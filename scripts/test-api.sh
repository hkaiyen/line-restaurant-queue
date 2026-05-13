#!/bin/bash
# =====================================================
# LINE 餐廳候補位系統 - API 測試腳本
# 版本：1.0.0
# 日期：2026-05-13
# 作者：小咪技術研發助理
# =====================================================

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 預設值
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TIMEOUT=5

# 測試Restaurant ID（請替換為實際值）
TEST_RESTAURANT_ID="${TEST_RESTAURANT_ID:-}"

# =====================================================
# 工具函數
# =====================================================

print_header() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# HTTP 請求函數
http_get() {
    local endpoint="$1"
    local description="$2"
    
    echo -e "\n📡 GET ${BASE_URL}${endpoint}"
    echo "   說明：${description}"
    
    response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}${endpoint}" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "HTTP ${http_code} - ${description}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "HTTP ${http_code} - ${description}"
        echo "$body"
        return 1
    fi
}

http_post() {
    local endpoint="$1"
    local data="$2"
    local description="$3"
    
    echo -e "\n📡 POST ${BASE_URL}${endpoint}"
    echo "   說明：${description}"
    echo "   資料：${data}"
    
    response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
        -X POST "${BASE_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "${data}" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        print_success "HTTP ${http_code} - ${description}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        print_error "HTTP ${http_code} - ${description}"
        echo "$body"
        return 1
    fi
}

# =====================================================
# 測試案例
# =====================================================

test_health_check() {
    print_header "1. 健康檢查測試"
    
    http_get "/" "服務根目錄" || true
    http_get "/webhook" "Webhook 端點" || true
}

test_queue_api() {
    print_header "2. 排隊 API 測試"
    
    if [ -z "$TEST_RESTAURANT_ID" ]; then
        print_warning "未設定 TEST_RESTAURANT_ID，將跳過部分測試"
        print_info "可使用：export TEST_RESTAURANT_ID=<uuid>"
    fi
    
    # 取得排隊名單
    if [ -n "$TEST_RESTAURANT_ID" ]; then
        http_get "/api/queue/list/${TEST_RESTAURANT_ID}" "取得餐廳排隊名單"
        http_get "/api/queue/stats/${TEST_RESTAURANT_ID}" "取得排隊統計"
        
        # 叫號 API 測試
        http_post "/api/queue/call-next" "{\"restaurantId\":\"${TEST_RESTAURANT_ID}\"}" "叫下一位"
        http_post "/api/queue/call-specific" "{\"restaurantId\":\"${TEST_RESTAURANT_ID}\",\"queueNumber\":1}" "叫指定號碼"
    else
        print_info "請設定 TEST_RESTAURANT_ID 來測試排隊 API"
    fi
}

test_reservation_api() {
    print_header "3. 預約 API 測試"
    
    if [ -n "$TEST_RESTAURANT_ID" ]; then
        # 取得預約列表
        http_get "/api/reservations/${TEST_RESTAURANT_ID}" "取得預約列表"
        
        # 測試特定日期
        local today=$(date +%Y-%m-%d)
        http_get "/api/reservations/${TEST_RESTAURANT_ID}?date=${today}" "取得今日預約"
    else
        print_info "請設定 TEST_RESTAURANT_ID 來測試預約 API"
    fi
}

test_notification_api() {
    print_header "4. 通知 API 測試"
    
    if [ -n "$TEST_RESTAURANT_ID" ]; then
        http_get "/api/notifications/${TEST_RESTAURANT_ID}" "取得通知歷史"
        http_get "/api/notifications/${TEST_RESTAURANT_ID}?limit=10" "取得最近 10 筆通知"
    else
        print_info "請設定 TEST_RESTAURANT_ID 來測試通知 API"
    fi
}

test_liff_pages() {
    print_header "5. LIFF 頁面測試"
    
    local pages=(
        "/liff/queue/join:加入排隊頁面"
        "/liff/queue/status:排隊狀態頁面"
        "/liff/reservation/book:預約頁面"
        "/liff/reservation/my:我的預約頁面"
    )
    
    for page in "${pages[@]}"; do
        IFS=':' read -r path desc <<< "$page"
        
        echo -e "\n📡 測試 ${path}"
        echo "   說明：${desc}"
        
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}${path}")
        
        if [ "$status_code" = "200" ]; then
            print_success "HTTP ${status_code} - ${desc}"
        else
            print_error "HTTP ${status_code} - ${desc}"
        fi
    done
}

test_admin_pages() {
    print_header "6. 管理後台頁面測試"
    
    local pages=(
        "/admin:餐廳管理後台"
    )
    
    for page in "${pages[@]}"; do
        echo -e "\n📡 測試 ${page}"
        
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${BASE_URL}${page}")
        
        if [ "$status_code" = "200" ]; then
            print_success "HTTP ${status_code} - 管理後台"
        else
            print_error "HTTP ${status_code} - 管理後台"
        fi
    done
}

test_db_connection() {
    print_header "7. 資料庫連線測試"
    
    # 檢查 PostgreSQL
    if command -v psql &> /dev/null; then
        echo -e "\n🗄️  測試 PostgreSQL 連線..."
        
        export PGPASSWORD="${DB_PASSWORD:-postgres}"
        
        if psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d line_queue -c "SELECT 1" &> /dev/null; then
            print_success "PostgreSQL 連線成功"
            
            # 檢查資料錶
            echo -e "\n📋 檢查資料錶是否存在..."
            psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d line_queue -c "\dt" 2>/dev/null | grep -E "(restaurants|customers|queue_entries|reservations|notification_logs)" || print_warning "找不到資料表"
        else
            print_error "PostgreSQL 連線失敗"
        fi
    else
        print_warning "psql 未安裝，跳過資料庫測試"
    fi
    
    # 檢查 Redis
    if command -v redis-cli &> /dev/null; then
        echo -e "\n🔴 測試 Redis 連線..."
        
        if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping &> /dev/null; then
            print_success "Redis 連線成功"
        else
            print_error "Redis 連線失敗"
        fi
    else
        print_warning "redis-cli 未安裝，跳過 Redis 測試"
    fi
}

show_help() {
    echo "LINE 餐廳候補位系統 - API 測試腳本"
    echo ""
    echo "用法：$0 [選項]"
    echo ""
    echo "選項："
    echo "  --all           執行所有測試（預設）"
    echo "  --health        僅測試健康檢查"
    echo "  --queue         僅測試排隊 API"
    echo "  --reservation   僅測試預約 API"
    echo "  --notification  僅測試通知 API"
    echo "  --liff          僅測試 LIFF 頁面"
    echo "  --admin         僅測試管理後台"
    echo "  --db            僅測試資料庫連線"
    echo "  --help          顯示此幫助訊息"
    echo ""
    echo "環境變數："
    echo "  API_BASE_URL           API 基礎 URL（預設：http://localhost:3000）"
    echo "  TEST_RESTAURANT_ID     測試用餐廳 UUID"
    echo "  DB_HOST                資料庫主機（預設：localhost）"
    echo "  DB_PORT                資料庫連接埠（預設：5432）"
    echo "  DB_USER                資料庫使用者（預設：postgres）"
    echo "  DB_PASSWORD            資料庫密碼（預設：postgres）"
    echo "  REDIS_HOST             Redis 主機（預設：localhost）"
    echo "  REDIS_PORT             Redis 連接埠（預設：6379）"
    echo ""
}

# =====================================================
# 主程式
# =====================================================

main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   LINE 餐廳候補位系統 - API 測試腳本             ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "測試目標：${BASE_URL}"
    
    case "${1:-}" in
        --health)
            test_health_check
            ;;
        --queue)
            test_queue_api
            ;;
        --reservation)
            test_reservation_api
            ;;
        --notification)
            test_notification_api
            ;;
        --liff)
            test_liff_pages
            ;;
        --admin)
            test_admin_pages
            ;;
        --db)
            test_db_connection
            ;;
        --help)
            show_help
            ;;
        --all|*)
            test_health_check
            test_queue_api
            test_reservation_api
            test_notification_api
            test_liff_pages
            test_admin_pages
            test_db_connection
            ;;
    esac
    
    print_header "測試完成"
    print_info "若有任何失敗，請檢查："
    echo "  1. 伺服器是否運行中"
    echo "  2. 環境變數是否正確設定"
    echo "  3. 資料庫和 Redis 是否正常"
}

main "$@"