/**
 * LINE 餐廳候補位系統 - Webhook（第二版：資料庫版）
 * 
 * 功能：
 * 1. 連接 PostgreSQL 資料庫（Render.com 雲端資料庫）
 * 2. Flex Message + Quick Reply
 * 3. 「安安餐廳」品牌統一
 * 4. 完整的排隊流程
 */

const express = require('express');
const router = express.Router();
const lineConfig = require('../../config/line');

// Database repositories
const repositories = require('../repositories');

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// 餐廳設定（安安餐廳）
// =====================================================

const RESTAURANT = {
    name: '安安餐廳',
    phone: '02-2931-6688',
    address: '台北市文山區羅斯福路五段15號（萬隆站步行3分鐘）',
    hours: '11:00-21:00（週一至週日）',
    // 預設餐廳 ID（第一次設定時會建立）
    defaultRestaurantId: null,
};

// =====================================================
// LINE 回覆工具
// =====================================================

async function replyText(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN not set');
        return { success: false, error: 'No token' };
    }

    try {
        const response = await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{ type: 'text', text }],
            }),
        });
        console.log('✅ Replied:', text.substring(0, 50));
        return { success: true };
    } catch (error) {
        console.error('❌ Reply error:', error.message);
        return { success: false, error: error.message };
    }
}

async function replyFlex(replyToken, altText, contents) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN not set');
        return { success: false, error: 'No token' };
    }

    try {
        await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{
                    type: 'flex',
                    altText,
                    contents,
                }],
            }),
        });
        console.log('✅ Flex replied:', altText);
        return { success: true };
    } catch (error) {
        console.error('❌ Flex reply error:', error.message);
        return { success: false, error: error.message };
    }
}

async function replyQuickReply(replyToken, text, quickReplyItems) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN not set');
        return { success: false, error: 'No token' };
    }

    try {
        await fetch(`${LINE_API_BASE}/bot/message/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                replyToken,
                messages: [{
                    type: 'text',
                    text,
                    quickReply: {
                        items: quickReplyItems,
                    },
                }],
            }),
        });
        console.log('✅ Quick Reply sent');
        return { success: true };
    } catch (error) {
        console.error('❌ Quick Reply error:', error.message);
        return { success: false, error: error.message };
    }
}

async function pushMessage(userId, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return { success: false, error: 'No token' };

    try {
        await fetch(`${LINE_API_BASE}/bot/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text }],
            }),
        });
        return { success: true };
    } catch (error) {
        console.error('❌ Push error:', error.message);
        return { success: false, error: error.message };
    }
}

// =====================================================
// Flex Message 模板
// =====================================================

function createMenuFlex() {
    return {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '🍹 歡迎使用',
                    weight: 'bold',
                    size: 'xl',
                    color: '#00B900',
                },
                {
                    type: 'text',
                    text: RESTAURANT.name,
                    size: 'lg',
                    color: '#333333',
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '請選擇服務：',
                    color: '#666666',
                    margin: 'md',
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
                {
                    type: 'button',
                    style: 'primary',
                    color: '#00B900',
                    action: {
                        type: 'message',
                        label: '🔢 加入排隊',
                        text: '排隊',
                    },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    action: {
                        type: 'message',
                        label: '📋 我的號碼',
                        text: '查詢',
                    },
                },
                {
                    type: 'button',
                    style: 'secondary',
                    action: {
                        type: 'message',
                        label: '❌ 取消排隊',
                        text: '取消',
                    },
                },
            ],
        },
    };
}

function createQueueSuccessFlex(queueInfo) {
    return {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '✅ 排隊成功！',
                    weight: 'bold',
                    size: 'xl',
                    color: '#00B900',
                },
                {
                    type: 'text',
                    text: RESTAURANT.name,
                    size: 'sm',
                    color: '#888888',
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: '🔢 您的號碼',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `第 ${queueInfo.queueNumber} 號`,
                            weight: 'bold',
                            size: 'xl',
                            color: '#00B900',
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'separator',
                    margin: 'md',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: '👥 人數',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `${queueInfo.partySize} 人`,
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        {
                            type: 'text',
                            text: '⏳ 預估等候',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `${queueInfo.estimatedWaitMinutes || 15} 分鐘`,
                            align: 'end',
                        },
                    ],
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '📝 操作提示',
                    weight: 'bold',
                    size: 'sm',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: '• 輸入「查詢」查看排隊狀態\n• 輸入「取消」取消排隊',
                    size: 'sm',
                    color: '#888888',
                },
            ],
        },
    };
}

function createQueryFlex(queueInfo, position, waitingCount) {
    return {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '📋 排隊資料',
                    weight: 'bold',
                    size: 'xl',
                },
                {
                    type: 'text',
                    text: RESTAURANT.name,
                    size: 'sm',
                    color: '#888888',
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: '🔢 號碼',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `第 ${queueInfo.queueNumber} 號`,
                            weight: 'bold',
                            size: 'xl',
                            color: '#00B900',
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'separator',
                    margin: 'md',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: '👥 人數',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `${queueInfo.partySize} 人`,
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        {
                            type: 'text',
                            text: '⏳ 前方等候',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `${position || 0} 組`,
                            align: 'end',
                            color: '#FF6B00',
                            weight: 'bold',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        {
                            type: 'text',
                            text: '📊 目前排隊',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: `${waitingCount || 0} 組`,
                            align: 'end',
                            color: '#888888',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'sm',
                    contents: [
                        {
                            type: 'text',
                            text: '📊 狀態',
                            color: '#666666',
                        },
                        {
                            type: 'text',
                            text: queueInfo.status === 'waiting' ? '等待中 ⏳' : '已叫號 📢',
                            align: 'end',
                            color: queueInfo.status === 'waiting' ? '#00B900' : '#FF6B00',
                        },
                    ],
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '📞 服務電話',
                    size: 'sm',
                    color: '#888888',
                },
                {
                    type: 'text',
                    text: RESTAURANT.phone,
                    size: 'md',
                    weight: 'bold',
                },
            ],
        },
    };
}

function createHelpFlex() {
    return {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '❓ 幫助說明',
                    weight: 'bold',
                    size: 'xl',
                },
                {
                    type: 'text',
                    text: RESTAURANT.name,
                    size: 'sm',
                    color: '#888888',
                    margin: 'sm',
                },
            ],
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '🔢 加入排隊',
                    weight: 'bold',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: '輸入「排隊」，跟著指示操作',
                    size: 'sm',
                    color: '#666666',
                },
                {
                    type: 'separator',
                    margin: 'md',
                },
                {
                    type: 'text',
                    text: '📋 查詢狀態',
                    weight: 'bold',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: '輸入「查詢」查看排隊號碼',
                    size: 'sm',
                    color: '#666666',
                },
                {
                    type: 'separator',
                    margin: 'md',
                },
                {
                    type: 'text',
                    text: '❌ 取消排隊',
                    weight: 'bold',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: '輸入「取消」取消排隊',
                    size: 'sm',
                    color: '#666666',
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '📞 服務電話',
                    size: 'sm',
                    color: '#888888',
                },
                {
                    type: 'text',
                    text: RESTAURANT.phone,
                    size: 'md',
                    weight: 'bold',
                },
                {
                    type: 'text',
                    text: `🕐 營業時間：${RESTAURANT.hours}`,
                    size: 'sm',
                    color: '#888888',
                    margin: 'sm',
                },
            ],
        },
    };
}

// =====================================================
// Quick Reply 選項
// =====================================================

const QUICK_REPLY_MAIN = {
    items: [
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/yes.png',
            action: {
                type: 'message',
                label: '🔢 加入排隊',
                text: '排隊',
            },
        },
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/info.png',
            action: {
                type: 'message',
                label: '📋 查詢號碼',
                text: '查詢',
            },
        },
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/no.png',
            action: {
                type: 'message',
                label: '❌ 取消排隊',
                text: '取消',
            },
        },
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/phone.png',
            action: {
                type: 'message',
                label: '📞 聯絡我們',
                text: '電話',
            },
        },
    ],
};

const QUICK_REPLY_PARTY_SIZE = {
    items: [
        { type: 'action', action: { type: 'message', label: '1人', text: '1' } },
        { type: 'action', action: { type: 'message', label: '2人', text: '2' } },
        { type: 'action', action: { type: 'message', label: '3人', text: '3' } },
        { type: 'action', action: { type: 'message', label: '4人', text: '4' } },
        { type: 'action', action: { type: 'message', label: '❌ 取消', text: '取消' } },
    ],
};

const QUICK_REPLY_CONFIRM = {
    items: [
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/yes.png',
            action: { type: 'message', label: '✅ 確認', text: '確認' },
        },
        {
            type: 'action',
            imageUrl: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/no.png',
            action: { type: 'message', label: '❌ 取消', text: '取消' },
        },
    ],
};

// =====================================================
// 排隊流程（記憶體狀態，用於對話流程追蹤）
// =====================================================

const userQueueSteps = new Map(); // userId -> { step, restaurantId, customerId, partySize, queueEntryId }

// =====================================================
// 資料庫輔助函數
// =====================================================

async function getOrCreateCustomer(lineUserId, displayName = null) {
    try {
        // 先查詢
        let customer = await repositories.customerRepository.getCustomerByLineUserId(lineUserId);
        
        // 不存在就建立
        if (!customer) {
            customer = await repositories.customerRepository.createCustomer({
                lineUserId,
                displayName: displayName || 'LINE 用戶',
            });
            console.log(`✅ 新消費者建立：${customer.id}`);
        }
        
        return customer;
    } catch (error) {
        console.error('❌ getOrCreateCustomer error:', error.message);
        return null;
    }
}

async function getOrCreateRestaurant() {
    try {
        const channelId = lineConfig.messagingApi.channelId;
        let restaurant = await repositories.restaurantRepository.getRestaurantByLineChannelId(channelId);
        
        if (!restaurant) {
            // 建立新餐廳
            restaurant = await repositories.restaurantRepository.createRestaurant({
                name: RESTAURANT.name,
                lineChannelId: channelId,
                lineChannelSecret: lineConfig.messagingApi.channelSecret,
                lineAccessToken: lineConfig.messagingApi.accessToken,
                address: RESTAURANT.address,
                phone: RESTAURANT.phone,
                totalSeats: 50,
                avgMealDurationMinutes: 30,
                queueMaxSize: 100,
                autoCallEnabled: false,
            });
            console.log(`✅ 新餐廳建立：${restaurant.id}`);
        }
        
        RESTAURANT.defaultRestaurantId = restaurant.id;
        return restaurant;
    } catch (error) {
        console.error('❌ getOrCreateRestaurant error:', error.message);
        return null;
    }
}

function clearUserStep(userId) {
    userQueueSteps.delete(userId);
}

// =====================================================
// Webhook POST 路由
// =====================================================

router.post('/', async (req, res) => {
    console.log('📨 Webhook received');

    // 回應 LINE 確認收到（避免 timeout）
    res.status(200).send('OK');

    const events = req.body?.events;
    if (!events || events.length === 0) {
        console.log('⚠️ No events');
        return;
    }

    events.forEach(async (event) => {
        console.log(`🔔 Event: ${event.type}`);

        // =============================================
        // follow 事件（新用戶加入）
        // =============================================
        if (event.type === 'follow') {
            const lineUserId = event.source?.userId;
            const displayName = event.source?.displayName || 'LINE 用戶';
            
            console.log(`👤 New follower: ${lineUserId}`);
            
            // 建立消費者資料
            await getOrCreateCustomer(lineUserId, displayName);
            
            // 檢查並建立餐廳（如需要）
            await getOrCreateRestaurant();
            
            await replyFlex(event.replyToken, '🎉 歡迎使用 ' + RESTAURANT.name + ' 候補位系統！', createMenuFlex());
            return;
        }

        // =============================================
        // 訊息事件
        // =============================================
        if (event.type === 'message' && event.message?.type === 'text') {
            const userId = event.source?.userId;
            const replyToken = event.replyToken;
            const text = event.message.text.trim();

            console.log(`💬 ${userId}: ${text}`);

            if (!userId || !replyToken) {
                console.log('⚠️ No userId or replyToken');
                return;
            }

            const userStep = userQueueSteps.get(userId);
            const customer = await getOrCreateCustomer(userId);
            const restaurant = await getOrCreateRestaurant();

            // =============================================
            // 幫助
            // =============================================
            if (text === '幫助' || text === 'HELP' || text === '?') {
                await replyFlex(replyToken, '❓ 幫助說明', createHelpFlex());
                return;
            }

            // =============================================
            // 電話
            // =============================================
            if (text === '電話' || text === '聯絡' || text === '地址') {
                await replyText(replyToken,
`📞 聯絡我們

${RESTAURANT.name}
📞 電話：${RESTAURANT.phone}
📍 地址：${RESTAURANT.address}
🕐 營業時間：${RESTAURANT.hours}

歡迎光臨！`);
                return;
            }

            // =============================================
            // 排隊流程
            // =============================================
            if (text === '排隊' || text === '加入' || text === '候補') {
                if (!customer || !restaurant) {
                    await replyText(replyToken, '⚠️ 系統忙碌中，請稍後再試');
                    return;
                }

                // 清除舊狀態
                clearUserStep(userId);

                // 設定新狀態
                userQueueSteps.set(userId, {
                    step: 'party_size',
                    restaurantId: restaurant.id,
                    customerId: customer.id,
                });

                await replyText(replyToken, '🔢 請問幾位用餐？\n\n請選擇或直接輸入數字（1-20）');
                await replyQuickReply(replyToken, '選擇人數：', QUICK_REPLY_PARTY_SIZE);
                return;
            }

            // =============================================
            // 人數回覆（排隊流程中）
            // =============================================
            if (userStep && userStep.step === 'party_size') {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num >= 1 && num <= 20) {
                    userStep.partySize = num;
                    userStep.step = 'confirm';

                    // 計算預估等候時間
                    const estimatedWaitMinutes = num * 10;

                    await replyFlex(replyToken, '✅ 確認排隊資料', createQueueSuccessFlex({
                        queueNumber: '???', // 待確認
                        partySize: num,
                        estimatedWaitMinutes,
                    }));
                    await replyQuickReply(replyToken, '資料正確嗎？', QUICK_REPLY_CONFIRM);
                } else if (text !== '取消') {
                    await replyText(replyToken, '⚠️ 請輸入有效人數（1-20）');
                }
                return;
            }

            // =============================================
            // 確認排隊（排隊流程中）
            // =============================================
            if (userStep && userStep.step === 'confirm') {
                if (text === '確認' || text === 'YES' || text === '是的') {
                    try {
                        // 加入排隊
                        const queueEntry = await repositories.queueRepository.joinQueue({
                            restaurantId: userStep.restaurantId,
                            customerId: userStep.customerId,
                            partySize: userStep.partySize,
                            source: 'walk_in',
                        });

                        userStep.queueEntryId = queueEntry.id;
                        userStep.step = 'waiting';

                        await replyText(replyToken,
`✅ 排隊完成！

📍 餐廳：${RESTAURANT.name}
🔢 您的號碼：第 ${queueEntry.queueNumber} 號
👥 人數：${queueEntry.partySize} 人

⏳ 請留意手機通知，輪到您時會主動提醒！

📝 輸入「查詢」查看排隊狀態
📞 有問題隨時輸入「電話」聯絡我們`);

                        // 推播通知（可選）
                        console.log(`📢 排隊成功：${queueEntry.queueNumber}號`);
                    } catch (error) {
                        console.error('❌ Join queue error:', error.message);
                        await replyText(replyToken, `⚠️ ${error.message || '系統錯誤，請稍後再試'}`);
                    }
                } else if (text === '取消' || text === 'NO') {
                    clearUserStep(userId);
                    await replyText(replyToken, '❌ 已取消排隊\n\n歡迎下次使用！');
                } else {
                    await replyQuickReply(replyToken, '請確認資料是否正確：', QUICK_REPLY_CONFIRM);
                }
                return;
            }

            // =============================================
            // 查詢
            // =============================================
            if (text === '查詢' || text === '我的號碼' || text === '狀態' || text === '号碼') {
                if (!customer || !restaurant) {
                    await replyText(replyToken, '⚠️ 系統忙碌中，請稍後再試');
                    return;
                }

                try {
                    // 取得消費者的排隊資料
                    const queueList = await repositories.queueRepository.getQueueListByRestaurant(
                        restaurant.id,
                        'waiting'
                    );
                    const myEntry = queueList.find(entry => entry.customerId === customer.id);

                    if (myEntry) {
                        // 計算前方等候人數
                        const position = queueList.findIndex(entry => entry.id === myEntry.id) + 1;
                        const waitingCount = queueList.length;

                        await replyFlex(replyToken, '📋 您的排隊資料', createQueryFlex({
                            queueNumber: myEntry.queueNumber,
                            partySize: myEntry.partySize,
                            status: myEntry.status,
                        }, position, waitingCount));
                    } else {
                        // 檢查是否在其他狀態（如已叫號）
                        await replyText(replyToken, '📭 您目前沒有排隊記錄\n\n輸入「排隊」開始排隊！');
                        await replyQuickReply(replyToken, '或者：', QUICK_REPLY_MAIN);
                    }
                } catch (error) {
                    console.error('❌ Query error:', error.message);
                    await replyText(replyToken, '📭 您目前沒有排隊記錄\n\n輸入「排隊」開始排隊！');
                }
                return;
            }

            // =============================================
            // 取消
            // =============================================
            if (text === '取消') {
                if (userStep && userStep.queueEntryId) {
                    // 取消正在進行的排隊流程
                    try {
                        await repositories.queueRepository.cancelQueue(userStep.queueEntryId);
                        clearUserStep(userId);
                        await replyText(replyToken, '✅ 已取消排隊\n\n歡迎下次使用！');
                    } catch (error) {
                        console.error('❌ Cancel error:', error.message);
                        clearUserStep(userId);
                        await replyText(replyToken, '✅ 已取消排隊\n\n歡迎下次使用！');
                    }
                } else {
                    // 檢查是否有其他排隊記錄
                    await replyText(replyToken, '📭 您目前沒有排隊記錄');
                }
                return;
            }

            // =============================================
            // 未知訊息 → 顯示主選單
            // =============================================
            await replyFlex(replyToken, '🍹 ' + RESTAURANT.name + ' 候補位系統', createMenuFlex());
            await replyQuickReply(replyToken, '請選擇服務：', QUICK_REPLY_MAIN);
            return;
        }
    });
});

// GET 驗證
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: `${RESTAURANT.name} 候補位系統 Webhook 運作中 ✅`,
        timestamp: new Date().toISOString(),
        restaurant: RESTAURANT.name,
        features: ['Flex Message', 'Quick Reply', 'Database', 'Push Notification'],
    });
});

module.exports = {
    router,
    RESTAURANT,
};