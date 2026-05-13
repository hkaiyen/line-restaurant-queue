# LINE 餐廳候補位系統 - 部署指南

## 版本資訊
- **系統版本：** 1.0.0
- **发布日期：** 2026-05-13
- **時區：** Asia/Taipei (GMT+8)
- **作者：** 小咪技術研發助理

---

## 目錄
1. [系統需求](#系統需求)
2. [環境設定](#環境設定)
3. [資料庫設定](#資料庫設定)
4. [應用程式設定](#應用程式設定)
5. [LINE 設定](#line-設定)
6. [部署步驟](#部署步驟)
7. [Docker 部署](#docker-部署)
8. [生產環境設定](#生產環境設定)
9. [部署檢查清單](#部署檢查清單)
10. [系統管理者手冊](#系統管理者手冊)

---

## 系統需求

### 硬體需求
- **CPU：** 2 vCPU 以上
- **記憶體：** 4 GB RAM 以上
- **儲存空間：** 20 GB 以上

### 軟體需求
- **Node.js：** 18.x 或更新版本
- **PostgreSQL：** 16.x 或更新版本
- **Redis：** 7.x 或更新版本（可選，用於快取）
- **Nginx：** 1.20+（可選，用於反向代理）
- **Docker：** 20.x+（可選）

### 支援的作業系統
- Linux (Ubuntu 20.04+, Debian 11+)
- macOS 12+
- Windows 10+ (WSL2 建議)

---

## 環境設定

### 1. 安裝 Node.js

**Ubuntu/Debian：**
```bash
# 使用 nvm 安裝 Node.js 18.x
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
```

**macOS：**
```bash
brew install node@18
```

### 2. 安裝 PostgreSQL

**Ubuntu/Debian：**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

**macOS：**
```bash
brew install postgresql@16
```

### 3. 安裝 Redis（可選）

**Ubuntu/Debian：**
```bash
sudo apt install -y redis-server
```

**macOS：**
```bash
brew install redis
```

---

## 資料庫設定

### 1. 建立資料庫

```bash
# 登入 PostgreSQL
sudo -u postgres psql

# 建立資料庫
CREATE DATABASE line_queue;

# 建立使用者（可選）
CREATE USER linequeue_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE line_queue TO linequeue_user;
\q
```

### 2. 初始化資料庫結構

```bash
# 進入專案目錄
cd /path/to/line_queue

# 執行初始化 SQL
psql -U postgres -d line_queue -f sql/001_initial_schema.sql

# 執行範例資料（可選）
psql -U postgres -d line_queue -f sql/002_seed_data.sql
```

### 3. 驗證資料庫

```bash
# 連線到資料庫
psql -U postgres -d line_queue

# 確認資料錶存在
\dt

# 確認 schema_migrations 有記錄
SELECT * FROM schema_migrations;
```

---

## 應用程式設定

### 1. 複製環境變數檔案

```bash
cd /path/to/line_queue
cp .env.example .env
```

### 2. 編輯 .env 檔案

```env
# 應用程式設定
NODE_ENV=production
PORT=3000

# PostgreSQL 設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=line_queue
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Redis 設定（可選）
REDIS_HOST=localhost
REDIS_PORT=6379

# LINE Messaging API 設定
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_ACCESS_TOKEN=your_line_access_token

# JWT 設定
JWT_SECRET=your_secure_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### 3. 安裝相依套件

```bash
cd /path/to/line_queue

# 初始化 npm 專案（如果沒有 package.json）
npm init -y

# 安裝 dependencies
npm install express pg uuid dotenv jsonwebtoken @line/bot-sdk crypto

# 安裝 dev dependencies
npm install --save-dev nodemon
```

---

## LINE 設定

### 1. 建立 LINE 官方帳號

1. 前往 [LINE Developers Console](https://developers.line.me/)
2. 登入 LINE 帳號
3. 點擊「建立 Provider」
4. 點擊「建立 Channel」
5. 選擇「Messaging API」
6. 填入必要資訊：
   - **Channel Name：** 餐廳名稱或系統名稱
   - **Channel Description：** 排隊候補位系統
   - **Category：** 餐飲
   - **Subcategory：** 餐廳

### 2. 取得 Channel Credentials

在 LINE Developers Console 的「Basic settings」頁面：

- **Channel ID：** `1234567890`
- **Channel Secret：** `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

在「Messaging API」頁面：

- **Long-lived Access Token：** 點擊「Issue」產生

### 3. 啟用 LINE 功能

1. 在 LINE Developers Console 的「Messaging API」頁面：
   - 啟用「Auto-reply messages」設為「Disabled」
   - 啟用「Webhook」功能

2. 設定 Webhook URL：
   ```
   https://your-domain.com/webhook
   ```

3. 設定 Rich Menu（可選）：
   - 使用 LINE Official Account Manager 設計
   - 建議功能：加入排隊、預約、查詢狀態

### 4. 建立 LIFF 應用

1. 在 LINE Developers Console 的「LIFF」頁面
2. 點擊「Add」
3. 設定 LIFF 應用：
   - **Name：** 餐廳候補位系統
   - **Size：** Tall（建議）
   - **Endpoint URL：** `https://your-domain.com/liff/queue/join`
   - **Permission：** 「Chat Message」其餘可不勾選

---

## 部署步驟

### 方式一：直接部署

```bash
# 1. 複製專案
git clone <repository-url> /opt/line_queue
cd /opt/line_queue

# 2. 安裝相依套件
npm install

# 3. 設定環境變數
cp .env.example .env
vim .env

# 4. 初始化資料庫
psql -U postgres -d line_queue -f sql/001_initial_schema.sql

# 5. 啟動服務
npm start

# 6. 測試服務
curl http://localhost:3000/
curl http://localhost:3000/webhook
```

### 方式二：使用 PM2 部署（建議生產環境）

```bash
# 1. 安裝 PM2
npm install -g pm2

# 2. 建立啟動腳本
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'line-queue',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# 3. 啟動服務
pm2 start ecosystem.config.js

# 4. 設定開機啟動
pm2 startup
pm2 save
```

### 方式三：使用 Docker 部署（請參閱下一節）

---

## Docker 部署

### 1. 建立 Dockerfile

在專案根目錄建立 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安裝依賴
COPY package*.json ./
RUN npm ci --only=production

# 複製應用程式
COPY src/ ./src/
COPY public/ ./public/
COPY config/ ./config/
COPY sql/ ./sql/

# 複製環境變數（注意：不要將機密資訊 commit 到版控）
COPY .env.example .env

# 暴露連接埠
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 啟動指令
CMD ["node", "src/index.js"]
```

### 2. 建立 Docker Compose（生產環境）

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: line_queue_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: line_queue
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      LINE_CHANNEL_ID: ${LINE_CHANNEL_ID}
      LINE_CHANNEL_SECRET: ${LINE_CHANNEL_SECRET}
      LINE_ACCESS_TOKEN: ${LINE_ACCESS_TOKEN}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: line_queue_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: line_queue
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: line_queue_redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: line_queue_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### 3. 建立 Nginx 設定

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 自動轉址到 HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL 設定（請自行調整）
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        # 上游應用程式
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket 支援（如果需要）
        location /ws {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

### 4. 啟動 Docker Compose

```bash
# 建立環境變數檔案
cat > .env.production << 'EOF'
DB_PASSWORD=your_secure_password
LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_ACCESS_TOKEN=your_long_lived_access_token
JWT_SECRET=your_secure_jwt_secret
EOF

# 啟動服務
docker-compose -f docker-compose.prod.yml up -d

# 檢查服務狀態
docker-compose -f docker-compose.prod.yml ps

# 檢查日誌
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 生產環境設定

### 1. HTTPS 設定（必要）

LINE Webhook 需要 HTTPS 端點。選項：

1. **Let's Encrypt（免費）：**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

2. **Cloudflare（免費）：**
   - 將 DNS 指向 Cloudflare
   - 使用 Cloudflare 的免費 SSL 憑證

3. **自有 SSL 憑證：**
   - 購買商業 SSL 憑證
   - 設定 Nginx 使用憑證

### 2. 環境變數安全

```bash
# 不要將 .env 檔案 commit 到版控
echo ".env" >> .gitignore

# 生產環境使用 secrets 管理
# 例如：AWS Secrets Manager, HashiCorp Vault
```

### 3. 防火牆設定

```bash
# 開放必要連接埠
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 4. 效能優化

- 啟用 PostgreSQL 連線池
- 啟用 Redis 快取（可選）
- 啟用 Nginx Gzip 壓縮
- 設定適當的 worker 數量

---

## 部署檢查清單

### 部署前檢查
- [ ] 所有環境變數已設定
- [ ] 資料庫已初始化
- [ ] LINE Channel 已建立
- [ ] LIFF 應用已設定
- [ ] SSL 憑證已設定

### 部署後檢查
- [ ] 服務正常啟動
- [ ] 健康檢查端點正常
- [ ] Webhook 端點可存取
- [ ] LIFF 頁面可正常載入
- [ ] 資料庫連線正常

### 功能測試
- [ ] 加入排隊功能正常
- [ ] 叫號功能正常
- [ ] 取消排隊功能正常
- [ ] 預約功能正常
- [ ] LINE 訊息回覆正常
- [ ] Webhook 接收正常

---

## 系統管理者手冊

### 常用指令

```bash
# 查看服務狀態
pm2 status

# 查看服務日誌
pm2 logs line-queue

# 重啟服務
pm2 restart line-queue

# 停止服務
pm2 stop line-queue

# 查看資料庫連線
psql -U postgres -d line_queue -c "SELECT * FROM pg_stat_activity;"

# 資料庫備份
pg_dump -U postgres line_queue > backup_$(date +%Y%m%d).sql

# 還原資料庫
psql -U postgres -d line_queue < backup_20260513.sql
```

### 監控

```bash
# 監控 CPU 和記憶體
pm2 monit

# 監控服務健康
curl http://localhost:3000/webhook
```

### 緊急處理

1. **服務無回應：**
   ```bash
   pm2 restart line-queue
   ```

2. **資料庫連線失敗：**
   ```bash
   # 檢查 PostgreSQL 狀態
   sudo systemctl status postgresql
   
   # 重啟 PostgreSQL
   sudo systemctl restart postgresql
   ```

3. **Webhook 無法接收：**
   - 檢查 SSL 憑證是否有效
   - 檢查 Nginx 設定是否正確
   - 檢查防火牆是否允許 443 連線

---

## API 文件

### 端點清單

#### 健康檢查
- `GET /` - 根目錄
- `GET /webhook` - Webhook 驗證

#### 排隊 API
- `POST /api/queue/call-next` - 叫下一位
- `POST /api/queue/call-specific` - 叫指定號碼
- `POST /api/queue/mark-served` - 標記入座
- `POST /api/queue/mark-no-show` - 標記過號
- `GET /api/queue/list/:restaurantId` - 取得排隊名單
- `GET /api/queue/stats/:restaurantId` - 取得排隊統計

#### 預約 API
- `GET /api/reservations/:restaurantId` - 取得預約列表
- `POST /api/reservations/mark-seated` - 標記已入座
- `POST /api/reservations/mark-no-show` - 標記過號

#### 通知 API
- `GET /api/notifications/:restaurantId` - 取得通知歷史

#### 頁面
- `GET /liff/queue/join` - 加入排隊頁面
- `GET /liff/queue/status` - 排隊狀態頁面
- `GET /liff/reservation/book` - 預約頁面
- `GET /liff/reservation/my` - 我的預約頁面
- `GET /admin` - 餐廳管理後台

---

## 疑難排解

### 常見問題

1. **LINE Webhook 無法接收：**
   - 確認使用 HTTPS
   - 確認 Webhook URL 正確
   - 檢查 LINE Channel Secret 是否正確

2. **LIFF 頁面無法載入：**
   - 確認 LIFF Endpoint URL 正確
   - 確認 LIFF URL 格式正確：`https://liff.line.me/<liff_id>`

3. **資料庫連線失敗：**
   - 確認 PostgreSQL 已啟動
   - 確認環境變數正確
   - 檢查連線帳號權限

---

## 聯絡技術支援

如有任何問題，請聯繫：
- **負責人：** 小咪技術研發助理
- **版本：** 1.0.0
- **发布日期：** 2026-05-13