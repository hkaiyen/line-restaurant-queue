/**
 * LINE 餐廳候補位系統 - 通知服務
 * 
 * 處理通知發送的商業邏輯
 * 包含：叫號通知、預約確認、提醒等
 */

const repositories = require('../repositories');
const lineClient = require('../line/client');
const flexMessages = require('../line/messages/flexMessages');

// =====================================================
// 通知服務
// =====================================================

const notificationService = {
    /**
     * 發送叫號通知
     * @param {Object} params - 通知參數
     */
    async sendCallNotification({ restaurantId, customerId, queueEntryId, queueNumber, restaurantName }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            console.warn(`⚠️ 找不到消費者 ${customerId} 的 LINE ID`);
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            const result = await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '📢 輪到您了！',
                contents: flexMessages.createCalledFlex({
                    queue_number: queueNumber,
                    restaurant_name: restaurantName || '餐廳',
                }),
            });

            // 記錄通知
            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                queue_entry_id: queueEntryId,
                notification_type: 'queue_called',
                line_message_id: result.messageId,
                status: 'sent',
            });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ 發送叫號通知失敗：', error);

            // 記錄失敗
            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                queue_entry_id: queueEntryId,
                notification_type: 'queue_called',
                status: 'failed',
            });

            return { success: false, reason: error.message };
        }
    },

    /**
     * 發送排隊成功通知
     * @param {Object} params - 通知參數
     */
    async sendQueueJoinedNotification({ restaurantId, customerId, queueEntryId, queueNumber, restaurantName, position }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            const result = await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '✅ 排隊成功',
                contents: flexMessages.createQueueJoinedFlex({
                    queue_number: queueNumber,
                    restaurant_name: restaurantName,
                    position,
                }),
            });

            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                queue_entry_id: queueEntryId,
                notification_type: 'queue_joined',
                line_message_id: result.messageId,
                status: 'sent',
            });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ 發送排隊成功通知失敗：', error);
            return { success: false, reason: error.message };
        }
    },

    /**
     * 發送預約確認通知
     * @param {Object} params - 通知參數
     */
    async sendReservationConfirmedNotification({ restaurantId, customerId, reservationId, date, time, partySize, restaurantName }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            const result = await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '✅ 預約成功',
                contents: flexMessages.createReservationConfirmedFlex({
                    reservation_date: date,
                    reservation_time: time,
                    party_size: partySize,
                    restaurant_name: restaurantName,
                }),
            });

            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                notification_type: 'reservation_confirmed',
                status: 'sent',
            });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ 發送預約確認通知失敗：', error);
            return { success: false, reason: error.message };
        }
    },

    /**
     * 發送預約提醒
     * @param {Object} params - 通知參數
     */
    async sendReservationReminder({ restaurantId, customerId, reservationId, date, time, restaurantName }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            const result = await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '📅 預約提醒',
                contents: flexMessages.createReservationReminderFlex({
                    reservation_date: date,
                    reservation_time: time,
                    restaurant_name: restaurantName,
                }),
            });

            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                notification_type: 'reminder',
                line_message_id: result.messageId,
                status: 'sent',
            });

            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('❌ 發送預約提醒失敗：', error);
            return { success: false, reason: error.message };
        }
    },

    /**
     * 發送排隊取消通知
     * @param {Object} params - 通知參數
     */
    async sendQueueCancelledNotification({ restaurantId, customerId, queueNumber, reason }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            await lineClient.pushMessage(customer.line_user_id, {
                type: 'text',
                text: `⚠️ 您的排隊（號碼：${queueNumber}）已被餐廳取消${reason ? `：${reason}` : ''}。如有疑問請聯繫餐廳。`,
            });

            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                notification_type: 'queue_cancelled',
                status: 'sent',
            });

            return { success: true };
        } catch (error) {
            console.error('❌ 發送排隊取消通知失敗：', error);
            return { success: false, reason: error.message };
        }
    },

    /**
     * 發送過號提醒
     * @param {Object} params - 通知參數
     */
    async sendNoShowReminder({ restaurantId, customerId, queueNumber, restaurantName }) {
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        if (!customer || !customer.line_user_id) {
            return { success: false, reason: 'no_line_user_id' };
        }

        try {
            await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '⚠️ 過號提醒',
                contents: {
                    type: 'bubble',
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '⚠️ 過號提醒',
                                weight: 'bold',
                                size: 'lg',
                            },
                            {
                                type: 'text',
                                text: `您的號碼 ${queueNumber} 已過號`,
                                margin: 'md',
                            },
                            {
                                type: 'text',
                                text: `請聯繫 ${restaurantName} 重新排隊或繼續等候`,
                                margin: 'md',
                                color: '#666666',
                            },
                        ],
                    },
                },
            });

            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurantId,
                customer_id: customerId,
                notification_type: 'no_show_reminder',
                status: 'sent',
            });

            return { success: true };
        } catch (error) {
            console.error('❌ 發送過號提醒失敗：', error);
            return { success: false, reason: error.message };
        }
    },

    /**
     * 批量發送通知
     * @param {Array} notifications - 通知陣列
     */
    async sendBatch(notifications) {
        const results = [];

        for (const notification of notifications) {
            try {
                const result = await this.sendCallNotification(notification);
                results.push(result);

                // 避免發送過快
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                results.push({ success: false, reason: error.message });
            }
        }

        return results;
    },

    /**
     * 取得通知統計
     * @param {string} restaurantId - 餐廳 ID
     * @param {Date} startDate - 開始日期
     * @param {Date} endDate - 結束日期
     */
    async getNotificationStats(restaurantId, startDate = null, endDate = null) {
        return await repositories.notificationRepository.getNotificationStats(
            restaurantId,
            startDate,
            endDate
        );
    },

    /**
     * 取得失敗的通知並重試
     * @param {string} restaurantId - 餐廳 ID
     * @param {number} limit - 數量限制
     */
    async retryFailedNotifications(restaurantId, limit = 10) {
        const failedNotifications = await repositories.notificationRepository.getFailedNotifications(
            restaurantId,
            limit
        );

        const results = [];

        for (const notification of failedNotifications) {
            try {
                // 根據通知類型重新發送
                let result;

                switch (notification.notification_type) {
                    case 'queue_called':
                        result = await this.sendCallNotification({
                            restaurantId: notification.restaurant_id,
                            customerId: notification.customer_id,
                            queueEntryId: notification.queue_entry_id,
                            queueNumber: notification.queue_number,
                        });
                        break;
                    case 'reminder':
                        result = await this.sendReservationReminder({
                            restaurantId: notification.restaurant_id,
                            customerId: notification.customer_id,
                            reservationId: notification.reservation_id,
                        });
                        break;
                    default:
                        console.warn(`⚠️ 不支援的通知類型：${notification.notification_type}`);
                        continue;
                }

                // 更新通知狀態
                if (result.success) {
                    await repositories.notificationRepository.updateNotificationStatus(
                        notification.id,
                        'sent'
                    );
                }

                results.push({
                    notificationId: notification.id,
                    ...result,
                });
            } catch (error) {
                results.push({
                    notificationId: notification.id,
                    success: false,
                    reason: error.message,
                });
            }
        }

        return results;
    },
};

// =====================================================
// 匯出
// =====================================================

module.exports = notificationService;