/**
 * LINE 餐廳候補位系統 - Webhook 入口
 * 
 * 接收 LINE Platform 發送的事件並分發處理
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');
const messageHandler = require('./handlers/messageHandler');
const followHandler = require('./handlers/followHandler');
const postbackHandler = require('./handlers/postbackHandler');

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// LINE 驗證函數
// =====================================================

async function verifySignature(signature, body) {
    if (!signature || !body) return false;
    
    const crypto = require('crypto');
    const channelSecret = lineConfig.messagingApi.channelSecret;
    const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(Buffer.from(JSON.stringify(body)))
        .digest('base64');
    
    return hash === signature;
}

// =====================================================
// LINE 回覆訊息
// =====================================================

async function replyMessage(replyToken, messages) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken || !replyToken) return;

    try {
        await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ replyToken, messages }),
        });
    } catch (error) {
        console.error('❌ Reply error:', error.message);
    }
}

// =====================================================
// Webhook POST 路由
// =====================================================

router.post('/', async (req, res) => {
    console.log(`📨 Webhook received at ${new Date().toISOString()}`);
    
    // 回應 LINE 確認收到（避免 timeout）
    res.status(200).send('OK');

    const events = req.body?.events;
    if (!events || events.length === 0) {
        console.log('⚠️ No events in request');
        return;
    }

    console.log(`📨 Processing ${events.length} event(s)`);

    for (const event of events) {
        console.log(`🔔 Event type: ${event.type}`);

        try {
            switch (event.type) {
                case 'follow':
                    // 新用戶加入 LINE 官方帳號
                    await followHandler.handleFollow(event, { lineConfig, replyMessage });
                    break;

                case 'unfollow':
                    // 用戶封鎖/解除訂閱
                    await followHandler.handleUnfollow(event);
                    break;

                case 'message':
                    // 一般訊息（文字、圖片、貼圖等）
                    if (event.message?.type === 'text') {
                        await messageHandler.handleMessage(event);
                    } else {
                        // 非文字訊息，简单回复
                        console.log(`📝 Non-text message: ${event.message?.type}`);
                    }
                    break;

                case 'postback':
                    // 按鈕/快速回覆的 postback 事件
                    await postbackHandler.handlePostback(event);
                    break;

                case 'join':
                    // Bot 被加入到群組
                    console.log(`🤝 Bot joined group: ${event.source?.groupId}`);
                    break;

                case 'leave':
                    // Bot 被從群組移除
                    console.log(`👋 Bot left group: ${event.source?.groupId}`);
                    break;

                default:
                    console.log(`⚠️ Unknown event type: ${event.type}`);
            }
        } catch (error) {
            console.error(`❌ Error handling event ${event.type}:`, error.message);
        }
    }
});

// =====================================================
// Webhook GET 驗證
// =====================================================

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