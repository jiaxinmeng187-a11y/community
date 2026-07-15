import { NextRequest, NextResponse } from 'next/server'
import { findAdminByCommunityAndPhone } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { communityId, phone, password } = body

    // 参数校验
    if (!communityId || typeof communityId !== 'string' || !communityId.trim()) {
      return NextResponse.json({ error: '请输入社区编号' }, { status: 400 })
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号码' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 })
    }

    // 查询数据库并验证密码
    const admin = await findAdminByCommunityAndPhone(
      communityId.trim(),
      phone.trim(),
      password,
    )

    if (!admin) {
      return NextResponse.json(
        { error: '账号或密码错误，或该账号无管理权限' },
        { status: 401 },
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        userId: admin.id,
        communityId: admin.communityId,
        phone: admin.phone,
        role: admin.role,
        name: admin.name,
        communityName: admin.communityName,
      },
    })
  } catch (error) {
    console.error('管理员登录失败:', error)
    return NextResponse.json(
      { error: '登录服务暂时不可用，请稍后重试' },
      { status: 500 },
    )
  }
}
