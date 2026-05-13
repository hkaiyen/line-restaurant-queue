/**
 * LINE 餐廳候補位系統 - 餐廳端 API
 * 
 * 提供餐廳管理所需的 API
 * 包含：叫號、排隊名單管理、消費者通知等
 */

const express = require('express');
const router = express.Router();

const repositories = require('../repositories');
const lineClient = require('../line/client');
const flexMessages = require('../line/messages/flexMessages');

// =====================================================
// 叫號相關 API
// =====================================================

/**
 * POST /api/queue/call-next
 * 叫下一位
 */
router.post('/queue/call-next', async (req, res) => {
    try {
        const { restaurantId } = req.body;

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                error: '缺少 restaurantId',
            });
        }

        // 叫下一位
        const queueEntry = await repositories.queueRepository.callNext(restaurantId);

        if (!queueEntry) {
            return res.json({
                success: true,
                message: '目前沒有排隊中的消費者',
                called: false,
            });
        }

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customer_id);

        // 發送 LINE 通知
        if (customer && customer.line_user_id) {
            try {
                await lineClient.pushMessage(customer.line_user_id, flexMessages.createCalledFlex(queueEntry));

                // 記錄通知
                await repositories.notificationRepository.createNotification({
                    restaurant_id: restaurantId,
                    customer_id: customer.id,
                    queue_entry_id: queueEntry.id,
                    notification_type: 'queue_called',
                    status: 'sent',
                });
            } catch (pushError) {
                console.error('❌ Push notification failed:', pushError.message);
            }
        }

        res.json({
            success: true,
            called: true,
            queueEntry: {
                id: queueEntry.id,
                queueNumber: queueEntry.queue_number,
                partySize: queueEntry.party_size,
                customerName: customer?.display_name || '未知',
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

/**
 * POST /api/queue/call-specific
 * 叫指定號碼
 */
router.post('/queue/call-specific', async (req, res) => {
    try {
        const { restaurantId, queueNumber } = req.body;

        if (!restaurantId || !queueNumber) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數',
            });
        }

        // 叫指定號碼
        const queueEntry = await repositories.queueRepository.callSpecific(restaurantId, queueNumber);

        if (!queueEntry) {
            return res.status(404).json({
                success: false,
                error: '找不到指定的排隊號碼',
            });
        }

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customer_id);

        // 發送 LINE 通知
        if (customer && customer.line_user_id) {
            try {
                await lineClient.pushMessage(customer.line_user_id, flexMessages.createCalledFlex(queueEntry));
            } catch (pushError) {
                console.error('❌ Push notification failed:', pushError.message);
            }
        }

        res.json({
            success: true,
            queueEntry: {
                id: queueEntry.id,
                queueNumber: queueEntry.queue_number,
                partySize: queueEntry.party_size,
                customerName: customer?.display_name || '未知',
            },
        });

    } catch (error) {
        console.error('❌ Call specific error:', error);
        res.status(500).json({
            success: false,
            error: '叫號失敗',
        });
    }
});

/**
 * POST /api/queue/mark-served
 * 標記入座
 */
router.post('/queue/mark-served', async (req, res) => {
    try {
        const { queueEntryId } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少 queueEntryId',
            });
        }

        await repositories.queueRepository.markAsServed(queueEntryId);

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

/**
 * POST /api/queue/mark-no-show
 * 標記過號
 */
router.post('/queue/mark-no-show', async (req, res) => {
    try {
        const { queueEntryId } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少 queueEntryId',
            });
        }

        await repositories.queueRepository.markAsNoShow(queueEntryId);

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

/**
 * POST /api/queue/cancel
 * 取消排隊（餐廳端）
 */
router.post('/queue/cancel', async (req, res) => {
    try {
        const { queueEntryId, reason } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少 queueEntryId',
            });
        }

        const queueEntry = await repositories.queueRepository.getQueueEntryById(queueEntryId);

        if (!queueEntry) {
            return res.status(404).json({
                success: false,
                error: '找不到排隊資料',
            });
        }

        // 取消排隊
        await repositories.queueRepository.cancelQueue(queueEntryId);

        // 通知消費者（可選）
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customer_id);

        if (customer && customer.line_user_id) {
            try {
                await lineClient.pushMessage(customer.line_user_id, {
                    type: 'text',
                    text: `⚠️ 您的排隊（號碼：${queueEntry.queue_number}）已被餐廳取消${reason ? `：${reason}` : ''}。如有疑問請聯繫餐廳。`,
                });
            } catch (pushError) {
                console.error('❌ Push notification failed:', pushError.message);
            }
        }

        res.json({
            success: true,
            message: '已取消排隊',
        });

    } catch (error) {
        console.error('❌ Cancel queue error:', error);
        res.status(500).json({
            success: false,
            error: '取消排隊失敗',
        });
    }
});

// =====================================================
// 排隊名單 API
// =====================================================

/**
 * GET /api/queue/list/:restaurantId
 * 取得排隊名單
 */
router.get('/queue/list/:restaurantId', async (req, res) => {
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

/**
 * GET /api/queue/stats/:restaurantId
 * 取得排隊統計
 */
router.get('/queue/stats/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const waitingCount = await repositories.queueRepository.getWaitingCount(restaurantId);
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);

        res.json({
            success: true,
            data: {
                restaurantId,
                restaurantName: restaurant?.name,
                currentWaiting: waitingCount,
                maxCapacity: restaurant?.queue_max_size || 0,
                availability: (restaurant?.queue_max_size || 0) - waitingCount,
                avgMealDuration: restaurant?.avg_meal_duration_minutes || 0,
                estimatedWaitMinutes: waitingCount * (restaurant?.avg_meal_duration_minutes || 30),
            },
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
// 預約管理 API
// =====================================================

/**
 * GET /api/reservations/:restaurantId
 * 取得餐廳的預約列表
 */
router.get('/reservations/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { date } = req.query;

        let reservations;

        if (date) {
            reservations = await repositories.reservationRepository.getReservationsByRestaurantAndDate(
                restaurantId,
                date
            );
        } else {
            // 取得未來一週的預約
            reservations = [];
            const today = new Date();
            for (let i = 0; i < 7; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);
                const dateStr = checkDate.toISOString().split('T')[0];
                const dayReservations = await repositories.reservationRepository.getReservationsByRestaurantAndDate(
                    restaurantId,
                    dateStr
                );
                reservations.push(...dayReservations);
            }
        }

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

/**
 * POST /api/reservations/mark-seated
 * 標記已入座
 */
router.post('/reservations/mark-seated', async (req, res) => {
    try {
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({
                success: false,
                error: '缺少 reservationId',
            });
        }

        await repositories.reservationRepository.markAsSeated(reservationId);

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

/**
 * POST /api/reservations/mark-no-show
 * 標記過號
 */
router.post('/reservations/mark-no-show', async (req, res) => {
    try {
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({
                success: false,
                error: '缺少 reservationId',
            });
        }

        await repositories.reservationRepository.markAsNoShow(reservationId);

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
// 通知記錄 API
// =====================================================

/**
 * GET /api/notifications/:restaurantId
 * 取得通知歷史
 */
router.get('/notifications/:restaurantId', async (req, res) => {
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

module.exports = router;