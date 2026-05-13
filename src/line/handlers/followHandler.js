/**
 * LINE 餐廳候補位系統 - 關注事件處理器
 * 
 * 處理 follow（加入好友）和 unfollow（封鎖/刪除）事件
 */

const lineConfig = require('../../../config/line');

/**
 * 處理 follow 事件
 * 當使用者加入 LINE 官方帳號為好友時觸發
 * 
 * @param {object} event - LINE Webhook 事件
 * @param {object} dependencies - 依賴注入
 */
async function handleFollow(event, { lineClient, repositories, flexMessages }) {
    const userId = event.source?.userId;
    const replyToken = event.replyToken;

    if (!userId) {
        console.warn('⚠️ Follow event without userId');
        return;
    }

    console.log(`👋 New follower: ${userId}`);

    try {
        // 嘗試取得 LINE 使用者資料
        let profile;
        try {
            profile = await lineClient.getProfile(userId);
        } catch (profileError) {
            // 無法取得 profile（例如使用者隱藏個資），使用預設值
            console.warn('⚠️ Cannot get user profile, using defaults');
            profile = {
                displayName: 'LINE 使用者',
                userId: userId,
            };
        }

        // 檢查是否已存在該消費者
        let customer = await repositories.customerRepository.getCustomerByLineUserId(userId);

        if (!customer) {
            // 建立新消費者資料
            customer = await repositories.customerRepository.createCustomer({
                line_user_id: userId,
                display_name: profile.displayName || 'LINE 使用者',
                phone: null, // 初次建立不要求電話
            });
            console.log(`✅ New customer created: ${customer.id}`);
        } else {
            // 更新顯示名稱
            await repositories.customerRepository.updateCustomer(customer.id, {
                display_name: profile.displayName,
            });
            console.log(`✅ Customer updated: ${customer.id}`);
        }

        // 發送歡迎訊息
        const welcomeMessage = flexMessages.createWelcomeFlex(profile.displayName);
        await lineClient.replyMessage(replyToken, welcomeMessage);

    } catch (error) {
        console.error('❌ handleFollow error:', error);
        // 即使失敗也回應 OK，避免 webhook 重試
        try {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '👋 感謝您加入！我們將為您提供即時排隊服務。',
            });
        } catch (replyError) {
            console.error('❌ Reply welcome message failed:', replyError.message);
        }
    }
}

/**
 * 處理 unfollow 事件
 * 當使用者封鎖或刪除 LINE 官方帳號時觸發
 * 
 * @param {object} event - LINE Webhook 事件
 * @param {object} dependencies - 依賴注入
 */
async function handleUnfollow(event, { lineClient, repositories }) {
    const userId = event.source?.userId;

    if (!userId) {
        console.warn('⚠️ Unfollow event without userId');
        return;
    }

    console.log(`👋 User unfollowed: ${userId}`);

    try {
        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerByLineUserId(userId);

        if (customer) {
            // 可選：標記為已封鎖（不刪除資料，保留歷史記錄）
            // await repositories.customerRepository.updateCustomer(customer.id, {
            //     is_blocked: true,
            //     blocked_at: new Date(),
            // });

            console.log(`📝 Customer ${customer.id} has unfollowed the official account`);
        }

        // 取消該使用者的 rich menu 連結（如果有）
        try {
            await lineClient.unlinkRichMenuFromUser(userId);
        } catch (richMenuError) {
            // 忽略 rich menu 錯誤
            console.log(`ℹ️ No rich menu to unlink for user ${userId}`);
        }

    } catch (error) {
        console.error('❌ handleUnfollow error:', error);
        // unfollow 事件不需要回應
    }
}

/**
 * 處理 join 事件
 * 當 Bot 被加入 Group 或 Room 時觸發
 * 
 * @param {object} event - LINE Webhook 事件
 * @param {object} dependencies - 依賴
 */
async function handleJoin(event, { lineClient }) {
    const sourceType = event.source?.type; // 'group' 或 'room'
    const sourceId = event.source?.groupId || event.source?.roomId;

    console.log(`🤝 Bot joined ${sourceType}: ${sourceId}`);

    try {
        // 可選：發送歡迎訊息至 Group/Room
        // await lineClient.pushMessage(sourceId, {
        //     type: 'text',
        //     text: '👋 大家好！我是排隊管理機器人。',
        // });
    } catch (error) {
        console.error('❌ handleJoin error:', error);
    }
}

/**
 * 處理 leave 事件
 * 當 Bot 被從 Group 或 Room 移除時觸發
 * 
 * @param {object} event - LINE Webhook 事件
 * @param {object} dependencies - 依賴
 */
async function handleLeave(event, { lineClient }) {
    const sourceType = event.source?.type; // 'group' 或 'room'
    const sourceId = event.source?.groupId || event.source?.roomId;

    console.log(`👋 Bot left ${sourceType}: ${sourceId}`);

    // 可選：清理與該 Group/Room 相關的資料
    // await repositories.cleanupGroupData(sourceId);
}

module.exports = {
    handleFollow,
    handleUnfollow,
    handleJoin,
    handleLeave,
};