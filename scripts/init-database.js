/**
 * LINE 餐廳候補位系統 - 資料庫初始化腳本
 * 
 * 用於在 Render.com 建立 PostgreSQL 資料庫後初始化 schema
 * 
 * 使用方式：
 *   node scripts/init-database.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// 從環境變數取得資料庫設定
const poolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
};

async function initDatabase() {
    console.log('🔧 開始初始化資料庫...');
    console.log(`   主機：${poolConfig.host}`);
    console.log(`   資料庫：${poolConfig.database}`);

    const pool = new Pool(poolConfig);

    try {
        // =====================================================
        // 1. 啟用 UUID 擴充功能
        // =====================================================
        console.log('\n📦 啟用 UUID 擴充功能...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('✅ UUID 擴充功能已啟用');

        // =====================================================
        // 2. 建立餐廳資料表
        // =====================================================
        console.log('\n📋 建立餐廳資料表...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurants (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(100) NOT NULL,
                line_channel_id VARCHAR(100) UNIQUE,
                line_channel_secret VARCHAR(255),
                line_access_token TEXT,
                address VARCHAR(200),
                phone VARCHAR(20),
                total_seats INT NOT NULL DEFAULT 0,
                avg_meal_duration_minutes INT NOT NULL DEFAULT 60,
                queue_max_size INT NOT NULL DEFAULT 50,
                auto_call_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ 餐廳資料表已建立');

        // =====================================================
        // 3. 建立消費者資料表
        // =====================================================
        console.log('\n👤 建立消費者資料表...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                line_user_id VARCHAR(100) UNIQUE NOT NULL,
                display_name VARCHAR(100),
                phone VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ 消費者資料表已建立');

        // =====================================================
        // 4. 建立排隊資料表
        // =====================================================
        console.log('\n🔢 建立排隊資料表...');
        
        // 建立 ENUM 型態
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE queue_status AS ENUM ('waiting', 'called', 'served', 'cancelled', 'no_show');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `);
        
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE queue_source AS ENUM ('walk_in', 'reservation', 'waitlist');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS queue_entries (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                queue_number INT NOT NULL,
                status queue_status NOT NULL DEFAULT 'waiting',
                party_size INT NOT NULL DEFAULT 1,
                joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                called_at TIMESTAMP WITH TIME ZONE,
                served_at TIMESTAMP WITH TIME ZONE,
                notes TEXT,
                source queue_source NOT NULL DEFAULT 'walk_in'
            )
        `);
        console.log('✅ 排隊資料表已建立');

        // =====================================================
        // 5. 建立索引
        // =====================================================
        console.log('\n🔍 建立索引...');
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_entries_restaurant_status ON queue_entries(restaurant_id, status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_entries_restaurant_queue_number ON queue_entries(restaurant_id, queue_number)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_entries_customer ON queue_entries(customer_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_queue_entries_joined_at ON queue_entries(joined_at)`);
        console.log('✅ 索引已建立');

        // =====================================================
        // 6. 建立預約資料表
        // =====================================================
        console.log('\n📅 建立預約資料表...');
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE reservation_status AS ENUM ('confirmed', 'seated', 'cancelled', 'no_show');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                reservation_date DATE NOT NULL,
                reservation_time TIME NOT NULL,
                party_size INT NOT NULL DEFAULT 1,
                status reservation_status NOT NULL DEFAULT 'confirmed',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                notes TEXT
            )
        `);
        console.log('✅ 預約資料表已建立');

        // =====================================================
        // 7. 建立通知記錄資料表
        // =====================================================
        console.log('\n📬 建立通知記錄資料表...');
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE notification_type AS ENUM ('queue_called', 'queue_cancelled', 'reminder', 'reservation_confirmed', 'reservation_reminder');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `);
        
        await pool.query(`
            DO $$ BEGIN
                CREATE TYPE notification_status AS ENUM ('sent', 'delivered', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                queue_entry_id UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
                notification_type notification_type NOT NULL,
                line_message_id VARCHAR(100),
                sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                status notification_status NOT NULL DEFAULT 'sent'
            )
        `);
        console.log('✅ 通知記錄資料表已建立');

        // =====================================================
        // 8. 建立自動更新 updated_at 觸發器
        // =====================================================
        console.log('\n⏰ 建立更新觸發器...');
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        
        await pool.query(`
            DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants
        `);
        await pool.query(`
            CREATE TRIGGER update_restaurants_updated_at
                BEFORE UPDATE ON restaurants
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
        `);
        console.log('✅ 更新觸發器已建立');

        // =====================================================
        // 9. 插入安安餐廳預設資料
        // =====================================================
        console.log('\n🏪 插入安安餐廳預設資料...');
        await pool.query(`
            INSERT INTO restaurants (name, line_channel_id, address, phone, total_seats, avg_meal_duration_minutes, queue_max_size)
            VALUES (
                '安安餐廳',
                $1,
                '台北市文山區羅斯福路五段15號（萬隆站步行3分鐘）',
                '02-2931-6688',
                50,
                30,
                100
            )
            ON CONFLICT (line_channel_id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                phone = EXCLUDED.phone
        `, [process.env.LINE_CHANNEL_ID]);
        console.log('✅ 安安餐廳資料已插入');

        // =====================================================
        // 完成
        // =====================================================
        console.log('\n' + '='.repeat(50));
        console.log('🎉 資料庫初始化完成！');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ 資料庫初始化失敗：', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// 執行
initDatabase().catch(error => {
    console.error(' Fatal error:', error);
    process.exit(1);
});