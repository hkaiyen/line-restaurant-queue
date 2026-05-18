/**
 * LINE 餐廳候補位系統 - Webhook 入口（檔案儲存版）
 * 
 * 功能：
 * 1. 抽號碼牌（輸入「1」）
 * 2. 查詢狀態（輸入「2」）
 * 3. 取消排隊（輸入「3」）
 * 4. 回主選單（輸入「4」）
 * 5. 資料持久化到檔案（重啟後不消失）
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');

const lineConfig = require('../../config/line');

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// 檔案儲存路徑
// =====================================================

const DATA_FILE = '/tmp/queue_data.json';

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

// =====================================================
// 排隊狀態（全域）
// =====================================================

let currentCalledNumber = null;
let nextQueueNumber = 1;
const queueStore = new Map();

// =====================================================
// 檔案讀寫
// =====================================================

function loadQueueData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            currentCalledNumber = data.currentCalledNumber || null;
            nextQueueNumber = data.nextQueueNumber || 1;
            queueStore.clear();
            if (data.queueEntries) {
                for (const entry of data.queueEntries) {
                    queueStore.set(entry.userId, entry);
                }
            }
            console.log(`📂 載入: nextNumber=${nextQueueNumber}, called=${currentCalledNumber}, size=${queueStore.size}`);
        } else {
            console.log('📂 資料檔案不存在，從頭開始');
        }
    } catch (error) {
        console.error('❌ 載入資料失敗:', error.message);
    }
}

function saveQueueData() {
    try {
        const data = {
            currentCalledNumber,
            nextQueueNumber,
            queueEntries: Array.from(queueStore.values()),
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ 儲存資料失敗:', error.message);
    }
}

loadQueueData();

// =====================================================
// 取得下一個排隊號碼
// =====================================================

function getNextQueueNumber() {
    const num = nextQueueNumber;
    nextQueueNumber++;
    if (nextQueueNumber > 99) nextQueueNumber = 1;
    saveQueueData();
    return num;
}

function getWaitingCount() {
    return queueStore.size;
}

function autoCallNext() {
    if (queueStore.size === 0) {
        currentCalledNumber = null;
        saveQueueData();
        return null;
    }
    
    let earliestUserId = null;
    let earliestNum = Infinity;
    for (const [uid, info] of queueStore) {
        if (info.queueNumber < earliestNum) {
            earliestNum = info.queueNumber;
            earliestUserId = uid;
        }
    }
    
    currentCalledNumber = earliestNum;
    saveQueueData();
    return earliestUserId;
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
// 訊息範本
// =====================================================

function getMainMenu() {
    return `🍹 LINE 餐廳候補位系統

1️⃣ 抽號碼牌 - 輸入「1」
2️⃣ 查詢狀態 - 輸入「2」
3️⃣ 取消排隊 - 輸入「3」
4️⃣ 回主選單 - 輸入「4」

================================
👋 歡迎使用！`;
}

function getQueueSuccessText(queueInfo) {
    const positionAhead = getPositionAhead(queueInfo.queueNumber);
    return `✅ 排隊成功！

📍 餐廳：安安餐廳
🔢 您的號碼：第 ${queueInfo.queueNumber} 號
👥 人數：${queueInfo.partySize} 人

📊 目前叫號：第 ${currentCalledNumber || '-'} 號
⏳ 您前方等候：${positionAhead} 組
📋 總等候組數：${getWaitingCount()} 組

================================
📋 輸入「2」查詢
❌ 輸入「3」取消
🔙 輸入「4」回主選單`;
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

🔙 輸入「4」回主選單`;
}

function getStatusBoardText() {
    return `📢 安安餐廳 - 排隊狀態

📊 目前叫號：第 ${currentCalledNumber || '-'} 號
📋 總等候組數：${getWaitingCount()} 組

${currentCalledNumber ? '✅ 請「第 ' + currentCalledNumber + ' 號」顧客準備入座！' : '⏳ 等待叫號中...'}
`;
}

// =====================================================
// Webhook POST 路由
// =====================================================

router.post('/', (req, res) => {
    console.log('📨 Webhook received');
    
    res.status(200).send('OK');

    const events = req.body?.events;
    if (!events || events.length === 0) return;

    events.forEach(async (event) => {
        console.log(`🔔 Event: ${event.type}`);

        if (event.type === 'follow') {
            await replyText(event.replyToken, 
`🎉 感謝您加入！

🍹 LINE 餐廳候補位系統

1️⃣ 抽號碼牌 - 輸入「1」
2️⃣ 查詢狀態 - 輸入「2」
3️⃣ 取消排隊 - 輸入「3」
4️⃣ 回主選單 - 輸入「4」

================================
👋 歡迎使用！`);
            return;
        }

        if (event.type === 'message' && event.message?.type === 'text') {
            const userId = event.source?.userId;
            const replyToken = event.replyToken;
            const text = event.message.text.trim();

            if (!userId || !replyToken) return;

            const upperText = text.toUpperCase();

            // ---------- 回主選單 ----------
            if (upperText === '4' || upperText === '幫助' || upperText === 'HELP' || upperText === 'MENU') {
                await replyText(replyToken, getMainMenu());
                return;
            }

            // ---------- 抽號碼牌 ----------
            if (upperText === '1' || upperText === '排隊' || upperText === '加入') {
                // 如果已在排隊中，先取消舊的
                if (queueStore.has(userId)) {
                    const oldInfo = queueStore.get(userId);
                    queueStore.delete(userId);
                }
                
                const queueNumber = getNextQueueNumber();
                queueStore.set(userId, {
                    userId,
                    queueNumber,
                    partySize: 2,
                    phone: '0912345678',
                    joinedAt: new Date().toISOString(),
                    partySizeConfirmed: false
                });
                
                saveQueueData();
                await replyText(replyToken, 
`🔢 請問幾位用餐？

請直接輸入數字（例如：3）`);
                return;
            }

            // ---------- 處理人數回覆 ----------
            const queueInfo = queueStore.get(userId);
            if (queueInfo && !queueInfo.partySizeConfirmed) {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    queueInfo.partySize = num;
                    queueInfo.partySizeConfirmed = true;
                    saveQueueData();
                    autoCallNext();
                    await replyText(replyToken, getQueueSuccessText(queueInfo));
                } else {
                    await replyText(replyToken, '⚠️ 請輸入有效人數（1-20）');
                }
                return;
            }

            // ---------- 查詢狀態 ----------
            if (upperText === '2' || upperText === '查詢' || upperText === '我的號碼' || upperText === '狀態') {
                const info = queueStore.get(userId);
                if (info) {
                    await replyText(replyToken, getQueryText(info));
                } else {
                    await replyText(replyToken, getStatusBoardText());
                }
                return;
            }

            // ---------- 取消排隊 ----------
            if (upperText === '3' || upperText === '取消') {
                if (queueStore.has(userId)) {
                    const info = queueStore.get(userId);
                    queueStore.delete(userId);
                    saveQueueData();
                    await replyText(replyToken, 
`✅ 已取消排隊（第 ${info.queueNumber} 號）

📋 總等候組數：${getWaitingCount()} 組
⏳ 歡迎下次使用！`);
                } else {
                    await replyText(replyToken, '📭 您目前沒有排隊記錄');
                }
                return;
            }

            // ---------- 叫號（手動）----------
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
            await replyText(replyToken, getMainMenu());
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

module.exports = { router };