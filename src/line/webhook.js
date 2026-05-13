/**
 * LINE 餐廳候補位系統 - Webhook 處理器
 */

const line = require('@line/bot-sdk');
const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// LINE Client
// =====================================================

const lineClient = new line.Client({
    channelAccessToken: lineConfig.messagingApi.accessToken,
    channelSecret: lineConfig.messagingApi.channelSecret,
});

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
    
    // 處理每個事件
    events.forEach(async event => {
        console.log(`🔔 Event: ${event.type}`);
        
        if (event.type === 'follow') {
            // 新好友加入
            const userId = event.source.userId;
            console.log(`👋 New follower: ${userId}`);
            
            // 發送歡迎訊息
            try {
                await lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `🎉 感謝您加入小安智能助理！

🍹 LINE 餐廳候補位系統

請選擇操作：
🔢 加入排隊
📋 我的排隊
📅 線上預約
❓ 幫助

輸入關鍵字操作～`,
                });
                console.log('✅ Welcome message sent');
            } catch (error) {
                console.error('❌ Welcome message failed:', error.message);
            }
            
        } else if (event.type === 'message' && event.message.type === 'text') {
            // 收到文字訊息
            const userId = event.source.userId;
            const text = event.message.text;
            console.log(`💬 Message from ${userId}: ${text}`);
            
            // 發送回覆
            try {
                await lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `✅ 收到訊息：${text}\n\n小咪 LINE 餐廳候補位系統正在運作中！`,
                });
                console.log('✅ Reply sent');
            } catch (error) {
                console.error('❌ Reply failed:', error.message);
            }
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