/**
 * LINE 餐廳候補位系統 - 路由整合模組
 * 
 * 整合所有路由，包括 LIFF 頁面路由和 API 路由
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// 載入服務層
const { queueService, reservationService, notificationService } = require('../services');

// 載入 Repository（用於需要直接存取的場景）
const repositories = require('../repositories');

// 載入 Flex Messages
const flexMessages = require('../line/messages/flexMessages');

// =====================================================
// LIFF 頁面路由（提供靜態 HTML）
// =====================================================

/**
 * 加入排隊頁面
 */
router.get('/liff/queue/join', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/liff/queue/join.html'));
});

/**
 * 排隊進度頁面
 */
router.get('/liff/queue/status', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/liff/queue/status.html'));
});

/**
 * 預約頁面
 */
router.get('/liff/reservation/book', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/liff/reservation/book.html'));
});

/**
 * 我的預約頁面
 */
router.get('/liff/reservation/my', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/liff/reservation/my.html'));
});

// =====================================================
// 餐廳管理後台路由
// =====================================================

/**
 * 餐廳管理後台首頁
 */
router.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

/**
 * 餐廳設定頁面（可擴展）
 */
router.get('/admin/settings', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

// =====================================================
// API 路由（使用服務層）
// =====================================================

// 叫號 API
router.post('/api/queue/call-next', async (req, res) => {
    try {
        const { restaurantId } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                error: '缺少 restaurantId',
            });
        }

        const result = await queueService.callNext(restaurantId);

        if (!result) {
            return res.json({
                success: true,
                message: '目前沒有排隊中的消費者',
                called: false,
            });
        }

        res.json({
            success: true,
            called: true,
            queueEntry: {
                id: result.queueEntry.id,
                queueNumber: result.queueEntry.queue_number,
                partySize: result.queueEntry.party_size,
                customerName: result.customer?.display_name || '未知',
            },
        });
    } catch (error) {
        console.error('❌ Call next error:', error);
        res.status(500).json({
            success: false,
            error: '叫號失敗',
        });
    }
});

router.post('/api/queue/call-specific', async (req, res) => {
    try {
        const { restaurantId, queueNumber } = req.body;

        if (!restaurantId || !queueNumber) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數',
            });
        }

        const result = await queueService.callSpecific(restaurantId, parseInt(queueNumber, 10));

        res.json({
            success: true,
            queueEntry: {
                id: result.queueEntry.id,
                queueNumber: result.queueEntry.queue_number,
                partySize: result.queueEntry.party_size,
                customerName: result.customer?.display_name || '未知',
            },
        });
    } catch (error) {
        console.error('❌ Call specific error:', error);
        res.status(500).json({
            success: false,
            error: error.message || '叫號失敗',
        });
    }
});

router.post('/api/queue/mark-served', async (req, res) => {
    try {
        const { queueEntryId } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少 queueEntryId',
            });
        }

        await queueService.markAsServed(queueEntryId);

        res.json({
            success: true,
            message: '已標記入座',
        });
    } catch (error) {
        console.error('❌ Mark served error:', error);
        res.status(500).json({
            success: false,
            error: '標記入座失敗',
        });
    }
});

router.post('/api/queue/mark-no-show', async (req, res) => {
    try {
        const { queueEntryId } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少 queueEntryId',
            });
        }

        await queueService.markAsNoShow(queueEntryId);

        res.json({
            success: true,
            message: '已標記過號',
        });
    } catch (error) {
        console.error('❌ Mark no-show error:', error);
        res.status(500).json({
            success: false,
            error: '標記過號失敗',
        });
    }
});

// 排隊名單 API
router.get('/api/queue/list/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { status } = req.query;

        const queueList = await repositories.queueRepository.getQueueListByRestaurant(
            restaurantId,
            status || null
        );

        // 取得消費者名稱
        const enrichedList = await Promise.all(
            queueList.map(async (entry) => {
                const customer = await repositories.customerRepository.getCustomerById(entry.customer_id);
                return {
                    ...entry,
                    customerName: customer?.display_name || '未知',
                };
            })
        );

        res.json({
            success: true,
            data: {
                queueList: enrichedList,
                total: enrichedList.length,
                waiting: enrichedList.filter(e => e.status === 'waiting').length,
                called: enrichedList.filter(e => e.status === 'called').length,
            },
        });
    } catch (error) {
        console.error('❌ Get queue list error:', error);
        res.status(500).json({
            success: false,
            error: '取得排隊名單失敗',
        });
    }
});

router.get('/api/queue/stats/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const stats = await queueService.getQueueStats(restaurantId);

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('❌ Get queue stats error:', error);
        res.status(500).json({
            success: false,
            error: '取得排隊統計失敗',
        });
    }
});

// =====================================================
// 預約 API
// =====================================================

router.get('/api/reservations/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { date } = req.query;

        const reservations = await reservationService.getReservationsByRestaurant(restaurantId, date);

        // 取得消費者名稱
        const enrichedList = await Promise.all(
            reservations.map(async (res) => {
                const customer = await repositories.customerRepository.getCustomerById(res.customer_id);
                return {
                    ...res,
                    customerName: customer?.display_name || '未知',
                    customerPhone: customer?.phone,
                };
            })
        );

        res.json({
            success: true,
            data: {
                reservations: enrichedList,
                total: enrichedList.length,
            },
        });
    } catch (error) {
        console.error('❌ Get reservations error:', error);
        res.status(500).json({
            success: false,
            error: '取得預約列表失敗',
        });
    }
});

router.post('/api/reservations/mark-seated', async (req, res) => {
    try {
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({
                success: false,
                error: '缺少 reservationId',
            });
        }

        await reservationService.markAsSeated(reservationId);

        res.json({
            success: true,
            message: '已標記已入座',
        });
    } catch (error) {
        console.error('❌ Mark seated error:', error);
        res.status(500).json({
            success: false,
            error: '標記失敗',
        });
    }
});

router.post('/api/reservations/mark-no-show', async (req, res) => {
    try {
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({
                success: false,
                error: '缺少 reservationId',
            });
        }

        await reservationService.markAsNoShow(reservationId);

        res.json({
            success: true,
            message: '已標記過號',
        });
    } catch (error) {
        console.error('❌ Mark no-show error:', error);
        res.status(500).json({
            success: false,
            error: '標記失敗',
        });
    }
});

// =====================================================
// 餐廳排隊管理 API
// =====================================================

// 取得排隊名單
router.get('/api/restaurants/:id/queue', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;

        const restaurant = await repositories.restaurantRepository.getRestaurantById(id);
        if (!restaurant) {
            return res.status(404).json({ success: false, error: '找不到餐廳' });
        }

        const queueList = await repositories.queueRepository.getQueueListByRestaurant(
            id,
            status || 'waiting'
        );

        // 取得消費者名稱
        const enrichedList = await Promise.all(
            queueList.map(async (entry) => {
                const customer = await repositories.customerRepository.getCustomerById(entry.customerId || entry.customer_id);
                return {
                    id: entry.id,
                    queueNumber: entry.queueNumber || entry.queue_number,
                    partySize: entry.partySize || entry.party_size,
                    status: entry.status,
                    joinedAt: entry.joinedAt || entry.joined_at,
                    calledAt: entry.calledAt || entry.called_at,
                    customerName: customer?.displayName || customer?.display_name || '未知',
                    customerPhone: customer?.phone || null,
                };
            })
        );

        res.json({
            success: true,
            data: {
                restaurantId: id,
                restaurantName: restaurant.name,
                queueList: enrichedList,
                total: enrichedList.length,
                waiting: enrichedList.filter(e => e.status === 'waiting').length,
                called: enrichedList.filter(e => e.status === 'called').length,
            },
        });
    } catch (error) {
        console.error('❌ Get restaurant queue error:', error);
        res.status(500).json({ success: false, error: '取得排隊名單失敗' });
    }
});

// 叫下一位
router.post('/api/restaurants/:id/call-next', async (req, res) => {
    try {
        const { id } = req.params;


        const restaurant = await repositories.restaurantRepository.getRestaurantById(id);
        if (!restaurant) {
            return res.status(404).json({ success: false, error: '找不到餐廳' });
        }

        const queueEntry = await repositories.queueRepository.callNext(id);
        if (!queueEntry) {
            return res.json({
                success: true,
                called: false,
                message: '目前沒有排隊中的消費者',
            });
        }

        // 發送 LINE 通知
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customerId || queueEntry.customer_id);
        if (customer?.lineUserId) {
            try {
                const lineConfig = require('../../../config/line');
                const LINE_API_BASE = 'https://api.line.me/v2';
                const accessToken = lineConfig.messagingApi.accessToken;
                if (accessToken) {
                    await fetch(`${LINE_API_BASE}/bot/message/push`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            to: customer.lineUserId,
                            messages: [{
                                type: 'flex',
                                altText: '🎉 輪到您了！',
                                contents: flexMessages.createCalledFlex({
                                    ...queueEntry,
                                    restaurantName: restaurant.name,
                                }),
                            }],
                        }),
                    });
                }
            } catch (notifyError) {
                console.warn('⚠️ 發送叫號通知失敗：', notifyError.message);
            }
        }

        res.json({
            success: true,
            called: true,
            queueEntry: {
                id: queueEntry.id,
                queueNumber: queueEntry.queueNumber || queueEntry.queue_number,
                partySize: queueEntry.partySize || queueEntry.party_size,
                customerName: customer?.displayName || customer?.display_name || '未知',
            },
        });
    } catch (error) {
        console.error('❌ Call next error:', error);
        res.status(500).json({ success: false, error: '叫號失敗' });
    }
});

// 取消特定排隊
router.post('/api/restaurants/:id/queue/:entryId/cancel', async (req, res) => {
    try {
        const { id, entryId } = req.params;

        const restaurant = await repositories.restaurantRepository.getRestaurantById(id);
        if (!restaurant) {
            return res.status(404).json({ success: false, error: '找不到餐廳' });
        }

        const queueEntry = await repositories.queueRepository.cancelQueue(entryId);
        if (!queueEntry) {
            return res.status(404).json({ success: false, error: '找不到排隊資料或無法取消' });
        }

        res.json({
            success: true,
            message: '已成功取消排隊',
            queueEntry: {
                id: queueEntry.id,
                queueNumber: queueEntry.queueNumber || queueEntry.queue_number,
            },
        });
    } catch (error) {
        console.error('❌ Cancel queue error:', error);
        res.status(500).json({ success: false, error: '取消排隊失敗' });
    }
});

// =====================================================
// 通知 API
// =====================================================

router.get('/api/notifications/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { limit = 50 } = req.query;

        const notifications = await repositories.notificationRepository.getNotificationsByRestaurant(
            restaurantId,
            parseInt(limit, 10)
        );

        res.json({
            success: true,
            data: {
                notifications,
                total: notifications.length,
            },
        });
    } catch (error) {
        console.error('❌ Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: '取得通知歷史失敗',
        });
    }
});

// =====================================================
// 匯出
// =====================================================


module.exports = router;