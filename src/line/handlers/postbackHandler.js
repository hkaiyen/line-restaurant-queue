/**
 * LINE 餐廳候補位系統 - Postback 事件處理器
 * 
 * 處理使用者點擊按鈕、Carousel 等元件所觸發的 postback 事件
 * postback 可以攜帶自訂資料（data 參數）
 */

const lineConfig = require('../../../config/line');

// =====================================================
// Postback 動作類型
// =====================================================

const PostbackActions = {
    // 排隊相關
    JOIN_QUEUE: 'join_queue',
    SHOW_QUEUE_STATUS: 'show_queue_status',
    CANCEL_QUEUE: 'cancel_queue',
    
    // 預約相關
    BOOK_RESERVATION: 'book_reservation',
    SHOW_RESERVATION: 'show_reservation',
    CANCEL_RESERVATION: 'cancel_reservation',
    
    // 餐廳選擇
    SELECT_RESTAURANT: 'select_restaurant',
    
    // 人數選擇
    SELECT_PARTY_SIZE: 'select_party_size',
    
    // 操作確認
    CONFIRM_ACTION: 'confirm_action',
    CANCEL_ACTION: 'cancel_action',
    
    // 分頁
    NEXT_PAGE: 'next_page',
    PREV_PAGE: 'prev_page',
};

/**
 * 解析 postback data
 * 將 URL-encoded 格式轉換為物件
 * 
 * @param {string} data - postback data 字串
 * @returns {object} 解析後的物件
 */
function parsePostbackData(data) {
    if (!data) return {};
    
    const params = new URLSearchParams(data);
    const result = {};
    
    for (const [key, value] of params) {
        // 嘗試解析 JSON
        try {
            result[key] = JSON.parse(value);
        } catch {
            result[key] = value;
        }
    }
    
    return result;
}

/**
 * 處理 postback 事件
 * 
 * @param {object} event - LINE Webhook 事件
 * @param {object} dependencies - 依賴注入
 */
async function handlePostback(event, { lineClient, repositories, flexMessages }) {
    const { postback, source, replyToken } = event;
    const userId = source?.userId;

    if (!userId) {
        console.warn('⚠️ Postback without userId');
        return;
    }

    // 解析 postback data
    const params = parsePostbackData(postback?.data);
    const action = params.action;

    console.log(`🔘 Postback action: ${action}`, params);

    switch (action) {
        // ========== 排隊相關 ==========
        case PostbackActions.JOIN_QUEUE:
            await handleJoinQueue(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        case PostbackActions.SHOW_QUEUE_STATUS:
            await handleShowQueueStatus(userId, replyToken, { lineClient, repositories, flexMessages });
            break;

        case PostbackActions.CANCEL_QUEUE:
            await handleCancelQueue(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        // ========== 預約相關 ==========
        case PostbackActions.BOOK_RESERVATION:
            await handleBookReservation(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        case PostbackActions.SHOW_RESERVATION:
            await handleShowReservation(userId, replyToken, { lineClient, repositories, flexMessages });
            break;

        case PostbackActions.CANCEL_RESERVATION:
            await handleCancelReservation(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        // ========== 餐廳選擇 ==========
        case PostbackActions.SELECT_RESTAURANT:
            await handleSelectRestaurant(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        // ========== 人數選擇 ==========
        case PostbackActions.SELECT_PARTY_SIZE:
            await handleSelectPartySize(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        // ========== 操作確認 ==========
        case PostbackActions.CONFIRM_ACTION:
            await handleConfirmAction(userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        case PostbackActions.CANCEL_ACTION:
            await handleCancelAction(userId, replyToken, { lineClient, flexMessages });
            break;

        // ========== 分頁 ==========
        case PostbackActions.NEXT_PAGE:
        case PostbackActions.PREV_PAGE:
            await handlePagination(action, userId, params, replyToken, { lineClient, repositories, flexMessages });
            break;

        default:
            console.log(`⚠️ Unknown postback action: ${action}`);
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '⚠️ 收到未知的操作請求，請透過選單操作。',
            });
    }
}

// =====================================================
// 個別動作處理函數
// =====================================================

/**
 * 處理加入排隊
 */
async function handleJoinQueue(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            // 如果找不到消費者，可能是第一次使用
            // 引導至 LIFF 頁面進行註冊
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 檢查是否已在排隊中
        const queueEntries = await repositories.queueRepository.getQueueListByRestaurant(
            params.restaurantId,
            'waiting'
        );

        const existingEntry = queueEntries.find(entry => entry.customer_id === customer.id);

        if (existingEntry) {
            // 已在排隊中，顯示現有排隊資料
            await lineClient.replyMessage(replyToken, flexMessages.createQueueStatusFlex({
                queueNumber: existingEntry.queue_number,
                position: queueEntries.filter(e => e.queue_number < existingEntry.queue_number).length + 1,
                partySize: existingEntry.party_size,
                joinedAt: existingEntry.joined_at,
            }));
            return;
        }

        // 檢查排隊人數是否已滿
        const restaurant = await repositories.restaurantRepository.getRestaurantById(params.restaurantId);
        const waitingCount = await repositories.queueRepository.getWaitingCount(params.restaurantId);

        if (waitingCount >= restaurant.queue_max_size) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: `⚠️ 很抱歉，${restaurant.name} 目前排隊人數已滿（${waitingCount}/${restaurant.queue_max_size}），請稍後再嘗試或選擇其他時段。`,
            });
            return;
        }

        // 確認是否要加入排隊
        await lineClient.replyMessage(replyToken, flexMessages.createConfirmJoinQueueFlex({
            restaurantId: params.restaurantId,
            restaurantName: restaurant.name,
            partySize: params.partySize || 2,
        }));

    } catch (error) {
        console.error('❌ handleJoinQueue error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 加入排隊失敗，請稍後再試。',
        });
    }
}

/**
 * 處理顯示排隊狀態
 */
async function handleShowQueueStatus(userId, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 找尋該使用者的排隊資料（所有狀態）
        // 這裡需要實作查詢消費者所有排隊記錄的功能
        const allQueues = await repositories.queueRepository.getQueueListByRestaurant(
            customer.restaurant_id,
            null // 不限狀態
        );

        const myEntry = allQueues.find(entry => entry.customer_id === customer.id);

        if (!myEntry) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '🔍 您目前沒有排隊記錄。輸入「加入排隊」開始排隊！',
            });
            return;
        }

        // 根據狀態顯示不同訊息
        switch (myEntry.status) {
            case 'waiting':
                const waitingQueues = await repositories.queueRepository.getQueueListByRestaurant(
                    myEntry.restaurant_id,
                    'waiting'
                );
                const position = waitingQueues.filter(e => e.queue_number < myEntry.queue_number).length + 1;

                await lineClient.replyMessage(replyToken, flexMessages.createQueueStatusFlex({
                    queueNumber: myEntry.queue_number,
                    position,
                    partySize: myEntry.party_size,
                    joinedAt: myEntry.joined_at,
                }));
                break;

            case 'called':
                await lineClient.replyMessage(replyToken, flexMessages.createCalledFlex(myEntry));
                break;

            case 'served':
                await lineClient.replyMessage(replyToken, {
                    type: 'text',
                    text: `✅ 您已入座（號碼：${myEntry.queue_number}）。祝您用餐愉快！`,
                });
                break;

            default:
                await lineClient.replyMessage(replyToken, {
                    type: 'text',
                    text: `ℹ️ 您的排隊狀態：${myEntry.status}`,
                });
        }

    } catch (error) {
        console.error('❌ handleShowQueueStatus error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 查詢排隊狀態失敗，請稍後再試。',
        });
    }
}

/**
 * 處理取消排隊
 */
async function handleCancelQueue(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 從 params 取得 queueEntryId 或查詢
        const queueEntryId = params.queueEntryId;
        
        if (!queueEntryId) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '⚠️ 無法取得排隊資料，請稍後再試。',
            });
            return;
        }

        // 確認取消
        await lineClient.replyMessage(replyToken, flexMessages.createConfirmCancelQueueFlex({
            queueEntryId,
            queueNumber: params.queueNumber,
        }));

    } catch (error) {
        console.error('❌ handleCancelQueue error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 取消排隊失敗，請稍後再試。',
        });
    }
}

/**
 * 處理預約
 */
async function handleBookReservation(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 顯示預約表單（LIFF 頁面）
        const liffUrl = lineConfig.liff.apps.bookReservation.url;
        
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: `📅 請填寫預約資料：\n${liffUrl}`,
        });

    } catch (error) {
        console.error('❌ handleBookReservation error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 載入預約頁面失敗，請稍後再試。',
        });
    }
}

/**
 * 處理顯示預約
 */
async function handleShowReservation(userId, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        const reservations = await repositories.reservationRepository.getUpcomingReservations(customer.id);

        if (reservations.length === 0) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '📅 您目前沒有預約。輸入「預約」進行線上預約！',
            });
            return;
        }

        await lineClient.replyMessage(replyToken, flexMessages.createReservationListFlex(reservations));

    } catch (error) {
        console.error('❌ handleShowReservation error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 查詢預約失敗，請稍後再試。',
        });
    }
}

/**
 * 處理取消預約
 */
async function handleCancelReservation(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 確認取消
        await lineClient.replyMessage(replyToken, flexMessages.createConfirmCancelReservationFlex({
            reservationId: params.reservationId,
            reservationDate: params.reservationDate,
            reservationTime: params.reservationTime,
        }));

    } catch (error) {
        console.error('❌ handleCancelReservation error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 取消預約失敗，請稍後再試。',
        });
    }
}

/**
 * 處理餐廳選擇
 */
async function handleSelectRestaurant(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const restaurantId = params.restaurantId;
        
        // 取得餐廳資料
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        
        if (!restaurant) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '⚠️ 找不到指定的餐廳。',
            });
            return;
        }

        // 顯示人數選擇
        await lineClient.replyMessage(replyToken, flexMessages.createPartySizeSelectionFlex({
            restaurantId,
            restaurantName: restaurant.name,
        }));

    } catch (error) {
        console.error('❌ handleSelectRestaurant error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 載入餐廳資料失敗，請稍後再試。',
        });
    }
}

/**
 * 處理人數選擇
 */
async function handleSelectPartySize(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        const { restaurantId, partySize } = params;

        // 檢查排隊人數是否已滿
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        const waitingCount = await repositories.queueRepository.getWaitingCount(restaurantId);

        if (waitingCount >= restaurant.queue_max_size) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: `⚠️ 很抱歉，${restaurant.name} 目前排隊人數已滿（${waitingCount}/${restaurant.queue_max_size}），請稍後再嘗試。`,
            });
            return;
        }

        // 確認加入排隊
        await lineClient.replyMessage(replyToken, flexMessages.createConfirmJoinQueueFlex({
            restaurantId,
            restaurantName: restaurant.name,
            partySize: parseInt(partySize),
        }));

    } catch (error) {
        console.error('❌ handleSelectPartySize error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 選擇人數失敗，請稍後再試。',
        });
    }
}

/**
 * 處理操作確認
 */
async function handleConfirmAction(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    const { actionType, ...actionParams } = params;

    try {
        switch (actionType) {
            case 'confirm_join_queue':
                await confirmJoinQueue(userId, actionParams, replyToken, { lineClient, repositories, flexMessages });
                break;

            case 'confirm_cancel_queue':
                await confirmCancelQueue(userId, actionParams, replyToken, { lineClient, repositories, flexMessages });
                break;

            case 'confirm_cancel_reservation':
                await confirmCancelReservation(userId, actionParams, replyToken, { lineClient, repositories, flexMessages });
                break;

            default:
                await lineClient.replyMessage(replyToken, {
                    type: 'text',
                    text: '⚠️ 未知的確認動作。',
                });
        }

    } catch (error) {
        console.error('❌ handleConfirmAction error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 確認操作失敗，請稍後再試。',
        });
    }
}

/**
 * 處理取消動作
 */
async function handleCancelAction(userId, replyToken, { lineClient, flexMessages }) {
    await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: 'ℹ️ 已取消操作。如需其他服務，請使用選單或輸入關鍵字。',
    });
}

/**
 * 處理分頁
 */
async function handlePagination(action, userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    const { page, type } = params;

    // 目前先簡單回應，後續可實作完整分頁
    await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: `ℹ️ ${action === PostbackActions.NEXT_PAGE ? '下一頁' : '上一頁'}功能持續開發中。`,
    });
}

// =====================================================
// 輔助函數：確認加入排隊
// =====================================================

async function confirmJoinQueue(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    const { restaurantId, partySize, notes } = params;
    const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);

    if (!customer) {
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 找不到您的資料，請重新加入官方帳號。',
        });
        return;
    }

    try {
        // 加入排隊
        const queueEntry = await repositories.queueRepository.joinQueue({
            restaurant_id: restaurantId,
            customer_id: customer.id,
            party_size: parseInt(partySize),
            notes: notes || null,
            source: 'walk_in',
        });

        // 取得餐廳資料
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);

        // 計算前方等候人數
        const waitingQueues = await repositories.queueRepository.getQueueListByRestaurant(restaurantId, 'waiting');
        const position = waitingQueues.filter(e => e.queue_number < queueEntry.queue_number).length + 1;

        // 發送成功訊息
        await lineClient.replyMessage(replyToken, flexMessages.createQueueJoinedFlex({
            queueNumber: queueEntry.queue_number,
            restaurantName: restaurant.name,
            position,
            partySize: parseInt(partySize),
        }));

    } catch (error) {
        console.error('❌ confirmJoinQueue error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 加入排隊失敗，請稍後再試。',
        });
    }
}

// =====================================================
// 輔助函數：確認取消排隊
// =====================================================

async function confirmCancelQueue(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    const { queueEntryId } = params;

    try {
        await repositories.queueRepository.cancelQueue(queueEntryId);

        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '✅ 已取消排隊。如需重新排隊，請輸入「加入排隊」。',
        });

    } catch (error) {
        console.error('❌ confirmCancelQueue error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 取消排隊失敗，請稍後再試。',
        });
    }
}

// =====================================================
// 輔助函數：確認取消預約
// =====================================================

async function confirmCancelReservation(userId, params, replyToken, { lineClient, repositories, flexMessages }) {
    const { reservationId } = params;

    try {
        await repositories.reservationRepository.cancelReservation(reservationId);

        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '✅ 已取消預約。如需重新預約，請輸入「預約」。',
        });

    } catch (error) {
        console.error('❌ confirmCancelReservation error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 取消預約失敗，請稍後再試。',
        });
    }
}

// =====================================================
// 匯出
// =====================================================

module.exports = {
    handlePostback,
    parsePostbackData,
    PostbackActions,
};