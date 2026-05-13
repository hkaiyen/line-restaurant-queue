#!/bin/bash
# =====================================================
# LINE 餐廳候補位系統 - 資料庫初始化腳本
# 用途：初始化 PostgreSQL 資料庫並執行 Migration
# 日期：2026-05-13
# 作者：小咪技術研發助理
# =====================================================

set -e

echo "=============================================="
echo "LINE 餐廳候補位系統 - 資料庫初始化"
echo "=============================================="

# 等待 PostgreSQL 啟動
echo "等待 PostgreSQL 啟動..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c '\q' 2>/dev/null; do
    echo "PostgreSQL 尚未就緒，等待 2 秒..."
    sleep 2
done
echo "✅ PostgreSQL 已啟動"

# 建立資料庫（如果不存在）
echo "檢查資料庫是否存在..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || {
    echo "建立資料庫：$DB_NAME"
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
}
echo "✅ 資料庫就緒"

# 執行 Migration
echo "執行 Migration..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/001_initial_schema.sql
echo "✅ Migration 完成"

# 執行 Seed Data（選擇性）
if [ "$LOAD_SEED_DATA" = "true" ]; then
    echo "載入測試資料..."
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/002_seed_data.sql
    echo "✅ Seed Data 載入完成"
fi

echo "=============================================="
echo "資料庫初始化完成！"
echo "=============================================="

# 顯示資料庫版本
echo "資料庫版本："
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();"