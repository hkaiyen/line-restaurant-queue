/**
 * LINE 餐廳候補位系統 - 訊息事件處理器（簡化版）
 */

const lineConfig = require('../../../config/line');

// =====================================================
// 訊息處理主函數
// =====================================================

async function handleMessage(event, { lineClient, repositories, flexMessages }) {
    const { message, source, replyToken } = event;
    
    if (!replyToken) {
        console.log('⚠️ No replyToken, ignoring');
        return;
    }

    if (source.type !== 'user') {
        console.log('⚠️ Ignoring non-user message from', source.type);
        return;
    }

    const userId = source.userId;

    console.log(`📨 Message from ${userId}: ${message.type} - ${message.text || ''}`);

    try {
        if (message.type === 'text') {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: `✅ 收到訊息：${message.text}\n\n這是 LINE 餐廳候補位系統的自動回覆！`,
            });
        } else if (message.type === 'sticker') {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '收到您的貼圖了！🙏',
            });
        } else {
            await lineClient.replyMessage(replyToken, {
                type: 'text',
                text: '👋 您好！歡迎使用 LINE 餐廳候補位系統！\n\n目前只支援文字訊息，請輸入「幫助」查看操作說明。',
            });
        }
    } catch (error) {
        console.error('❌ handleMessage error:', error.message);
    }
}

module.exports = {
    handleMessage,
};