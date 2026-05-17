/**
 * LINE 餐廳候補位系統 - 資料庫備份腳本
 * 
 * 用於定期備份 PostgreSQL 資料庫
 * 
 * 使用方式：
 *   node scripts/backup-database.js
 * 
 * 或設定 Cron Job 自動執行：
 *   0 2 * * * node /root/.openclaw/workspace/line-bot-repo/scripts/backup-database.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const poolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
};

// 備份檔案目錄
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// 確保備份目錄存在
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);
    
    console.log('🔄 開始備份資料庫...');
    console.log(`   主機：${poolConfig.host}`);
    console.log(`   資料庫：${poolConfig.database}`);
    console.log(`   備份檔案：${backupFile}`);

    const pool = new Pool(poolConfig);

    try {
        // =====================================================
        // 1. 匯出 schema
        // =====================================================
        console.log('\n📋 匯出 Schema...');
        
        const schemaTables = ['restaurants', 'customers', 'queue_entries', 'reservations', 'notification_logs'];
        let schemaSql = '-- =====================================================\n';
        schemaSql += '-- LINE 餐廳候補位系統 - 資料庫備份\n';
        schemaSql += `-- 備份時間：${new Date().toISOString()}\n`;
        schemaSql += '-- =====================================================\n\n';
        
        schemaSql += '-- 啟用 UUID 擴充功能\n';
        schemaSql += 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n';

        // 取得 schema
        for (const table of schemaTables) {
            const result = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table]);

            if (result.rows.length > 0) {
                schemaSql += `-- ----------------------------------------------- --\n`;
                schemaSql += `-- Table: ${table}\n`;
                schemaSql += `-- ----------------------------------------------- --\n`;
                schemaSql += `CREATE TABLE IF NOT EXISTS ${table} (\n`;
                
                const columns = result.rows.map(row => {
                    let colDef = `    ${row.column_name} ${row.data_type}`;
                    if (row.is_nullable === 'NO') colDef += ' NOT NULL';
                    if (row.column_default) colDef += ` DEFAULT ${row.column_default}`;
                    return colDef;
                });
                
                schemaSql += columns.join(',\n');
                schemaSql += '\n);\n\n';
            }
        }

        // =====================================================
        // 2. 匯出資料
        // =====================================================
        console.log('📦 匯出資料...');
        
        let dataSql = '\n-- =====================================================\n';
        dataSql += '-- 資料匯入\n';
        dataSql += '-- =====================================================\n\n';

        for (const table of schemaTables) {
            const result = await pool.query(`SELECT * FROM ${table}`);
            
            if (result.rows.length > 0) {
                dataSql += `-- ----------------------------------------------- --\n`;
                dataSql += `-- Table: ${table} (${result.rows.length} rows)\n`;
                dataSql += `-- ----------------------------------------------- --\n`;
                
                for (const row of result.rows) {
                    const columns = Object.keys(row);
                    const values = Object.values(row).map(v => {
                        if (v === null) return 'NULL';
                        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                        if (v instanceof Date) return `'${v.toISOString()}'`;
                        return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                    });
                    
                    dataSql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
                }
                dataSql += '\n';
            }
        }

        // =====================================================
        // 3. 寫入備份檔案
        // =====================================================
        const fullBackup = schemaSql + dataSql;
        fs.writeFileSync(backupFile, fullBackup, 'utf8');

        // =====================================================
        // 4. 清理舊備份（保留最近 7 天）
        // =====================================================
        console.log('\n🧹 清理舊備份檔案...');
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        
        for (const file of files) {
            if (file.time < sevenDaysAgo) {
                fs.unlinkSync(file.path);
                console.log(`   刪除：${file.name}`);
                deletedCount++;
            }
        }

        // =====================================================
        // 完成
        // =====================================================
        const stats = fs.statSync(backupFile);
        const fileSize = (stats.size / 1024).toFixed(2);
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 備份完成！');
        console.log(`   檔案：${path.basename(backupFile)}`);
        console.log(`   大小：${fileSize} KB`);
        console.log(`   刪除舊檔案：${deletedCount} 個`);
        console.log('='.repeat(50));

        return {
            success: true,
            backupFile,
            fileSize,
            deletedCount,
        };

    } catch (error) {
        console.error('\n❌ 備份失敗：', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// 執行
backupDatabase().then(result => {
    console.log('\n✅ 備份腳本執行成功');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ 備份腳本執行失敗：', error.message);
    process.exit(1);
});