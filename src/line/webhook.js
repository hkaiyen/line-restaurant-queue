/**
 * LINE 餐廳候補位系統 - Webhook 處理器
 * 
 * 接收並處理 LINE Platform 發送的 webhook 事件
 * 支援：follow, unfollow, message, postback, beacon 等事件
 */

const line = require('@line/bot-sdk');
const crypto = require('crypto');
const lineConfig = require('../../config/line');

// 載入事件處理器
const messageHandler = require('./handlers/messageHandler');
const followHandler = require('./handlers/followHandler');
const postbackHandler = require('./handlers/postbackHandler');
const leaveHandler = require('./handlers/leaveHandler');

// =====================================================
// Webhook 驗證（確保請求來自 LINE Platform）
// =====================================================

/**
 * 驗證 LINE Webhook 簽章
 * 
 * @param {string} body - 請求主體（原始文字）
 * @param {string} signature - X-LINE-Signature header 值
 * @param {string} channelSecret - LINE Channel Secret
 * @returns {boolean} 驗證結果
 */
function verifySignature(body, signature, channelSecret) {
    if (!signature || !channelSecret) {
        return false;
    }

    const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(body)
        .digest('base64');

    return hash === signature;
}

// =====================================================
// Webhook 事件處理主函數
// =====================================================

/**
 * 處理 LINE Webhook 請求
 * 
 * @param {object} req - Express 請求物件
 * @param {object} res - Express 回應物件
 * @param {object} dependencies - 依賴注入（可注入測試用的 mock）
 */
async function handleWebhook(req, res, dependencies = {}) {
    // 解構依賴（支援注入，便於測試）
    const {
        lineClient = require('../line/client'),
        repositories = require('../../repositories'),
        flexMessages = require('../line/messages'),
    } = dependencies;

    // 回應 LINE Platform（必須快速回應）
    res.status(200).send('OK');

    // 取得 webhook 事件
    const events = req.body.events;
    
    if (!events || events.length === 0) {
        console.log('📭 No events in webhook payload');
        return;
    }

    console.log(`📨 Received ${events.length} webhook event(s)`);

    // 依序處理每個事件（非同步並行處理）
    await Promise.all(
        events.map(async (event) => {
            try {
                await processEvent(event, { lineClient, repositories, flexMessages });
            } catch (error) {
                console.error(`❌ Error processing event ${event.type}:`, error.message);
            }
        })
    );
}

/**
 * 依據事件類型分派處理
 * 
 * @param {object} event - LINE Webhook 事件物件
 * @param {object} dependencies - 依賴
 */
async function processEvent(event, dependencies) {
    const { lineClient, repositories, flexMessages } = dependencies;

    console.log(`🔔 Processing event: ${event.type} (${event.source?.type || 'unknown source'})`);

    // 根據事件類型分派處理
    switch (event.type) {
        case 'follow':
            // 使用者加入官方帳號為好友
            await followHandler.handleFollow(event, { lineClient, repositories, flexMessages });
            break;

        case 'unfollow':
            // 使用者封鎖或刪除官方帳號
            await followHandler.handleUnfollow(event, { lineClient, repositories });
            break;

        case 'join':
            // Bot 被加入至 Group 或 Room
            await leaveHandler.handleJoin(event, { lineClient });
            break;

        case 'leave':
            // Bot 被從 Group 或 Room 移除
            await leaveHandler.handleLeave(event, { lineClient });
            break;

        case 'message':
            // 收到文字、圖片、影片、語音、檔案等訊息
            await messageHandler.handleMessage(event, { lineClient, repositories, flexMessages });
            break;

        case 'postback':
            // 使用者點擊 buttons、carousel 等元件
            await postbackHandler.handlePostback(event, { lineClient, repositories, flexMessages });
            break;

        case 'beacon':
            // 使用者進入或離開 Beacon 範圍
            await handleBeacon(event, { lineClient, repositories, flexMessages });
            break;

        default:
            console.log(`⚠️ Unknown event type: ${event.type}`);
    }
}

// =====================================================
// Beacon 事件處理（進階功能，可選實作）
// =====================================================

/**
 * 處理 Beacon 事件
 * 用於偵測消費者進入餐廳範圍
 * 
 * @param {object} event - LINE Beacon 事件
 * @param {object} dependencies - 依賴
 */
async function handleBeacon(event, { lineClient, repositories, flexMessages }) {
    const { beacon } = event;
    const userId = event.source?.userId;

    console.log(`📡 Beacon event: type=${beacon?.type}, deviceId=${beacon?.hwid}`);

    // 根據 Beacon 類型處理
    switch (beacon?.type) {
        case 'enter':
            // 消費者進入 Beacon 範圍
            if (userId) {
                // 可用於：自動跳出加入排隊提示
                console.log(`👤 User ${userId} entered beacon range`);
            }
            break;

        case 'leave':
            // 消費者離開 Beacon 範圍
            console.log(`👤 User ${userId} left beacon range`);
            break;

        case 'banner':
            // 消費者 tap Beacon（僅部分 Beacon 支援）
            console.log(`👤 User ${userId} tapped beacon`);
            break;
    }

    // 注意：Beacon 功能需要額外設備支援
    // 如無 Beacon 設備，可忽略此事件
}

// =====================================================
// Webhook 路由設定（Express Router）
// =====================================================

const express = require('express');
const router = express.Router();

// POST / - 接收 LINE Webhook
router.post('/', async (req, res) => {
    // 生產環境啟用簽章驗證
    if (lineConfig.webhook.verifySignature) {
        const signature = req.headers['x-line-signature'];
        const body = JSON.stringify(req.body);
        
        if (!verifySignature(body, signature, lineConfig.messagingApi.channelSecret)) {
            console.warn('⚠️ Webhook signature verification failed');
            return res.status(403).send('Forbidden');
        }
    }

    await handleWebhook(req, res);
});

// GET / - LINE 驗證 Webhook URL 用
router.get('/', (req, res) => {
    res.status(200).send('Webhook endpoint is active');
});

module.exports = {
    router,
    handleWebhook,
    verifySignature,
};