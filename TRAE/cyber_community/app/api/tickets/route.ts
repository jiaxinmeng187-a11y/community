import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

/** GET: 查询工单列表（按社区，或按用户） */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const communityId = searchParams.get('communityId')
    const reporterId = searchParams.get('reporterId')

    if (!communityId && !reporterId) {
      return NextResponse.json(
        { error: '缺少 communityId 或 reporterId 参数' },
        { status: 400 },
      )
    }

    let query = `
      SELECT t.id, t.community_id, t.reporter_id, t.building_id,
             t.unit_number, t.apartment_number, t.title, t.description,
             t.image_url, t.ai_severity, t.status, t.created_at,
             p.name AS reporter_name, b.name AS building_name
      FROM tickets t
      LEFT JOIN profiles p ON p.id = t.reporter_id
      LEFT JOIN buildings b ON b.id = t.building_id
      WHERE 1=1
    `
    const params: Array<string> = []
    let paramIdx = 1

    if (communityId) {
      query += ` AND t.community_id = $${paramIdx++}`
      params.push(communityId)
    }

    if (reporterId) {
      query += ` AND t.reporter_id = $${paramIdx++}`
      params.push(reporterId)
    }

    query += ` ORDER BY t.created_at DESC`

    const result = await getPool().query(query, params)

    const tickets = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      communityId: row.community_id as string,
      reporterId: (row.reporter_id as string) ?? null,
      reporterName: (row.reporter_name as string) ?? null,
      buildingId: (row.building_id as string) ?? null,
      buildingName: (row.building_name as string) ?? null,
      unitNumber: (row.unit_number as string) ?? null,
      apartmentNumber: (row.apartment_number as string) ?? null,
      title: (row.title as string) ?? null,
      description: (row.description as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      aiSeverity: (row.ai_severity as string) ?? 'low',
      status: (row.status as string) ?? 'pending',
      createdAt: (row.created_at as string) ?? null,
    }))

    return NextResponse.json({ success: true, tickets })
  } catch (error) {
    console.error('查询工单失败:', error)
    return NextResponse.json({ error: '查询工单失败' }, { status: 500 })
  }
}

/** POST: 创建工单 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      communityId,
      reporterId,
      buildingId,
      unitNumber,
      apartmentNumber,
      title,
      description,
      imageBase64,
      aiSeverity,
    } = body

    console.log('[POST /api/tickets] 接收参数:', { communityId, reporterId, buildingId, title, hasImage: !!imageBase64 })

    if (!communityId) {
      return NextResponse.json({ error: '缺少 communityId' }, { status: 400 })
    }
    if (!reporterId) {
      return NextResponse.json({ error: '缺少 reporterId' }, { status: 400 })
    }

    const crypto = await import('crypto')
    const ticketId = crypto.randomUUID()

    const result = await getPool().query(
      `INSERT INTO tickets
         (id, community_id, reporter_id, building_id, unit_number,
          apartment_number, title, description, image_url, ai_severity, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW())
       RETURNING id, community_id, reporter_id, title, description, ai_severity, status, created_at`,
      [
        ticketId,
        communityId,
        reporterId,
        buildingId ?? null,
        unitNumber ?? null,
        apartmentNumber ?? null,
        title ?? null,
        description ?? null,
        imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null,
        aiSeverity ?? 'high',
      ],
    )

    const ticket = result.rows[0]

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id as string,
        communityId: ticket.community_id as string,
        reporterId: (ticket.reporter_id as string) ?? null,
        title: (ticket.title as string) ?? null,
        description: (ticket.description as string) ?? null,
        aiSeverity: (ticket.ai_severity as string) ?? 'high',
        status: (ticket.status as string) ?? 'pending',
        createdAt: (ticket.created_at as string) ?? null,
      },
    })
  } catch (error) {
    console.error('创建工单失败:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: '创建工单失败: ' + errMsg }, { status: 500 })
  }
}
