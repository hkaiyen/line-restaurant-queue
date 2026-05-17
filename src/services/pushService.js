/**
 * LINE 餐廳候補位系統 - 推播通知服務
 * 
 * 提供叫號通知、排隊進度通知等功能
 */

const lineConfig = require('../../config/line');

const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// LINE 推播工具
// =====================================================

async function pushMessage(userId, messages) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        console.error('❌ LINE_ACCESS_TOKEN not set');
        return { success: false, error: 'No token' };
    }

    try {
        const response = await fetch(`${LINE_API_BASE}/bot/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                to: userId,
                messages,
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Push failed:', error);
            return { success: false, error: error };
        }
        
        return { success: true };
    } catch (error) {
        console.error('❌ Push error:', error.message);
        return { success: false, error: error.message };
    }
}

// =====================================================
// Flex Message 模板
// =====================================================

function createCalledFlex(queueInfo) {
    return {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '🎉 輪到您了！',
                    weight: 'bold',
                    size: 'xl',
                    color: '#FFD700',
                    align: 'center',
                },
                {
                    type: 'text',
                    text: queueInfo.restaurantName || '安安餐廳',
                    size: 'md',
                    color: '#888888',
                    align: 'center',
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
                    text: `第 ${queueInfo.queueNumber} 號`,
                    weight: 'bold',
                    size: '4xl',
                    color: '#FF6B00',
                    align: 'center',
                },
                {
                    type: 'text',
                    text: `👥 ${queueInfo.partySize || 1} 人`,
                    size: 'lg',
                    align: 'center',
                    margin: 'md',
                },
            ],
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '請準備入座～',
                    weight: 'bold',
                    size: 'lg',
                    color: '#00B900',
                    align: 'center',
                },
                {
                    type: 'text',
                    text: '📞 如有問題請聯絡餐廳',
                    size: 'sm',
                    color: '#888888',
                    align: 'center',
                    margin: 'sm',
                },
            ],
        },
    };
}

function createQueueProgressFlex(queueInfo) {
    return {
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '📋 排隊進度',
                    weight: 'bold',
                    size: 'lg',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
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
                            color: '#00B900',
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
                            text: `${queueInfo.position || 0} 組`,
                            weight: 'bold',
                            color: '#FF6B00',
                            align: 'end',
                        },
                    ],
                },
            ],
        },
    };
}

function createReminderFlex(queueInfo) {
    return {
        type: 'bubble',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: '⏰ 提醒您',
                    weight: 'bold',
                    size: 'lg',
                },
                {
                    type: 'text',
                    text: `您還有 ${queueInfo.restaurantName || '安安餐廳'} 的排隊`,
                    size: 'md',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: `第 ${queueInfo.queueNumber} 號 | ${queueInfo.position || '?'} 組前`,
                    weight: 'bold',
                    size: 'xl',
                    color: '#00B900',
                    margin: 'md',
                },
            ],
        },
    };
}

// =====================================================
// 推播通知服務
// =====================================================

const pushService = {
    /**
     * 發送叫號通知
     */
    async notifyCalled(lineUserId, queueInfo) {
        return await pushMessage(lineUserId, [{
            type: 'flex',
            altText: '🎉 輪到您了！',
            contents: createCalledFlex(queueInfo),
        }]);
    },

    /**
     * 發送排隊進度通知
     */
    async notifyProgress(lineUserId, queueInfo) {
        return await pushMessage(lineUserId, [{
            type: 'flex',
            altText: '📋 排隊進度更新',
            contents: createQueueProgressFlex(queueInfo),
        }]);
    },

    /**
     * 發送排隊提醒
     */
    async notifyReminder(lineUserId, queueInfo) {
        return await pushMessage(lineUserId, [{
            type: 'flex',
            altText: '⏰ 排隊提醒',
            contents: createReminderFlex(queueInfo),
        }]);
    },

    /**
     * 發送簡訊通知
     */
    async notifyText(lineUserId, text) {
        return await pushMessage(lineUserId, [{
            type: 'text',
            text,
        }]);
    },
};

module.exports = pushService;