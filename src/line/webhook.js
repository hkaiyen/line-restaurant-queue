/**
 * LINE 餐廳候補位系統 - Webhook 處理器
 */

const express = require('express');
const router = express.Router();

// 載入處理器
const messageHandler = require('./handlers/messageHandler');
const followHandler = require('./handlers/followHandler');

// =====================================================
// LINE Webhook 路由
// =====================================================

// POST / - 接收 LINE Webhook
router.post('/', async (req, res) => {
    console.log('📨 Webhook received');
    console.log('Body:', JSON.stringify(req.body).substring(0, 200));

    // 快速回應 LINE
    res.status(200).send('OK');

    const events = req.body.events;
    if (!events || events.length === 0) {
        console.log('📭 No events');
        return;
    }

    console.log(`📨 Processing ${events.length} event(s)`);

    // 載入依賴
    const lineClient = require('../line/client');
    const repositories = require('../../repositories');
    const flexMessages = require('./messages/flexMessages');

    // 處理每個事件
    for (const event of events) {
        console.log(`🔔 Event type: ${event.type}`);
        
        try {
            switch (event.type) {
                case 'follow':
                    await followHandler.handleFollow(event, { lineClient, repositories, flexMessages });
                    break;
                    
                case 'message':
                    await messageHandler.handleMessage(event, { lineClient, repositories, flexMessages });
                    break;
                    
                default:
                    console.log(`⚠️ Unknown event type: ${event.type}`);
            }
        } catch (error) {
            console.error(`❌ Error processing ${event.type}:`, error.message);
        }
    }
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    res.status(200).send('Webhook endpoint is active');
});

module.exports = {
    router,
};