/**
 * 排隊資料 Repository
 * 提供排隊資料的 CRUD 操作與叫號邏輯
 */

const { query, transaction } = require('../db/connection');

/**
 * 加入排隊
 */
async function joinQueue(data) {
    return await transaction(async (client) => {
        // 1. 取得下一個排隊號碼
        const numberResult = await client.query(
            'SELECT COALESCE(MAX(queue_number), 0) + 1 as next_number FROM queue_entries WHERE restaurant_id = $1 AND status IN (\'waiting\', \'called\', \'served\')',
            [data.restaurantId]
        );
        const queueNumber = numberResult.rows[0].next_number;

        // 2. 檢查是否已在排隊中
        const existingResult = await client.query(
            `SELECT * FROM queue_entries WHERE restaurant_id = $1 AND customer_id = $2 AND status = 'waiting'`,
            [data.restaurantId, data.customerId]
        );
        if (existingResult.rows.length > 0) {
            throw new Error('此消費者已在排隊中');
        }

        // 3. 檢查排隊人數是否已滿
        const countResult = await client.query(
            `SELECT COUNT(*) as count FROM queue_entries WHERE restaurant_id = $1 AND status = 'waiting'`,
            [data.restaurantId]
        );
        // TODO: 從餐廳設定取得 queue_max_size

        // 4. 新增排隊資料
        const insertResult = await client.query(
            `INSERT INTO queue_entries (restaurant_id, customer_id, queue_number, party_size, source, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [data.restaurantId, data.customerId, queueNumber, data.partySize || 1, data.source || 'walk_in', data.notes || null]
        );

        return mapToQueueEntry(insertResult.rows[0]);
    });
}

/**
 * 依 ID 取得排隊資料
 */
async function getQueueEntryById(id) {
    const sql = `
        SELECT qe.*, r.name as restaurant_name, c.display_name as customer_name
        FROM queue_entries qe
        JOIN restaurants r ON qe.restaurant_id = r.id
        JOIN customers c ON qe.customer_id = c.id
        WHERE qe.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapToQueueEntry(result.rows[0]) : null;
}

/**
 * 依餐廳取得排隊名單（waiting 狀態）
 */
async function getQueueListByRestaurant(restaurantId, status = 'waiting') {
    const sql = `
        SELECT qe.*, c.display_name as customer_name, c.line_user_id
        FROM queue_entries qe
        JOIN customers c ON qe.customer_id = c.id
        WHERE qe.restaurant_id = $1 AND qe.status = $2
        ORDER BY qe.queue_number ASC
    `;
    const result = await query(sql, [restaurantId, status]);
    return result.rows.map(mapToQueueEntry);
}

/**
 * 叫號（下一位）
 */
async function callNext(restaurantId) {
    return await transaction(async (client) => {
        // 1. 找出waiting 中最早的
        const nextResult = await client.query(
            `SELECT * FROM queue_entries 
             WHERE restaurant_id = $1 AND status = 'waiting'
             ORDER BY queue_number ASC
             LIMIT 1 FOR UPDATE`,
            [restaurantId]
        );

        if (nextResult.rows.length === 0) {
            return null; // 沒人在排隊
        }

        // 2. 更新為 called
        const updateResult = await client.query(
            `UPDATE queue_entries 
             SET status = 'called', called_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [nextResult.rows[0].id]
        );

        return mapToQueueEntry(updateResult.rows[0]);
    });
}

/**
 * 手動叫號（指定號碼）
 */
async function callSpecific(restaurantId, queueNumber) {
    return await transaction(async (client) => {
        // 1. 找出指定號碼且狀態為 waiting 的
        const targetResult = await client.query(
            `SELECT * FROM queue_entries 
             WHERE restaurant_id = $1 AND queue_number = $2 AND status = 'waiting'
             LIMIT 1 FOR UPDATE`,
            [restaurantId, queueNumber]
        );

        if (targetResult.rows.length === 0) {
            return null; // 找不到
        }

        // 2. 更新為 called
        const updateResult = await client.query(
            `UPDATE queue_entries 
             SET status = 'called', called_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [targetResult.rows[0].id]
        );

        return mapToQueueEntry(updateResult.rows[0]);
    });
}

/**
 * 消費者報到（入座）
 */
async function markAsServed(queueEntryId) {
    const sql = `
        UPDATE queue_entries 
        SET status = 'served', served_at = NOW()
        WHERE id = $1
        RETURNING *
    `;
    const result = await query(sql, [queueEntryId]);
    return result.rows[0] ? mapToQueueEntry(result.rows[0]) : null;
}

/**
 * 取消排隊
 */
async function cancelQueue(queueEntryId) {
    const sql = `
        UPDATE queue_entries 
        SET status = 'cancelled'
        WHERE id = $1 AND status IN ('waiting', 'called')
        RETURNING *
    `;
    const result = await query(sql, [queueEntryId]);
    return result.rows[0] ? mapToQueueEntry(result.rows[0]) : null;
}

/**
 * 標記過號
 */
async function markAsNoShow(queueEntryId) {
    const sql = `
        UPDATE queue_entries 
        SET status = 'no_show'
        WHERE id = $1 AND status = 'called'
        RETURNING *
    `;
    const result = await query(sql, [queueEntryId]);
    return result.rows[0] ? mapToQueueEntry(result.rows[0]) : null;
}

/**
 * 取得目前排隊人數
 */
async function getWaitingCount(restaurantId) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM queue_entries 
        WHERE restaurant_id = $1 AND status = 'waiting'
    `;
    const result = await query(sql, [restaurantId]);
    return parseInt(result.rows[0].count, 10);
}

/**
 * 取得消費者目前的排隊順位
 */
async function getCustomerQueuePosition(customerId, restaurantId) {
    const sql = `
        SELECT queue_number FROM queue_entries 
        WHERE customer_id = $1 AND restaurant_id = $2 AND status = 'waiting'
    `;
    const result = await query(sql, [customerId, restaurantId]);
    if (result.rows.length === 0) return null;
    return parseInt(result.rows[0].queue_number, 10);
}

/**
 * 將 SQL row 轉換為 QueueEntry 物件
 */
function mapToQueueEntry(row) {
    if (!row) return null;
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurant_name,
        customerId: row.customer_id,
        customerName: row.customer_name,
        lineUserId: row.line_user_id,
        queueNumber: row.queue_number,
        status: row.status,
        partySize: row.party_size,
        joinedAt: row.joined_at,
        calledAt: row.called_at,
        servedAt: row.served_at,
        notes: row.notes,
        source: row.source,
    };
}

module.exports = {
    joinQueue,
    getQueueEntryById,
    getQueueListByRestaurant,
    callNext,
    callSpecific,
    markAsServed,
    cancelQueue,
    markAsNoShow,
    getWaitingCount,
    getCustomerQueuePosition,
};