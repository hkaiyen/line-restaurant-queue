# LINE 餐廳候補位系統 - Render.com 部署指南（含 PostgreSQL）

## 前置需求
1. GitHub 帳號
2. Render.com 帳號（可用 GitHub 登入）
3. Render.com PostgreSQL 免費資料庫

## 部署步驟

### 第一步：將程式碼上傳到 GitHub

```bash
cd ~/.openclaw/workspace/line-bot-repo

# 加入所有檔案
git add -A
git commit -m "✨ 功能優化：PostgreSQL資料庫 + Flex Message + Quick Reply + 安安餐廳品牌"

# 推送（需要輸入 GitHub 帳號密碼）
git push origin main
```

---

### 第二步：在 Render.com 建立 PostgreSQL 資料庫

1. 前往 https://render.com
2. 點擊 "New +" → "PostgreSQL"
3. 設定：
   - **Name**: `line-queue-db`
   - **Region**: Singapore
   - **Plan**: Free
4. 點擊 "Create Database"
5. **複製 Internal Database URL**（待會用到）

---

### 第三步：在 Render.com 建立 Web Service

1. 點擊 "New +" → "Web Service"
2. 選擇 "Connect a GitHub account"
3. 找到您的 repository
4. 設定：

| 設定 | 值 |
| --- | --- |
| **Name** | `line-queue-bot` |
| **Region** | Singapore |
| **Branch** | `main` |
| **Root Directory** | （留空）|
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

5. 點擊 "Create Web Service"

---

### 第四步：設定環境變數

在 Web Service 頁面，點擊 "Environment" 標籤，加入：

```
LINE_CHANNEL_ID=2009974222
LINE_CHANNEL_SECRET=3d31217849d64bb5498021917fff1979
LINE_ACCESS_TOKEN=您的最新Token（每30天需更新）
LINE_ADMIN_USER_ID=Uad991d6c2defed9e2de07a16445c39bc
PORT=3000
NODE_ENV=production

# PostgreSQL 設定（從第二步取得）
DB_HOST=xxxxx.internal
DB_PORT=5432
DB_NAME=line_queue_db
DB_USER=your_username
DB_PASSWORD=your_password
```

---

### 第五步：初始化資料庫

1. 在 Render.com Web Service 頁面
2. 點擊 "Shell" 開啟終端機
3. 執行：

```bash
node scripts/init-database.js
```

看到「🎉 資料庫初始化完成！」表示成功

---

### 第六步：更新 LINE Webhook URL

1. 前往 LINE Developers Console
   👉 https://developers.line.biz/console/channel/2009974222/messaging-api

2. 點擊 "Messaging API" 標籤
3. 滾動到 "Webhook URL"
4. 填入您的 Render.com URL：
   ```
   https://line-queue-bot.onrender.com/webhook
   ```
5. 點擊 "Verify" 確認

6. 關閉「Auto-reply」和「LIFF」功能（如有）

---

### 第七步：測試

在 LINE App 中找到「小安智能助理」：
- 傳送「排隊」→ 應該出現 Flex Message 卡片和 Quick Reply
- 傳送「幫助」→ 顯示幫助說明
- 傳送「電話」→ 顯示聯絡資訊

---

## 🔧 常用指令

### 檢視資料庫
```bash
# 進入 psql
psql $DATABASE_URL

# 查詢排隊資料
SELECT * FROM queue_entries WHERE status = 'waiting';

# 查詢消費者
SELECT * FROM customers;
```

### 備份資料庫
```bash
node scripts/backup-database.js
```

### 重新初始化（慎用！）
```bash
node scripts/init-database.js
```

---

## ❓ 疑難排解

### Webhook Verify 失敗
1. 確認 Render.com 服務正常運行
2. 檢查環境變數是否正確
3. 查看 Render.com logs 是否有錯誤

### LINE Bot 無回應
1. 確認 LINE_ACCESS_TOKEN 未過期
2. 檢查 Webhook URL 是否正確
3. 確認已關閉「Auto-reply」功能

### 資料庫連線失敗
1. 確認 PostgreSQL 狀態是 "Available"
2. 檢查 DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
3. 確認 Internal Database URL 格式正確

---

## 📊 功能列表

| 功能 | 狀態 |
| --- | --- |
| PostgreSQL 資料庫 | ✅ |
| Flex Message 卡片 | ✅ |
| Quick Reply 按鈕 | ✅ |
| 安安餐廳品牌 | ✅ |
| 排隊流程 | ✅ |
| 查詢功能 | ✅ |
| 取消排隊 | ✅ |
| Rich Menu（需手動設定） | 🔧 |
| 管理後台 | 🔜 |
| 推播通知 | 🔜 |