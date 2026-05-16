/**
 * LINE 餐廳候補位系統 - Webhook 入口（簡化版，測試用）
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// LINE 回覆訊息
// =====================================================

async function replyText(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN not set');
        return;
    }

    try {
        await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{ type: 'text', text }],
            }),
        });
        console.log('✅ Replied:', text.substring(0, 50));
    } catch (error) {
        console.error('❌ Reply error:', error.message);
    }
}

async function pushMessage(userId, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return;

    try {
        await fetch(`${LINE_API_BASE}/bot/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text }],
            }),
        });
    } catch (error) {
        console.error('❌ Push error:', error.message);
    }
}

// =====================================================
// 幫助訊息
// =====================================================

function getHelpText() {
    return `🍹 LINE 餐廳候補位系統

🔢 加入排隊 - 輸入「排隊」
📋 查詢狀態 - 輸入「查詢」
❌ 取消排隊 - 輸入「取消」
❓ 幫助 - 輸入「幫助」

================================
👋 歡迎使用！`;
}

// =====================================================
// 排隊流程（簡化版，記憶體儲存）
// =====================================================

const queueStore = new Map(); // userId -> { queueNumber, partySize, phone, restaurantId }

function getNextQueueNumber() {
    return Math.floor(Math.random() * 50) + 1;
}

function getHelpTextWithQueue(queueInfo) {
    return `✅ 排隊成功！

📍 餐廳：測試餐廳
🔢 您的號碼：第 ${queueInfo.queueNumber} 號
👥 人數：${queueInfo.partySize} 人
📞 電話：${queueInfo.phone}

⏳ 請稍候，我們會通知您

================================
📋 輸入「查詢」查看進度
❌ 輸入「取消」取消排隊`;
}

// =====================================================
// Webhook POST 路由
// =====================================================

router.post('/', (req, res) => {
    console.log('📨 Webhook received');
    
    // 回應 LINE 確認收到（避免 timeout）
    res.status(200).send('OK');

    const events = req.body?.events;
    if (!events || events.length === 0) {
        console.log('⚠️ No events');
        return;
    }

    events.forEach(async (event) => {
        console.log(`🔔 Event: ${event.type}, replyToken: ${event.replyToken ? 'yes' : 'no'}`);

        // follow 事件
        if (event.type === 'follow') {
            await replyText(event.replyToken, 
`🎉 感謝您加入！

🍹 LINE 餐廳候補位系統

🔢 加入排隊 - 輸入「排隊」
📋 查詢狀態 - 輸入「查詢」
❌ 取消排隊 - 輸入「取消」
❓ 幫助 - 輸入「幫助」

================================
歡迎使用！`);
            return;
        }

        // 訊息事件
        if (event.type === 'message' && event.message?.type === 'text') {
            const userId = event.source?.userId;
            const replyToken = event.replyToken;
            const text = event.message.text.trim().toUpperCase();

            console.log(`💬 ${userId}: ${text}`);

            if (!userId || !replyToken) {
                console.log('⚠️ No userId or replyToken');
                return;
            }

            // 幫助
            if (text === '幫助' || text === 'HELP') {
                await replyText(replyToken, getHelpText());
                return;
            }

            // 排隊
            if (text === '排隊' || text === '加入') {
                const queueNumber = getNextQueueNumber();
                queueStore.set(userId, {
                    queueNumber,
                    partySize: 2, // 預設
                    phone: '0912345678', // 預設
                    restaurantId: 'test-001'
                });
                await replyText(replyToken, 
`🔢 請問幾位用餐？

請直接輸入數字（例如：3）
或輸入「取消」取消排隊`);
                return;
            }

            // 處理數量回覆（當用户在排隊流程中）
            const queueInfo = queueStore.get(userId);
            if (queueInfo && !queueInfo.partySizeConfirmed) {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    queueInfo.partySize = num;
                    queueInfo.partySizeConfirmed = true;
                    queueInfo.queueNumber = getNextQueueNumber();
                    await replyText(replyToken, getHelpTextWithQueue(queueInfo));
                } else {
                    await replyText(replyToken, '⚠️ 請輸入有效人數（1-20）');
                }
                return;
            }

            // 查詢
            if (text === '查詢' || text === '我的號碼' || text === '狀態') {
                const info = queueStore.get(userId);
                if (info) {
                    await replyText(replyToken, 
`📋 您的排隊資料

🔢 號碼：第 ${info.queueNumber} 號
👥 人數：${info.partySize} 人
⏳ 狀態：等待中

📝 輸入「取消」取消排隊`);
                } else {
                    await replyText(replyToken, '📭 您目前沒有排隊記錄\n\n輸入「排隊」開始排隊！');
                }
                return;
            }

            // 取消
            if (text === '取消') {
                if (queueStore.has(userId)) {
                    queueStore.delete(userId);
                    await replyText(replyToken, '✅ 已取消排隊\n\n歡迎下次使用！');
                } else {
                    await replyText(replyToken, '📭 您目前沒有排隊記錄');
                }
                return;
            }

            // 未知訊息
            await replyText(replyToken, getHelpText());
            return;
        }
    });
});

// GET 驗證
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'LINE 餐廳候補位系統 Webhook 運作中 ✅',
        timestamp: new Date().toISOString(),
    });
});

module.exports = {
    router,
};