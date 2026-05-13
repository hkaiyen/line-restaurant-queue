/**
 * LINE 餐廳候補位系統 - Repository 匯出索引
 */

const restaurantRepository = require('./restaurantRepository');
const customerRepository = require('./customerRepository');
const queueRepository = require('./queueRepository');
const reservationRepository = require('./reservationRepository');
const notificationRepository = require('./notificationRepository');

module.exports = {
    restaurantRepository,
    customerRepository,
    queueRepository,
    reservationRepository,
    notificationRepository,
};