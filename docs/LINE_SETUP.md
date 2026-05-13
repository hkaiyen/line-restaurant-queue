# LINE 官方帳號申請與設定教學

## 版本資訊
- **系統版本：** 1.0.0
- **发布日期：** 2026-05-13
- **時區：** Asia/Taipei (GMT+8)
- **作者：** 小咪技術研發助理

---

## 目錄
1. [LINE 官方帳號申請](#line-官方帳號申請)
2. [LINE Messaging API 設定](#line-messaging-api-設定)
3. [Webhook 設定](#webhook-設定)
4. [LIFF 應用設定](#liff-應用設定)
5. [Rich Menu 設定](#rich-menu-設定)
6. [測試與驗證](#測試與驗證)

---

## LINE 官方帳號申請

### 前置準備
- 一個 LINE 帳號
- 電子郵件地址（用於驗證）
- 餐廳或公司名稱（用於建立 Provider）

### Step 1：前往 LINE Developers Console

1. 開啟瀏覽器，前往 [LINE Developers Console](https://developers.line.me/)
2. 登入您的 LINE 帳號
3. 首次登入需要驗證電子郵件

### Step 2：建立 Provider

1. 登入後，點擊「建立 Provider」
2. 輸入 Provider 名稱（例如：「餐廳名稱」或「公司名稱」）
3. 點擊「建立」

```
💡 小提示：
- Provider 類似於一個組織或公司的概念
- 一個 Provider 可以管理多個 Channel
- 建議使用正式的公司或餐廳名稱
```

### Step 3：建立 Messaging API Channel

1. 在 Provider 頁面，點擊「建立 Channel」
2. 選擇「Messaging API」
3. 填入以下資訊：

| 欄位 | 說明 | 範例 |
|------|------|------|
| Channel Name | 頻道名稱（會顯示在使用者裝置上） | 餐廳候補位系統 |
| Channel Description | 頻道描述 | 餐廳排隊候補位服務 |
| Category | 類別 | 餐飲 |
| Subcategory | 子類別 | 餐廳 |
| Icon Image | 圖示（可之後再上傳） | 餐廳 logo |
| Email | 聯絡用電子郵件 | contact@restaurant.com |

4. 勾選「我已閱讀並同意 LINE Messages API 使用條款」
5. 點擊「建立」

### Step 4：保存重要資訊

建立完成後，在「Basic settings」頁面保存以下資訊：

- **Channel ID：** `1234567890`
- **Channel Secret：** `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

```
⚠️ 重要：
- Channel Secret 請妥善保管，不要外洩
- 建議將這些資訊記錄在安全的密碼管理工具中
```

---

## LINE Messaging API 設定

### Step 1：取得 Access Token

1. 在 LINE Developers Console 進入您的 Messaging API Channel
2. 點擊「Messaging API」標籤
3. 滾動到「Long-lived Access Token」區塊
4. 點擊「Issue」產生 Token

```
📋 產生的 Token 範例：
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 2：啟用自動回覆功能

1. 在「Messaging API」頁面
2. 找到「Auto-reply messages」
3. 點擊「Edit」
4. 將「Auto-reply messages」設為「Disabled」

```
💡 小提示：
- 我們需要手動處理回覆，不要讓 LINE 自動回覆
- 這樣可以確保系統能正確處理所有訊息
```

### Step 3：設定 Webhook URL

1. 在「Messaging API」頁面
2. 找到「Webhook settings」
3. 啟用「Use webhook」
4. 在「Webhook URL」輸入框輸入您的 Webhook URL

```
📋 Webhook URL 格式：
https://your-domain.com/webhook

例如：
https://example.ngrok.io/webhook
```

5. 點擊「Verify」確認 Webhook 是否正常運作

---

## Webhook 設定

### 什麼是 Webhook？

Webhook 是一種機制，當 LINE 收到使用者訊息時，會將事件資料 POST 到您的伺服器。這樣您的系統可以即時處理使用者的請求。

### 設定 Webhook URL

1. **開發環境（使用 ngrok）：**

   ```bash
   # 安裝 ngrok
   brew install ngrok   # macOS
   # 或下載：https://ngrok.com/download
   
   # 設定 ngrok
   ngrok config add-authtoken <your-token>
   
   # 啟動 ngrok（另一個終端機）
   ngrok http 3000
   
   # 複製產生的 HTTPS URL
   # 例如：https://abc123def456.ngrok.io
   ```

2. **生產環境：**
   - 確保您的伺服器有公開的 HTTPS URL
   - 可以使用 Cloudflare、Let's Encrypt 等服務
   - 確認 SSL 憑證有效

3. **在 LINE Developers Console 設定：**
   ```
   1. 進入 Messaging API Channel
   2. 點擊「Messaging API」
   3. 找到「Webhook settings」
   4. 啟用「Use webhook」
   5. 輸入 Webhook URL：https://your-domain.com/webhook
   6. 點擊「Verify」
   ```

### 驗證 Webhook

LINE 提供 Webhook 驗證功能：

1. 點擊「Verify」按鈕
2. LINE 會向您的 Webhook URL 發送測試請求
3. 如果成功，會顯示「Success」
4. 如果失敗，會顯示錯誤訊息

```
❌ 常見驗證失敗原因：
- Webhook URL 無法存取
- SSL 憑證無效
- 伺服器未正確回應
- 簽章驗證失敗
```

### 本地測試 Webhook

在本地端測試 Webhook 的方法：

```bash
# 使用 curl 測試 Webhook 端點
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-LINE-Signature: test_signature" \
  -d '{"events":[]}'

# 預期回應：200 OK
```

---

## LIFF 應用設定

### 什麼是 LIFF？

LIFF（LINE Front-end Framework）允許您在 LINE 內嵌瀏覽器中運行 Web 應用。這讓使用者可以在 LINE 內完成所有操作，不需要跳轉到其他應用。

### 建立 LIFF 應用

1. 在 LINE Developers Console 進入您的 Messaging API Channel
2. 點擊「LIFF」標籤
3. 點擊「Add」建立新的 LIFF 應用

### LIFF 設定欄位說明

| 欄位 | 說明 | 建議值 |
|------|------|--------|
| LIFF App Name | LIFF 應用名稱 | 餐廳候補位系統 |
| Size | 視圖大小 | Tall（全螢幕高度） |
| Endpoint URL | LIFF 頁面 URL | https://your-domain.com/liff/queue/join |
| Optional permissions | 額外權限 | Chat Message（建議啟用） |

### LIFF URL 格式

建立 LIFF 後，會得到一個 LIFF ID，格式如下：

```
https://liff.line.me/<liff_id>

例如：
https://liff.line.me/1234567890-abc123def
```

### 本系統支援的 LIFF 頁面

| LIFF ID | 頁面 | 用途 |
|---------|------|------|
| /liff/queue/join | 加入排隊 | 消費者加入排隊 |
| /liff/queue/status | 排隊狀態 | 查詢排隊進度 |
| /liff/reservation/book | 預約 | 預約座位 |
| /liff/reservation/my | 我的預約 | 查詢/取消預約 |

### 建議的 LIFF 設定

#### 1. 加入排隊 LIFF
```
Name: 加入排隊
Size: Tall
Endpoint URL: https://your-domain.com/liff/queue/join
Permissions: Chat Message
```

#### 2. 排隊狀態 LIFF
```
Name: 排隊狀態
Size: Tall
Endpoint URL: https://your-domain.com/liff/queue/status
Permissions: Chat Message
```

#### 3. 預約 LIFF
```
Name: 線上預約
Size: Tall
Endpoint URL: https://your-domain.com/liff/reservation/book
Permissions: Chat Message
```

#### 4. 我的預約 LIFF
```
Name: 我的預約
Size: Tall
Endpoint URL: https://your-domain.com/liff/reservation/my
Permissions: Chat Message
```

---

## Rich Menu 設定

### 什麼是 Rich Menu？

Rich Menu 是在 LINE 官方帳號聊天畫面底部顯示的選單，可以快速存取常見功能。

### 建立 Rich Menu

1. 前往 [LINE Official Account Manager](https:// managers.line.me/)
2. 登入您的 LINE 帳號
3. 選擇您的官方帳號
4. 點擊「Rich Menu」標籤
5. 點擊「建立 Rich Menu」

### 建議的 Rich Menu 設計

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   🏠 首頁   │   📝 排隊   │   📅 預約   │   ❓ 幫助   │
│   (主選單)  │ (加入排隊)  │ (線上預約)  │   (說明)   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 選單設定

| 選單名稱 | 動作 | LIFF URL |
|----------|------|----------|
| 🏠 首頁 | 開啟 LIFF | https://liff.line.me/<liff_id_1> |
| 📝 加入排隊 | 開啟 LIFF | https://liff.line.me/<liff_id> |
| 📅 線上預約 | 開啟 LIFF | https://liff.line.me/<liff_id> |
| 📍 我的排隊 | 開啟 LIFF | https://liff.line.me/<liff_id> |
| ❓ 幫助 | 文字回覆 | help |

### 設定預設 Rich Menu

1. 建立多個 Rich Menu 後
2. 點擊其中一個的「設為預設」
3. 這樣新加入的好友會看到這個選單

---

## 測試與驗證

### 測試清單

#### 1. Webhook 測試

```bash
# 測試 Webhook 端點是否正常
curl -X GET https://your-domain.com/webhook

# 預期回應：200 OK
```

#### 2. LINE Messaging API 測試

在 LINE Developers Console 的「Messaging API」頁面：

1. 找到「Test messaging API」區塊
2. 選擇「Push」類型
3. 輸入測試用的 User ID
4. 輸入測試訊息內容
5. 點擊「Test」

#### 3. LIFF 頁面測試

1. 在 LINE App 中開啟您的 LIFF URL
2. 確認頁面可以正常載入
3. 確認所有功能可以正常操作

#### 4. 完整流程測試

```
測試流程：
1. 使用者在 LINE 中點擊 Rich Menu「加入排隊」
2. 開啟 LIFF 頁面
3. 選擇餐廳
4. 填入姓名和人數
5. 提交成功
6. 收到 LINE 確認訊息
7. 收到排隊號碼和預計等候時間
8. 餐廳叫號
9. 收到叫號通知
10. 到店報到
```

### 常見問題與解決方式

#### Q1: Webhook 驗證失敗

**可能原因：**
- 伺服器未正常運行
- SSL 憑證無效
- Webhook URL 格式錯誤

**解決方式：**
1. 確認伺服器正在運行
2. 使用 ngrok 進行本地測試
3. 確認 SSL 憑證有效

#### Q2: LIFF 頁面無法載入

**可能原因：**
- LIFF Endpoint URL 錯誤
- 頁面有 JavaScript 錯誤

**解決方式：**
1. 確認 LIFF Endpoint URL 正確
2. 使用瀏覽器開發者工具檢查 Console 錯誤
3. 確認 LINE LIFF SDK 已正確引入

#### Q3: 訊息無法發送

**可能原因：**
- Access Token 過期
- LINE User ID 格式錯誤

**解決方式：**
1. 在 LINE Developers Console 重新產生 Access Token
2. 確認 LINE User ID 格式正確（開頭為 U）

---

## 快速參考表

### 必要資訊記錄

```
═══════════════════════════════════════════════════════════
                    LINE 開發設定資訊
═══════════════════════════════════════════════════════════

Channel ID:          _________________________________
Channel Secret:      _________________________________

Access Token:        _________________________________

Webhook URL:         _________________________________

LIFF IDs:
  - 加入排隊:      _________________________________
  - 排隊狀態:      _________________________________
  - 預約:          _________________________________
  - 我的預約:      _________________________________

═══════════════════════════════════════════════════════════
```

### LINE Developers Console 連結

| 功能 | 連結 |
|------|------|
| LINE Developers Console | https://developers.line.me/console/ |
| LINE Official Account Manager | https:// managers.line.me/ |
| LINE Login | https://developers.line.me/line-login/ |

---

## 下一步

完成 LINE 官方帳號設定後，請參考以下文件：

1. **DEPLOYMENT.md** - 系統部署指南
2. **API 測試腳本** - `scripts/test-api.sh`
3. **LINE 整合測試腳本** - `scripts/test-line.sh`

---

## 聯絡技術支援

如有任何問題，請聯繫：
- **負責人：** 小咪技術研發助理
- **版本：** 1.0.0
- **发布日期：** 2026-05-13