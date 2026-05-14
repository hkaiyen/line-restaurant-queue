/**
 * LINE 小安智能助理 - OpenClaw 轉發版
 * 所有命令轉發到 VPS OpenClaw Gateway
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// 設定
// =====================================================

// OpenClaw Gateway 設定
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://104.168.53.32:18789/v1/chat/completions';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '6e27d4f27e30a18584bc529d39dfc75c7f3a5c6cdf3267fc'; // 需要替換
const AGENT_NAME = process.env.AGENT_NAME || 'xiao-an'; // 小安 agent

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// LINE 用戶資料取得
// =====================================================

async function getUserProfile(userId, groupId = null) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken || !userId) return null;
    
    try {
        let url;
        if (groupId) {
            url = `${LINE_API_BASE}/bot/group/${groupId}/member/${userId}`;
        } else {
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
// LINE 回覆功能
// =====================================================

async function replyMessage(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return { success: false, error: 'No token' };
    
    const body = {
        replyToken: replyToken,
        messages: [{ type: 'text', text: text }]
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
        return { success: response.ok };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =====================================================
// LINE 推播訊息
// =====================================================

async function pushMessage(to, text) {
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
                to: to,
                messages: [{ type: 'text', text: text }]
            })
        });
        return { success: response.ok };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =====================================================
// 發送到 OpenClaw Gateway
// =====================================================

async function sendToOpenClaw(message, userName = '家人') {
    console.log('🤖 發送到 OpenClaw Gateway:', OPENCLAW_URL);
    
    const systemPrompt = `你是「小安」，一個專業的智能助理。

稱呼：
- 老闆：就是老闆，永遠稱呼他「老闆」
- 媽媽：Sally
- 兒子：Willie
- 女兒：Alice

你的特點：
- 說話專業、嚴謹、有條理
- 繁體中文回答
- 活潑有創意但不失專業
- 樂於幫助回答問題

你專門負責：
- 家庭聊天陪伴
- 天氣查詢
- 網路搜尋
- 即時新聞
- 家庭公告幫手
- 提醒設定
- 待辦事項管理
- 股市分析
- 研究報告

請用繁體中文回答，友善且專業。`;

    try {
        const response = await fetch(OPENCLAW_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENCLAW_TOKEN}`
            },
            body: JSON.stringify({
                model: AGENT_NAME, // 使用小安 agent
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });

        console.log('📬 OpenClaw response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenClaw API error:', response.status, errorText);
            return `⚠️ AI 回應失敗（${response.status}），請稍後再試`;
        }

        const data = await response.json();
        
        let reply = '';
        if (data.choices && data.choices[0] && data.choices[0].message) {
            reply = data.choices[0].message.content;
        } else if (data.content && Array.isArray(data.content)) {
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
        
        console.log('✅ OpenClaw reply:', reply.substring(0, 100));
        return reply;
        
    } catch (error) {
        console.error('❌ OpenClaw error:', error.message);
        return `⚠️ 連線錯誤：${error.message}`;
    }
}

// =====================================================
// 幫助訊息
// =====================================================

function getHelpMessage() {
    return `📱 小安智能助理 - OpenClaw 版

👋 你好！我是小安 AI 助理

💬 我可以幫您：
• 聊天、問答
• 天氣查詢
• 網路搜尋
• 即時新聞
• 股市分析
• 研究報告
• 家庭公告（/公告）
• 提醒設定（/提醒）
• 待辦事項（待辦、待辦清單）

🔧 家族群組：
• 輸入「幫助」顯示此訊息

輸入任何問題，我為您解答！ 🙏`;
}

// =====================================================
// LINE Webhook 路由
// =====================================================

router.post('/', (req, res) => {
    console.log('✅ POST /webhook received');
    
    res.status(200).send('OK');
    
    const events = req.body.events;
    if (!events || events.length === 0) return;
    
    console.log(`📨 Processing ${events.length} event(s)`);
    
    events.forEach(async event => {
        console.log(`🔔 Event type: ${event.type}`);
        
        if (event.type === 'follow') {
            await replyMessage(event.replyToken, 
`🎉 感謝您加入小安智能助理！

👋 我是家族版小安

可以幫您：
💬 聊天、問答
🌤️ 天氣查詢
🔍 網路搜尋
📰 即時新聞
📊 股市分析
📝 研究報告

輸入「幫助」查看功能 🙏`);
        }
        else if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text.trim();
            console.log(`💬 Message: ${text}`);
            
            const isGroup = event.source?.type === 'group';
            const groupId = event.source?.groupId || null;
            const userId = event.source?.userId || '';
            
            // 群組訊息：只回覆有提到 @小安 的訊息
            if (isGroup && !text.includes('@小安') && !text.includes('@小安智能助理')) {
                console.log('📝 群組訊息但未提及 Bot，忽略');
                return;
            }
            
            // 取得用戶名稱
            let userName = '家人';
            if (userId) {
                const profile = await getUserProfile(userId, groupId);
                if (profile && profile.displayName) {
                    userName = profile.displayName;
                }
            }
            
            // 移除 mention
            const cleanText = text.replace(/@小安智能助理|@小安/g, '').trim();
            
            console.log(`👤 User: ${userName}, Text: ${cleanText}`);
            
            // 幫助指令
            if (cleanText === '幫助' || cleanText === 'help' || cleanText === '?' || cleanText === '/help') {
                await replyMessage(event.replyToken, getHelpMessage());
                return;
            }
            
            // 發送到 OpenClaw Gateway
            const openClawReply = await sendToOpenClaw(cleanText, userName);
            
            // 回覆 LINE
            if (isGroup) {
                await replyMessage(event.replyToken, openClawReply);
            } else {
                await pushMessage(userId, openClawReply);
            }
        }
    });
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    res.status(200).send('小安智能助理 - OpenClaw 版 Webhook 運作中 ✅');
});

module.exports = {
    router,
};