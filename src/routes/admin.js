/**
 * LINE 餐廳候補位系統 - 店家管理後台
 * 
 * 提供網頁介面讓店家叫號、查詢、管理排隊
 * 
 * 路由：
 *   /admin           - 管理後台首頁
 *   /admin/api/queue - 排隊 API
 */

const express = require('express');
const router = express.Router();

// =====================================================
// 店家管理後台首頁
// =====================================================

router.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>安安餐廳 - 管理後台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            min-height: 100vh;
        }
        .header {
            background: linear-gradient(135deg, #00B900 0%, #00a000 100%);
            color: white;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .stat-card h3 { color: #666; font-size: 14px; margin-bottom: 8px; }
        .stat-card .value { font-size: 32px; font-weight: bold; color: #333; }
        .stat-card .value.green { color: #00B900; }
        .stat-card .value.orange { color: #FF6B00; }
        .queue-panel {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .queue-panel h2 { margin-bottom: 20px; font-size: 18px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f8f8; font-weight: 600; color: #666; font-size: 13px; }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .status.waiting { background: #e8f5e9; color: #00B900; }
        .status.called { background: #fff3e0; color: #FF6B00; }
        .status.served { background: #e3f2fd; color: #2196F3; }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }
        .btn-primary { background: #00B900; color: white; }
        .btn-primary:hover { background: #00a000; }
        .btn-warning { background: #FF6B00; color: white; }
        .btn-warning:hover { background: #e65100; }
        .btn-secondary { background: #f5f5f5; color: #666; }
        .btn-secondary:hover { background: #e0e0e0; }
        .actions { display: flex; gap: 8px; }
        .empty { text-align: center; padding: 40px; color: #999; }
        .refresh-btn {
            float: right;
            background: white;
            border: 1px solid #ddd;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
        }
        .refresh-btn:hover { background: #f5f5f5; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #00B900;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🍹 安安餐廳 - 管理後台</h1>
        <p><span class="live-indicator"></span>即時排隊系統</p>
    </div>
    
    <div class="container">
        <div class="stats">
            <div class="stat-card">
                <h3>目前等待</h3>
                <div class="value green" id="waitingCount">-</div>
            </div>
            <div class="stat-card">
                <h3>今日總排隊</h3>
                <div class="value" id="todayTotal">-</div>
            </div>
            <div class="stat-card">
                <h3>已叫號</h3>
                <div class="value orange" id="calledCount">-</div>
            </div>
            <div class="stat-card">
                <h3>服務完成</h3>
                <div class="value" id="servedCount">-</div>
            </div>
        </div>
        
        <div class="queue-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>📋 排隊名單</h2>
                <button class="refresh-btn" onclick="loadQueue()">🔄 重新整理</button>
            </div>
            <div id="queueList">
                <div class="empty">載入中...</div>
            </div>
        </div>
    </div>
    
    <script>
        // 載入排隊資料
        async function loadQueue() {
            try {
                const response = await fetch('/admin/api/queue');
                const data = await response.json();
                
                // 更新統計
                document.getElementById('waitingCount').textContent = data.stats.waitingCount || 0;
                document.getElementById('todayTotal').textContent = data.stats.todayTotal || 0;
                document.getElementById('calledCount').textContent = data.stats.calledCount || 0;
                document.getElementById('servedCount').textContent = data.stats.servedCount || 0;
                
                // 更新列表
                const listEl = document.getElementById('queueList');
                if (data.queueList.length === 0) {
                    listEl.innerHTML = '<div class="empty">目前沒有人排隊 🎉</div>';
                    return;
                }
                
                let html = '<table><thead><tr><th>號碼</th><th>人數</th><th>狀態</th><th>等候時間</th><th>操作</th></tr></thead><tbody>';
                
                for (const entry of data.queueList) {
                    const statusClass = entry.status;
                    const statusText = {
                        'waiting': '等待中',
                        'called': '已叫號',
                        'served': '已完成',
                        'cancelled': '已取消'
                    }[entry.status] || entry.status;
                    
                    const waitMinutes = Math.floor((Date.now() - new Date(entry.joinedAt).getTime()) / 60000);
                    
                    html += \`
                        <tr>
                            <td><strong>第 \${entry.queueNumber} 號</strong></td>
                            <td>\${entry.partySize} 人</td>
                            <td><span class="status \${statusClass}">\${statusText}</span></td>
                            <td>\${waitMinutes} 分鐘</td>
                            <td class="actions">
                                \${entry.status === 'waiting' ? \`
                                    <button class="btn btn-warning" onclick="callNumber('\${entry.id}')">📢 叫號</button>
                                \` : ''}
                                \${entry.status === 'called' ? \`
                                    <button class="btn btn-primary" onclick="markServed('\${entry.id}')">✅ 入座</button>
                                \` : ''}
                            </td>
                        </tr>
                    \`;
                }
                
                html += '</tbody></table>';
                listEl.innerHTML = html;
                
            } catch (error) {
                console.error('載入失敗：', error);
                document.getElementById('queueList').innerHTML = '<div class="empty">載入失敗，請稍後再試</div>';
            }
        }
        
        // 叫號
        async function callNumber(id) {
            try {
                const response = await fetch('/admin/api/queue/' + id + '/call', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    alert('已叫號！第 ' + data.queueNumber + ' 號');
                    loadQueue();
                } else {
                    alert('叫號失敗：' + data.error);
                }
            } catch (error) {
                alert('叫號失敗');
            }
        }
        
        // 標記入座
        async function markServed(id) {
            try {
                const response = await fetch('/admin/api/queue/' + id + '/served', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    alert('已標記入座！');
                    loadQueue();
                } else {
                    alert('操作失敗：' + data.error);
                }
            } catch (error) {
                alert('操作失敗');
            }
        }
        
        // 每 10 秒自動更新
        loadQueue();
        setInterval(loadQueue, 10000);
    </script>
</body>
</html>
    `);
});

// =====================================================
// 排隊 API
// =====================================================

router.get('/admin/api/queue', async (req, res) => {
    try {
        const repositories = require('../repositories');
        
        // 取得餐廳
        const lineConfig = require('../../config/line');
        const channelId = lineConfig.messagingApi.channelId;
        const restaurant = await repositories.restaurantRepository.getRestaurantByLineChannelId(channelId);
        
        if (!restaurant) {
            return res.json({ queueList: [], stats: {} });
        }
        
        // 取得排隊名單
        const queueList = await repositories.queueRepository.getQueueListByRestaurant(restaurant.id);
        
        // 計算統計
        const stats = {
            waitingCount: queueList.filter(e => e.status === 'waiting').length,
            calledCount: queueList.filter(e => e.status === 'called').length,
            servedCount: queueList.filter(e => e.status === 'served').length,
            todayTotal: queueList.length,
        };
        
        res.json({ queueList, stats });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 叫號 API
router.post('/admin/api/queue/:id/call', async (req, res) => {
    try {
        const repositories = require('../repositories');
        const queueEntry = await repositories.queueRepository.callNext(req.params.id);
        
        if (queueEntry) {
            res.json({ success: true, queueNumber: queueEntry.queueNumber });
        } else {
            res.json({ success: false, error: '沒有待叫號的排隊' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 標記入座 API
router.post('/admin/api/queue/:id/served', async (req, res) => {
    try {
        const repositories = require('../repositories');
        await repositories.queueRepository.markAsServed(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;