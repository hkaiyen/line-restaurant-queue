/**
 * LINE 小安智能助理 - 家族群組升級版
 * 具備 AI 聊天、家庭公告、隱私保護功能
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// MiniMax AI 設定
// =====================================================

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_URL = 'https://api.minimax.io/anthropic/v1/messages';

// =====================================================
// 天氣查詢功能
// =====================================================

async function getWeather(location = '台北') {
    try {
        const response = await fetch(
            `https://wttr.in/${encodeURIComponent(location)}?format=j1&lang=zh`
        );
        if (!response.ok) return null;
        const data = await response.json();
        
        const current = data.current_condition[0];
        const temp = current.temp_C;
        const desc = current.weatherDesc[0].value;
        const humidity = current.humidity;
        
        return `🌤️ ${location}天氣\n\n溫度：${temp}°C\n天氣：${desc}\n濕度：${humidity}%`;
    } catch (error) {
        return null;
    }
}

// =====================================================
// 網路搜尋功能
// =====================================================

async function searchWeb(query) {
    try {
        const response = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
        );
        if (!response.ok) return null;
        const data = await response.json();
        
        if (data.AbstractText) {
            return `🔍 ${query}\n\n${data.AbstractText.slice(0, 500)}`;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// =====================================================
// LINE 用戶資料取得
// =====================================================

async function getUserProfile(userId, groupId = null) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken || !userId) return null;
    
    try {
        let url;
        if (groupId) {
            // 群組：用群組 API
            url = `${LINE_API_BASE}/bot/group/${groupId}/member/${userId}`;
        } else {
            // 個人：用個人 API
            url = `${LINE_API_BASE}/bot/profile/${userId}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            return {
                userId: userId,
                displayName: data.displayName || '家人',
                pictureUrl: data.pictureUrl || null
            };
        }
    } catch (error) {
        console.error('❌ Get profile error:', error.message);
    }
    return { userId: userId, displayName: '家人' };
}

// =====================================================
// AI 回覆功能（增強版）
// =====================================================

async function askMiniMax(userMessage, context = {}) {
    console.log('🤖 askMiniMax called with:', userMessage);
    console.log('📋 Context:', JSON.stringify(context));
    
    if (!MINIMAX_API_KEY) {
        return '⚠️ AI 功能尚未設定（缺少 API Key）';
    }

    // 分析訊息類型
    const text = userMessage.trim();
    const isGroup = context.isGroup || false;
    const userName = context.userName || '家人';
    const userId = context.userId || '';
    
    // 隱私關鍵字過濾
    const privacyKeywords = ['老闆', '老闆的', '薛凱恩', 'Hsueh', 'Kaiyen', '個人', '帳戶', '銀行', '密碼'];
    let filteredText = text;
    for (const kw of privacyKeywords) {
        if (text.includes(kw)) {
            filteredText = filteredText.replace(new RegExp(kw, 'g'), '***');
        }
    }

    // 偵測意圖
    const weatherMatch = text.match(/(?:天氣|weather|氣象)/i);
    const searchMatch = text.match(/(?:搜尋|搜|search|查詢|找)/i);
    const announcementMatch = text.match(/^\/公告|^公告|^發公告|^\/announce/i);

    // 處理公告指令
    if (announcementMatch) {
        return `📢 家庭公告功能

要用公告功能，請在 LINE@ 後台設定！

或者直接告訴我，我幫您記錄，稍後發送。`;
    }

    // 處理天氣查詢
    if (weatherMatch) {
        const location = text.replace(/(?:天氣|weather|氣象)/gi, '').trim() || '台北';
        const weatherResult = await getWeather(location);
        if (weatherResult) return weatherResult;
    }

    // 處理搜尋
    if (searchMatch) {
        const query = text.replace(/(?:搜尋|搜|search|查詢|找)/gi, '').trim();
        if (query) {
            const searchResult = await searchWeb(query);
            if (searchResult) return searchResult;
        }
    }

    // AI 聊天
    const systemPrompt = `你是「小安」，一個專業的智能助理。

你的特點：
- 說話專業、嚴謹、有條理
- 繁體中文回答
- 活潑有創意但不失專業
- 樂於幫助回答問題

你專門負責：
- 家庭聊天陪伴
- 天氣查詢（可用 wttr.in API）
- 網路搜尋（可用 DuckDuckGo API）
- 簡單問題回答
- 家庭公告幫手

家庭成員稱呼：
- 爸爸：老闆（但要保護隱私，不透露他個資）
- 媽媽：Sally
- 兒子：Willie
- 女兒：Alice

請用繁體中文回答，友善且專業。`;

    try {
        const response = await fetch(MINIMAX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': MINIMAX_API_KEY,
                'anthropic-version': '2023-06-01',
                'Authorization': `Bearer ${MINIMAX_API_KEY}`
            },
            body: JSON.stringify({
                model: 'MiniMax-M2.7',
                max_tokens: 800,
                temperature: 0.7,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: `[發話人資料]
用戶名稱：${userName}
用戶ID：${userId}
是否是群組：${isGroup ? '是' : '否'}

[訊息內容]
${filteredText || text}` }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ MiniMax API error:', response.status, errorText);
            return `⚠️ AI 回應失敗（${response.status}），請稍後再試`;
        }

        const data = await response.json();
        
        let reply = '';
        if (data.content && Array.isArray(data.content)) {
            for (const item of data.content) {
                if (item.type === 'text' && item.text) {
                    reply = item.text;
                    break;
                }
            }
        }
        
        if (!reply) {
            reply = '⚠️ 無法理解，請重新輸入';
        }
        
        // 隱私檢查（輸出）
        for (const kw of privacyKeywords) {
            if (reply.includes(kw) && kw !== '老闆') {
                reply = reply.replace(new RegExp(kw, 'g'), '***');
            }
        }
        
        console.log('✅ Generated reply:', reply.substring(0, 100));
        return reply;
        
    } catch (error) {
        console.error('❌ MiniMax error:', error.message);
        return `⚠️ AI 系統錯誤：${error.message}`;
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
// 推送訊息到用戶
// =====================================================

async function pushMessage(userId, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return { success: false };
    
    try {
        const response = await fetch(`${LINE_API_BASE}/bot/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text: text }]
            })
        });
        return { success: response.ok };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =====================================================
// 幫助訊息
// =====================================================

function getHelpMessage() {
    return `📱 小安智能助理 - 家族版

👋 你好！我是小安AI助理

💬 聊天功能：
• 直接輸入任何問題
• 天氣：輸入「台北天氣」
• 搜尋：輸入「搜尋xxx」

📢 公告功能：
• 家族重要通知
• 聯繫管理員

🔒 隱私保護：
• 不透露老闆個資
• 敏感資料自動過濾

輸入「幫助」顯示此訊息 🙏`;
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
        return;
    }
    
    console.log(`📨 Processing ${events.length} event(s)`);
    
    events.forEach(async event => {
        console.log(`🔔 Event type: ${event.type}`);
        
        // 跟進歡迎訊息
        if (event.type === 'follow') {
            await replyMessage(event.replyToken, 
`🎉 感謝您加入小安智能助理！

👋 我是家族版小安

可以幫您：
💬 聊天、問答
🌤️ 天氣查詢
🔍 網路搜尋
📢 家庭公告

輸入「幫助」查看功能 🙏`);
        }
        // 訊息處理
        else if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text.trim();
            console.log(`💬 Message: ${text}`);
            
            // 偵測群組
            const isGroup = event.source?.type === 'group';
            const groupId = event.source?.groupId || null;
            const userId = event.source?.userId || '';
            console.log(`📍 Group: ${isGroup}, groupId: ${groupId}, userId: ${userId}`);
            
            // 取得用戶名稱
            let userName = '家人';
            if (userId) {
                const profile = await getUserProfile(userId, groupId);
                if (profile && profile.displayName) {
                    userName = profile.displayName;
                }
            }
            console.log(`👤 User name: ${userName}`);
            
            // 幫助指令
            if (text === '幫助' || text === 'help' || text === '?' || text === '/help') {
                await replyMessage(event.replyToken, getHelpMessage());
                return;
            }
            
            
            // AI 回覆（帶用戶名稱）
            const context = { isGroup, userName, userId };
            const aiReply = await askMiniMax(text, context);
            
            // 群組訊息 → 回覆到群組（用 replyToken）
            // 個人訊息 → 推送到用戶（用 userId）
            if (isGroup) {
                // 群組：用 replyToken 回覆到群組
                await replyMessage(event.replyToken, aiReply);
            } else {
                // 個人：用 pushMessage 發送
                const pushUserId = userId || 'Uad991d6c2defed9e2de07a16445c39bc';
                await pushMessage(pushUserId, aiReply);
            }
        }
    });
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    console.log('✅ GET /webhook');
    res.status(200).send('小安智能助理 - 家族版 Webhook 運作中 ✅');
});

module.exports = {
    router,
};