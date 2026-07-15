import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

/** POST: 派单 — 插入 ticket_logs 并更新 ticket 状态为 processing */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticketId, workerId } = body

    if (!ticketId) {
      return NextResponse.json({ error: '缺少 ticketId' }, { status: 400 })
    }
    if (!workerId || typeof workerId !== 'string' || !workerId.trim()) {
      return NextResponse.json({ error: '请输入工号' }, { status: 400 })
    }

    const pool = getPool()

    // 1. 插入派单记录
    const logResult = await pool.query(
      `INSERT INTO ticket_logs (ticket_id, worker_id, status)
       VALUES ($1, $2, 'processing')
       RETURNING id, ticket_id, worker_id, status, created_at`,
      [ticketId, workerId.trim()],
    )

    // 2. 更新工单状态为 processing
    await pool.query(
      `UPDATE tickets SET status = 'processing' WHERE id = $1`,
      [ticketId],
    )

    return NextResponse.json({
      success: true,
      log: logResult.rows[0],
    })
  } catch (error) {
    console.error('派单失败:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '派单失败: ' + errMsg }, { status: 500 })
  }
}
