import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载项目根目录的 .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// ---- 连接池 ----

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL 未设置。请在项目根目录的 .env.local 中配置：\n' +
        '  DATABASE_URL=postgres://postgres:密码@127.0.0.1:5432/cyber_community',
    );
  }
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

const pool = createPool();

// ---- 类型定义 ----

export interface Building {
  id: string;
  communityId: string;
  name: string;
  posX: number;
  posZ: number;
  alertLevel: 'normal' | 'low' | 'mid' | 'high';
  createdAt: Date;
}

export interface PendingTicket {
  id: string;
  communityId: string;
  reporterId: string | null;
  reporterName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  apartmentNumber: string | null;
  description: string | null;
  imageUrl: string | null;
  aiSeverity: 'low' | 'mid' | 'high' | null;
  isDispatched: boolean | null;
  workerId: string | null;
  status: 'pending' | 'processing' | 'done' | null;
  createdAt: Date;
}

// ---- 自定义错误 ----

export class QueryError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

// ---- 行映射 ----

function toBuilding(row: Record<string, unknown>): Building {
  return {
    id: row.id as string,
    communityId: row.community_id as string,
    name: row.name as string,
    posX: row.pos_x as number,
    posZ: row.pos_z as number,
    alertLevel: row.alert_level as Building['alertLevel'],
    createdAt: row.created_at as Date,
  };
}

function toPendingTicket(row: Record<string, unknown>): PendingTicket {
  return {
    id: row.id as string,
    communityId: row.community_id as string,
    reporterId: (row.reporter_id as string) ?? null,
    reporterName: (row.reporter_name as string) ?? null,
    buildingId: (row.building_id as string) ?? null,
    buildingName: (row.building_name as string) ?? null,
    unitNumber: (row.unit_number as string) ?? null,
    apartmentNumber: (row.apartment_number as string) ?? null,
    description: (row.description as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    aiSeverity: (row.ai_severity as PendingTicket['aiSeverity']) ?? null,
    isDispatched: (row.is_dispatched as boolean) ?? null,
    workerId: (row.worker_id as string) ?? null,
    status: (row.status as PendingTicket['status']) ?? null,
    createdAt: row.created_at as Date,
  };
}

// ---- 公开查询函数 ----

/**
 * 获取指定小区的所有楼栋（含 3D 坐标与报警状态）。
 */
export async function getBuildings(communityId: string): Promise<Building[]> {
  try {
    const result = await pool.query(
      `SELECT id, community_id, name, pos_x, pos_z, alert_level, created_at
       FROM buildings
       WHERE community_id = $1
       ORDER BY name`,
      [communityId],
    );
    return result.rows.map(toBuilding);
  } catch (error) {
    throw new QueryError(
      `获取楼栋数据失败 (communityId: ${communityId})`,
      error,
    );
  }
}

/**
 * 获取指定小区所有待处理工单（status = 'pending'），
 * 同时 JOIN 报修人姓名与楼栋名称。
 */
export async function getPendingTickets(
  communityId: string,
): Promise<PendingTicket[]> {
  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.community_id,
         t.reporter_id,
         t.building_id,
         t.unit_number,
         t.apartment_number,
         t.description,
         t.image_url,
         t.ai_severity,
         t.is_dispatched,
         t.worker_id,
         t.status,
         t.created_at,
         p.name AS reporter_name,
         b.name AS building_name
       FROM tickets t
       LEFT JOIN profiles p ON p.id = t.reporter_id
       LEFT JOIN buildings b ON b.id = t.building_id
       WHERE t.community_id = $1
         AND t.status = 'pending'
       ORDER BY t.created_at DESC`,
      [communityId],
    );
    return result.rows.map(toPendingTicket);
  } catch (error) {
    throw new QueryError(
      `获取待处理工单失败 (communityId: ${communityId})`,
      error,
    );
  }
}

/**
 * 关闭连接池（通常在进程退出前调用）。
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
