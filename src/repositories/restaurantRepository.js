/**
 * 餐廳 Repository
 * 提供餐廳資料的 CRUD 操作
 */

const { query, transaction } = require('../db/connection');

/**
 * 建立新餐廳
 */
async function createRestaurant(data) {
    const sql = `
        INSERT INTO restaurants (
            name, line_channel_id, line_channel_secret, line_access_token,
            address, phone, total_seats, avg_meal_duration_minutes,
            queue_max_size, auto_call_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `;
    const values = [
        data.name,
        data.lineChannelId || null,
        data.lineChannelSecret || null,
        data.lineAccessToken || null,
        data.address || null,
        data.phone || null,
        data.totalSeats || 0,
        data.avgMealDurationMinutes || 60,
        data.queueMaxSize || 50,
        data.autoCallEnabled || false,
    ];
    const result = await query(sql, values);
    return mapToRestaurant(result.rows[0]);
}

/**
 * 依 ID 取得餐廳
 */
async function getRestaurantById(id) {
    const sql = 'SELECT * FROM restaurants WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToRestaurant(result.rows[0]) : null;
}

/**
 * 依 LINE Channel ID 取得餐廳
 */
async function getRestaurantByLineChannelId(lineChannelId) {
    const sql = 'SELECT * FROM restaurants WHERE line_channel_id = $1';
    const result = await query(sql, [lineChannelId]);
    return result.rows[0] ? mapToRestaurant(result.rows[0]) : null;
}

/**
 * 取得所有餐廳
 */
async function getAllRestaurants() {
    const sql = 'SELECT * FROM restaurants ORDER BY created_at DESC';
    const result = await query(sql, []);
    return result.rows.map(mapToRestaurant);
}

/**
 * 更新餐廳資料
 */
async function updateRestaurant(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
    }
    if (data.lineChannelId !== undefined) {
        fields.push(`line_channel_id = $${paramIndex++}`);
        values.push(data.lineChannelId);
    }
    if (data.lineChannelSecret !== undefined) {
        fields.push(`line_channel_secret = $${paramIndex++}`);
        values.push(data.lineChannelSecret);
    }
    if (data.lineAccessToken !== undefined) {
        fields.push(`line_access_token = $${paramIndex++}`);
        values.push(data.lineAccessToken);
    }
    if (data.address !== undefined) {
        fields.push(`address = $${paramIndex++}`);
        values.push(data.address);
    }
    if (data.phone !== undefined) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(data.phone);
    }
    if (data.totalSeats !== undefined) {
        fields.push(`total_seats = $${paramIndex++}`);
        values.push(data.totalSeats);
    }
    if (data.avgMealDurationMinutes !== undefined) {
        fields.push(`avg_meal_duration_minutes = $${paramIndex++}`);
        values.push(data.avgMealDurationMinutes);
    }
    if (data.queueMaxSize !== undefined) {
        fields.push(`queue_max_size = $${paramIndex++}`);
        values.push(data.queueMaxSize);
    }
    if (data.autoCallEnabled !== undefined) {
        fields.push(`auto_call_enabled = $${paramIndex++}`);
        values.push(data.autoCallEnabled);
    }

    if (fields.length === 0) {
        return getRestaurantById(id);
    }

    values.push(id);
    const sql = `
        UPDATE restaurants 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] ? mapToRestaurant(result.rows[0]) : null;
}

/**
 * 刪除餐廳
 */
async function deleteRestaurant(id) {
    const sql = 'DELETE FROM restaurants WHERE id = $1 RETURNING id';
    const result = await query(sql, [id]);
    return result.rowCount > 0;
}

/**
 * 取得餐廳的目前排隊人數
 */
async function getQueueCount(restaurantId) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM queue_entries 
        WHERE restaurant_id = $1 AND status = 'waiting'
    `;
    const result = await query(sql, [restaurantId]);
    return parseInt(result.rows[0].count, 10);
}

/**
 * 將 SQL row 轉換為 Restaurant 物件
 */
function mapToRestaurant(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        lineChannelId: row.line_channel_id,
        lineChannelSecret: row.line_channel_secret,
        lineAccessToken: row.line_access_token,
        address: row.address,
        phone: row.phone,
        totalSeats: row.total_seats,
        avgMealDurationMinutes: row.avg_meal_duration_minutes,
        queueMaxSize: row.queue_max_size,
        autoCallEnabled: row.auto_call_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

module.exports = {
    createRestaurant,
    getRestaurantById,
    getRestaurantByLineChannelId,
    getAllRestaurants,
    updateRestaurant,
    deleteRestaurant,
    getQueueCount,
};