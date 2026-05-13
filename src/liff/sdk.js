/**
 * LINE 餐廳候補位系統 - LIFF 頁面 JavaScript SDK
 * 
 * 此檔案包含 LIFF SDK 的初始化與常用函數
 * 適用於嵌入在 LIFF 頁面中的前端程式碼
 * 
 * 使用方式：
 * 1. 在 LIFF 頁面中引入此檔案
 * 2. 呼叫 initLiff() 初始化
 * 3. 使用 liffApi 物件呼叫 API
 */

// LIFF SDK 初始化設定
const LIFF_ID = {
    joinQueue: process.env.LIFF_JOIN_QUEUE_ID || '',
    myQueue: process.env.LIFF_MY_QUEUE_ID || '',
    bookReservation: process.env.LIFF_BOOK_RESERVATION_ID || '',
    myReservation: process.env.LIFF_MY_RESERVATION_ID || '',
};

// API Base URL
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// =====================================================
// LIFF SDK 初始化的 Promise 包裝
// =====================================================

/**
 * 初始化 LIFF SDK
 * @param {string} liffId - LIFF App ID（可選，預設使用 joinQueue）
 * @returns {Promise<object>} liff 物件
 */
async function initLiff(liffId = null) {
    return new Promise((resolve, reject) => {
        // 檢查 liff 物件是否已存在
        if (window.liff) {
            window.liff
                .init({
                    liffId: liffId || LIFF_ID.joinQueue,
                    withLoginOnExternalBrowser: true,
                })
                .then((data) => {
                    console.log('✅ LIFF initialized:', data);
                    resolve(window.liff);
                })
                .catch((error) => {
                    console.error('❌ LIFF init error:', error);
                    reject(error);
                });
        } else {
            console.warn('⚠️ liff SDK not loaded yet');
            // 等待 liff SDK 載入
            const checkLiff = setInterval(() => {
                if (window.liff) {
                    clearInterval(checkLiff);
                    window.liff
                        .init({
                            liffId: liffId || LIFF_ID.joinQueue,
                            withLoginOnExternalBrowser: true,
                        })
                        .then((data) => {
                            console.log('✅ LIFF initialized:', data);
                            resolve(window.liff);
                        })
                        .catch((error) => {
                            console.error('❌ LIFF init error:', error);
                            reject(error);
                        });
                }
            }, 100);

            // 30 秒後放棄
            setTimeout(() => {
                clearInterval(checkLiff);
                reject(new Error('LIFF SDK timeout'));
            }, 30000);
        }
    });
}

// =====================================================
// LIFF API 封裝
// =====================================================

const liffApi = {
    /**
     * 取得目前登入的使用者資料
     * @returns {Promise<object>} 使用者資料
     */
    async getProfile() {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        return await window.liff.getProfile();
    },

    /**
     * 取得 LINE Access Token
     * @returns {string} Access Token
     */
    getAccessToken() {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        return window.liff.getAccessToken();
    },

    /**
     * 取得 ID Token
     * @returns {string} ID Token
     */
    getIDToken() {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        return window.liff.getIDToken();
    },

    /**
     * 檢查使用者是否已登入
     * @returns {boolean}
     */
    isLoggedIn() {
        if (!window.liff) {
            return false;
        }
        return window.liff.isLoggedIn();
    },

    /**
     * 開啟外部瀏覽器
     * @param {string} url - 目標網址
     */
    async openExternalBrowser(url) {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        await window.liff.openExternalBrowser(url);
    },

    /**
     * 開啟 LINE 內部瀏覽器（目前為外部瀏覽器）
     * @param {string} url - 目標網址
     */
    async openWindow(url) {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        await window.liff.openWindow({
            url: url,
            external: true,
        });
    },

    /**
     * 傳送訊息給 Bot
     * 使用 liff.sendMessages() 必須使用者授權
     * @param {array} messages - 訊息陣列
     * @returns {Promise<object>} 發送結果
     */
    async sendMessages(messages) {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        
        if (!window.liff.isInClient()) {
            throw new Error('此功能僅能在 LINE 內部瀏覽器使用');
        }
        
        return await window.liff.sendMessages(messages);
    },

    /**
     * 關閉 LIFF 視窗
     */
    closeWindow() {
        if (!window.liff) {
            throw new Error('LIFF 未初始化');
        }
        window.liff.closeWindow();
    },
};

// =====================================================
// API 呼叫封裝
// =====================================================

const api = {
    /**
     * 發送 API 請求
     * @param {string} method - HTTP 方法
     * @param {string} endpoint - API 端點
     * @param {object} data - 請求資料
     * @returns {Promise<object>} API 回應
     */
    async request(method, endpoint, data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
        };

        // 如果在 LIFF 環境中，加入 userId
        let userId = null;
        try {
            if (window.liff && window.liff.isLoggedIn()) {
                const profile = await window.liff.getProfile();
                userId = profile.userId;
            }
        } catch (e) {
            console.warn('Cannot get userId:', e);
        }

        const options = {
            method,
            headers,
        };

        if (data) {
            if (method === 'GET') {
                // GET 請求將資料放在 query string
                const params = new URLSearchParams(data);
                const queryUrl = new URL(url);
                Object.keys(data).forEach(key => {
                    if (data[key] !== null && data[key] !== undefined) {
                        queryUrl.searchParams.append(key, data[key]);
                    }
                });
            } else {
                options.body = JSON.stringify({
                    ...data,
                    userId, // 自動加入 userId
                });
            }
        } else if (userId) {
            // 即使沒有 data，也傳送 userId
            options.body = JSON.stringify({ userId });
        }

        let finalUrl = url;
        if (data && method === 'GET') {
            const params = new URLSearchParams();
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    params.append(key, data[key]);
                }
            });
            finalUrl = `${url}?${params.toString()}`;
        }

        try {
            const response = await fetch(finalUrl, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'API 請求失敗');
            }

            return result;
        } catch (error) {
            console.error('❌ API request error:', error);
            throw error;
        }
    },

    get(endpoint, data = null) {
        return this.request('GET', endpoint, data);
    },

    post(endpoint, data = null) {
        return this.request('POST', endpoint, data);
    },

    put(endpoint, data = null) {
        return this.request('PUT', endpoint, data);
    },

    delete(endpoint, data = null) {
        return this.request('DELETE', endpoint, data);
    },
};

// =====================================================
// 排隊 API
// =====================================================

const queueApi = {
    /**
     * 取得排隊狀態
     */
    async getStatus(restaurantId = null) {
        const params = restaurantId ? { restaurantId } : {};
        return api.get('/liff/queue/status', params);
    },

    /**
     * 加入排隊
     */
    async join(restaurantId, partySize, notes = null) {
        return api.post('/liff/queue/join', {
            restaurantId,
            partySize,
            notes,
        });
    },

    /**
     * 取消排隊
     */
    async cancel(queueEntryId) {
        return api.post('/liff/queue/cancel', {
            queueEntryId,
        });
    },
};

// =====================================================
// 預約 API
// =====================================================

const reservationApi = {
    /**
     * 取得我的預約
     */
    async getMyReservations() {
        return api.get('/liff/reservation/my');
    },

    /**
     * 建立預約
     */
    async book(restaurantId, date, time, partySize, notes = null) {
        return api.post('/liff/reservation/book', {
            restaurantId,
            date,
            time,
            partySize,
            notes,
        });
    },

    /**
     * 取消預約
     */
    async cancel(reservationId) {
        return api.post('/liff/reservation/cancel', {
            reservationId,
        });
    },
};

// =====================================================
// 餐廳 API
// =====================================================

const restaurantApi = {
    /**
     * 取得餐廳列表
     */
    async getAll() {
        return api.get('/liff/restaurants');
    },

    /**
     * 取得特定餐廳
     */
    async getById(id) {
        return api.get(`/liff/restaurants/${id}`);
    },
};

// =====================================================
// 匯出模組
// =====================================================

// 僅在瀏覽器環境匯出
if (typeof window !== 'undefined') {
    window.LIFF_SDK = {
        initLiff,
        liffApi,
        api,
        queueApi,
        reservationApi,
        restaurantApi,
    };
}

// 支援 CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initLiff,
        liffApi,
        api,
        queueApi,
        reservationApi,
        restaurantApi,
    };
}