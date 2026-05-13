/**
 * 通知 Repository
 * 提供通知記錄的 CRUD 操作
 */

const { query } = require('../db/connection');

/**
 * 建立通知記錄
 */
async function createNotification(data) {
    const sql = `
        INSERT INTO notification_logs (
            restaurant_id, customer_id, queue_entry_id,
            notification_type, line_message_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const values = [
        data.restaurantId || null,
        data.customerId,
        data.queueEntryId || null,
        data.notificationType,
        data.lineMessageId || null,
        data.status || 'sent',
    ];
    const result = await query(sql, values);
    return mapToNotificationLog(result.rows[0]);
}

/**
 * 依 ID 取得通知記錄
 */
async function getNotificationById(id) {
    const sql = `
        SELECT nl.*, r.name as restaurant_name, c.display_name as customer_name
        FROM notification_logs nl
        LEFT JOIN restaurants r ON nl.restaurant_id = r.id
        JOIN customers c ON nl.customer_id = c.id
        WHERE nl.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToNotificationLog(result.rows[0]) : null;
}

/**
 * 依餐廳取得通知歷史
 */
async function getNotificationsByRestaurant(restaurantId, limit = 100) {
    const sql = `
        SELECT nl.*, c.display_name as customer_name
        FROM notification_logs nl
        JOIN customers c ON nl.customer_id = c.id
        WHERE nl.restaurant_id = $1
        ORDER BY nl.sent_at DESC
        LIMIT $2
    `;
    const result = await query(sql, [restaurantId, limit]);
    return result.rows.map(mapToNotificationLog);
}

/**
 * 依消費者取得通知歷史
 */
async function getNotificationsByCustomer(customerId, limit = 50) {
    const sql = `
        SELECT nl.*, r.name as restaurant_name
        FROM notification_logs nl
        LEFT JOIN restaurants r ON nl.restaurant_id = r.id
        WHERE nl.customer_id = $1
        ORDER BY nl.sent_at DESC
        LIMIT $2
    `;
    const result = await query(sql, [customerId, limit]);
    return result.rows.map(mapToNotificationLog);
}

/**
 * 更新通知狀態（根據 LINE API 回傳的 webhook）
 */
async function updateNotificationStatus(lineMessageId, status) {
    const sql = `
        UPDATE notification_logs 
        SET status = $1
        WHERE line_message_id = $2
        RETURNING *
    `;
    const result = await query(sql, [status, lineMessageId]);
    return result.rows[0] ? mapToNotificationLog(result.rows[0]) : null;
}

/**
 * 取得特定類型的通知記錄
 */
async function getNotificationsByType(restaurantId, notificationType, limit = 50) {
    const sql = `
        SELECT nl.*, c.display_name as customer_name
        FROM notification_logs nl
        JOIN customers c ON nl.customer_id = c.id
        WHERE nl.restaurant_id = $1 AND nl.notification_type = $2
        ORDER BY nl.sent_at DESC
        LIMIT $3
    `;
    const result = await query(sql, [restaurantId, notificationType, limit]);
    return result.rows.map(mapToNotificationLog);
}

/**
 * 取得發送失敗的通知（可用於重試機制）
 */
async function getFailedNotifications(restaurantId, limit = 50) {
    const sql = `
        SELECT nl.*, c.display_name as customer_name, c.line_user_id
        FROM notification_logs nl
        JOIN customers c ON nl.customer_id = c.id
        WHERE nl.restaurant_id = $1 AND nl.status = 'failed'
        ORDER BY nl.sent_at ASC
        LIMIT $2
    `;
    const result = await query(sql, [restaurantId, limit]);
    return result.rows.map(mapToNotificationLog);
}

/**
 * 統計特定時間範圍內的通知發送數量
 */
async function getNotificationStats(restaurantId, startDate, endDate) {
    const sql = `
        SELECT 
            notification_type,
            status,
            COUNT(*) as count
        FROM notification_logs
        WHERE restaurant_id = $1 AND sent_at BETWEEN $2 AND $3
        GROUP BY notification_type, status
        ORDER BY notification_type, status
    `;
    const result = await query(sql, [restaurantId, startDate, endDate]);
    return result.rows;
}

/**
 * 將 SQL row 轉換為 NotificationLog 物件
 */
function mapToNotificationLog(row) {
    if (!row) return null;
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurant_name,
        customerId: row.customer_id,
        customerName: row.customer_name,
        queueEntryId: row.queue_entry_id,
        notificationType: row.notification_type,
        lineMessageId: row.line_message_id,
        sentAt: row.sent_at,
        status: row.status,
    };
}

module.exports = {
    createNotification,
    getNotificationById,
    getNotificationsByRestaurant,
    getNotificationsByCustomer,
    updateNotificationStatus,
    getNotificationsByType,
    getFailedNotifications,
    getNotificationStats,
};