#!/bin/bash
# =====================================================
# LINE 餐廳候補位系統 - LINE 整合測試腳本
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
NC='\033[0m'

# 預設值
WEBHOOK_URL="${WEBHOOK_URL:-}"
CHANNEL_SECRET="${LINE_CHANNEL_SECRET:-}"
TIMEOUT=10

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

# =====================================================
# LINE Messaging API 測試
# =====================================================

test_line_messaging_api() {
    print_header "LINE Messaging API 測試"
    
    if [ -z "${LINE_ACCESS_TOKEN:-}" ]; then
        print_warning "未設定 LINE_ACCESS_TOKEN，跳過 Messaging API 測試"
        print_info "請設定：export LINE_ACCESS_TOKEN=<your_token>"
        return 1
    fi
    
    echo -e "\n📡 測試 LINE Messaging API..."
    
    # 測試取得 profile（使用官方測試用戶 ID）
    response=$(curl -s --max-time "$TIMEOUT" \
        -H "Authorization: Bearer ${LINE_ACCESS_TOKEN}" \
        "https://api.line.me/v2/profile" 2>&1)
    
    if echo "$response" | grep -q '"userId"'; then
        print_success "LINE Access Token 驗證成功"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        print_error "LINE Access Token 驗證失敗"
        echo "$response"
    fi
}

test_line_webhook_signature() {
    print_header "LINE Webhook 簽章驗證測試"
    
    if [ -z "$CHANNEL_SECRET" ]; then
        print_warning "未設定 LINE_CHANNEL_SECRET，跳過簽章測試"
        return 1
    fi
    
    echo -e "\n🔐 測試簽章驗證函數..."
    
    # 建立測試內容
    test_body='{"events":[]}'
    test_signature="test_signature"
    
    # 呼叫本地 webhook 端點測試（如果伺服器運行中）
    if curl -s --max-time 5 "http://localhost:3000/webhook" &>/dev/null; then
        print_info "嘗試測試 webhook 端點..."
        
        # 傳送測試請求（無效簽章應被拒絕）
        response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" \
            -X POST "http://localhost:3000/webhook" \
            -H "Content-Type: application/json" \
            -H "X-LINE-Signature: invalid_signature" \
            -d "$test_body" 2>&1)
        
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "403" ]; then
            print_success "Webhook 簽章驗證正常運作（無效簽章被拒絕）"
        else
            print_warning "Webhook 端點回應：HTTP $http_code"
        fi
    else
        print_info "伺服器未運行，無法測試 webhook 端點"
    fi
}

test_line_liff() {
    print_header "LINE LIFF 頁面測試"
    
    if [ -z "${LINE_ACCESS_TOKEN:-}" ]; then
        print_warning "未設定 LINE_ACCESS_TOKEN，跳過 LIFF 測試"
        return 1
    fi
    
    echo -e "\n📱 測試 LIFF API..."
    
    # 取得 LIFF 應用列表
    response=$(curl -s --max-time "$TIMEOUT" \
        -H "Authorization: Bearer ${LINE_ACCESS_TOKEN}" \
        "https://api.line.me/liff/v1/apps" 2>&1)
    
    if echo "$response" | grep -q '"apps"'; then
        print_success "LIFF API 連線成功"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        print_warning "LIFF API 回應異常"
        echo "$response"
    fi
    
    echo -e "\n📋 LIFF 設定說明："
    echo "  LIFF URL 格式：https://liff.line.me/<liff_id>"
    echo "  請在 LINE Developers Console 註冊 LIFF 應用"
    echo ""
    print_info "本系統支援的 LIFF 頁面："
    echo "  - /liff/queue/join      加入排隊"
    echo "  - /liff/queue/status    排隊狀態"
    echo "  - /liff/reservation/book  預約"
    echo "  - /liff/reservation/my   我的預約"
}

test_line_bot_info() {
    print_header "LINE Bot 資訊測試"
    
    if [ -z "${LINE_ACCESS_TOKEN:-}" ]; then
        print_warning "未設定 LINE_ACCESS_TOKEN，跳過 Bot 資訊測試"
        return 1
    fi
    
    echo -e "\n🤖 取得 Bot 資訊..."
    
    response=$(curl -s --max-time "$TIMEOUT" \
        -H "Authorization: Bearer ${LINE_ACCESS_TOKEN}" \
        "https://api.line.me/v2/bot/info" 2>&1)
    
    if echo "$response" | grep -q '"displayName"'; then
        print_success "成功取得 Bot 資訊"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        print_error "無法取得 Bot 資訊"
        echo "$response"
    fi
}

test_line_webhook_url() {
    print_header "LINE Webhook URL 測試"
    
    if [ -z "${LINE_ACCESS_TOKEN:-}" ]; then
        print_warning "未設定 LINE_ACCESS_TOKEN，跳過 Webhook URL 測試"
        return 1
    fi
    
    if [ -z "$WEBHOOK_URL" ]; then
        print_warning "未設定 WEBHOOK_URL（你的 ngrok/public URL）"
        print_info "請設定：export WEBHOOK_URL=https://your-domain.ngrok.io"
        return 1
    fi
    
    echo -e "\n🔗 測試 Webhook URL 設定..."
    echo "   URL: $WEBHOOK_URL"
    
    response=$(curl -s --max-time "$TIMEOUT" \
        -H "Authorization: Bearer ${LINE_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -X PUT \
        -d "{\"webhook\":{\"webhookUrl\":\"${WEBHOOK_URL}/webhook\",\"botPrompt\":\"normal\"}}" \
        "https://api.line.me/v2/bot/channel/webhook/endpoint" 2>&1)
    
    if echo "$response" | grep -q '"success"'; then
        print_success "Webhook URL 設定成功"
    else
        print_info "Webhook URL 回應：$response"
    fi
    
    # 驗證 webhook
    echo -e "\n🔍 驗證 Webhook..."
    response=$(curl -s --max-time "$TIMEOUT" \
        -H "Authorization: Bearer ${LINE_ACCESS_TOKEN}" \
        "https://api.line.me/v2/bot/channel/webhook/endpoint" 2>&1)
    
    if echo "$response" | grep -q '"webhookUrl"'; then
        print_success "Webhook URL 驗證成功"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        print_warning "Webhook 驗證回應：$response"
    fi
}

test_line_follow_event() {
    print_header "LINE Follow 事件模擬測試"
    
    echo -e "\n📝 Follow 事件說明："
    echo "  當使用者加入 Bot 為好友時，LINE 會發送 follow 事件"
    echo ""
    echo "  事件格式："
    echo '  {'
    echo '    "type": "follow",'
    echo '    "replyToken": "xxx",'
    echo '    "source": { "type": "user", "userId": "U123..." },'
    echo '    "timestamp": 12345678901234'
    echo '  }'
    echo ""
    print_info "請使用 ngrok 將本地伺服器暴露到網路，然後在 LINE Developers Console 設定 Webhook URL"
}

test_line_postback_event() {
    print_header "LINE Postback 事件模擬測試"
    
    echo -e "\n📝 Postback 事件說明："
    echo "  當使用者點擊 carousel、buttons 等元件時，LINE 會發送 postback 事件"
    echo ""
    echo "  事件格式："
    echo '  {'
    echo '    "type": "postback",'
    echo '    "replyToken": "xxx",'
    echo '    "source": { "type": "user", "userId": "U123..." },'
    echo '    "postback": { "data": "action=join&restaurantId=xxx" },'
    echo '    "timestamp": 12345678901234'
    echo '  }'
}

test_line_message_event() {
    print_header "LINE Message 事件模擬測試"
    
    echo -e "\n📝 Message 事件說明："
    echo "  當使用者傳送訊息給 Bot 時，LINE 會發送 message 事件"
    echo ""
    echo "  事件格式："
    echo '  {'
    echo '    "type": "message",'
    echo '    "replyToken": "xxx",'
    echo '    "source": { "type": "user", "userId": "U123..." },'
    echo '    "message": { "type": "text", "text": "我要排隊" },'
    echo '    "timestamp": 12345678901234'
    echo '  }'
    echo ""
    print_info "系統支援處理的訊息："
    echo "  - '排隊' / 'join' → 加入排隊"
    echo "  - '預約' / 'reservation' → 預約"
    echo "  - '取消' / 'cancel' → 取消排隊/預約"
    echo "  - '狀態' / 'status' → 查詢排隊/預約狀態"
    echo "  - '幫助' / 'help' → 顯示幫助訊息"
}

# =====================================================
# ngrok 測試（本地 Webhook 測試）
# =====================================================

test_ngrok() {
    print_header "ngrok 本地測試環境設定"
    
    echo -e "\n🚀 ngrok 設定說明："
    echo ""
    echo "1. 安裝 ngrok（如果尚未安裝）："
    echo "   brew install ngrok    # macOS"
    echo "   或下載：https://ngrok.com/download"
    echo ""
    echo "2. 設定 LINE Channel Secret："
    echo "   ngrok config add-authtoken <your-token>"
    echo ""
    echo "3. 啟動 ngrok（另一個終端機）："
    echo "   ngrok http 3000"
    echo ""
    echo "4. 複製 https://xxx.ngrok.io 到 LINE Developers Console"
    echo ""
    echo "5. 測試 Webhook："
    echo "   # 測試 LINE 事件傳送"
    echo "   curl -X POST https://xxx.ngrok.io/webhook \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"events\":[]}'"
    echo ""
    print_info "建議：使用 --all 執行完整測試"
}

show_help() {
    echo "LINE 餐廳候補位系統 - LINE 整合測試腳本"
    echo ""
    echo "用法：$0 [選項]"
    echo ""
    echo "選項："
    echo "  --all          執行所有測試（預設）"
    echo "  --messaging    測試 LINE Messaging API"
    echo "  --signature    測試 Webhook 簽章驗證"
    echo "  --liff         測試 LINE LIFF"
    echo "  --bot-info     測試 Bot 資訊"
    echo "  --webhook-url  測試 Webhook URL 設定"
    echo "  --follow       模擬 Follow 事件"
    echo "  --postback     模擬 Postback 事件"
    echo "  --message      模擬 Message 事件"
    echo "  --ngrok        ngrok 設定說明"
    echo "  --help         顯示此幫助訊息"
    echo ""
    echo "環境變數："
    echo "  LINE_ACCESS_TOKEN      LINE Channel Access Token"
    echo "  LINE_CHANNEL_SECRET    LINE Channel Secret"
    echo "  WEBHOOK_URL            公開的 Webhook URL（如 ngrok URL）"
    echo ""
}

# =====================================================
# 主程式
# =====================================================

main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   LINE 餐廳候補位系統 - LINE 整合測試腳本         ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
    
    case "${1:-}" in
        --messaging)
            test_line_messaging_api
            ;;
        --signature)
            test_line_webhook_signature
            ;;
        --liff)
            test_line_liff
            ;;
        --bot-info)
            test_line_bot_info
            ;;
        --webhook-url)
            test_line_webhook_url
            ;;
        --follow)
            test_line_follow_event
            ;;
        --postback)
            test_line_postback_event
            ;;
        --message)
            test_line_message_event
            ;;
        --ngrok)
            test_ngrok
            ;;
        --help)
            show_help
            ;;
        --all|*)
            test_line_messaging_api
            test_line_webhook_signature
            test_line_liff
            test_line_bot_info
            test_line_webhook_url
            test_line_follow_event
            test_line_postback_event
            test_line_message_event
            ;;
    esac
    
    print_header "LINE 整合測試完成"
    print_info "後續步驟："
    echo "  1. 確保 LINE Channel 已正確設定"
    echo "  2. 在 LINE Developers Console 啟用 Messaging API"
    echo "  3. 設定 Webhook URL（需 HTTPS）"
    echo "  4. 確認 LINE LIFF 應用已建立"
}

main "$@"