/**
 * LINE 餐廳候補位系統 - Webhook 處理器（最簡化版）
 */

const express = require('express');
const router = express.Router();

// =====================================================
// LINE Webhook 路由
// =====================================================

// POST / - 接收 LINE Webhook
router.post('/', (req, res) => {
    console.log('✅ POST /webhook received');
    
    // 立刻回應 LINE（必須快速）
    res.status(200).send('OK');
    
    // 取得事件
    const events = req.body.events;
    if (!events || events.length === 0) {
        console.log('📭 No events');
        return;
    }
    
    console.log(`📨 Processing ${events.length} event(s)`);
    
    // 簡單處理每個事件
    events.forEach(event => {
        console.log(`🔔 Event: ${event.type}`);
        
        if (event.type === 'follow') {
            console.log(`👋 New follower: ${event.source.userId}`);
        } else if (event.type === 'message') {
            console.log(`💬 Message: ${event.message.text}`);
        }
    });
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    console.log('✅ GET /webhook');
    res.status(200).send('Webhook endpoint is active');
});

module.exports = {
    router,
};