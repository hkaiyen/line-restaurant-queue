-- =====================================================
-- LINE 餐廳候補位系統 - Migration 復原腳本
-- 版本：001
-- 日期：2026-05-13
-- 作者：小咪技術研發助理
-- 說明：復原所有 001_initial_schema.sql 的變更
-- =====================================================

-- 刪除觸發器
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;

-- 刪除函數
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS get_next_queue_number(UUID);

-- 刪除資料表（依依賴順序，先刪除有外鍵的）
DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS queue_entries;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS schema_migrations;

-- 刪除 ENUM 型別
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS reservation_status;
DROP TYPE IF EXISTS queue_source;
DROP TYPE IF EXISTS queue_status;