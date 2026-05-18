/**
 * LINE 餐廳候補位系統 - Webhook 入口（記憶體版）
 * 
 * 功能：
 * 1. 直接輸入人數快速加入排隊
 * 2. 自動叫號（加入後自動叫下一個）
 * 3. 查詢顯示目前叫號 + 等候組數
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
// 排隊狀態（全域記憶體）
// =====================================================

let currentCalledNumber = null; // 目前叫到的號碼
let nextQueueNumber = 1;         // 下一個要發的號碼

const queueStore = new Map(); // userId -> { queueNumber, partySize, phone, joinedAt, partySizeConfirmed }

// 取得下一個排隊號碼
function getNextQueueNumber() {
    const num = nextQueueNumber;
    nextQueueNumber++;
    if (nextQueueNumber > 99) nextQueueNumber = 1;
    return num;
}

// 取得等候組數
function getWaitingCount() {
    return queueStore.size;
}

// 自動叫下一號
function autoCallNext() {
    if (queueStore.size === 0) {
        currentCalledNumber = null;
        return null;
    }
    
    // 找出 queueNumber 最小的
    let earliestUserId = null;
    let earliestNum = Infinity;
    for (const [uid, info] of queueStore) {
        if (info.queueNumber < earliestNum) {
            earliestNum = info.queueNumber;
            earliestUserId = uid;
        }
    }
    
    currentCalledNumber = earliestNum;
    return earliestUserId;
}

// =====================================================
// 訊息範本
// =====================================================

function getHelpText() {
    return `🍹 LINE 餐廳候補位系統

🔢 直接輸入人數 - 快速加入排隊
🔢 正式加入 - 輸入「排隊」
📋 查詢狀態 - 輸入「查詢」
❌ 取消排隊 - 輸入「取消」
❓ 幫助 - 輸入「幫助」

================================
👋 歡迎使用！`;
}

function getQueueSuccessText(queueInfo) {
    const positionAhead = getPositionAhead(queueInfo.queueNumber);
    return `✅ 排隊成功！

📍 餐廳：安安餐廳
🔢 您的號碼：第 ${queueInfo.queueNumber} 號
👥 人數：${queueInfo.partySize} 人
📞 電話：${queueInfo.phone}

📊 目前叫號：第 ${currentCalledNumber || '-'} 號
⏳ 您前方等候：${positionAhead} 組
📋 總等候組數：${getWaitingCount()} 組

================================
📋 輸入「查詢」查看進度
❌ 輸入「取消」取消排隊`;
}

function getQueryText(queueInfo) {
    const positionAhead = getPositionAhead(queueInfo.queueNumber);
    return `📋 您的排隊資料

🔢 您的號碼：第 ${queueInfo.queueNumber} 號
👥 人數：${queueInfo.partySize} 人
⏳ 狀態：等待中

📊 目前叫號：第 ${currentCalledNumber || '-'} 號
⏳ 您前方等候：${positionAhead} 組
📋 總等候組數：${getWaitingCount()} 組

📝 輸入「取消」取消排隊`;
}

function getStatusBoardText() {
    return `📢 安安餐廳 - 排隊狀態

📊 目前叫號：第 ${currentCalledNumber || '-'} 號
📋 總等候組數：${getWaitingCount()} 組

${currentCalledNumber ? '✅ 請「第 ' + currentCalledNumber + ' 號」顧客準備入座！' : '⏳ 等待叫號中...'}

================================
🔢 輸入人數直接加入排隊
📋 輸入「查詢」查看個人狀態`;
}

function getPositionAhead(queueNumber) {
    let position = 0;
    for (const [userId, info] of queueStore) {
        if (info.queueNumber < queueNumber) {
            position++;
        }
    }
    return position;
}

// =====================================================
// Webhook POST 路由
// =====================================================

router.post('/', (req, res) => {
    console.log('📨 Webhook received');
    
    res.status(200).send('OK');

    const events = req.body?.events;
    if (!events || events.length === 0) {
        console.log('⚠️ No events');
        return;
    }

    events.forEach(async (event) => {
        console.log(`🔔 Event: ${event.type}`);

        // follow 事件
        if (event.type === 'follow') {
            await replyText(event.replyToken, 
`🎉 感謝您加入！

🍹 LINE 餐廳候補位系統

🔢 直接輸入人數 - 快速加入排隊
📋 查詢狀態 - 輸入「查詢」
❌ 取消排隊 - 輸入「取消」

================================
歡迎使用！`);
            return;
        }

        // 訊息事件
        if (event.type === 'message' && event.message?.type === 'text') {
            const userId = event.source?.userId;
            const replyToken = event.replyToken;
            const text = event.message.text.trim();

            console.log(`💬 ${userId}: ${text}`);

            if (!userId || !replyToken) {
                console.log('⚠️ No userId or replyToken');
                return;
            }

            const upperText = text.toUpperCase();

            // ---------- 幫助 ----------
            if (upperText === '幫助' || upperText === 'HELP') {
                await replyText(replyToken, getHelpText());
                return;
            }

            // ---------- 直接輸入數字（快速加入） ----------
            const directNum = parseInt(text, 10);
            if (!isNaN(directNum) && directNum >= 1 && directNum <= 20) {
                // 檢查是否已在排隊中
                const existingInfo = queueStore.get(userId);
                if (existingInfo) {
                    existingInfo.partySize = directNum;
                    await replyText(replyToken, getQueueSuccessText(existingInfo));
                } else {
                    const queueNumber = getNextQueueNumber();
                    queueStore.set(userId, {
                        queueNumber,
                        partySize: directNum,
                        phone: '0912345678',
                        joinedAt: new Date(),
                        partySizeConfirmed: true
                    });
                    
                    // 加入後自動叫下一個
                    const calledUserId = autoCallNext();
                    
                    await replyText(replyToken, getQueueSuccessText(queueStore.get(userId)));
                }
                return;
            }

            // ---------- 排隊（傳統流程） ----------
            if (upperText === '排隊' || upperText === '加入' || upperText === 'JOIN') {
                const queueNumber = getNextQueueNumber();
                queueStore.set(userId, {
                    queueNumber,
                    partySize: 2,
                    phone: '0912345678',
                    joinedAt: new Date()
                });
                await replyText(replyToken, 
`🔢 請問幾位用餐？

請直接輸入數字（例如：3）`);
                return;
            }

            // ---------- 處理數量回覆 ----------
            const queueInfo = queueStore.get(userId);
            if (queueInfo && !queueInfo.partySizeConfirmed) {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    queueInfo.partySize = num;
                    queueInfo.partySizeConfirmed = true;
                    
                    // 加入後自動叫下一個
                    autoCallNext();
                    
                    await replyText(replyToken, getQueueSuccessText(queueInfo));
                } else {
                    await replyText(replyToken, '⚠️ 請輸入有效人數（1-20）');
                }
                return;
            }

            // ---------- 查詢 ----------
            if (upperText === '查詢' || upperText === '我的號碼' || upperText === '狀態') {
                const info = queueStore.get(userId);
                if (info) {
                    await replyText(replyToken, getQueryText(info));
                } else {
                    await replyText(replyToken, getStatusBoardText());
                }
                return;
            }

            // ---------- 取消 ----------
            if (upperText === '取消') {
                if (queueStore.has(userId)) {
                    const info = queueStore.get(userId);
                    queueStore.delete(userId);
                    await replyText(replyToken, 
`✅ 已取消排隊（第 ${info.queueNumber} 號）

📋 總等候組數：${getWaitingCount()} 組
⏳ 歡迎下次使用！`);
                } else {
                    await replyText(replyToken, '📭 您目前沒有排隊記錄');
                }
                return;
            }

            // ---------- 叫號（手動） ----------
            if (upperText === '叫號' || upperText === 'CALL') {
                const calledUserId = autoCallNext();
                if (calledUserId) {
                    const calledInfo = queueStore.get(calledUserId);
                    await replyText(replyToken, 
`📢 叫號完成！

🔢 第 ${currentCalledNumber} 號
👥 ${calledInfo.partySize} 人

請準備入座，謝謝！`);
                } else {
                    await replyText(replyToken, '📭 目前沒有人在排隊');
                }
                return;
            }

            // ---------- 未知訊息 ----------
            await replyText(replyToken, getStatusBoardText());
            return;
        }
    });
});

// GET 驗證
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'LINE 餐廳候補位系統 Webhook 運作中 ✅',
        queueStatus: {
            currentCalled: currentCalledNumber,
            totalWaiting: getWaitingCount(),
            nextNumber: nextQueueNumber
        },
        timestamp: new Date().toISOString(),
    });
});

module.exports = {
    router,
};