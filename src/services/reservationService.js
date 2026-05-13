/**
 * LINE 餐廳候補位系統 - 預約服務
 * 
 * 處理預約相關的商業邏輯
 * 包含：建立預約、取消預約、時間衝突檢查等
 */

const repositories = require('../repositories');
const lineClient = require('../line/client');
const flexMessages = require('../line/messages/flexMessages');

// =====================================================
// 預約服務
// =====================================================

const reservationService = {
    /**
     * 建立預約
     * @param {Object} params - 預約參數
     * @returns {Object} 預約結果
     */
    async createReservation({ restaurantId, customerId, date, time, partySize, notes }) {
        // 檢查餐廳是否存在
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        if (!restaurant) {
            throw new Error('找不到指定的餐廳');
        }

        // 檢查時間衝突
        const hasConflict = await this.checkTimeConflict(restaurantId, date, time, partySize);
        if (hasConflict) {
            throw new Error('該時段已額滿，請選擇其他時間');
        }

        // 建立預約
        const reservation = await repositories.reservationRepository.createReservation({
            restaurant_id: restaurantId,
            customer_id: customerId,
            reservation_date: date,
            reservation_time: time,
            party_size: partySize,
            notes: notes || null,
        });

        // 取得消費者資料
        const customer = await repositories.customerRepository.getCustomerById(customerId);

        // 發送 LINE 通知
        if (customer && customer.line_user_id) {
            try {
                await lineClient.pushMessage(customer.line_user_id, {
                    type: 'flex',
                    altText: '✅ 預約成功',
                    contents: flexMessages.createReservationConfirmedFlex({
                        reservation,
                        restaurant,
                    }),
                });
            } catch (error) {
                console.warn('⚠️ 發送預約確認通知失敗：', error.message);
            }
        }

        return {
            reservation,
            restaurant,
        };
    },

    /**
     * 取消預約
     * @param {string} reservationId - 預約 ID
     * @param {string} customerId - 消費者 ID（用於驗證）
     * @returns {Object} 取消結果
     */
    async cancelReservation(reservationId, customerId) {
        const reservation = await repositories.reservationRepository.getReservationById(reservationId);

        if (!reservation) {
            throw new Error('找不到預約資料');
        }

        if (reservation.customer_id !== customerId) {
            throw new Error('您無權限取消此預約');
        }

        if (reservation.status === 'cancelled') {
            throw new Error('此預約已經取消');
        }

        if (reservation.status === 'seated') {
            throw new Error('已入座的預約無法取消');
        }

        await repositories.reservationRepository.cancelReservation(reservationId);

        return { success: true };
    },

    /**
     * 檢查時間衝突
     * @param {string} restaurantId - 餐廳 ID
     * @param {string} date - 預約日期
     * @param {string} time - 預約時間
     * @param {number} partySize - 用餐人數
     * @returns {boolean} 是否有衝突
     */
    async checkTimeConflict(restaurantId, date, time, partySize) {
        const existingReservations = await repositories.reservationRepository.getReservationsByRestaurantAndDate(
            restaurantId,
            date
        );

        // 取得該時段前後 30 分鐘的預約
        const [hours, minutes] = time.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
        const bufferMinutes = 30; // 時間緩衝

        const conflictingReservations = existingReservations.filter(res => {
            if (res.status === 'cancelled' || res.status === 'no_show') {
                return false;
            }

            const [resHours, resMinutes] = res.reservation_time.split(':').map(Number);
            const resTimeInMinutes = resHours * 60 + resMinutes;

            // 檢查時間是否重疊（前後 30 分鐘緩衝）
            const timeDiff = Math.abs(resTimeInMinutes - timeInMinutes);
            return timeDiff < bufferMinutes;
        });

        // 如果有多個預約重疊，檢查總人數是否超過座位數
        const restaurant = await repositories.restaurantRepository.getRestaurantById(restaurantId);
        const totalPartySize = conflictingReservations.reduce((sum, res) => sum + res.party_size, 0) + partySize;

        return totalPartySize > restaurant.total_seats;
    },

    /**
     * 取得我的預約
     * @param {string} customerId - 消費者 ID
     * @returns {Array} 預約列表
     */
    async getMyReservations(customerId) {
        return await repositories.reservationRepository.getUpcomingReservations(customerId);
    },

    /**
     * 標記已入座
     * @param {string} reservationId - 預約 ID
     */
    async markAsSeated(reservationId) {
        await repositories.reservationRepository.markAsSeated(reservationId);
        return { success: true };
    },

    /**
     * 標記過號
     * @param {string} reservationId - 預約 ID
     */
    async markAsNoShow(reservationId) {
        await repositories.reservationRepository.markAsNoShow(reservationId);
        return { success: true };
    },

    /**
     * 取得餐廳的預約列表
     * @param {string} restaurantId - 餐廳 ID
     * @param {string} date - 日期（可選）
     * @returns {Array} 預約列表
     */
    async getReservationsByRestaurant(restaurantId, date = null) {
        if (date) {
            return await repositories.reservationRepository.getReservationsByRestaurantAndDate(
                restaurantId,
                date
            );
        }

        // 取得未來一週的預約
        const reservations = [];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const dayReservations = await repositories.reservationRepository.getReservationsByRestaurantAndDate(
                restaurantId,
                dateStr
            );
            reservations.push(...dayReservations);
        }

        return reservations;
    },

    /**
     * 傳送預約提醒
     * @param {string} reservationId - 預約 ID
     */
    async sendReminder(reservationId) {
        const reservation = await repositories.reservationRepository.getReservationById(reservationId);

        if (!reservation) {
            throw new Error('找不到預約資料');
        }

        if (reservation.status !== 'confirmed') {
            throw new Error('只能對已確認的預約發送提醒');
        }

        const restaurant = await repositories.restaurantRepository.getRestaurantById(reservation.restaurant_id);
        const customer = await repositories.customerRepository.getCustomerById(reservation.customer_id);

        if (customer && customer.line_user_id) {
            await lineClient.pushMessage(customer.line_user_id, {
                type: 'flex',
                altText: '📅 預約提醒',
                contents: flexMessages.createReservationReminderFlex({
                    reservation,
                    restaurant,
                }),
            });

            // 記錄通知
            await repositories.notificationRepository.createNotification({
                restaurant_id: restaurant.id,
                customer_id: customer.id,
                notification_type: 'reminder',
                status: 'sent',
            });
        }

        return { success: true };
    },
};

// =====================================================
// 匯出
// =====================================================

module.exports = reservationService;