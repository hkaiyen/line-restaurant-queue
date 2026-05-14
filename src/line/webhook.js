/**
 * LINE 小安智能助理 - 家族群組升級版
 * 具備 AI 聊天、家庭公告、提醒功能、家庭記事
 */

const express = require('express');
const router = express.Router();

const lineConfig = require('../../config/line');

// =====================================================
// 設定
// =====================================================

// MiniMax AI 設定
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_URL = 'https://api.minimax.io/anthropic/v1/messages';

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// 家庭資料（本地儲存示範，生產環境建議用資料庫）
// =====================================================

const familyData = {
    announcements: [],      // 公告歷史
    reminders: [],          // 提醒設定
    todos: [],              // 待辦事項
};

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
// 發送家庭公告
// =====================================================

async function sendAnnouncement(text, groupId, userName = '管理員') {
    if (!groupId) {
        return '⚠️ 群組 ID 無效，無法發送公告';
    }
    
    const announcement = {
        text: text,
        sender: userName,
        time: new Date().toISOString()
    };
    familyData.announcements.push(announcement);
    
    const message = `📢 家庭公告\n\n${text}\n\n───\n發送人：${userName}\n時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
    
    const result = await pushMessage(groupId, message);
    return result.success ? '✅ 公告已發送' : '❌ 發送失敗';
}

// =====================================================
// 設定提醒
// =====================================================

function setReminder(time, text, groupId, userName = '管理員') {
    // time 格式：HH:MM 或 "now"（立即）
    const reminder = {
        time: time,
        text: text,
        sender: userName,
        groupId: groupId,
        created: new Date().toISOString()
    };
    familyData.reminders.push(reminder);
    
    if (time === 'now') {
        // 立即發送到群組
        if (groupId) {
            pushMessage(groupId, `⏰ 提醒：${text}`);
        }
        return `⏰ 提醒：${text}`;
    }
    
    return `✅ 提醒已設定：${time} - ${text}`;
}

// =====================================================
// 鬧鐘檢查（每分鐘檢查）
// =====================================================

function checkReminders() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDate = now.toISOString().split('T')[0];
    
    familyData.reminders = familyData.reminders.filter(reminder => {
        if (reminder.time === currentTime) {
            // 發送提醒到群組
            if (reminder.groupId) {
                pushMessage(reminder.groupId, `⏰ 提醒：${reminder.text}`);
            }
            return false; // 移除已發送的提醒
        }
        return true;
    });
}

// 每分鐘檢查提醒（示範用，生產環境建議用 node-cron）
setInterval(checkReminders, 60000);

// =====================================================
// AI 回覆功能
// =====================================================

async function askMiniMax(userMessage, context = {}) {
    console.log('🤖 askMiniMax called with:', userMessage);
    
    if (!MINIMAX_API_KEY) {
        return '⚠️ AI 功能尚未設定（缺少 API Key）';
    }

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

    // 偵測特殊指令
    const weatherMatch = text.match(/(?:天氣|weather|氣象)/i);
    const searchMatch = text.match(/(?:搜尋|搜|search|查詢|找)/i);
    const announcementMatch = text.match(/^\/公告\s*/);
    const reminderMatch = text.match(/^\/提醒\s*(.+)/i);
    const todoMatch = text.match(/^待辦|^記事|^todo|^記錄/i);
    const helpMatch = text.match(/^幫助|^help|^\?$/i);

    // 處理公告指令
    if (announcementMatch) {
        const content = text.replace(/^\/公告\s*/, '').trim();
        if (!content) {
            return '📢 公告指令用法：\n/公告 [公告內容]\n\n範例：/公告 今天晚上8點全家吃飯';
        }
        return await sendAnnouncement(content, context.groupId, userName);
    }
    
    // 處理提醒指令
    if (reminderMatch) {
        const reminderText = reminderMatch[1].trim();
        // 簡化版：/提醒 [內容]（預設 時間現在）
        return setReminder('now', reminderText, context.groupId, userName);
    }
    
    // 處理待辦指令
    if (todoMatch) {
        // 顯示待辦列表
        if (familyData.todos.length === 0) {
            return '📋 家庭待辦\n\n目前沒有待辦事項\n\n新增待辦：待辦 [事項內容]';
        }
        let response = '📋 家庭待辦\n\n';
        familyData.todos.forEach((todo, i) => {
            response += `${i + 1}. ${todo.text} ${todo.done ? '✅' : '⬜'}\n`;
        });
        return response;
    }
    
    // 處理新增待辦：待辦 [內容]
    if (text.match(/^待辦\s+(.+)/i)) {
        const todoText = text.replace(/^待辦\s+/i, '').trim();
        familyData.todos.push({ text: todoText, done: false, created: new Date().toISOString() });
        return `✅ 已加入待辦：${todoText}\n\n目前共 ${familyData.todos.length} 項待辦`;
    }
    
    // 處理完成待辦：完成 [編號]
    if (text.match(/^完成\s*(\d+)/i)) {
        const num = parseInt(text.match(/^完成\s*(\d+)/i)[1]) - 1;
        if (num >= 0 && num < familyData.todos.length) {
            familyData.todos[num].done = true;
            return `✅ 已完成：${familyData.todos[num].text}`;
        }
        return '❌ 無效的編號';
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
- 家庭公告幫手（用 /公告 [內容] 發送）
- 提醒設定（用 /提醒 [內容] 設定）
- 待辦事項管理（用 待辦 新增事項）

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
        
        return reply;
        
    } catch (error) {
        console.error('❌ MiniMax error:', error.message);
        return `⚠️ AI 系統錯誤：${error.message}`;
    }
}

// =====================================================
// 幫助訊息
// =====================================================

function getHelpMessage() {
    return `📱 小安智能助理 - 家族版

💬 聊天：
• 直接輸入任何問題

🔍 實用功能：
• 天氣：台北天氣
• 搜尋：搜尋xxx

📢 公告功能：
• /公告 [內容] - 發送公告到家族群組

⏰ 提醒功能：
• /提醒 [內容] - 立即提醒

📋 待辦事項：
• 待辦 [事項] - 新增待辦
• 待辦 - 查看所有待辦
• 完成 [編號] - 標記完成

🔒 隱私保護：
• 不透露老闆個資

輸入「幫助」顯示此訊息 🙏`;
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
📢 家庭公告
⏰ 提醒功能
📋 待辦事項

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
            
            if (text === '幫助' || text === 'help' || text === '?' || text === '/help') {
                await replyMessage(event.replyToken, getHelpMessage());
                return;
            }
            
            // 移除 mention（@小安、@小安智能助理）再處理
            const cleanText = text.replace(/@小安智能助理|@小安/g, '').trim();
            
            const context = { isGroup, userName, userId, groupId };
            const aiReply = await askMiniMax(cleanText, context);
            
            if (isGroup) {
                await replyMessage(event.replyToken, aiReply);
            } else {
                await pushMessage(userId, aiReply);
            }
        }
    });
});

// GET / - Webhook 驗證
router.get('/', (req, res) => {
    res.status(200).send('小安智能助理 - 家族版 Webhook 運作中 ✅');
});

module.exports = {
    router,
};