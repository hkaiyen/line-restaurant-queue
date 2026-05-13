/**
 * 消費者 Repository
 * 提供消費者資料的 CRUD 操作
 */

const { query } = require('../db/connection');

/**
 * 建立新消費者
 */
async function createCustomer(data) {
    const sql = `
        INSERT INTO customers (line_user_id, display_name, phone)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
    const values = [
        data.lineUserId,
        data.displayName || null,
        data.phone || null,
    ];
    const result = await query(sql, values);
    return mapToCustomer(result.rows[0]);
}

/**
 * 依 ID 取得消費者
 */
async function getCustomerById(id) {
    const sql = 'SELECT * FROM customers WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToCustomer(result.rows[0]) : null;
}

/**
 * 依 LINE User ID 取得消費者
 */
async function getCustomerByLineUserId(lineUserId) {
    const sql = 'SELECT * FROM customers WHERE line_user_id = $1';
    const result = await query(sql, [lineUserId]);
    return result.rows[0] ? mapToCustomer(result.rows[0]) : null;
}

/**
 * 取得所有消費者
 */
async function getAllCustomers() {
    const sql = 'SELECT * FROM customers ORDER BY created_at DESC';
    const result = await query(sql, []);
    return result.rows.map(mapToCustomer);
}

/**
 * 更新消費者資料
 */
async function updateCustomer(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.displayName !== undefined) {
        fields.push(`display_name = $${paramIndex++}`);
        values.push(data.displayName);
    }
    if (data.phone !== undefined) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(data.phone);
    }

    if (fields.length === 0) {
        return getCustomerById(id);
    }

    values.push(id);
    const sql = `
        UPDATE customers 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] ? mapToCustomer(result.rows[0]) : null;
}

/**
 * 刪除消費者
 */
async function deleteCustomer(id) {
    const sql = 'DELETE FROM customers WHERE id = $1 RETURNING id';
    const result = await query(sql, [id]);
    return result.rowCount > 0;
}

/**
 * 取得消費者的排隊歷史
 */
async function getCustomerQueueHistory(customerId, limit = 20) {
    const sql = `
        SELECT qe.*, r.name as restaurant_name
        FROM queue_entries qe
        JOIN restaurants r ON qe.restaurant_id = r.id
        WHERE qe.customer_id = $1
        ORDER BY qe.joined_at DESC
        LIMIT $2
    `;
    const result = await query(sql, [customerId, limit]);
    return result.rows;
}

/**
 * 取得消費者的預約歷史
 */
async function getCustomerReservationHistory(customerId, limit = 20) {
    const sql = `
        SELECT res.*, r.name as restaurant_name
        FROM reservations res
        JOIN restaurants r ON res.restaurant_id = r.id
        WHERE res.customer_id = $1
        ORDER BY res.reservation_date DESC, res.reservation_time DESC
        LIMIT $2
    `;
    const result = await query(sql, [customerId, limit]);
    return result.rows;
}

/**
 * 將 SQL row 轉換為 Customer 物件
 */
function mapToCustomer(row) {
    if (!row) return null;
    return {
        id: row.id,
        lineUserId: row.line_user_id,
        displayName: row.display_name,
        phone: row.phone,
        createdAt: row.created_at,
    };
}

module.exports = {
    createCustomer,
    getCustomerById,
    getCustomerByLineUserId,
    getAllCustomers,
    updateCustomer,
    deleteCustomer,
    getCustomerQueueHistory,
    getCustomerReservationHistory,
};