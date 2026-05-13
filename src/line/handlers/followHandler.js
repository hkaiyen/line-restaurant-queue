/**
 * LINE 餐廳候補位系統 - 跟隨事件處理器（簡化版）
 */

async function handleFollow(event, { lineClient, repositories, flexMessages }) {
    const { source, replyToken } = event;
    
    if (!replyToken) return;
    
    const userId = source.userId;
    
    console.log(`👋 New follower: ${userId}`);

    try {
        await lineClient.replyMessage(replyToken, {
            type: 'text',
            text: `🎉 感謝您加入小安智能助理！

🍹 LINE 餐廳候補位系統

這個 Bot 可以幫您：
🔢 加入餐廳排隊
📋 查詢排隊狀態
📅 線上預約座位
❓ 輸入「幫助」查看操作說明

如有問題，請聯繫餐廳服務人員。`,
        });
    } catch (error) {
        console.error('❌ handleFollow error:', error.message);
    }
}

async function handleUnfollow(event, { lineClient }) {
    const { source } = event;
    const userId = source.userId;
    console.log(`👋 User unfollowed: ${userId}`);
}

module.exports = {
    handleFollow,
    handleUnfollow,
};