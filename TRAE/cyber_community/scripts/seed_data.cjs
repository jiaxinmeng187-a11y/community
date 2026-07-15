/**
 * scripts/seed_data.js
 * 向 buildings 表写入 sunshine_001 小区的完整空间布局数据
 *
 * 运行方式：node scripts/seed_data.js
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');

// 加载 .env.local
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const COMMUNITY_ID = 'sunshine_001';

// ---------- 坐标生成 ----------

/** 带微小随机偏移的坐标抖动 (±jitter) */
function jitter(base, range) {
  return +(base + (Math.random() * 2 - 1) * range).toFixed(1);
}

/**
 * 12 栋居民楼：3 排 × 4 列 阵列
 *   排方向：Z 轴（每排间隔 30）
 *   列方向：X 轴（每栋间隔 20）
 *   整体居中偏移，让原点 (0,0) 大致在小区中央
 */
function generateResidentialBuildings() {
  const cols = 4;
  const xSpacing = 20;
  const zSpacing = 30;
  const xOffset = -((cols - 1) * xSpacing) / 2; // 水平居中
  const zOffset = -30; // 整体略向上偏移，下方留给公共设施

  const buildings = [];
  let idx = 1;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cols; col++) {
      const baseX = xOffset + col * xSpacing;
      const baseZ = zOffset + row * zSpacing;

      buildings.push({
        id: crypto.randomUUID(),
        community_id: COMMUNITY_ID,
        name: `${idx}栋`,
        pos_x: jitter(baseX, 2),
        pos_z: jitter(baseZ, 2),
        alert_level: 'normal',
      });
      idx++;
    }
  }

  return buildings;
}

/**
 * 公共设施：放在小区中轴线及边缘
 */
function generateFacilities() {
  return [
    {
      id: crypto.randomUUID(),
      community_id: COMMUNITY_ID,
      name: '物业中心',
      pos_x: jitter(0, 1),
      pos_z: jitter(45, 1),     // 最南侧中央
      alert_level: 'normal',
    },
    {
      id: crypto.randomUUID(),
      community_id: COMMUNITY_ID,
      name: '东门保安亭',
      pos_x: jitter(45, 1),     // 最右侧
      pos_z: jitter(0, 1),
      alert_level: 'normal',
    },
    {
      id: crypto.randomUUID(),
      community_id: COMMUNITY_ID,
      name: '西门保安亭',
      pos_x: jitter(-45, 1),    // 最左侧
      pos_z: jitter(0, 1),
      alert_level: 'normal',
    },
  ];
}

// ---------- 主流程 ----------

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL 未设置，请检查 .env.local');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    // 1. 确保小区记录存在（外键依赖）
    await pool.query(
      `INSERT INTO communities (id, name, grid_size, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [COMMUNITY_ID, '阳光家园', 20],
    );
    console.log(`🏘️  小区 '${COMMUNITY_ID}' 已就绪`);

    // 2. 清空旧建筑数据
    await pool.query("DELETE FROM buildings WHERE community_id = $1", [COMMUNITY_ID]);
    console.log(`🗑️  已清空旧建筑数据`);

    // 3. 生成并插入
    const residential = generateResidentialBuildings();
    const facilities  = generateFacilities();
    const all = [...residential, ...facilities];

    for (const b of all) {
      await pool.query(
        `INSERT INTO buildings (id, community_id, name, pos_x, pos_z, alert_level, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [b.id, b.community_id, b.name, b.pos_x, b.pos_z, b.alert_level],
      );
    }

    console.log(`✅ 成功写入 ${all.length} 条建筑数据：`);
    console.log('');
    all.forEach((b) => {
      const tag = b.name.includes('栋') ? '🏠' : '🏢';
      console.log(`   ${tag}  ${b.name.padEnd(8)}  (${b.pos_x}, ${b.pos_z})`);
    });

    console.log('\n🎉 数据库初始化完成！');
  } catch (err) {
    console.error('❌ 执行失败：', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
