import { NextRequest, NextResponse } from 'next/server'
import { createProfile, findProfileByPhone, findProfileByCommunityAndPhone } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { communityId, phone, name } = body

    // 参数校验
    if (!communityId || typeof communityId !== 'string' || !communityId.trim()) {
      return NextResponse.json({ error: '请输入社区编号' }, { status: 400 })
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入正确的手机号码' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请输入您的姓名' }, { status: 400 })
    }

    // 检查同一社区下是否已注册过该手机号
    const existing = await findProfileByCommunityAndPhone(
      communityId.trim(),
      phone.trim(),
    )
    if (existing) {
      return NextResponse.json(
        { error: '该手机号已在本社区注册，请直接登录' },
        { status: 409 },
      )
    }

    // 检查该手机号是否在其他社区已注册（可选：提示用户）
    const otherCommunityUser = await findProfileByPhone(phone.trim())
    if (otherCommunityUser) {
      return NextResponse.json(
        { error: `该手机号已在社区 "${otherCommunityUser.community_id}" 注册，不可重复注册` },
        { status: 409 },
      )
    }

    // 创建用户
    const crypto = await import('crypto')
    const userId = crypto.randomUUID()
    const profile = await createProfile({
      id: userId,
      communityId: communityId.trim(),
      name: name.trim(),
      phone: phone.trim(),
    })

    return NextResponse.json({
      success: true,
      user: {
        userId: profile.id,
        communityId: profile.community_id,
        phone: profile.phone,
        role: profile.role,
        name: profile.name,
        buildingId: null,
        buildingName: null,
        posX: null,
        posZ: null,
        unitNumber: null,
        apartmentNumber: null,
      },
    })
  } catch (error) {
    console.error('注册失败:', error)
    return NextResponse.json(
      { error: '注册服务暂时不可用，请稍后重试' },
      { status: 500 },
    )
  }
}
