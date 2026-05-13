/**
 * LINE 餐廳候補位系統 - 排隊服務
 * 
 * 處理排隊相關的商業邏輯
 * 包含：加入排隊、叫號、順位計算等
 */

const repositories = require('../repositories');
const lineClient = require('../line/client');
const flexMessages = require('../line/messages/flexMessages');

// =====================================================
// 排隊服務
// =====================================================

const queueService = {
    /**
     * 加入排隊
     * @param {Object} params - 排隊參數
     * @returns {Object} 排隊結果
     */
    async joinQueue({ restaurantId, customerId, partySize, notes, source = 'walk_in' }) {
        // 檢查餐廳是否存在
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        if (!restaurant) {
            throw new Error('找不到指定的餐廳');
        }

        // 檢查是否已在排隊中
        const existingQueues = await repositories.queueRepository.getQueueListByRestaurant(
            restaurantId,
            'waiting'
        );

        const existingEntry = existingQueues.find(entry => entry.customer_id === customerId);
        if (existingEntry) {
            throw new Error('您已在排隊中，請勿重複加入');
        }

        // 檢查排隊人數是否已滿
        const waitingCount = await repositories.queueRepository.getWaitingCount(restaurantId);
        if (waitingCount >= restaurant.queue_max_size) {
            throw new Error(`很抱歉，${restaurant.name} 目前排隊人數已滿`);
        }

        // 建立排隊資料
        const queueEntry = await repositories.queueRepository.joinQueue({
            restaurant_id: restaurantId,
            customer_id: customerId,
            party_size: partySize,
            notes: notes || null,
            source: source,
        });

        // 計算前方等候人數
        const position = await this.calculateQueuePosition(restaurantId, queueEntry.queue_number);

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        // 發送 LINE 通知（可選）
        if (customer && customer.line_user_id) {
            try {
                await lineClient.pushMessage(customer.line_user_id, {
                    type: 'flex',
                    altText: '✅ 排隊成功',
                    contents: flexMessages.createQueueJoinedFlex({
                        queueEntry,
                        restaurant,
                        position,
                    }),
                });
            } catch (error) {
                console.warn('⚠️ 發送排隊成功通知失敗：', error.message);
            }
        }

        return {
            queueEntry,
            restaurant,
            position,
            estimatedWaitMinutes: position * restaurant.avg_meal_duration_minutes,
        };
    },

    /**
     * 取消排隊
     * @param {string} queueEntryId - 排隊資料 ID
     * @param {string} customerId - 消費者 ID（用於驗證）
     * @returns {Object} 取消結果
     */
    async cancelQueue(queueEntryId, customerId) {
        const queueEntry = await repositories.queueRepository.getQueueEntryById(queueEntryId);
        
        if (!queueEntry) {
            throw new Error('找不到排隊資料');
        }

        if (queueEntry.customer_id !== customerId) {
            throw new Error('您無權限取消此排隊');
        }

        if (queueEntry.status !== 'waiting') {
            throw new Error('此排隊無法取消（狀態不是等待中）');
        }

        await repositories.queueRepository.cancelQueue(queueEntryId);

        return { success: true };
    },

    /**
     * 叫下一位
     * @param {string} restaurantId - 餐廳 ID
     * @returns {Object} 被叫號的排隊資料
     */
    async callNext(restaurantId) {
        const queueEntry = await repositories.queueRepository.callNext(restaurantId);

        if (!queueEntry) {
            return null;
        }

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customer_id);

        // 發送 LINE 通知
        if (customer && customer.line_user_id) {
            try {
                const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
                
                await lineClient.pushMessage(customer.line_user_id, {
                    type: 'flex',
                    altText: '📢 輪到您了！',
                    contents: flexMessages.createCalledFlex({
                        ...queueEntry,
                        restaurantName: restaurant?.name || '餐廳',
                    }),
                });

                // 記錄通知
                await repositories.notificationRepository.createNotification({
                    restaurant_id: restaurantId,
                    customer_id: customer.id,
                    queue_entry_id: queueEntry.id,
                    notification_type: 'queue_called',
                    status: 'sent',
                });
            } catch (error) {
                console.error('❌ 發送叫號通知失敗：', error.message);
            }
        }

        return {
            queueEntry,
            customer,
        };
    },

    /**
     * 叫指定號碼
     * @param {string} restaurantId - 餐廳 ID
     * @param {number} queueNumber - 排隊號碼
     * @returns {Object} 被叫號的排隊資料
     */
    async callSpecific(restaurantId, queueNumber) {
        const queueEntry = await repositories.queueRepository.callSpecific(restaurantId, queueNumber);

        if (!queueEntry) {
            throw new Error('找不到指定的排隊號碼');
        }

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(queueEntry.customer_id);

        // 發送 LINE 通知
        if (customer && customer.line_user_id) {
            try {
                const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
                
                await lineClient.pushMessage(customer.line_user_id, {
                    type: 'flex',
                    altText: '📢 輪到您了！',
                    contents: flexMessages.createCalledFlex({
                        ...queueEntry,
                        restaurantName: restaurant?.name || '餐廳',
                    }),
                });
            } catch (error) {
                console.error('❌ 發送叫號通知失敗：', error.message);
            }
        }

        return {
            queueEntry,
            customer,
        };
    },

    /**
     * 標記入座
     * @param {string} queueEntryId - 排隊資料 ID
     */
    async markAsServed(queueEntryId) {
        await repositories.queueRepository.markAsServed(queueEntryId);
        return { success: true };
    },

    /**
     * 標記過號
     * @param {string} queueEntryId - 排隊資料 ID
     */
    async markAsNoShow(queueEntryId) {
        await repositories.queueRepository.markAsNoShow(queueEntryId);
        return { success: true };
    },

    /**
     * 計算排隊順位
     * @param {string} restaurantId - 餐廳 ID
     * @param {number} queueNumber - 排隊號碼
     * @returns {number} 前方等候人數 + 1
     */
    async calculateQueuePosition(restaurantId, queueNumber) {
        const queueList = await repositories.queueRepository.getQueueListByRestaurant(
            restaurantId,
            'waiting'
        );

        // 計算前方有多少組
        let position = 1;
        for (const entry of queueList) {
            if (entry.queue_number < queueNumber) {
                position++;
            } else {
                break;
            }
        }

        return position;
    },

    /**
     * 取得排隊狀態
     * @param {string} customerId - 消費者 ID
     * @param {string} restaurantId - 餐廳 ID（可選）
     * @returns {Object} 排隊狀態資料
     */
    async getQueueStatus(customerId, restaurantId = null) {
        if (restaurantId) {
            // 查詢特定餐廳
            const queueList = await repositories.queueRepository.getQueueListByRestaurant(
                restaurantId,
                'waiting'
            );

            const myEntry = queueList.find(entry => entry.customer_id === customerId);

            if (!myEntry) {
                return { inQueue: false };
            }

            const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
            const position = await this.calculateQueuePosition(restaurantId, myEntry.queue_number);

            return {
                inQueue: true,
                queueEntry: myEntry,
                restaurant,
                position,
                estimatedWaitMinutes: position * restaurant.avg_meal_duration_minutes,
            };
        }

        // 查詢所有餐廳的排隊（取最新的）
        // 這需要更複雜的查詢，目前先返回無排隊
        return { inQueue: false };
    },

    /**
     * 取得排隊統計
     * @param {string} restaurantId - 餐廳 ID
     * @returns {Object} 排隊統計資料
     */
    async getQueueStats(restaurantId) {
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        const waitingCount = await repositories.queueRepository.getWaitingCount(restaurantId);

        return {
            restaurantId,
            restaurantName: restaurant?.name,
            currentWaiting: waitingCount,
            maxCapacity: restaurant?.queue_max_size || 0,
            availability: (restaurant?.queue_max_size || 0) - waitingCount,
            avgMealDuration: restaurant?.avg_meal_duration_minutes || 0,
            estimatedWaitMinutes: waitingCount * (restaurant?.avg_meal_duration_minutes || 30),
        };
    },
};

// =====================================================
// 匯出
// =====================================================

module.exports = queueService;