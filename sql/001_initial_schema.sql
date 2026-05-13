-- =====================================================
-- LINE 餐廳候補位系統 - 初始資料庫 Migration
-- 版本：001
-- 日期：2026-05-13
-- 作者：小咪技術研發助理
-- 適用時區：Asia/Taipei (GMT+8)
-- =====================================================

-- 啟用 UUID 擴充功能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. restaurants（餐廳資料表）
-- =====================================================
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
);

COMMENT ON TABLE restaurants IS '餐廳基本資料表';
COMMENT ON COLUMN restaurants.id IS '餐廳 UUID 主鍵';
COMMENT ON COLUMN restaurants.line_channel_id IS 'LINE Channel ID';
COMMENT ON COLUMN restaurants.line_channel_secret IS 'LINE Channel Secret（加密儲存）';
COMMENT ON COLUMN restaurants.line_access_token IS 'LINE Long-lived Access Token';
COMMENT ON COLUMN restaurants.total_seats IS '總座位數';
COMMENT ON COLUMN restaurants.avg_meal_duration_minutes IS '平均用餐時長（分鐘）';
COMMENT ON COLUMN restaurants.queue_max_size IS '排隊人數上限';
COMMENT ON COLUMN restaurants.auto_call_enabled IS '是否啟用自動叫號';

-- =====================================================
-- 2. customers（消費者資料表）
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customers IS '消費者資料表';
COMMENT ON COLUMN customers.line_user_id IS 'LINE User ID（用於發送推播）';
COMMENT ON COLUMN customers.display_name IS 'LINE 顯示名稱';

-- =====================================================
-- 3. queue_entries（排隊資料表）
-- =====================================================
CREATE TYPE queue_status AS ENUM ('waiting', 'called', 'served', 'cancelled', 'no_show');
CREATE TYPE queue_source AS ENUM ('walk_in', 'reservation', 'waitlist');

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
    source queue_source NOT NULL DEFAULT 'walk_in',
    CONSTRAINT unique_active_queue UNIQUE (restaurant_id, customer_id, status)
);

COMMENT ON TABLE queue_entries IS '排隊資料表';
COMMENT ON COLUMN queue_entries.status IS '排隊狀態：waiting/called/served/cancelled/no_show';
COMMENT ON COLUMN queue_entries.source IS '來源：walk_in現場排隊/reservation預約/waitlist候補';

-- Index：提升依餐廳查詢排隊名單的效能
CREATE INDEX idx_queue_entries_restaurant_status ON queue_entries(restaurant_id, status);
CREATE INDEX idx_queue_entries_restaurant_queue_number ON queue_entries(restaurant_id, queue_number);
CREATE INDEX idx_queue_entries_customer ON queue_entries(customer_id);
CREATE INDEX idx_queue_entries_joined_at ON queue_entries(joined_at);

-- =====================================================
-- 4. reservations（預約資料表）
-- =====================================================
CREATE TYPE reservation_status AS ENUM ('confirmed', 'seated', 'cancelled', 'no_show');

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
);

COMMENT ON TABLE reservations IS '預約資料表';
COMMENT ON COLUMN reservations.reservation_date IS '預約日期';
COMMENT ON COLUMN reservations.reservation_time IS '預約時間';
COMMENT ON COLUMN reservations.status IS '預約狀態：confirmed/seated/cancelled/no_show';

-- Index：依餐廳查詢特定日期的預約
CREATE INDEX idx_reservations_restaurant_date ON reservations(restaurant_id, reservation_date);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);

-- =====================================================
-- 5. notification_logs（通知記錄資料表）
-- =====================================================
CREATE TYPE notification_type AS ENUM ('queue_called', 'queue_cancelled', 'reminder', 'reservation_confirmed', 'reservation_reminder');
CREATE TYPE notification_status AS ENUM ('sent', 'delivered', 'failed');

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    queue_entry_id UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
    notification_type notification_type NOT NULL,
    line_message_id VARCHAR(100),
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status notification_status NOT NULL DEFAULT 'sent'
);

COMMENT ON TABLE notification_logs IS '通知發送記錄表';
COMMENT ON COLUMN notification_logs.notification_type IS '通知類型';
COMMENT ON COLUMN notification_logs.line_message_id IS 'LINE 訊息 ID（用於追蹤送達狀態）';

-- Index：依餐廳查詢通知歷史
CREATE INDEX idx_notification_logs_restaurant ON notification_logs(restaurant_id);
CREATE INDEX idx_notification_logs_customer ON notification_logs(customer_id);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);

-- =====================================================
-- 自動更新 updated_at 觸發器
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 取得下一個排隊號碼的函數
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_queue_number(p_restaurant_id UUID)
RETURNS INT AS $$
DECLARE
    next_number INT;
    max_number INT;
BEGIN
    -- 取得目前最大號碼
    SELECT COALESCE(MAX(queue_number), 0) INTO max_number
    FROM queue_entries
    WHERE restaurant_id = p_restaurant_id
      AND status IN ('waiting', 'called', 'served');

    -- 下一個號碼 = 最大號碼 + 1
    next_number := max_number + 1;
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Migration 版本記錄（可選，用於未來版本管理）
-- =====================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('001', 'Initial schema: restaurants, customers, queue_entries, reservations, notification_logs')
ON CONFLICT (version) DO NOTHING;