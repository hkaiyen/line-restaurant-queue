#!/usr/bin/env node
/**
 * LINE 餐廳候補位系統 - Rich Menu 設定腳本
 * 
 * 使用方式：
 *   node scripts/setup-rich-menu.js
 * 
 * 功能：
 *   1. 建立 Rich Menu（4個按鈕）
 *   2. 上傳到 LINE
 *   3. 設定為預設選單
 */

const lineConfig = require('../config/line');

const LINE_API_BASE = 'https://api.line.me/v2';

// =====================================================
// 餐廳設定
// =====================================================

const RESTAURANT = {
    name: '安安餐廳',
    phone: '02-xxxx-xxxx',
};

// =====================================================
// LINE API 工具
// =====================================================

async function lineRequest(endpoint, options = {}) {
    const accessToken = lineConfig.messagingApi.accessToken;
    if (!accessToken) {
        throw new Error('LINE_ACCESS_TOKEN not set');
    }

    const url = `${LINE_API_BASE}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            ...options.headers,
        },
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(`LINE API Error: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    return data;
}

// =====================================================
// 建立 Rich Menu
// =====================================================

async function createRichMenu() {
    console.log('📝 建立 Rich Menu...');

    // Rich Menu 結構（2列 x 2行 = 4個按鈕）
    const richMenu = {
        size: {
            width: 2500,
            height: 1686,
        },
        selected: true,
        name: `安安餐廳-${Date.now()}`,
        chatBarText: '🍹 打開選單',
        areas: [
            // 第一列
            {
                bounds: {
                    x: 0,
                    y: 0,
                    width: 1250,
                    height: 843,
                },
                action: {
                    type: 'message',
                    label: '🔢 加入排隊',
                    text: '排隊',
                },
            },
            {
                bounds: {
                    x: 1250,
                    y: 0,
                    width: 1250,
                    height: 843,
                },
                action: {
                    type: 'message',
                    label: '📋 我的號碼',
                    text: '查詢',
                },
            },
            // 第二列
            {
                bounds: {
                    x: 0,
                    y: 843,
                    width: 1250,
                    height: 843,
                },
                action: {
                    type: 'message',
                    label: '❌ 取消排隊',
                    text: '取消',
                },
            },
            {
                bounds: {
                    x: 1250,
                    y: 843,
                    width: 1250,
                    height: 843,
                },
                action: {
                    type: 'message',
                    label: '📞 聯絡我們',
                    text: '電話',
                },
            },
        ],
    };

    const result = await lineRequest('/bot/richmenu', {
        method: 'POST',
        body: JSON.stringify(richMenu),
    });

    console.log(`✅ Rich Menu 建立成功！`);
    console.log(`   Rich Menu ID: ${result.richMenuId}`);
    
    return result.richMenuId;
}

// =====================================================
// 上傳 Rich Menu 圖片
// =====================================================

async function uploadRichMenuImage(richMenuId) {
    console.log('🖼️ 上傳 Rich Menu 圖片...');

    // 建立簡單的彩色圖片（LINE 需要 PNG 格式）
    // 這裡我們建立一個簡單的 Base64 編碼圖片
    // 實際使用，建議用 UI 工具建立好看的圖片
    
    // 創建一個簡單的 2500x1686 白色背景圖片
    const width = 2500;
    const height = 1686;
    
    // 使用 canvas 或其他工具建立圖片
    // 這裡我們用一個簡單的方法：建立 SVG 轉 PNG
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect fill="#ffffff" width="${width}" height="${height}"/>
        <rect fill="#00B900" x="0" y="0" width="1250" height="843"/>
        <rect fill="#01C851" x="1250" y="0" width="1250" height="843"/>
        <rect fill="#01C851" x="0" y="843" width="1250" height="843"/>
        <rect fill="#00B900" x="1250" y="843" width="1250" height="843"/>
        <text x="625" y="450" font-size="60" fill="white" text-anchor="middle">🔢 加入排隊</text>
        <text x="1875" y="450" font-size="60" fill="white" text-anchor="middle">📋 我的號碼</text>
        <text x="625" y="1293" font-size="60" fill="white" text-anchor="middle">❌ 取消排隊</text>
        <text x="1875" y="1293" font-size="60" fill="white" text-anchor="middle">📞 聯絡我們</text>
        <text x="1250" y="1650" font-size="40" fill="#888888" text-anchor="middle">${RESTAURANT.name} 候補位系統</text>
    </svg>`;

    // 這裡我們用 Node.js buffer 來處理
    // 如果需要上傳實際圖片，需要用 sharp 或 canvas 工具
    // 目前先跳過上傳，用預設圖片

    console.log('⚠️ 圖片上傳需要額外工具（sharp/canvas）');
    console.log('   建議使用線上工具建立 Rich Menu 圖片：');
    console.log('   https://richmenu.online/');
    console.log('');
    console.log('   建立後，將圖片命名為 rich-menu.png 放在專案根目錄');
    console.log('   然後執行：node scripts/upload-rich-menu-image.js');
    
    return null;
}

// =====================================================
// 設定為預設選單
// =====================================================

async function setDefaultRichMenu(richMenuId) {
    console.log('⭐ 設定為預設選單...');

    await lineRequest('/bot/user/all/richmenu/' + richMenuId, {
        method: 'POST',
    });

    console.log('✅ 已設為預設選單（所有用戶都會看到）');
}

// =====================================================
// 列出現有 Rich Menu
// =====================================================

async function listRichMenus() {
    console.log('📋 列出所有 Rich Menu...');

    const result = await lineRequest('/bot/richmenu/list');
    
    if (result.richmenus && result.richmenus.length > 0) {
        console.log('');
        result.richmenus.forEach((menu, index) => {
            console.log(`${index + 1}. ${menu.name}`);
            console.log(`   ID: ${menu.richMenuId}`);
            console.log(`   預設: ${menu.selected ? '是' : '否'}`);
            console.log('');
        });
    } else {
        console.log('目前沒有 Rich Menu');
    }
    
    return result.richmenus || [];
}

// =====================================================
// 刪除 Rich Menu
// =====================================================

async function deleteRichMenu(richMenuId) {
    console.log(`🗑️ 刪除 Rich Menu ${richMenuId}...`);

    await lineRequest('/bot/richmenu/' + richMenuId, {
        method: 'DELETE',
    });

    console.log('✅ 已刪除');
}

// =====================================================
// 主程式
// =====================================================

async function main() {
    console.log('='.repeat(50));
    console.log('🍹 安安餐廳 Rich Menu 設定程式');
    console.log('='.repeat(50));
    console.log('');

    const args = process.argv.slice(2);
    const command = args[0] || 'setup';

    try {
        switch (command) {
            case 'setup':
                // 建立並設定預設
                const richMenuId = await createRichMenu();
                await setDefaultRichMenu(richMenuId);
                
                console.log('');
                console.log('='.repeat(50));
                console.log('📝 下一步：');
                console.log('');
                console.log('1. 建立 Rich Menu 圖片（2500x1686px）');
                console.log('2. 命名為 rich-menu.png 放在專案根目錄');
                console.log('3. 執行：node scripts/upload-rich-menu-image.js');
                console.log('='.repeat(50));
                break;

            case 'list':
                await listRichMenus();
                break;

            case 'delete':
                if (args[1]) {
                    await deleteRichMenu(args[1]);
                } else {
                    console.log('❌ 請提供 Rich Menu ID');
                    console.log('   範例：node scripts/setup-rich-menu.js delete R123456789');
                }
                break;

            case 'upload':
                // 這需要單獨的腳本
                console.log('⚠️ 請執行上傳圖片腳本');
                console.log('   node scripts/upload-rich-menu-image.js <richMenuId>');
                break;

            default:
                console.log('❌ 未知指令');
                console.log('');
                console.log('可用指令：');
                console.log('  setup   - 建立並設定預設 Rich Menu');
                console.log('  list    - 列出所有 Rich Menu');
                console.log('  delete  - 刪除 Rich Menu（需提供 ID）');
                console.log('  upload  - 上傳 Rich Menu 圖片');
        }
    } catch (error) {
        console.error('❌ 錯誤：', error.message);
        process.exit(1);
    }
}

main();