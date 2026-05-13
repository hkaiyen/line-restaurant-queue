/**
 * LINE 餐廳候補位系統 - LIFF 頁面 API
 * 
 * 提供 LIFF 頁面所需的 API 端點
 * 包含：LIFF 初始化、使用者驗證、排隊操作、預約操作
 */

const express = require('express');
const router = express.Router();

// 載入依賴
const lineConfig = require('../../config/line');
const repositories = require('../../repositories');
const lineClient = require('./client');

// =====================================================
// 中介層：LIFF 驗證
// =====================================================

/**
 * LIFF 頁面驗證中介層
 * 驗證 LINE Access Token 並取得使用者資料
 */
async function liffAuth(req, res, next) {
    try {
        // 從 LIFF 取得的 ID Token（適用於 Vue 3 LINE Login SDK）
        // const liffToken = req.headers['x-liff-token'];
        
        // 從查詢參數取得 userId（由 LIFF 頁面傳入）
        const userId = req.query.userId || req.body.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: '未授權：無法取得使用者資料',
            });
        }

        // 查詢消費者資料
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            // 可選：自動建立消費者資料
            // const profile = await lineClient.getProfile(userId);
            // const newCustomer = await repositories.customerRepository.createCustomer({
            //     line_user_id: userId,
            //     display_name: profile.displayName,
            // });
            // req.customer = newCustomer;
            
            return res.status(404).json({
                success: false,
                error: '找不到消費者資料，請先加入 LINE 官方帳號',
            });
        }

        req.customer = customer;
        next();
    } catch (error) {
        console.error('❌ LIFF auth error:', error);
        res.status(500).json({
            success: false,
            error: '驗證失敗',
        });
    }
}

// =====================================================
// LIFF 資訊 API
// =====================================================

/**
 * GET /liff/info
 * 取得 LIFF 頁面基本資訊
 */
router.get('/info', (req, res) => {
    res.json({
        success: true,
        data: {
            liffVersion: '2.0',
            supportedScopes: ['openid', 'profile'],
            defaultLanguage: 'zh-TW',
        },
    });
});

// =====================================================
// 排隊相關 API
// =====================================================

/**
 * GET /liff/queue/status
 * 取得使用者的排隊狀態
 * 
 * 需帶入參數：
 * - userId: LINE User ID
 */
router.get('/queue/status', liffAuth, async (req, res) => {
    try {
        const { customer } = req;
        const { restaurantId } = req.query;

        // 如果有指定餐廳，查詢該餐廳的排隊狀態
        if (restaurantId) {
            const queueEntries = await repositories.queueRepository.getQueueListByRestaurant(
                restaurantId,
                'waiting'
            );

            const myEntry = queueEntries.find(entry => entry.customer_id === customer.id);

            if (!myEntry) {
                return res.json({
                    success: true,
                    data: {
                        inQueue: false,
                        message: '您不在此餐廳的排隊名單中',
                    },
                });
            }

            // 計算前方等候人數
            const position = queueEntries.filter(
                entry => entry.queue_number < myEntry.queue_number
            ).length + 1;

            // 取得餐廳資料
            const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);

            return res.json({
                success: true,
                data: {
                    inQueue: true,
                    queueEntry: {
                        id: myEntry.id,
                        queueNumber: myEntry.queue_number,
                        partySize: myEntry.party_size,
                        status: myEntry.status,
                        joinedAt: myEntry.joined_at,
                        position,
                        estimatedWaitMinutes: position * restaurant.avg_meal_duration_minutes,
                    },
                    restaurant: {
                        id: restaurant.id,
                        name: restaurant.name,
                        avgMealDuration: restaurant.avg_meal_duration_minutes,
                    },
                },
            });
        }

        // 查詢所有等待中的排隊
        // 這需要餐廳 ID，可從 customer 取得或顯示所有
        res.json({
            success: true,
            data: {
                customer: {
                    id: customer.id,
                    displayName: customer.display_name,
                },
                message: '請指定餐廳 ID 查詢排隊狀態',
            },
        });

    } catch (error) {
        console.error('❌ Get queue status error:', error);
        res.status(500).json({
            success: false,
            error: '查詢排隊狀態失敗',
        });
    }
});

/**
 * POST /liff/queue/join
 * 加入排隊
 * 
 * 請求 body：
 * - userId: LINE User ID
 * - restaurantId: 餐廳 ID
 * - partySize: 用餐人數
 * - notes: 備註（可選）
 */
router.post('/queue/join', liffAuth, async (req, res) => {
    try {
        const { customer } = req;
        const { restaurantId, partySize, notes } = req.body;

        if (!restaurantId || !partySize) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數：restaurantId, partySize',
            });
        }

        // 檢查是否已在排隊中
        const existingQueues = await repositories.queueRepository.getQueueListByRestaurant(
            restaurantId,
            'waiting'
        );

        const existingEntry = existingQueues.find(entry => entry.customer_id === customer.id);

        if (existingEntry) {
            return res.status(400).json({
                success: false,
                error: '您已在排隊中，請勿重複加入',
                existingEntry: {
                    id: existingEntry.id,
                    queueNumber: existingEntry.queue_number,
                    status: existingEntry.status,
                },
            });
        }

        // 檢查排隊人數是否已滿
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        const waitingCount = await repositories.queueRepository.getWaitingCount(restaurantId);

        if (waitingCount >= restaurant.queue_max_size) {
            return res.status(400).json({
                success: false,
                error: `很抱歉，${restaurant.name} 目前排隊人數已滿（${waitingCount}/${restaurant.queue_max_size}）`,
            });
        }

        // 加入排隊
        const queueEntry = await repositories.queueRepository.joinQueue({
            restaurant_id: restaurantId,
            customer_id: customer.id,
            party_size: parseInt(partySize, 10),
            notes: notes || null,
            source: 'walk_in',
        });

        // 計算前方等候人數
        const updatedQueues = await repositories.queueRepository.getQueueListByRestaurant(
            restaurantId,
            'waiting'
        );
        const position = updatedQueues.filter(
            entry => entry.queue_number < queueEntry.queue_number
        ).length + 1;

        // 發送 LINE 通知（可選）
        try {
            await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '✅ 排隊成功',
                contents: {
                    type: 'bubble',
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            { type: 'text', text: '✅ 排隊成功！', weight: 'bold' },
                            { type: 'text', text: `您的號碼：第 ${queueEntry.queue_number} 號` },
                            { type: 'text', text: `前方等候：${position - 1} 組` },
                        ],
                    },
                },
            });
        } catch (pushError) {
            console.warn('⚠️ Push notification failed:', pushError.message);
        }

        res.json({
            success: true,
            data: {
                queueEntry: {
                    id: queueEntry.id,
                    queueNumber: queueEntry.queue_number,
                    partySize: queueEntry.party_size,
                    status: queueEntry.status,
                    joinedAt: queueEntry.joined_at,
                    position,
                    estimatedWaitMinutes: position * restaurant.avg_meal_duration_minutes,
                },
                restaurant: {
                    id: restaurant.id,
                    name: restaurant.name,
                },
            },
        });

    } catch (error) {
        console.error('❌ Join queue error:', error);
        res.status(500).json({
            success: false,
            error: '加入排隊失敗',
        });
    }
});

/**
 * POST /liff/queue/cancel
 * 取消排隊
 * 
 * 請求 body：
 * - userId: LINE User ID
 * - queueEntryId: 排隊資料 ID
 */
router.post('/queue/cancel', liffAuth, async (req, res) => {
    try {
        const { customer } = req;
        const { queueEntryId } = req.body;

        if (!queueEntryId) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數：queueEntryId',
            });
        }

        // 確認這個排隊資料屬於這個消費者
        const queueEntry = await repositories.queueRepository.getQueueEntryById(queueEntryId);

        if (!queueEntry) {
            return res.status(404).json({
                success: false,
                error: '找不到排隊資料',
            });
        }

        if (queueEntry.customer_id !== customer.id) {
            return res.status(403).json({
                success: false,
                error: '您無權限取消此排隊',
            });
        }

        if (queueEntry.status !== 'waiting') {
            return res.status(400).json({
                success: false,
                error: '此排隊無法取消（狀態不是等待中）',
            });
        }

        // 取消排隊
        await repositories.queueRepository.cancelQueue(queueEntryId);

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
// 預約相關 API
// =====================================================

/**
 * GET /liff/reservation/my
 * 取得我的預約
 */
router.get('/reservation/my', liffAuth, async (req, res) => {
    try {
        const { customer } = req;

        const reservations = await repositories.reservationRepository.getUpcomingReservations(customer.id);

        res.json({
            success: true,
            data: {
                reservations: reservations.map(res => ({
                    id: res.id,
                    restaurantId: res.restaurant_id,
                    restaurantName: res.restaurant_name,
                    date: res.reservation_date,
                    time: res.reservation_time,
                    partySize: res.party_size,
                    status: res.status,
                    notes: res.notes,
                    createdAt: res.created_at,
                })),
            },
        });

    } catch (error) {
        console.error('❌ Get reservations error:', error);
        res.status(500).json({
            success: false,
            error: '查詢預約失敗',
        });
    }
});

/**
 * POST /liff/reservation/book
 * 建立預約
 * 
 * 請求 body：
 * - userId: LINE User ID
 * - restaurantId: 餐廳 ID
 * - date: 預約日期 (YYYY-MM-DD)
 * - time: 預約時間 (HH:MM)
 * - partySize: 用餐人數
 * - notes: 備註（可選）
 */
router.post('/reservation/book', liffAuth, async (req, res) => {
    try {
        const { customer } = req;
        const { restaurantId, date, time, partySize, notes } = req.body;

        if (!restaurantId || !date || !time || !partySize) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數：restaurantId, date, time, partySize',
            });
        }

        // 檢查餐廳是否存在
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                error: '找不到指定的餐廳',
            });
        }

        // 建立預約
        const reservation = await repositories.reservationRepository.createReservation({
            restaurant_id: restaurantId,
            customer_id: customer.id,
            reservation_date: date,
            reservation_time: time,
            party_size: parseInt(partySize, 10),
            notes: notes || null,
        });

        // 發送 LINE 通知（可選）
        try {
            await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '✅ 預約成功',
                contents: {
                    type: 'bubble',
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            { type: 'text', text: '✅ 預約成功！', weight: 'bold' },
                            { type: 'text', text: `餐廳：${restaurant.name}` },
                            { type: 'text', text: `日期：${date} ${time}` },
                            { type: 'text', text: `人數：${partySize} 人` },
                        ],
                    },
                },
            });
        } catch (pushError) {
            console.warn('⚠️ Push notification failed:', pushError.message);
        }

        res.json({
            success: true,
            data: {
                reservation: {
                    id: reservation.id,
                    restaurantId: reservation.restaurant_id,
                    restaurantName: restaurant.name,
                    date: reservation.reservation_date,
                    time: reservation.reservation_time,
                    partySize: reservation.party_size,
                    status: reservation.status,
                },
            },
        });

    } catch (error) {
        console.error('❌ Book reservation error:', error);
        res.status(500).json({
            success: false,
            error: '建立預約失敗',
        });
    }
});

/**
 * POST /liff/reservation/cancel
 * 取消預約
 */
router.post('/reservation/cancel', liffAuth, async (req, res) => {
    try {
        const { customer } = req;
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數：reservationId',
            });
        }

        // 確認預約存在且屬於此消費者
        const reservation = await repositories.reservationRepository.getReservationById(reservationId);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: '找不到預約資料',
            });
        }

        if (reservation.customer_id !== customer.id) {
            return res.status(403).json({
                success: false,
                error: '您無權限取消此預約',
            });
        }

        if (reservation.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: '此預約已經取消',
            });
        }

        // 取消預約
        await repositories.reservationRepository.cancelReservation(reservationId);

        res.json({
            success: true,
            message: '已取消預約',
        });

    } catch (error) {
        console.error('❌ Cancel reservation error:', error);
        res.status(500).json({
            success: false,
            error: '取消預約失敗',
        });
    }
});

// =====================================================
// 餐廳相關 API
// =====================================================

/**
 * GET /liff/restaurants
 * 取得餐廳列表
 */
router.get('/restaurants', async (req, res) => {
    try {
        const restaurants = await repositories.restaurantRepository.getAllRestaurants();

        res.json({
            success: true,
            data: {
                restaurants: restaurants.map(rest => ({
                    id: rest.id,
                    name: rest.name,
                    address: rest.address,
                    phone: rest.phone,
                    totalSeats: rest.total_seats,
                    avgMealDuration: rest.avg_meal_duration_minutes,
                    queueMaxSize: rest.queue_max_size,
                })),
            },
        });

    } catch (error) {
        console.error('❌ Get restaurants error:', error);
        res.status(500).json({
            success: false,
            error: '查詢餐廳列表失敗',
        });
    }
});

/**
 * GET /liff/restaurants/:id
 * 取得特定餐廳資料與排隊狀態
 */
router.get('/restaurants/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const restaurant = await repositories.restaurantRepository.getRestaurantById(id);

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                error: '找不到指定的餐廳',
            });
        }

        const waitingCount = await repositories.queueRepository.getWaitingCount(id);

        res.json({
            success: true,
            data: {
                restaurant: {
                    id: restaurant.id,
                    name: restaurant.name,
                    address: restaurant.address,
                    phone: restaurant.phone,
                    totalSeats: restaurant.total_seats,
                    avgMealDuration: restaurant.avg_meal_duration_minutes,
                    queueMaxSize: restaurant.queue_max_size,
                    currentWaiting: waitingCount,
                    availability: restaurant.queue_max_size - waitingCount,
                },
            },
        });

    } catch (error) {
        console.error('❌ Get restaurant error:', error);
        res.status(500).json({
            success: false,
            error: '查詢餐廳資料失敗',
        });
    }
});

module.exports = router;