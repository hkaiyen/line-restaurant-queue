/**
 * LINE 餐廳候補位系統 - LINE SDK 初始化
 * 
 * 使用 @line/bot-sdk 進行 LINE Messaging API 操作
 * 支援 Reply API、Push API、Group API 等
 */

const line = require('@line/bot-sdk');
const lineConfig = require('../../config/line');

// =====================================================
// LINE Client 初始化
// =====================================================

// LINE Messaging API 客戶端設定
const lineClientConfig = {
    channelAccessToken: lineConfig.messagingApi.accessToken,
    channelSecret: lineConfig.messagingApi.channelSecret,
};

// 建立 LINE Client 實例
let lineClient = null;

// 延遲初始化（等待 accessToken 載入）
function getLineClient() {
    if (!lineClient && lineConfig.messagingApi.accessToken) {
        lineClient = new line.Client(lineClientConfig);
        console.log('✅ LINE Client 初始化成功');
    }
    return lineClient;
}

// =====================================================
// Messaging API 操作函數
// =====================================================

/**
 * 發送回覆訊息（Reply API）
 * 用於回應使用者輸入
 * 
 * @param {string} replyToken - 回覆權杖（從 webhook event 取得）
 * @param {object|array} messages - 訊息物件或陣列
 * @returns {Promise<object>} LINE API 回應結果
 */
async function replyMessage(replyToken, messages) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const result = await client.replyMessage(replyToken, messages);
        console.log('✅ Reply message sent:', replyToken);
        return result;
    } catch (error) {
        console.error('❌ Reply message failed:', error.message);
        throw error;
    }
}

/**
 * 發送推播訊息（Push API）
 * 主動推播訊息給使用者
 * 
 * @param {string} userId - 接收者的 LINE User ID
 * @param {object|array} messages - 訊息物件或陣列
 * @returns {Promise<object>} LINE API 回應結果
 */
async function pushMessage(userId, messages) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const result = await client.pushMessage(userId, messages);
        console.log('✅ Push message sent to:', userId);
        return result;
    } catch (error) {
        console.error('❌ Push message failed:', error.message);
        throw error;
    }
}

/**
 * 發送多用途訊息（Multicast）
 * 同時推播訊息給多個使用者
 * 
 * @param {array} userIds - LINE User ID 陣列
 * @param {object|array} messages - 訊息物件或陣列
 * @returns {Promise<object>} LINE API 回應結果
 */
async function multicast(userIds, messages) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const result = await client.multicast(userIds, messages);
        console.log('✅ Multicast sent to', userIds.length, 'users');
        return result;
    } catch (error) {
        console.error('❌ Multicast failed:', error.message);
        throw error;
    }
}

/**
 * 取得使用者資料
 * 
 * @param {string} userId - LINE User ID
 * @returns {Promise<object>} 使用者資料
 */
async function getProfile(userId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const profile = await client.getProfile(userId);
        return profile;
    } catch (error) {
        console.error('❌ Get profile failed:', error.message);
        throw error;
    }
}

/**
 * 取得使用者 ID 列表（用於 broadcast）
 * 需已加入 LINE 官方帳號為好友
 * 
 * @param {string} start - 游標位置（可選）
 * @returns {Promise<object>} 包含 userIds 和 next 游標
 */
async function getAllUserIds(start = null) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const result = start 
            ? await client.getFollowerIds(start)
            : await client.getFollowerIds();
        return result;
    } catch (error) {
        console.error('❌ Get follower IDs failed:', error.message);
        throw error;
    }
}

/**
 * 取得 Room 或 Group 內的成員資料
 * 
 * @param {string} type - 'room' 或 'group'
 * @param {string} id - Room 或 Group ID
 * @param {string} userId - LINE User ID
 * @returns {Promise<object>} 成員資料
 */
async function getMemberProfile(type, id, userId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const profile = type === 'room' 
            ? await client.getRoomMemberProfile(id, userId)
            : await client.getGroupMemberProfile(id, userId);
        return profile;
    } catch (error) {
        console.error(`❌ Get ${type} member profile failed:`, error.message);
        throw error;
    }
}

/**
 * 取得會員人數
 * 
 * @param {string} type - 'room' 或 'group'
 * @param {string} id - Room 或 Group ID
 * @returns {Promise<number>} 成員人數
 */
async function getMemberCount(type, id) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const count = type === 'room'
            ? await client.getRoomMemberCount(id)
            : await client.getGroupMemberCount(id);
        return count;
    } catch (error) {
        console.error(`❌ Get ${type} member count failed:`, error.message);
        throw error;
    }
}

/**
 * 離開 Room 或 Group
 * 
 * @param {string} type - 'room' 或 'group'
 * @param {string} id - Room 或 Group ID
 * @returns {Promise<object>} LINE API 回應結果
 */
async function leave(type, id) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const result = type === 'room'
            ? await client.leaveRoom(id)
            : await client.leaveGroup(id);
        console.log(`✅ Left ${type}:`, id);
        return result;
    } catch (error) {
        console.error(`❌ Leave ${type} failed:`, error.message);
        throw error;
    }
}

// =====================================================
// NSE Content 函數（用於 rich menu 與 link token）
// =====================================================

/**
 * 建立 rich menu
 * 
 * @param {object} richMenuObject - Rich menu 物件
 * @returns {Promise<string>} richMenuId
 */
async function createRichMenu(richMenuObject) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const richMenuId = await client.createRichMenu(richMenuObject);
        console.log('✅ Rich menu created:', richMenuId);
        return richMenuId;
    } catch (error) {
        console.error('❌ Create rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 刪除 rich menu
 * 
 * @param {string} richMenuId - Rich menu ID
 * @returns {Promise<object>} LINE API 回應結果
 */
async function deleteRichMenu(richMenuId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.deleteRichMenu(richMenuId);
        console.log('✅ Rich menu deleted:', richMenuId);
    } catch (error) {
        console.error('❌ Delete rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 設定預設 rich menu
 * 
 * @param {string} richMenuId - Rich menu ID
 * @returns {Promise<object>} LINE API 回應結果
 */
async function setDefaultRichMenu(richMenuId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.setDefaultRichMenu(richMenuId);
        console.log('✅ Default rich menu set:', richMenuId);
    } catch (error) {
        console.error('❌ Set default rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取消預設 rich menu
 * 
 * @returns {Promise<object>} LINE API 回應結果
 */
async function deleteDefaultRichMenu() {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.deleteDefaultRichMenu();
        console.log('✅ Default rich menu removed');
    } catch (error) {
        console.error('❌ Delete default rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取得預設 rich menu
 * 
 * @returns {Promise<string|null>} richMenuId 或 null
 */
async function getDefaultRichMenu() {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const richMenuId = await client.getDefaultRichMenu();
        return richMenuId;
    } catch (error) {
        if (error.statusCode === 404) {
            return null;
        }
        console.error('❌ Get default rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 上傳 rich menu 圖片
 * 
 * @param {string} richMenuId - Rich menu ID
 * @param {string} imagePath - 圖片路徑
 * @returns {Promise<object>} LINE API 回應結果
 */
async function uploadRichMenuImage(richMenuId, imagePath) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.uploadRichMenuImage(richMenuId, imagePath);
        console.log('✅ Rich menu image uploaded:', richMenuId);
    } catch (error) {
        console.error('❌ Upload rich menu image failed:', error.message);
        throw error;
    }
}

/**
 * 連結使用者與 rich menu
 * 
 * @param {string} userId - LINE User ID
 * @param {string} richMenuId - Rich menu ID
 * @returns {Promise<object>} LINE API 回應結果
 */
async function linkRichMenuToUser(userId, richMenuId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.linkRichMenuToUser(userId, richMenuId);
        console.log('✅ Rich menu linked to user:', userId);
    } catch (error) {
        console.error('❌ Link rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取消使用者的 rich menu 連結
 * 
 * @param {string} userId - LINE User ID
 * @returns {Promise<object>} LINE API 回應結果
 */
async function unlinkRichMenuFromUser(userId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        await client.unlinkRichMenuFromUser(userId);
        console.log('✅ Rich menu unlinked from user:', userId);
    } catch (error) {
        console.error('❌ Unlink rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取得使用者的 rich menu
 * 
 * @param {string} userId - LINE User ID
 * @returns {Promise<string|null>} richMenuId 或 null
 */
async function getLinkedRichMenu(userId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const richMenuId = await client.getLinkedRichMenu(userId);
        return richMenuId;
    } catch (error) {
        if (error.statusCode === 404) {
            return null;
        }
        console.error('❌ Get linked rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取得 rich menu 詳細資料
 * 
 * @param {string} richMenuId - Rich menu ID
 * @returns {Promise<object>} Rich menu 物件
 */
async function getRichMenu(richMenuId) {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const richMenu = await client.getRichMenu(richMenuId);
        return richMenu;
    } catch (error) {
        console.error('❌ Get rich menu failed:', error.message);
        throw error;
    }
}

/**
 * 取得所有 rich menu 列表
 * 
 * @returns {Promise<array>} Rich menu 列表
 */
async function getAllRichMenu() {
    const client = getLineClient();
    if (!client) {
        throw new Error('LINE Client 未初始化，請確認 LINE_ACCESS_TOKEN 已設定');
    }

    try {
        const richMenus = await client.getAllRichMenu();
        return richMenus;
    } catch (error) {
        console.error('❌ Get all rich menus failed:', error.message);
        throw error;
    }
}

// =====================================================
// 匯出模組
// =====================================================

module.exports = {
    // 客戶端
    getLineClient,
    
    // Messaging API
    replyMessage,
    pushMessage,
    multicast,
    getProfile,
    getAllUserIds,
    getMemberProfile,
    getMemberCount,
    leave,
    
    // Rich Menu
    createRichMenu,
    deleteRichMenu,
    setDefaultRichMenu,
    deleteDefaultRichMenu,
    getDefaultRichMenu,
    uploadRichMenuImage,
    linkRichMenuToUser,
    unlinkRichMenuFromUser,
    getLinkedRichMenu,
    getRichMenu,
    getAllRichMenu,
};