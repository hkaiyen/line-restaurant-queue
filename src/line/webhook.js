/**
 * LINE 餐廳候補位系統 - Webhook 處理器
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// 直接使用 HTTP API
// =====================================================

const LINE_API_BASE = 'https://api.line.me/v2';

async function replyMessage(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    
    console.log(`📤 Reply attempt:`);
    console.log(`   Token length: ${accessToken ? accessToken.length : 'UNDEFINED'}`);
    console.log(`   Token prefix: ${accessToken ? accessToken.substring(0, 10) : 'N/A'}`);
    console.log(`   ReplyToken: ${replyToken ? 'SET' : 'UNDEFINED'}`);
    
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN is undefined!');
        return { success: false, error: 'No token' };
    }
    
    const body = {
        replyToken: replyToken,
        messages: [{
            type: 'text',
            text: text
        }]
    };
    
    try {
        const response = await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            console.log('✅ Reply sent successfully');
            return { success: true };
        } else {
            const error = await response.text();
            console.error('❌ Reply failed:', response.status, error);
            return { success: false, error };
        }
    } catch (error) {
        console.error('❌ Reply error:', error.message);
        return { success: false, error: error.message };
    }
}

// =====================================================
// LINE Webhook 路由
// =====================================================

// POST / - 接收 LINE Webhook
router.post('/', (req, res) => {
    console.log('✅ POST /webhook received');
    console.log('📋 LINE_ACCESS_TOKEN:', lineConfig.messagingApi.accessToken ? 'SET (len=' + lineConfig.messagingApi.accessToken.length + ')' : 'UNDEFINED!');
    
    // 立刻回應 LINE
    res.status(200).send('OK');
    
    const events = req.body.events;
    if (!events || events.length === 0) {
        console.log('📭 No events');
        return;
    }
    
    console.log(`📨 Processing ${events.length} event(s)`);
    
    events.forEach(async event => {
        console.log(`🔔 Event: ${event.type}`);
        
        if (event.type === 'follow') {
            await replyMessage(event.replyToken, `🎉 感謝您加入小安智能助理！

🍹 LINE 餐廳候補位系統

請選擇操作：
🔢 加入排隊
📋 我的排隊
📅 線上預約
❓ 幫助

輸入關鍵字操作～`);
            
        } else if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text;
            console.log(`💬 Message: ${text}`);
            
            await replyMessage(event.replyToken, `✅ 收到訊息：${text}\n\n小咪 LINE 餐廳候補位系統正在運作中！`);
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