/**
 * LINE 餐廳候補位系統 - 應用程式入口
 */

require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// JSON Body Parser（重要！）
// =====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// LINE Webhook 路徑
// =====================================================
const lineWebhook = require('./src/line/webhook');
app.use('/webhook', lineWebhook.router);

// =====================================================
// 其他頁面和 API
// =====================================================
const appRoutes = require('./src/routes');
const adminRoutes = require('./src/routes/admin');
app.use('/', appRoutes);
app.use('/admin', adminRoutes);

// =====================================================
// 健康檢查
// =====================================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =====================================================
// 啟動伺服器
// =====================================================
app.listen(PORT, () => {
    console.log(`🍹 LINE 餐廳候補位系統已啟動`);
    console.log(`📍 監聽 port: ${PORT}`);
    console.log(`🔗 Webhook URL: /webhook`);
    console.log(`🌐 LIFF 頁面: http://localhost:${PORT}/liff/...`);
});