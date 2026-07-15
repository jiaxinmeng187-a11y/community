const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. 给 tickets 表添加 unit_number 字段
    console.log('添加 unit_number 字段到 tickets 表...');
    await client.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS unit_number VARCHAR(10)
    `);
    console.log('  -> unit_number 字段已添加');

    // 2. 更新已有工单数据 - 给测试工单设置单元号
    console.log('更新已有工单数据...');
    await client.query(`
      UPDATE tickets
      SET unit_number = '1'
      WHERE unit_number IS NULL
    `);
    console.log('  -> 已有工单单元号已更新为默认值 "1"');

    // 3. 给 profiles 表也添加 default_unit 字段（可选，注册时填）
    console.log('添加 default_unit 字段到 profiles 表...');
    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS default_unit VARCHAR(10)
    `);
    console.log('  -> default_unit 字段已添加');

    // 4. 更新居民默认单元
    await client.query(`
      UPDATE profiles
      SET default_unit = '1'
      WHERE default_unit IS NULL
    `);
    console.log('  -> 居民默认单元已更新');

    console.log('\n迁移完成！');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
