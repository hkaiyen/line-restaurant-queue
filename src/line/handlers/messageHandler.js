/**
 * LINE 餐廳候補位系統 - 訊息事件處理器
 * 
 * 實作完整的文字對話流程：
 * - 「排隊」/「加入」→ 問「幾位？」→ 問「電話？」→ 確認後加入排隊
 * - 「查詢」/「我的號碼」→ 回覆目前排隊狀態
 * - 「取消」→ 確認取消排隊
 * - 「幫助」→ 顯示操作說明
 * - 「叫號」→ 餐廳端叫下一位（需驗證是否為餐廳管理者）
 */

const repositories = require('../../repositories');
const lineConfig = require('../../../config/line');
const flexMessages = require('../messages/flexMessages');

// =====================================================
// 消費者對話狀態（記憶用戶的對話階段）
// =====================================================

// userState: { step: 'idle'|'asking_party_size'|'asking_phone', data: {...} }
// 管理員狀態: { step: 'awaiting_call_confirm', restaurantId }
const userStates = new Map();

// LINE API Base
const LINE_API_BASE = 'https://api.line.me/v2';

// 餐廳管理員 LINE IDs（可從資料庫或環境變數載入）
const ADMIN_LINE_IDS = (process.env.ADMIN_LINE_IDS || '').split(',').filter(Boolean);

// =====================================================
// LINE 推播訊息
// =====================================================

async function pushMessage(to, flexContent, altText = '通知') {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return;

    try {
        await fetch(`${LINE_API_BASE}/bot/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                to: to,
                messages: [{ type: 'flex', altText, contents: flexContent }],
            }),
        });
    } catch (error) {
        console.error('❌ Push message error:', error.message);
    }
}

// =====================================================
// 取得或建立消費者資料
// =====================================================

async function getOrCreateCustomer(userId, displayName = '顧客') {
    let customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
    if (!customer) {
        customer = await repositories.customerRepository.createCustomer({
            lineUserId: userId,
            displayName: displayName,
        });
    }
    return customer;
}

// =====================================================
// 訊息處理主函數
// =====================================================

async function handleMessage(event, context = {}) {
    const { message, source, replyToken } = event;

    if (!replyToken) return;
    if (source.type !== 'user' && source.type !== 'group') return;

    const userId = source.userId;
    const isGroup = source.type === 'group';

    // 跳過群組中未提及機器的訊息
    if (isGroup) {
        const text = message.text || '';
        if (!text.includes('@')) return;
    }

    if (message.type !== 'text') {
        await replySimpleText(replyToken, '👋 您好！請輸入文字訊息，或輸入「幫助」查看操作說明。');
        return;
    }

    const rawText = message.text.trim();
    const text = rawText.replace(/@\S+/g, '').trim(); // 移除 mention
    const upperText = text.toUpperCase();

    console.log(`📨 Message from ${userId}: ${text}`);

    try {
        // -------------------- 幫助 --------------------
        if (upperText === '幫助' || upperText === 'HELP') {
            await replyFlex(replyToken, flexMessages.createHelpFlex());
            userStates.delete(userId);
            return;
        }

        // -------------------- 叫號（需管理員驗證） --------------------
        if (upperText === '叫號') {
            if (!ADMIN_LINE_IDS.includes(userId)) {
                await replySimpleText(replyToken, '⚠️ 您無權使用叫號功能。\n\n此功能僅提供餐廳管理人員使用。');
            } else {
                // 取得第一個餐廳叫號（或可擴展為選擇餐廳）
                const restaurants = await repositories.restaurantRepository.getAllRestaurants();
                if (restaurants.length === 0) {
                    await replySimpleText(replyToken, '⚠️ 目前系統中沒有餐廳資料。');
                } else {
                    const restaurant = restaurants[0];
                    const result = await callNextAndNotify(restaurant.id);
                    if (result.called) {
                        await replySimpleText(replyToken,
                            `📢 已叫號！\n\n號碼：第 ${result.queueEntry.queueNumber} 號\n人數：${result.queueEntry.partySize} 人\n顧客：${result.customer?.displayName || '未知'}`);
                    } else {
                        await replySimpleText(replyToken, '📭 目前沒有排隊中的消費者。');
                    }
                }
            }
            return;
        }

        // -------------------- 查詢 --------------------
        if (upperText === '查詢' || upperText === '我的號碼' || upperText === '狀態') {
            await handleQueryQueueStatus(userId, replyToken);
            userStates.delete(userId);
            return;
        }

        // -------------------- 取消 --------------------
        if (upperText === '取消') {
            await handleCancelQueue(userId, replyToken);
            userStates.delete(userId);
            return;
        }

        // -------------------- 排隊 / 加入 --------------------
        if (upperText === '排隊' || upperText === '加入' || upperText === 'JOIN') {
            // 先取得餐廳列表供選擇
            const restaurants = await repositories.restaurantRepository.getAllRestaurants();
            if (restaurants.length === 0) {
                await replySimpleText(replyToken, '⚠️ 目前沒有開放排隊的餐廳，請稍後再試。');
                return;
            }
            if (restaurants.length === 1) {
                // 只有一家餐廳，直接問人數
                const state = {
                    step: 'asking_party_size',
                    restaurantId: restaurants[0].id,
                    restaurantName: restaurants[0].name,
                };
                userStates.set(userId, state);
                await replyFlex(replyToken, flexMessages.createPartySizeSelectionFlex({
                    restaurantId: restaurants[0].id,
                    restaurantName: restaurants[0].name,
                }));
            } else {
                // 多家餐廳，显示选择气泡
                await replyRestaurantSelection(replyToken, restaurants, userId);
            }
            return;
        }

        // -------------------- 人數選擇（已進入流程） --------------------
        const state = userStates.get(userId);

        if (state?.step === 'asking_party_size') {
            const partySize = parseInt(text, 10);
            if (isNaN(partySize) || partySize < 1 || partySize > 20) {
                await replySimpleText(replyToken, '⚠️ 請輸入有效的人數（1-20人），或點擊上方按鈕選擇。');
                return;
            }
            state.step = 'asking_phone';
            state.partySize = partySize;
            userStates.set(userId, state);

            await replySimpleText(replyToken,
                `📞 您填寫的人數：${partySize} 人\n\n請輸入您的聯絡電話（範例：0912345678）：`
            );
            return;
        }

        if (state?.step === 'asking_phone') {
            const phone = text.trim();
            if (!/^[\d\-]{7,15}$/.test(phone.replace(/\s/g, ''))) {
                await replySimpleText(replyToken, '⚠️ 電話格式有誤，請輸入正確的電話號碼（範例：0912345678）：');
                return;
            }
            // 更新電話
            const customer = await getOrCreateCustomer(userId);
            await repositories.customerRepository.updateCustomer(customer.id, { phone });

            // 加入排隊
            const result = await handleJoinQueue(userId, state.restaurantId, state.partySize, phone);
            userStates.delete(userId);

            if (result.success) {
                await replyFlex(replyToken, flexMessages.createQueueJoinedFlex({
                    queueNumber: result.queueNumber,
                    restaurantName: state.restaurantName,
                    position: result.position,
                    partySize: state.partySize,
                }));
            } else {
                await replySimpleText(replyToken, `❌ 加入排隊失敗：${result.error}`);
            }
            return;
        }

        // -------------------- 未知訊息 --------------------
        await replyFlex(replyToken, flexMessages.createHelpFlex());

    } catch (error) {
        console.error('❌ handleMessage error:', error.message);
        await replySimpleText(replyToken, '⚠️ 系統錯誤，請稍後再試。');
    }
}

// =====================================================
// 查詢排隊狀態
// =====================================================

async function handleQueryQueueStatus(userId, replyToken) {
    // 找到消費者最新的 waiting 排隊記錄
    const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
    if (!customer) {
        await replySimpleText(replyToken, '📭 您目前沒有在任何餐廳排隊。\n\n輸入「排隊」或「加入」開始排隊！');
        return;
    }

    // 取得所有餐廳的排隊名單，找消費者的記錄
    const restaurants = await repositories.restaurantRepository.getAllRestaurants();
    let myEntry = null;
    let myRestaurant = null;

    for (const restaurant of restaurants) {
        const queueList = await repositories.queueRepository.getQueueListByRestaurant(restaurant.id, 'waiting');
        const entry = queueList.find(e => e.customerId === customer.id || e.customer_id === customer.id);
        if (entry) {
            myEntry = entry;
            myRestaurant = restaurant;
            break;
        }
    }

    if (!myEntry) {
        // 檢查是否有被叫到的記錄
        await replySimpleText(replyToken, '📭 您目前沒有在任何餐廳排隊。\n\n輸入「排隊」或「加入」開始排隊！');
        return;
    }

    const position = await calculatePosition(myRestaurant.id, myEntry.queueNumber);
    await replyFlex(replyToken, flexMessages.createQueueStatusFlex({
        queueNumber: myEntry.queueNumber || myEntry.queue_number,
        position: position,
        partySize: myEntry.partySize || myEntry.party_size,
        joinedAt: myEntry.joinedAt || myEntry.joined_at,
    }));
}

// =====================================================
// 取消排隊
// =====================================================

async function handleCancelQueue(userId, replyToken) {
    const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);
    if (!customer) {
        await replySimpleText(replyToken, '📭 您目前沒有在任何餐廳排隊，無法取消。');
        return;
    }

    // 找消費者的排隊記錄
    const restaurants = await repositories.restaurantRepository.getAllRestaurants();
    let myEntry = null;
    let myRestaurant = null;

    for (const restaurant of restaurants) {
        const queueList = await repositories.queueRepository.getQueueListByRestaurant(restaurant.id, 'waiting');
        const entry = queueList.find(e => e.customerId === customer.id || e.customer_id === customer.id);
        if (entry) {
            myEntry = entry;
            myRestaurant = restaurant;
            break;
        }
    }

    if (!myEntry) {
        await replySimpleText(replyToken, '📭 您目前沒有在任何餐廳排隊，無法取消。');
        return;
    }

    try {
        await repositories.queueRepository.cancelQueue(myEntry.id || myEntry.queueEntryId);
        await replySimpleText(replyToken, `✅ 已成功取消排隊（號碼：第 ${myEntry.queueNumber || myEntry.queue_number} 號）。\n\n感謝您的使用，期待下次為您服務！`);
    } catch (error) {
        await replySimpleText(replyToken, `❌ 取消排隊失敗：${error.message}`);
    }
}

// =====================================================
// 加入排隊核心邏輯
// =====================================================

async function handleJoinQueue(userId, restaurantId, partySize, phone) {
    try {
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        if (!restaurant) {
            return { success: false, error: '找不到指定的餐廳' };
        }

        // 確保消費者存在
        const customer = await getOrCreateCustomer(userId);
        if (phone) {
            await repositories.customerRepository.updateCustomer(customer.id, { phone });
        }

        // 檢查是否已在排隊中
        const existingQueues = await repositories.queueRepository.getQueueListByRestaurant(restaurantId, 'waiting');
        const existingEntry = existingQueues.find(e => (e.customerId || e.customer_id) === customer.id);
        if (existingEntry) {
            return { success: false, error: '您已在排隊中，請勿重複加入' };
        }

        // 加入排隊
        const queueEntry = await repositories.queueRepository.joinQueue({
            restaurantId: restaurantId,
            customerId: customer.id,
            partySize: partySize,
            source: 'line_walk_in',
        });

        // 計算順位
        const position = await calculatePosition(restaurantId, queueEntry.queueNumber);

        return {
            success: true,
            queueNumber: queueEntry.queueNumber,
            position: position,
            estimatedWait: position * (restaurant.avgMealDurationMinutes || 30),
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =====================================================
// 叫下一位並發送通知
// =====================================================

async function callNextAndNotify(restaurantId) {
    const queueEntry = await repositories.queueRepository.callNext(restaurantId);
    if (!queueEntry) {
        return { called: false };
    }

    const customer = await repositories.customerRepository.getCustomerById(queueEntry.customerId || queueEntry.customer_id);
    const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);

    if (customer?.lineUserId) {
        try {
            await pushMessage(customer.lineUserId, flexMessages.createCalledFlex({
                ...queueEntry,
                restaurantName: restaurant?.name || '餐廳',
            }), '🎉 輪到您了！');
        } catch (error) {
            console.warn('⚠️ 發送叫號通知失敗：', error.message);
        }
    }

    return {
        called: true,
        queueEntry,
        customer,
    };
}

// =====================================================
// 計算排隊順位
// =====================================================

async function calculatePosition(restaurantId, queueNumber) {
    const queueList = await repositories.queueRepository.getQueueListByRestaurant(restaurantId, 'waiting');
    let position = 1;
    for (const entry of queueList) {
        const num = entry.queueNumber || entry.queue_number;
        if (num < queueNumber) {
            position++;
        } else {
            break;
        }
    }
    return position;
}

// =====================================================
// 回覆工具函數
// =====================================================

async function replySimpleText(replyToken, text) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return;

    await fetch(`${LINE_API_BASE}/bot/message/reply`, {
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
}

async function replyFlex(replyToken, flexContent) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return;

    await fetch(`${LINE_API_BASE}/bot/message/reply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            replyToken,
            messages: [{ type: 'flex', altText: flexContent.altText || '通知', contents: flexContent.contents || flexContent }],
        }),
    });
}

// =====================================================
// 餐廳選擇訊息（當有多家餐廳時）
// =====================================================

async function replyRestaurantSelection(replyToken, restaurants, userId) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) return;

    const bubble = {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '🏪 選擇餐廳',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FFFFFF',
                },
            ],
            backgroundColor: lineConfig.flexMessages.colors.primary,
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '請選擇您要前往的餐廳：',
                    wrap: true,
                    size: 'md',
                },
                { type: 'spacer', size: 'md' },
                ...restaurants.slice(0, 5).map(r => ({
                    type: 'button',
                    style: 'secondary',
                    height: 'sm',
                    action: {
                        type: 'postback',
                        label: `🍽️ ${r.name}`,
                        data: `action=select_restaurant&restaurantId=${r.id}&restaurantName=${encodeURIComponent(r.name)}`,
                        displayText: `我要去 ${r.name}`,
                    },
                })),
            ],
        },
    };

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
                altText: '選擇餐廳',
                contents: bubble,
            }],
        }),
    });
}

module.exports = {
    handleMessage,
    userStates, // 匯出讓 postbackHandler 可以使用
};