/**
 * LINE 餐廳候補位系統 - LINE 設定集中管理
 * 
 * 集中管理所有 LINE 相關設定
 * 包含 Channel 設定、LIFF 設定、Rich Menu 設定
 */

module.exports = {
    // =====================================================
    // LINE Messaging API 設定
    // =====================================================
    messagingApi: {
        channelId: process.env.LINE_CHANNEL_ID,
        channelSecret: process.env.LINE_CHANNEL_SECRET,
        accessToken: process.env.LINE_ACCESS_TOKEN,
    },

    // =====================================================
    // LIFF 設定
    // =====================================================
    liff: {
        // LIFF 頁面 URL（正式環境需替換為實際網址）
        baseUrl: process.env.LIFF_BASE_URL || 'https://your-domain.com',
        
        // LIFF App ID（從 LINE Developers Console 取得）
        apps: {
            joinQueue: {
                id: process.env.LIFF_JOIN_QUEUE_ID,
                url: `${process.env.LIFF_BASE_URL || 'https://your-domain.com'}/liff/queue/join`,
                name: '加入排隊',
                default: true,
            },
            myQueue: {
                id: process.env.LIFF_MY_QUEUE_ID,
                url: `${process.env.LIFF_BASE_URL || 'https://your-domain.com'}/liff/queue/status`,
                name: '我的排隊',
            },
            bookReservation: {
                id: process.env.LIFF_BOOK_RESERVATION_ID,
                url: `${process.env.LIFF_BASE_URL || 'https://your-domain.com'}/liff/reservation/book`,
                name: '線上預約',
            },
            myReservation: {
                id: process.env.LIFF_MY_RESERVATION_ID,
                url: `${process.env.LIFF_BASE_URL || 'https://your-domain.com'}/liff/reservation/my`,
                name: '我的預約',
            },
        },
    },

    // =====================================================
    // Flex Message 訊息模板設定
    // =====================================================
    flexMessages: {
        // 氣泡訊息尺寸
        bubbleMaxSize: 1048576, // 1MB
        
        // 圖示設定
        icons: {
            check: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/yes.png',
            cross: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/no.png',
            info: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/info.png',
            clock: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/time.png',
            person: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/user.png',
            phone: 'https://scdn.line-apps.com/circle/d103/chameleon/static/icon/call.png',
        },
        
        // 顏色設定
        colors: {
            primary: '#00B900',      // LINE 綠色
            secondary: '#01C851',    // 深綠色
            accent: '#FFD700',       // 金色（叫號）
            warning: '#FF6B6B',      // 紅色（取消）
            background: '#FFFFFF',   // 白色背景
            text: '#333333',         // 深灰色文字
            textLight: '#888888',    // 淺灰色文字
        },
    },

    // =====================================================
    // Rich Menu 設定
    // =====================================================
    richMenu: {
        // Rich Menu 尺寸
        width: 2500,
        height: 1686,
        
        // 預設選單項目（依序由左至右）
        items: [
            {
                id: 'join_queue',
                text: '🔢 加入排隊',
                action: 'liff',
                liffPath: '/liff/queue/join',
            },
            {
                id: 'my_queue',
                text: '📋 我的排隊',
                action: 'liff',
                liffPath: '/liff/queue/status',
            },
            {
                id: 'book_reservation',
                text: '📅 線上預約',
                action: 'liff',
                liffPath: '/liff/reservation/book',
            },
            {
                id: 'my_reservation',
                text: '📝 我的預約',
                action: 'liff',
                liffPath: '/liff/reservation/my',
            },
        ],
    },

    // =====================================================
    // Webhook 設定
    // =====================================================
    webhook: {
        // Webhook 路徑
        path: '/webhook',
        
        // 是否啟用 webhook 驗證（生產環境必須開啟）
        verifySignature: process.env.NODE_ENV !== 'development',
    },

    // =====================================================
    // 推播設定
    // =====================================================
    push: {
        // 推播超時時間（毫秒）
        timeout: 30000,
        
        // 重試次數
        retryTimes: 3,
        
        // 重試間隔（毫秒）
        retryInterval: 5000,
    },
};