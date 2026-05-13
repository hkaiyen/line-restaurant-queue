/**
 * LINE 餐廳候補位系統 - 資料庫連線設定
 * 
 * 使用 node-postgres (pg) 連接 PostgreSQL
 * 支援連線池設定
 */

const { Pool } = require('pg');

// 環境變數設定
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'line_queue',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10), // 連線池最大連線數
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10), // 閒置連線逾時（毫秒）
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10), // 連線逾時（毫秒）
};

// 建立連線池
const pool = new Pool(poolConfig);

// 連線池錯誤處理
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// 測試連線函數
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW() as now, version() as version');
        console.log('✅ PostgreSQL 連線成功');
        console.log(`   資料庫版本：${result.rows[0].version.split(' ')[0]}`);
        console.log(`   連線時間：${result.rows[0].now}`);
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL 連線失敗：', error.message);
        return false;
    }
}

// 執行查詢的通用函數
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`📊 Query executed in ${duration}ms | rows: ${result.rowCount}`);
        return result;
    } catch (error) {
        console.error(`❌ Query error: ${error.message}`);
        throw error;
    }
}

// 從連線池取得客戶端（用於交易）
async function getClient() {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    // 記錄查詢時間
    client.query = async (...args) => {
        const start = Date.now();
        try {
            const result = await originalQuery(...args);
            const duration = Date.now() - start;
            console.log(`📊 Transaction query executed in ${duration}ms`);
            return result;
        } catch (error) {
            console.error(`❌ Transaction query error: ${error.message}`);
            throw error;
        }
    };

    // 確保 release 不會被呼叫多次
    let released = false;
    client.release = () => {
        if (!released) {
            released = true;
            return originalRelease();
        }
    };

    return client;
}

// 交易包裝函數
async function transaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// 關閉連線池
async function closePool() {
    await pool.end();
    console.log('🔌 Database pool closed');
}

// 匯出模組
module.exports = {
    pool,
    query,
    getClient,
    transaction,
    testConnection,
    closePool,
};