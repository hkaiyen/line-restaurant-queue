/**
 * LINE 餐廳候補位系統 - 離開事件處理器
 * 
 * 處理 leave（離開群組）事件
 * 當 Bot 被移除時的清理工作
 */

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
    handleJoin,
    handleLeave,
};