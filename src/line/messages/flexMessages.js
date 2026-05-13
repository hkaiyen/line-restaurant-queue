/**
 * LINE 餐廳候補位系統 - Flex Message 訊息模板
 * 
 * 建立各種 LINE Flex Message 格式
 * 支援：歡迎訊息、排隊確認、排隊狀態、叫號通知、預約相關等
 */

const lineConfig = require('../../../config/line');

// =====================================================
// 顏色捷徑
// =====================================================

const colors = lineConfig.flexMessages.colors;
const icons = lineConfig.flexMessages.icons;

// =====================================================
// 基礎元件
// =====================================================

/**
 * 建立分隔線
 */
function createSeparator(margin = 'md') {
    return {
        type: 'separator',
        margin: margin,
        color: '#E0E0E0',
    };
}

/**
 * 建立空白空間
 */
function createSpacer(size = 'md') {
    return {
        type: 'spacer',
        size: size,
    };
}

/**
 * 建立標題文字
 */
function createTitle(text, size = 'lg', weight = 'bold') {
    return {
        type: 'text',
        text: text,
        weight: weight,
        size: size,
        color: colors.text,
    };
}

/**
 * 建立內文文字
 */
function createBody(text, wrap = true, size = 'md', color = colors.text) {
    return {
        type: 'text',
        text: text,
        wrap: wrap,
        size: size,
        color: color,
    };
}

/**
 * 建立按鈕動作
 */
function createPostbackAction(label, data, displayText = null) {
    return {
        type: 'postback',
        label: label,
        data: data,
        displayText: displayText || label,
    };
}

/**
 * 建立 URI 動作（開啟網頁）
 */
function createURIAction(label, uri) {
    return {
        type: 'uri',
        label: label,
        uri: uri,
    };
}

/**
 * 建立 datetimepicker 動作（時間選擇）
 */
function createDateTimePickerAction(label, data, mode = 'date') {
    return {
        type: 'datetimepicker',
        label: label,
        data: data,
        mode: mode, // 'date', 'time', 'datetime'
    };
}

// =====================================================
// 歡迎訊息
// =====================================================

/**
 * 建立歡迎訊息 Flex Message
 * 
 * @param {string} displayName - 使用者名稱（可選）
 */
function createWelcomeFlex(displayName = '貴賓') {
    return {
        type: 'flex',
        altText: '歡迎使用 LINE 餐廳候補位系統',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '👋 歡迎回來！',
                        weight: 'bold',
                        size: 'xl',
                        color: colors.primary,
                    },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `嗨，${displayName}！`,
                        size: 'lg',
                        weight: 'bold',
                        color: colors.text,
                    },
                    createSpacer('sm'),
                    createBody('感謝您使用 LINE 餐廳候補位系統！'),
                    createSpacer('sm'),
                    createBody('您可以使用以下功能：'),
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('🔢 加入排隊', `action=join_queue`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('📋 我的排隊', `action=show_queue_status`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('📅 線上預約', `action=book_reservation`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('📝 我的預約', `action=show_reservation`),
                    },
                ],
            },
        },
    };
}

// =====================================================
// 加入排隊
// =====================================================

/**
 * 建立加入排隊 Flex Message
 */
function createJoinQueueFlex() {
    return {
        type: 'flex',
        altText: '加入排隊',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🔢 加入排隊',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    createBody('歡迎使用排隊服務！請選擇您要前往的餐廳。'),
                    createSpacer('md'),
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('🔢 加入排隊', `action=select_restaurant`),
                    },
                ],
            },
        },
    };
}

/**
 * 建立確認加入排隊 Flex Message
 * 
 * @param {object} params - 包含 restaurantId, restaurantName, partySize
 */
function createConfirmJoinQueueFlex({ restaurantId, restaurantName, partySize }) {
    return {
        type: 'flex',
        altText: '確認加入排隊',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🔢 確認加入排隊',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '請確認您的排隊資料',
                        weight: 'bold',
                        size: 'md',
                    },
                    createSpacer('md'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '餐廳：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: restaurantName, color: colors.text, weight: 'bold', flex: 3 },
                        ],
                    },
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '人數：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: `${partySize} 人`, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '狀態：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: '等待中', color: colors.secondary, weight: 'bold', flex: 3 },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction(
                            '✅ 確認加入',
                            `actionType=confirm_join_queue&restaurantId=${restaurantId}&partySize=${partySize}`,
                            `我要加入排隊`
                        ),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('❌ 取消', `action=cancel_action`),
                    },
                ],
            },
        },
    };
}

/**
 * 建立排隊成功訊息 Flex Message
 * 
 * @param {object} params - 包含 queueNumber, restaurantName, position, partySize
 */
function createQueueJoinedFlex({ queueNumber, restaurantName, position, partySize }) {
    return {
        type: 'flex',
        altText: '排隊成功',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '✅ 排隊成功！',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.secondary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '您的排隊號碼',
                        size: 'sm',
                        color: colors.textLight,
                    },
                    {
                        type: 'text',
                        text: `第 ${queueNumber} 號`,
                        weight: 'bold',
                        size: '3xl',
                        color: colors.primary,
                    },
                    createSeparator(),
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '餐廳：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: restaurantName, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '人數：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: `${partySize} 人`, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '前方等候：', color: colors.textLight, flex: 2 },
                            {
                                type: 'text',
                                text: `${position - 1} 組`,
                                color: colors.accent,
                                weight: 'bold',
                                flex: 3,
                            },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('📋 查看排隊進度', `action=show_queue_status`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('❌ 取消排隊', `action=cancel_queue`),
                    },
                ],
            },
        },
    };
}

// =====================================================
// 排隊狀態
// =====================================================

/**
 * 建立排隊狀態 Flex Message
 * 
 * @param {object} params - 包含 queueNumber, position, partySize, joinedAt
 */
function createQueueStatusFlex({ queueNumber, position, partySize, joinedAt }) {
    const joinedTime = new Date(joinedAt).toLocaleString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return {
        type: 'flex',
        altText: '排隊進度查詢',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '📋 我的排隊',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '目前排隊狀態',
                        size: 'sm',
                        color: colors.textLight,
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '號碼：', color: colors.textLight, flex: 2 },
                            {
                                type: 'text',
                                text: `第 ${queueNumber} 號`,
                                weight: 'bold',
                                size: 'xl',
                                color: colors.primary,
                                flex: 3,
                            },
                        ],
                    },
                    createSeparator(),
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '目前順位：', color: colors.textLight, flex: 2 },
                            {
                                type: 'text',
                                text: `第 ${position} 位`,
                                weight: 'bold',
                                color: colors.accent,
                                flex: 3,
                            },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '前方等候：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: `${position - 1} 組`, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '人數：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: `${partySize} 人`, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '加入時間：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: joinedTime, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('md'),
                    {
                        type: 'text',
                        text: '💡 聽到叫號時，請至櫃檯報到。',
                        wrap: true,
                        size: 'sm',
                        color: colors.textLight,
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('🔄 更新狀態', `action=show_queue_status`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('❌ 取消排隊', `action=cancel_queue`),
                    },
                ],
            },
        },
    };
}

/**
 * 建立被叫號通知 Flex Message
 * 
 * @param {object} queueEntry - 排隊資料
 */
function createCalledFlex(queueEntry) {
    return {
        type: 'flex',
        altText: '🎉 輪到您了！',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🎉 輪到您了！',
                        weight: 'bold',
                        size: 'xl',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.accent,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '請速至餐廳櫃檯報到',
                        weight: 'bold',
                        size: 'lg',
                        color: colors.text,
                    },
                    createSpacer('md'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '您的號碼：', color: colors.textLight, flex: 2 },
                            {
                                type: 'text',
                                text: `第 ${queueEntry.queue_number} 號`,
                                weight: 'bold',
                                size: '2xl',
                                color: colors.accent,
                                flex: 3,
                            },
                        ],
                    },
                    createSpacer('sm'),
                    {
                        type: 'text',
                        text: '⚠️ 過號需重新排隊，請儘速報到！',
                        wrap: true,
                        color: colors.warning,
                        size: 'sm',
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('✅ 確認已報到', `action=mark_served`),
                    },
                ],
            },
        },
    };
}

/**
 * 建立取消排隊確認 Flex Message
 */
function createConfirmCancelQueueFlex({ queueEntryId, queueNumber }) {
    return {
        type: 'flex',
        altText: '確認取消排隊',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '⚠️ 確認取消排隊？',
                        weight: 'bold',
                        size: 'lg',
                    },
                    createSpacer('md'),
                    createBody(`您確定要取消排隊（號碼：${queueNumber}）嗎？取消後需重新排隊。`),
                ],
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.warning,
                        action: createPostbackAction(
                            '✅ 確認取消',
                            `actionType=confirm_cancel_queue&queueEntryId=${queueEntryId}`,
                            `取消排隊`
                        ),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('❌ 保留', `action=cancel_action`),
                    },
                ],
            },
        },
    };
}

// =====================================================
// 預約相關
// =====================================================

/**
 * 建立線上預約 Flex Message
 */
function createReservationFlex() {
    return {
        type: 'flex',
        altText: '線上預約',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '📅 線上預約',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    createBody('歡迎使用線上預約服務！'),
                    createSpacer('sm'),
                    createBody('請填寫預約日期、時間、人數，我們將為您保留座位。'),
                    createSpacer('md'),
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('📅 填寫預約資料', `action=book_reservation`),
                    },
                ],
            },
        },
    };
}

/**
 * 建立預約列表 Flex Message
 * 
 * @param {array} reservations - 預約資料陣列
 */
function createReservationListFlex(reservations) {
    const reservationItems = reservations.map((res) => ({
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
            {
                type: 'box',
                layout: 'baseline',
                contents: [
                    { type: 'text', text: '📍 ', flex: 0 },
                    { type: 'text', text: res.restaurant_name || '餐廳', weight: 'bold', flex: 3 },
                ],
            },
            {
                type: 'box',
                layout: 'baseline',
                contents: [
                    { type: 'text', text: '📅 ', flex: 0 },
                    {
                        type: 'text',
                        text: `${res.reservation_date} ${res.reservation_time}`,
                        color: colors.text,
                        flex: 3,
                    },
                ],
            },
            {
                type: 'box',
                layout: 'baseline',
                contents: [
                    { type: 'text', text: '👥 ', flex: 0 },
                    { type: 'text', text: `${res.party_size} 人`, color: colors.textLight, flex: 3 },
                ],
            },
            createSeparator(),
        ],
    }));

    return {
        type: 'flex',
        altText: '我的預約',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '📝 我的預約',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: reservationItems,
            },
        },
    };
}

/**
 * 建立取消預約確認 Flex Message
 */
function createConfirmCancelReservationFlex({ reservationId, reservationDate, reservationTime }) {
    return {
        type: 'flex',
        altText: '確認取消預約',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '⚠️ 確認取消預約？',
                        weight: 'bold',
                        size: 'lg',
                    },
                    createSpacer('md'),
                    createBody(`您確定要取消以下預約嗎？`),
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '日期：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: reservationDate, color: colors.text, flex: 3 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '時間：', color: colors.textLight, flex: 2 },
                            { type: 'text', text: reservationTime, color: colors.text, flex: 3 },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.warning,
                        action: createPostbackAction(
                            '✅ 確認取消',
                            `actionType=confirm_cancel_reservation&reservationId=${reservationId}`,
                            `取消預約`
                        ),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('❌ 保留', `action=cancel_action`),
                    },
                ],
            },
        },
    };
}

// =====================================================
// 幫助訊息
// =====================================================

/**
 * 建立幫助訊息 Flex Message
 */
function createHelpFlex() {
    return {
        type: 'flex',
        altText: '幫助資訊',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '❓ 幫助',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    createTitle('操作說明', 'md'),
                    createSpacer('sm'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '🔢', flex: 0 },
                            { type: 'text', text: '「加入排隊」- 開始排隊', flex: 1 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '📋', flex: 0 },
                            { type: 'text', text: '「我的排隊」- 查看排隊進度', flex: 1 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '📅', flex: 0 },
                            { type: 'text', text: '「預約」- 線上預約座位', flex: 1 },
                        ],
                    },
                    createSpacer('xs'),
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            { type: 'text', text: '📝', flex: 0 },
                            { type: 'text', text: '「我的預約」- 查看/取消預約', flex: 1 },
                        ],
                    },
                    createSeparator(),
                    createSpacer('sm'),
                    createBody('輸入關鍵字或點擊下方按鈕操作', false, 'sm', colors.textLight),
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        color: colors.primary,
                        action: createPostbackAction('🔢 加入排隊', `action=join_queue`),
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: createPostbackAction('📅 線上預約', `action=book_reservation`),
                    },
                ],
            },
        },
    };
}

// =====================================================
// 人數選擇
// =====================================================

/**
 * 建立人數選擇 Flex Message
 */
function createPartySizeSelectionFlex({ restaurantId, restaurantName }) {
    const partySizeButtons = [];
    
    for (let i = 1; i <= 10; i++) {
        if (i <= 5) {
            // 前 5 人用按鈕
            partySizeButtons.push({
                type: 'button',
                style: 'secondary',
                action: createPostbackAction(
                    `${i} 人`,
                    `action=select_party_size&restaurantId=${restaurantId}&partySize=${i}`
                ),
            });
        } else {
            // 第 6 人以上用 postback
            partySizeButtons.push({
                type: 'button',
                style: 'secondary',
                action: createPostbackAction(
                    `${i} 人`,
                    `action=select_party_size&restaurantId=${restaurantId}&partySize=${i}`
                ),
            });
        }
    }

    return {
        type: 'flex',
        altText: '選擇用餐人數',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `👥 選擇人數 - ${restaurantName}`,
                        weight: 'bold',
                        size: 'md',
                        color: '#FFFFFF',
                    },
                ],
                backgroundColor: colors.primary,
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    createBody('請選擇用餐人數：', false),
                    createSpacer('md'),
                    ...partySizeButtons.slice(0, 5),
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '6-10 人請點擊這裡',
                        wrap: true,
                        align: 'center',
                        color: colors.textLight,
                        size: 'sm',
                    },
                ],
            },
        },
    };
}

// =====================================================
// 匯出
// =====================================================

module.exports = {
    // 基礎元件
    createSeparator,
    createSpacer,
    createTitle,
    createBody,
    createPostbackAction,
    createURIAction,
    createDateTimePickerAction,

    // 訊息模板
    createWelcomeFlex,
    createJoinQueueFlex,
    createConfirmJoinQueueFlex,
    createQueueJoinedFlex,
    createQueueStatusFlex,
    createCalledFlex,
    createConfirmCancelQueueFlex,
    createReservationFlex,
    createReservationListFlex,
    createConfirmCancelReservationFlex,
    createHelpFlex,
    createPartySizeSelectionFlex,
};