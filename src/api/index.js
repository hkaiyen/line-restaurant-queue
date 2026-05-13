/**
 * LINE 餐廳候補位系統 - Express 應用程式主檔案
 * 
 * 整合所有模組，建立完整的 Web 服務
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// 載入設定
require('dotenv').config();
const lineConfig = require('./config/line');

// 載入資料庫
const { testConnection } = require('./src/db/connection');

// 載入路由
const webhookRouter = require('./src/line/webhook').router;
const liffRouter = require('./src/liff/routes');

// =====================================================
// 建立 Express App
// =====================================================

const app = express();

// 中介層設定
app.use(cors()); // 允許跨域請求（開發環境）
app.use(express.json()); // 解析 JSON
app.use(express.urlencoded({ extended: true })); // 解析 URL-encoded

// 記錄所有請求（開發環境）
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.path}`);
        next();
    });
}

// =====================================================
// 靜態檔案（LIFF 頁面）
// =====================================================

// 提供 LIFF 頁面靜態檔案
app.use('/static', express.static(path.join(__dirname, 'public')));

// =====================================================
// 路由設定
// =====================================================

// LINE Webhook 端點
app.use('/', webhookRouter);

// LIFF API 端點
app.use('/liff', liffRouter);

// 餐廳管理後台 API（Phase 4）
// app.use('/api/admin', adminRouter);

// 餐廳端叫號 API
app.use('/api', require('./src/api'));

// 頁面路由（LIFF + Admin）
app.use('/', require('./src/routes'));

// =====================================================
// 健康檢查端點
// =====================================================

app.get('/health', async (req, res) => {
    const dbStatus = await testConnection();
    
    res.json({
        status: dbStatus ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus ? 'connected' : 'disconnected',
            line: lineConfig.messagingApi.accessToken ? 'configured' : 'not_configured',
        },
        version: '1.0.0',
    });
});

// =====================================================
// 錯誤處理
// =====================================================

// 404 處理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '找不到請求的資源',
        path: req.path,
    });
});

// 錯誤處理中介層
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : '伺服器發生錯誤',
    });
});

// =====================================================
// 啟動伺服器
// =====================================================

const PORT = process.env.PORT || 3000;

async function startServer() {
    console.log('🚀 啟動 LINE 餐廳候補位系統...');
    console.log(`📁 環境：${process.env.NODE_ENV || 'development'}`);

    // 測試資料庫連線
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.warn('⚠️ 資料庫連線失敗，服務可能無法正常運作');
    }

    // 啟動監聽
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🍜 LINE 餐廳候補位系統 - 伺服器已啟動                   ║
║                                                          ║
║   🌐 Webhook: http://localhost:${PORT}/webhook              ║
║   📊 健康檢查: http://localhost:${PORT}/health               ║
║   📝 LIFF API: http://localhost:${PORT}/liff                 ║
║                                                          ║
║   ⚠️  請記得將 Webhook URL 設定至 LINE Developers Console  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
        `);
    });
}

// 執行啟動
startServer().catch((error) => {
    console.error('❌ 啟動伺服器失敗：', error);
    process.exit(1);
});

// =====================================================
// 優雅關閉
// =====================================================

process.on('SIGTERM', async () => {
    console.log('📤 收到 SIGTERM，準備關閉伺服器...');
    
    const { closePool } = require('./src/db/connection');
    await closePool();
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('📤 收到 SIGINT，準備關閉伺服器...');
    
    const { closePool } = require('./src/db/connection');
    await closePool();
    
    process.exit(0);
});

module.exports = app;