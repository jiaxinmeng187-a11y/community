import { NextRequest, NextResponse } from 'next/server'
import { findProfileByCommunityAndPhone } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { communityId, phone } = body

    // 参数校验
    if (!communityId || typeof communityId !== 'string' || !communityId.trim()) {
      return NextResponse.json({ error: '请输入社区编号' }, { status: 400 })
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号码' }, { status: 400 })
    }

    // 查询数据库
    const profile = await findProfileByCommunityAndPhone(
      communityId.trim(),
      phone.trim(),
    )

    if (!profile) {
      return NextResponse.json(
        { error: '未找到该用户，请确认社区编号和手机号，或前往注册' },
        { status: 401 },
      )
    }

    // 仅允许居民角色登录居民端
    if (profile.role !== 'resident') {
      return NextResponse.json(
        { error: '该账号非居民账户，请使用管理端入口' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        userId: profile.id,
        communityId: profile.community_id,
        phone: profile.phone,
        role: profile.role,
        name: profile.name,
        buildingId: profile.default_building_id ?? null,
        buildingName: profile.building_name ?? null,
        posX: profile.pos_x ?? null,
        posZ: profile.pos_z ?? null,
        unitNumber: profile.default_unit ?? null,
        apartmentNumber: profile.default_apartment ?? null,
      },
    })
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json(
      { error: '登录服务暂时不可用，请稍后重试' },
      { status: 500 },
    )
  }
}
