/**
 * 預約 Repository
 * 提供預約資料的 CRUD 操作
 */

const { query, transaction } = require('../db/connection');

/**
 * 建立新預約
 */
async function createReservation(data) {
    return await transaction(async (client) => {
        // 1. 檢查同一時間是否已有相同餐廳、相同時間的預約（可選：加入時段衝堂檢查）
        // 2. 新增預約資料
        const insertResult = await client.query(
            `INSERT INTO reservations (restaurant_id, customer_id, reservation_date, reservation_time, party_size, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                data.restaurantId,
                data.customerId,
                data.reservationDate,
                data.reservationTime,
                data.partySize || 1,
                data.notes || null,
            ]
        );

        return mapToReservation(insertResult.rows[0]);
    });
}

/**
 * 依 ID 取得預約
 */
async function getReservationById(id) {
    const sql = `
        SELECT res.*, r.name as restaurant_name, c.display_name as customer_name
        FROM reservations res
        JOIN restaurants r ON res.restaurant_id = r.id
        JOIN customers c ON res.customer_id = c.id
        WHERE res.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToReservation(result.rows[0]) : null;
}

/**
 * 依餐廳取得特定日期的預約列表
 */
async function getReservationsByRestaurantAndDate(restaurantId, date) {
    const sql = `
        SELECT res.*, c.display_name as customer_name, c.line_user_id
        FROM reservations res
        JOIN customers c ON res.customer_id = c.id
        WHERE res.restaurant_id = $1 AND res.reservation_date = $2
        ORDER BY res.reservation_time ASC
    `;
    const result = await query(sql, [restaurantId, date]);
    return result.rows.map(mapToReservation);
}

/**
 * 依消費者取得所有預約
 */
async function getReservationsByCustomer(customerId) {
    const sql = `
        SELECT res.*, r.name as restaurant_name, r.address as restaurant_address
        FROM reservations res
        JOIN restaurants r ON res.restaurant_id = r.id
        WHERE res.customer_id = $1
        ORDER BY res.reservation_date DESC, res.reservation_time DESC
    `;
    const result = await query(sql, [customerId]);
    return result.rows.map(mapToReservation);
}

/**
 * 依消費者取得即將到来的預約（未來的 confirmed 預約）
 */
async function getUpcomingReservations(customerId) {
    const sql = `
        SELECT res.*, r.name as restaurant_name, r.address as restaurant_address, r.phone as restaurant_phone
        FROM reservations res
        JOIN restaurants r ON res.restaurant_id = r.id
        WHERE res.customer_id = $1 
          AND res.reservation_date >= CURRENT_DATE 
          AND res.status = 'confirmed'
        ORDER BY res.reservation_date ASC, res.reservation_time ASC
    `;
    const result = await query(sql, [customerId]);
    return result.rows.map(mapToReservation);
}

/**
 * 更新預約
 */
async function updateReservation(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.reservationDate !== undefined) {
        fields.push(`reservation_date = $${paramIndex++}`);
        values.push(data.reservationDate);
    }
    if (data.reservationTime !== undefined) {
        fields.push(`reservation_time = $${paramIndex++}`);
        values.push(data.reservationTime);
    }
    if (data.partySize !== undefined) {
        fields.push(`party_size = $${paramIndex++}`);
        values.push(data.partySize);
    }
    if (data.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
    }
    if (data.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
    }

    if (fields.length === 0) {
        return getReservationById(id);
    }

    values.push(id);
    const sql = `
        UPDATE reservations 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
    `;
    const result = await query(sql, values);
    return result.rows[0] ? mapToReservation(result.rows[0]) : null;
}

/**
 * 取消預約
 */
async function cancelReservation(id) {
    const sql = `
        UPDATE reservations 
        SET status = 'cancelled'
        WHERE id = $1 AND status = 'confirmed'
        RETURNING *
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToReservation(result.rows[0]) : null;
}

/**
 * 標記已入座
 */
async function markAsSeated(id) {
    const sql = `
        UPDATE reservations 
        SET status = 'seated'
        WHERE id = $1
        RETURNING *
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToReservation(result.rows[0]) : null;
}

/**
 * 標記過號
 */
async function markAsNoShow(id) {
    const sql = `
        UPDATE reservations 
        SET status = 'no_show'
        WHERE id = $1 AND status = 'confirmed'
        RETURNING *
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToReservation(result.rows[0]) : null;
}

/**
 * 將 SQL row 轉換為 Reservation 物件
 */
function mapToReservation(row) {
    if (!row) return null;
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurant_name,
        restaurantAddress: row.restaurant_address,
        restaurantPhone: row.restaurant_phone,
        customerId: row.customer_id,
        customerName: row.customer_name,
        lineUserId: row.line_user_id,
        reservationDate: row.reservation_date,
        reservationTime: row.reservation_time,
        partySize: row.party_size,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
    };
}

module.exports = {
    createReservation,
    getReservationById,
    getReservationsByRestaurantAndDate,
    getReservationsByCustomer,
    getUpcomingReservations,
    updateReservation,
    cancelReservation,
    markAsSeated,
    markAsNoShow,
};