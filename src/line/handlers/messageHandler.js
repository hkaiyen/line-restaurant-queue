/**
 * LINE 餐廳候補位系統 - 訊息事件處理器
 * 
 * 處理使用者傳送的各種訊息類型
 * 支援：文字、圖片、位置、貼圖等
 */

const lineConfig = require('../../../config/line');

// =====================================================
// 關鍵字回應設定
// =====================================================

// 關鍵字對應回應動作
const keywordActions = {
    // 加入排隊相關
    '加入排隊': { action: 'showJoinQueue' },
    '排隊': { action: 'showJoinQueue' },
    '排隊中': { action: 'showQueueStatus' },
    '我的排隊': { action: 'showQueueStatus' },
    
    // 預約相關
    '預約': { action: 'showReservation' },
    '線上預約': { action: 'showReservation' },
    '我的預約': { action: 'showMyReservation' },
    
    // 查詢相關
    '現在幾號': { action: 'showQueueStatus' },
    '排隊進度': { action: 'showQueueProgress' },
    '前方等待': { action: 'showQueuePosition' },
    
    // 取消相關
    '取消排隊': { action: 'cancelQueue' },
    '取消預約': { action: 'cancelReservation' },
    
    // 幫助
    '幫助': { action: 'showHelp' },
    'help': { action: 'showHelp' },
    '?': { action: 'showHelp' },
    
    // 示範用（開發環境）
    '測試': { action: 'test' },
    'test': { action: 'test' },
};

// =====================================================
// 訊息處理主函數
// =====================================================

/**
 * 處理訊息事件
 * 
 * @param {object} event - LINE 訊息事件
 * @param {object} dependencies - 依賴注入
 */
async function handleMessage(event, { lineClient, repositories, flexMessages }) {
    const { message, source, replyToken } = event;
    
    // 忽略來自 Group 或 Room 的訊息（可依需求調整）
    if (source.type !== 'user') {
        console.log('⚠️ Ignoring non-user message');
        return;
    }

    const userId = source.userId;

    switch (message.type) {
        case 'text':
            await handleTextMessage(userId, message.text, replyToken, { lineClient, repositories, flexMessages });
            break;

        case 'image':
            // 圖片訊息（目前不處理，可留作未來擴展）
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '收到圖片了！目前圖片功能尚未開放，請使用文字訊息操作。',
            });
            break;

        case 'video':
        case 'audio':
        case 'file':
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: `收到您的${message.type}了！目前檔案功能尚未開放，請使用文字訊息操作。`,
            });
            break;

        case 'location':
            // 位置訊息（可用於餐廳定位功能）
            console.log(`📍 Location received: ${message.latitude}, ${message.longitude}`);
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: `收到您的位置資訊！緯度：${message.latitude}，經度：${message.longitude}`,
            });
            break;

        case 'sticker':
            // 貼圖（單純回應）
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '收到您的貼圖了！',
            });
            break;

        default:
            console.log(`⚠️ Unknown message type: ${message.type}`);
    }
}

/**
 * 處理文字訊息
 * 
 * @param {string} userId - LINE User ID
 * @param {string} text - 訊息文字
 * @param {string} replyToken - 回覆權杖
 * @param {object} dependencies - 依賴
 */
async function handleTextMessage(userId, text, replyToken, { lineClient, repositories, flexMessages }) {
    const normalizedText = text.trim().toLowerCase();
    
    // 查詢對應的關鍵字動作
    const action = keywordActions[normalizedText] || keywordActions[text];

    if (action) {
        await executeAction(action.action, userId, replyToken, { lineClient, repositories, flexMessages });
    } else {
        // 無匹配的關鍵字，顯示預設選單
        await showDefaultMenu(replyToken, { lineClient, flexMessages });
    }
}

// =====================================================
// 動作執行函數
// =====================================================

/**
 * 執行對應動作
 * 
 * @param {string} action - 動作名稱
 * @param {string} userId - LINE User ID
 * @param {string} replyToken - 回覆權杖
 * @param {object} dependencies - 依賴
 */
async function executeAction(action, userId, replyToken, { lineClient, repositories, flexMessages }) {
    switch (action) {
        case 'showJoinQueue':
            // 顯示加入排隊說明與按鈕
            await lineClient.replyMessage(replyToken, flexMessages.createJoinQueueFlex());
            break;

        case 'showQueueStatus':
            // 顯示排隊狀態
            await showQueueStatus(userId, replyToken, { lineClient, repositories, flexMessages });
            break;

        case 'showReservation':
            // 顯示線上預約說明與按鈕
            await lineClient.replyMessage(replyToken, flexMessages.createReservationFlex());
            break;

        case 'showMyReservation':
            // 顯示我的預約
            await showMyReservations(userId, replyToken, { lineClient, repositories, flexMessages });
            break;

        case 'showHelp':
            // 顯示幫助訊息
            await lineClient.replyMessage(replyToken, flexMessages.createHelpFlex());
            break;

        case 'cancelQueue':
            // 取消排隊
            await cancelUserQueue(userId, replyToken, { lineClient, repositories });
            break;

        case 'test':
            // 測試訊息
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '✅ 測試成功！LINE 訊息傳遞正常。',
            });
            break;

        default:
            await showDefaultMenu(replyToken, { lineClient, flexMessages });
    }
}

/**
 * 顯示排隊狀態
 */
async function showQueueStatus(userId, replyToken, { lineClient, repositories, flexMessages }) {
    try {
        // 查詢消費者資料
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, flexMessages.createWelcomeFlex());
            return;
        }

        // 查詢目前的排隊資料
        const queueEntries = await repositories.queueRepository.getQueueListByRestaurant(
            customer.restaurant_id, // 需要確認欄位名稱
            'waiting'
        );

        if (queueEntries.length === 0) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '🔍 目前沒有排隊中的資料。輸入「加入排隊」開始排隊！',
            });
            return;
        }

        // 找到該使用者的排隊資料
        const myEntry = queueEntries.find(entry => entry.customer_id === customer.id);

        if (!myEntry) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '🔍 您目前不在排隊名單中。輸入「加入排隊」開始排隊！',
            });
            return;
        }

        // 計算前方等候人數
        const position = queueEntries
            .filter(entry => entry.queue_number < myEntry.queue_number)
            .length + 1;

        // 發送排隊狀態 Flex Message
        await lineClient.replyMessage(replyToken, flexMessages.createQueueStatusFlex({
            queueNumber: myEntry.queue_number,
            position,
            partySize: myEntry.party_size,
            joinedAt: myEntry.joined_at,
        }));
    } catch (error) {
        console.error('❌ showQueueStatus error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 查詢排隊狀態失敗，請稍後再試。',
        });
    }
}

/**
 * 顯示我的預約
 */
async function showMyReservations(userId, replyToken, { lineClient, repositories, flexMessages }) {
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

        // 發送預約列表
        await lineClient.replyMessage(replyToken, flexMessages.createReservationListFlex(reservations));
    } catch (error) {
        console.error('❌ showMyReservations error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 查詢預約失敗，請稍後再試。',
        });
    }
}

/**
 * 取消排隊
 */
async function cancelUserQueue(userId, replyToken, { lineClient, repositories }) {
    try {
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
        
        if (!customer) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '⚠️ 找不到您的資料，請重新加入排隊。',
            });
            return;
        }

        // 找尋等待中的排隊資料
        const queueEntries = await repositories.queueRepository.getQueueListByRestaurant(
            customer.restaurant_id,
            'waiting'
        );

        const myEntry = queueEntries.find(entry => entry.customer_id === customer.id);

        if (!myEntry) {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '🔍 您目前不在排隊名單中，無需取消。',
            });
            return;
        }

        // 取消排隊
        await repositories.queueRepository.cancelQueue(myEntry.id);

        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: `✅ 已為您取消排隊（號碼：${myEntry.queue_number}）。有需要請重新加入排隊！`,
        });
    } catch (error) {
        console.error('❌ cancelUserQueue error:', error);
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: '⚠️ 取消排隊失敗，請稍後再試。',
        });
    }
}

/**
 * 顯示預設選單
 */
async function showDefaultMenu(replyToken, { lineClient, flexMessages }) {
    const welcomeText = `👋 您好！歡迎使用 LINE 餐廳候補位系統！

請選擇操作：
🔢 加入排隊
📋 我的排隊
📅 線上預約
📝 我的預約
❓ 幫助

輸入關鍵字或點擊選單按鈕操作～`;

    await lineClient.replyMessage(replyToken, {
        type: 'text',
        text: welcomeText,
    });
}

module.exports = {
    handleMessage,
    handleTextMessage,
    keywordActions,
};