/**
 * LINE 餐廳候補位系統 - Webhook 處理器
 * 加入 MiniMax AI 聊天功能
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// MiniMax AI 設定
// =====================================================

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

async function askMiniMax(userMessage) {
    if (!MINIMAX_API_KEY) {
        return '⚠️ AI 功能尚未設定（缺少 API Key）';
    }

    const systemPrompt = `你是「小安」，一個專業的智能助理。

你的特點：
- 專精深度研究、股市分析、創業建議、產業研究
- 說話專業、嚴謹、有條理
- 繁體中文回答
- 活潑有創意但不失專業

你專門負責：
- LINE 餐廳候補位系統客服
- 回答用戶問題
- 提供有用建議

請用繁體中文回答，友善且專業。`;

    try {
        const response = await fetch(MINIMAX_API_URL + (MINIMAX_API_URL.includes('?') ? '&' : '?') + 'GroupId=your_group_id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MINIMAX_API_KEY}`
            },
            body: JSON.stringify({
                model: 'MiniMax-M2.7',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            console.error('❌ MiniMax API error:', response.status);
            return '⚠️ AI 回應失敗，請稍後再試';
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '⚠️ 無法理解，請重新輸入';
    } catch (error) {
        console.error('❌ MiniMax error:', error.message);
        return '⚠️ AI 系統錯誤，請稍後再試';
    }
}

// =====================================================
// LINE 回覆功能
// =====================================================

const LINE_API_BASE = 'https://api.line.me/v2';

async function replyMessage(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    
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

router.post('/', (req, res) => {
    console.log('✅ POST /webhook received');
    
    // 立刻回應 LINE（避免 timeout）
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
            await replyMessage(event.replyToken, 
`🎉 感謝您加入小安智能助理！

🍹 LINE 餐廳候補位系統

我是小安AI助理，可以幫您：
🔢 加入排隊
📋 我的排隊
📅 線上預約
❓ 幫助

請輸入關鍵字操作，或直接跟我聊天～`);
            
        } else if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text;
            console.log(`💬 Message: ${text}`);
            
            // 先回覆用戶，正在處理中
            await replyMessage(event.replyToken, `⏳ 小安正在思考中...`);
            
            // 叫 MiniMax AI 回覆
            const aiReply = await askMiniMax(text);
            
            // 再發送 AI 回覆
            const pushToken = lineConfig.messagingApi.accessToken;
            if (pushToken) {
                await fetch(`${LINE_API_BASE}/bot/message/push`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${pushToken}`
                    },
                    body: JSON.stringify({
                        to: event.source?.userId || 'Uad991d6c2defed9e2de07a16445c39bc',
                        messages: [{ type: 'text', text: aiReply }]
                    })
                });
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