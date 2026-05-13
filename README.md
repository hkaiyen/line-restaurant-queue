# LINE 餐廳候補位系統

## 系統版本
- **版本：** 1.0.0
- **发布日期：** 2026-05-13
- **作者：** 小咪技術研發助理

---

## 📋 系統概述

LINE 餐廳候補位系統是一個幫助餐廳管理現場候位、消費者可透過 LINE 預約候補位的平台。

### 主要功能

- ✅ **LINE 機器人整合** - 消費者可透過 LINE 與系統互動
- 📝 **線上排隊** - 消費者可透過 LIFF 頁面加入排隊
- 📢 **智慧叫號** - 餐廳可叫號、標記入座、標記過號
- 📅 **線上預約** - 消費者可預約座位
- 🔔 **推播通知** - LINE 訊息推播排隊/預約狀態
- 📊 **管理後台** - 餐廳管理排隊、預約、統計資料

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                        LINE Platform                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   LIFF      │  │  Messaging  │  │   Rich      │         │
│  │   Pages     │  │     API     │  │   Menu      │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
└─────────┼─────────────────┼──────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Your Server                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Express   │  │   LINE     │  │  Database   │         │
│  │   App       │  │   Bot SDK   │  │  PostgreSQL │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 專案結構

```
line_queue/
├── config/                 # 設定檔
│   └── line.js           # LINE 設定
├── docs/                  # 文件
│   ├── DEPLOYMENT.md     # 部署指南
│   └── LINE_SETUP.md     # LINE 申請教學
├── public/                # 靜態檔案
│   ├── admin/           # 管理後台
│   └── liff/            # LIFF 頁面
│       ├── queue/       # 排隊相關頁面
│       └── reservation/ # 預約相關頁面
├── scripts/               # 工具腳本
│   ├── init-db.sh       # 資料庫初始化
│   ├── test-api.sh      # API 測試
│   └── test-line.sh     # LINE 整合測試
├── sql/                   # SQL 資料庫脚本
│   ├── 001_initial_schema.sql
│   └── 002_seed_data.sql
├── src/                   # 應用程式原始碼
│   ├── api/             # API 路由
│   ├── db/              # 資料庫連線
│   ├── liff/            # LIFF 路由
│   ├── line/            # LINE 機器人
│   │   ├── client.js    # LINE Client
│   │   ├── webhook.js   # Webhook 處理
│   │   ├── handlers/    # 事件處理器
│   │   └── messages/    # 訊息範本
│   ├── repositories/    # 資料存取層
│   └── services/        # 商業邏輯層
├── docker-compose.yml    # Docker Compose 設定
├── .env.example          # 環境變數範例
└── package.json          # Node.js 相依套件
```

---

## 🚀 快速開始

### 1. 環境需求

- Node.js 18.x 或更新版本
- PostgreSQL 16.x 或更新版本
- Redis 7.x（可選，用於快取）

### 2. 複製專案

```bash
git clone <repository-url>
cd line_queue
```

### 3. 安裝相依套件

```bash
npm install
```

### 4. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env 填入實際值
```

### 5. 初始化資料庫

```bash
psql -U postgres -d line_queue -f sql/001_initial_schema.sql
psql -U postgres -d line_queue -f sql/002_seed_data.sql  # 可選
```

### 6. 啟動服務

```bash
# 開發環境
npm run dev

# 生產環境
npm start
```

### 7. 測試

```bash
# API 測試
./scripts/test-api.sh

# LINE 整合測試
./scripts/test-line.sh
```

---

## 📡 API 端點

### 排隊 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/queue/list/:restaurantId` | 取得排隊名單 |
| GET | `/api/queue/stats/:restaurantId` | 取得排隊統計 |
| POST | `/api/queue/call-next` | 叫下一位 |
| POST | `/api/queue/call-specific` | 叫指定號碼 |
| POST | `/api/queue/mark-served` | 標記入座 |
| POST | `/api/queue/mark-no-show` | 標記過號 |

### 預約 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/reservations/:restaurantId` | 取得預約列表 |
| POST | `/api/reservations/mark-seated` | 標記已入座 |
| POST | `/api/reservations/mark-no-show` | 標記過號 |

### 通知 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/notifications/:restaurantId` | 取得通知歷史 |

### 頁面

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/liff/queue/join` | 加入排隊頁面 |
| GET | `/liff/queue/status` | 排隊狀態頁面 |
| GET | `/liff/reservation/book` | 預約頁面 |
| GET | `/liff/reservation/my` | 我的預約頁面 |
| GET | `/admin` | 餐廳管理後台 |

---

## 🐳 Docker 部署

### 啟動服務

```bash
# 啟動所有服務（開發環境）
docker-compose up -d

# 停止服務
docker-compose down
```

### 生產環境部署

請參考 `docs/DEPLOYMENT.md` 的完整部署指南。

---

## 📚 文件

- [部署指南](./docs/DEPLOYMENT.md) - 詳細的系統部署步驟
- [LINE 申請教學](./docs/LINE_SETUP.md) - LINE 官方帳號申請與設定

---

## 🔧 開發

### 執行測試

```bash
# 所有測試
./scripts/test-api.sh --all

# 僅 API 測試
./scripts/test-api.sh --queue

# 僅 LINE 測試
./scripts/test-line.sh --all
```

### 環境變數說明

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `NODE_ENV` | 環境（development/production） | development |
| `PORT` | 伺服器連接埠 | 3000 |
| `DB_HOST` | 資料庫主機 | localhost |
| `DB_PORT` | 資料庫連接埠 | 5432 |
| `DB_NAME` | 資料庫名稱 | line_queue |
| `DB_USER` | 資料庫使用者 | postgres |
| `DB_PASSWORD` | 資料庫密碼 | postgres |
| `REDIS_HOST` | Redis 主機 | localhost |
| `REDIS_PORT` | Redis 連接埠 | 6379 |
| `LINE_CHANNEL_ID` | LINE Channel ID | - |
| `LINE_CHANNEL_SECRET` | LINE Channel Secret | - |
| `LINE_ACCESS_TOKEN` | LINE Access Token | - |
| `JWT_SECRET` | JWT 密鑰 | - |

---

## 📊 資料庫結構

### 主要資料表

| 資料表 | 說明 |
|--------|------|
| `restaurants` | 餐廳資料 |
| `customers` | 消費者資料 |
| `queue_entries` | 排隊資料 |
| `reservations` | 預約資料 |
| `notification_logs` | 通知記錄 |

---

## 📝 版本歷史

### v1.0.0 (2026-05-13)
- 初始版本
- 支援 LINE 排隊候補位功能
- 支援 LIFF 頁面
- 支援 LINE 訊息互動

---

## 📄 授權

本專案為内部使用。

---

## 聯絡方式

- **負責人：** 小咪技術研發助理
- **版本：** 1.0.0
- **发布日期：** 2026-05-13