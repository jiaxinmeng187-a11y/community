import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:Mm1979@127.0.0.1:5432/cyber_community',
});

async function seed() {
  const client = await pool.connect();

  try {
    // 1. 插入社区
    await client.query(`
      INSERT INTO communities (id, name, grid_size)
      VALUES ('sunshine_001', '阳光社区', 10)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('社区已就绪: sunshine_001');

    // 2. 插入楼栋
    await client.query(`
      INSERT INTO buildings (community_id, name, pos_x, pos_z, alert_level)
      VALUES
        ('sunshine_001', '1号楼', -8, -6, 'normal'),
        ('sunshine_001', '2号楼', -8,  6, 'high'),
        ('sunshine_001', '3号楼',  8, -6, 'mid'),
        ('sunshine_001', '4号楼',  8,  6, 'normal'),
        ('sunshine_001', '社区服务中心', 0, 0, 'normal')
      ON CONFLICT DO NOTHING
    `);
    console.log('楼栋已就绪: 5 栋');

    // 3. 插入居民用户 - 用固定 UUID 方便测试
    const residentId = 'a0000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO profiles (id, community_id, role, name, phone)
      VALUES ($1, 'sunshine_001', 'resident', '张先生', '13800138000')
      ON CONFLICT (id) DO UPDATE
        SET phone = EXCLUDED.phone, name = EXCLUDED.name
    `, [residentId]);
    console.log('居民用户已就绪:');
    console.log('  社区编号: sunshine_001');
    console.log('  手机号:   13800138000');
    console.log('  姓名:     张先生');
    console.log('  角色:     resident');

    // 4. 插入一个测试工单
    await client.query(`
      INSERT INTO tickets (community_id, reporter_id, building_id, description, ai_severity, status)
      VALUES ('sunshine_001', $1,
        (SELECT id FROM buildings WHERE community_id='sunshine_001' AND name='2号楼' LIMIT 1),
        '电梯按键失灵，需要维修', 'high', 'pending')
      ON CONFLICT DO NOTHING
    `, [residentId]);
    console.log('测试工单已就绪: 1 条');
    console.log('\n现在可以用以下信息登录居民端:');
    console.log('  社区编号: sunshine_001');
    console.log('  手机号:   13800138000');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error('种子数据写入失败:', e.message);
  process.exit(1);
});
