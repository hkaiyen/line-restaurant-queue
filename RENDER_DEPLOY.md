# LINE 餐廳候補位系統 - Render.com 部署指南

## 前置需求
1. GitHub 帳號
2. Render.com 帳號（可用 GitHub 登入）

## 部署步驟

### 第一步：將程式碼上傳到 GitHub

1. **在 GitHub 建立新 Repository**
   - 前往 https://github.com/new
   - Repository name: `line-restaurant-queue`
   - 選擇 Private 或 Public皆可
   - 不要勾選 "Add a README file"（我們已有）

2. **在本地端執行以下指令**（在 line_queue 資料夾）:

```bash
cd /root/.openclaw/workspace/line_queue

# 初始化 git
git init

# 設定遠端
git remote add origin https://github.com/YOUR_USERNAME/line-restaurant-queue.git

# 加入所有檔案（排除 node_modules 和 .env）
echo "node_modules/" >> .gitignore
echo ".env" >> .gitignore
echo ".gitignore" >> .gitignore

# 提交
git add .
git commit -m "Initial commit - LINE 餐廳候補位系統"

# 推送（需要輸入 GitHub 帳號密碼）
git branch -M main
git push -u origin main
```

### 第二步：在 Render.com 建立 Web Service

1. 前往 https://render.com
2. 點擊 "New +" → "Web Service"
3. 選擇 "Connect a GitHub account"
4. 找到您的 repository `line-restaurant-queue`
5. 設定以下內容：

| 設定 | 值 |
|------|------|
| **Name** | `line-queue-bot` |
| **Region** | Singapore（離台灣近）|
| **Branch** | `main` |
| **Root Directory** | （留空）|
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

6. 點擊 "Create Web Service"

### 第三步：設定環境變數

在 Render.com 的 Web Service 頁面：

1. 點擊 "Environment" 標籤
2. 在 "Environment Variables" 加入：

```
LINE_CHANNEL_ID=2009974222
LINE_CHANNEL_SECRET=3d31217849d64bb5498021917fff1979
LINE_ACCESS_TOKEN=您的最新Token
LINE_ADMIN_USER_ID=Uad991d6c2defed9e2de07a16445c39bc
PORT=3000
```

3. 點擊 "Save Changes"

### 第四步：取得公開 URL

部署完成後，Render.com 會給您一個 URL，例如：
```
https://line-queue-bot.onrender.com
```

### 第五步：更新 LINE Webhook URL

在 LINE Developers Console：

1. 進入 Messaging API 設定
2. Webhook URL 填入：
   ```
   https://line-queue-bot.onrender.com/webhook
   ```
3. 點擊 "Verify"

---

## 完成！🎉

Bot 成功上線後，您就可以在 LINE 上測試了！

---

## 維護說明

- **每次更新程式碼**：push 到 GitHub，Render.com 會自動重新部署
- **查看日誌**：在 Render.com 的 "Logs" 頁面
- **重啟服務**：點擊 "Manual Deploy" → "Deploy latest commit"

---

## 問題排除

如果 `Verify` 失敗：
1. 確認 Webhook URL 結尾是 `/webhook`
2. 確認環境變數已正確設定
3. 查看 Render.com 的 Logs 是否有錯誤訊息

如需幫助，請聯繫小咪！💡