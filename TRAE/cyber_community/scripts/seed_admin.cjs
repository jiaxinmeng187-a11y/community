/**
 * 创建管理员账号种子脚本
 * 运行: node scripts/seed_admin.cjs
 */
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  })

  try {
    // 1. 添加 password_hash 列（如果不存在）
    console.log('1. 添加 password_hash 列...')
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE profiles ADD COLUMN password_hash VARCHAR(255);
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$;
    `)
    console.log('   OK')

    // 2. 生成管理员密码哈希
    const password = 'admin123'
    const hash = bcrypt.hashSync(password, 10)

    // 3. 插入管理员账号（如果已存在则更新密码）
    console.log('2. 创建管理员账号...')
    const result = await pool.query(
      `INSERT INTO profiles (id, community_id, role, name, phone, password_hash)
       VALUES ($1, $2, 'admin', $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET role = 'admin', password_hash = $5, name = $3, phone = $4
       RETURNING id, name, phone, role`,
      ['a0000000-0000-0000-0000-000000000000', 'sunshine_001', '管理员', '13900139000', hash],
    )
    console.log('   OK:', result.rows[0])

    console.log('\n--- 管理员登录信息 ---')
    console.log('小区编号: sunshine_001')
    console.log('手机号:   13900139000')
    console.log('密码:     admin123')
    console.log('角色:     admin')
    console.log('---')
  } catch (err) {
    console.error('错误:', err.message)
  } finally {
    await pool.end()
  }
}

main()
