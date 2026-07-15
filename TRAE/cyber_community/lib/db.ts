import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

let pool: Pool

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL 未设置。请在 .env.local 中配置 DATABASE_URL')
    }

    // 清理 URL 中 node-postgres 不直接支持的 libpq 参数，避免冲突
    const cleanUrl = url.replace(/[?&]sslmode=\w+/, '').replace(/\?$/, '')

    const isRemote = cleanUrl.includes('supabase') || cleanUrl.includes('.co')

    pool = new Pool({
      connectionString: cleanUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      ...(isRemote
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}),
    })

    // 连接错误时清理 pool 以便下次重试
    pool.on('error', (err) => {
      console.error('[db] 数据库连接池错误:', err.message)
      pool = null as unknown as Pool
    })
  }
  return pool
}

/**
 * 根据 communityId + phone 查找用户（含楼栋坐标信息）
 */
export async function findProfileByCommunityAndPhone(
  communityId: string,
  phone: string,
) {
  const result = await getPool().query(
    `SELECT p.id, p.community_id, p.role, p.name, p.phone,
            p.default_building_id, p.default_apartment, p.default_unit,
            b.name AS building_name, b.pos_x, b.pos_z
     FROM profiles p
     LEFT JOIN buildings b ON b.id = p.default_building_id
     WHERE p.community_id = $1 AND p.phone = $2
     LIMIT 1`,
    [communityId, phone],
  )
  return result.rows[0] ?? null
}

/**
 * 管理员登录 - 按社区+手机+密码查找
 */
export async function findAdminByCommunityAndPhone(
  communityId: string,
  phone: string,
  password: string,
) {
  const result = await getPool().query(
    `SELECT p.id, p.community_id, p.role, p.name, p.phone, p.password_hash,
            c.name AS community_name
     FROM profiles p
     JOIN communities c ON c.id = p.community_id
     WHERE p.community_id = $1 AND p.phone = $2 AND p.role = 'admin'
     LIMIT 1`,
    [communityId, phone],
  )
  const row = result.rows[0]
  if (!row) return null

  const match = await bcrypt.compare(password, row.password_hash)
  if (!match) return null

  return {
    id: row.id,
    communityId: row.community_id,
    role: row.role,
    name: row.name,
    phone: row.phone,
    communityName: row.community_name,
  }
}

/**
 * 创建新用户（注册）
 */
export async function createProfile(params: {
  id: string
  communityId: string
  name: string
  phone: string
  role?: string
}) {
  const result = await getPool().query(
    `INSERT INTO profiles (id, community_id, role, name, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET phone = EXCLUDED.phone, name = EXCLUDED.name
     RETURNING id, community_id, role, name, phone`,
    [
      params.id,
      params.communityId,
      params.role ?? 'resident',
      params.name,
      params.phone,
    ],
  )
  return result.rows[0]
}

/**
 * 根据手机号查找用户（跨社区）
 */
export async function findProfileByPhone(phone: string) {
  const result = await getPool().query(
    `SELECT id, community_id, role, name, phone
     FROM profiles
     WHERE phone = $1
     LIMIT 1`,
    [phone],
  )
  return result.rows[0] ?? null
}
