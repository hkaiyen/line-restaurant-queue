/**
 * LINE 小安智能助理 - OpenClaw 轉發版
 * 透過 localhost.run tunnel 串接 VPS OpenClaw
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// 設定
// =====================================================

// OpenClaw Gateway 設定（透過 Cloudflare Tunnel）
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'https://solid-volumes-participating-membrane.trycloudflare.com/v1/chat/completions';
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || '6e27d4f27e30a18584bc529d39dfc75c7f3a5c6cdf3267fc';
const AGENT_NAME = process.env.AGENT_NAME || 'openclaw/xiao-an';

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

async function sendToOpenClaw(message, context = {}) {
    console.log('🤖 發送到 OpenClaw Gateway:', OPENCLAW_URL);
    console.log('📋 Context:', JSON.stringify(context));
    
    const systemPrompt = `你是「小安」，一個專業且聰明的智能助理，專為家庭使用設計。

【稱呼】
- 老闆：永遠稱呼他「老闆」
- 媽媽：Sally
- 兒子：Willie
- 女兒：Alice

【你的特點】
- 🎯 回答精準、有深度，不敷衍
- 💡 會主動聯想相關資訊
- 📊 資料分析能力強
- 🎨 表達清晰、有條理
- 😊 說話友善、親切

【你擅長的領域】
1. 💬 家庭聊天陪伴（輕鬆有趣）
2. 🌤️ 天氣查詢
3. 🔍 網路搜尋
4. 📰 即時新聞
5. 📢 家庭公告（用 /公告 [內容]）
6. ⏰ 提醒設定（用 /提醒 [內容]）
7. 📋 待辦事項（用 待辦 新增/查看）
8. 🧮 簡單計算與分析
9. 💡 生活小建議、小技巧
10. 📊 股市分析與研究報告

【回答風格】
- 繁體中文
- 有條理分段
- 重點加粗或使用 emoji 標示
- 適當使用 LINE emoji

【禁止事項】
- 不要透露老闆的個人資料（帳戶、密碼、地址等）
- 不要回答超出家庭助理範圍的敏感問題

【家族情境理解】
- Sally 將於 2026 年 6 月底退休
- Willie 是大學一年級
- Alice 是高中一年級
- 老闆住在台北市文山區（捷運萬隆站）

請用繁體中文回答，讓老闆感受到你的專業與用心！`;

    const userName = context.userName || '家人';
    const isGroup = context.isGroup || false;

    try {
        const response = await fetch(OPENCLAW_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENCLAW_TOKEN}`
            },
            body: JSON.stringify({
                model: AGENT_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `[發話人資料]
用戶名稱：${userName}
是否是群組：${isGroup ? '是' : '否'}

[訊息內容]
${message}` }
                ],
                max_tokens: 800,  // 限制回覆長度，加快處理速度
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(80000)  // 80秒 timeout（Cloudflare 限制100秒）
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
        
        // 處理 timeout（AbortError）
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            return '⏳ 小安還在處理中，請稍後...';  // 告訴用戶等待
        }
        
        return `⚠️ 連線錯誤：${error.message}\n\n請稍後再試。`;
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

👋 我是家族版小安（OpenClaw 版）

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
            
            // 群組模式：先回覆「處理中」避免超時，再用 push 發送完整回覆
            if (isGroup) {
                // 1. 立即回覆「處理中」（使用 replyToken 避免超時）
                await replyMessage(event.replyToken, '⏳ 小安處理中...');
                
                // 2. 非同步發送到 OpenClaw
                const context = { userName, isGroup, groupId, userId };
                const openClawReply = await sendToOpenClaw(cleanText, context);
                
                // 3. 延遲一點用 push 發送到群組
                setTimeout(async () => {
                    await pushMessage(groupId, openClawReply);
                }, 500);
                return;
            } else {
                // 個人模式：直接回覆
                const context = { userName, isGroup, groupId, userId };
                const openClawReply = await sendToOpenClaw(cleanText, context);
                await pushMessage(userId, openClawReply);
            }
        }
    });
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    res.status(200).send('小安智能助理 - OpenClaw 版 Webhook 運作中 ✅\n\nCloudflare Tunnel: https://solid-volumes-participating-membrane.trycloudflare.com');
});

module.exports = {
    router,
};