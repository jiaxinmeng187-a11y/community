const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:Mm1979@127.0.0.1:5432/cyber_community',
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

    // 2. 插入楼栋（坐标对齐 3D 场景 mockBuildings）
    await client.query(`
      INSERT INTO buildings (community_id, name, pos_x, pos_z, alert_level)
      VALUES
        ('sunshine_001', '1号楼', -30, -30, 'normal'),
        ('sunshine_001', '2号楼', -10, -30, 'high'),
        ('sunshine_001', '3号楼',  10, -30, 'mid'),
        ('sunshine_001', '4号楼',  30, -30, 'normal'),
        ('sunshine_001', '社区服务中心', 0, 45, 'normal')
      ON CONFLICT DO NOTHING
    `);
    console.log('楼栋已就绪: 5 栋');

    // 3. 插入居民用户（带默认楼栋）
    const residentId = 'a0000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO profiles (id, community_id, role, name, phone, default_building_id, default_unit, default_apartment)
      VALUES ($1, 'sunshine_001', 'resident', '张先生', '13800138000',
        (SELECT id FROM buildings WHERE community_id='sunshine_001' AND name='2号楼' LIMIT 1),
        '1', '301')
      ON CONFLICT (id) DO UPDATE
        SET phone = EXCLUDED.phone, name = EXCLUDED.name,
            default_building_id = EXCLUDED.default_building_id,
            default_unit = EXCLUDED.default_unit,
            default_apartment = EXCLUDED.default_apartment
    `, [residentId]);
    console.log('居民用户已就绪:');
    console.log('  社区编号: sunshine_001');
    console.log('  手机号:   13800138000');
    console.log('  姓名:     张先生');
    console.log('  角色:     resident');

    // 4. 插入测试工单
    await client.query(`
      INSERT INTO tickets (community_id, reporter_id, building_id, unit_number, apartment_number, description, ai_severity, status)
      VALUES ('sunshine_001', $1,
        (SELECT id FROM buildings WHERE community_id='sunshine_001' AND name='2号楼' LIMIT 1),
        '1', '301', '电梯按键失灵，需要维修', 'high', 'pending')
      ON CONFLICT DO NOTHING
    `, [residentId]);
    console.log('测试工单已就绪: 1 条');
    console.log('\n======== 登录信息 ========');
    console.log('社区编号: sunshine_001');
    console.log('手机号:   13800138000');
    console.log('===========================');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error('写入失败:', e.message);
  process.exit(1);
});
