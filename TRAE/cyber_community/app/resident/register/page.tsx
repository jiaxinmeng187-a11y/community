"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Building2, User, Phone, Shield, UserPlus, ArrowLeft, LogIn } from 'lucide-react'

export default function ResidentRegisterPage() {
  const router = useRouter()
  const [communityId, setCommunityId] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!communityId.trim()) {
      setError('请输入社区编号')
      return
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      setError('请输入正确的手机号码')
      return
    }
    if (!name.trim()) {
      setError('请输入您的姓名')
      return
    }
    if (name.trim().length < 2) {
      setError('姓名至少需要2个字')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId: communityId.trim(),
          phone: phone.trim(),
          name: name.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '注册失败，请稍后重试')
        setIsLoading(false)
        return
      }

      // 注册成功：自动登录
      localStorage.setItem(
        'residentUser',
        JSON.stringify({
          ...data.user,
          loginAt: new Date().toISOString(),
        }),
      )

      router.push('/resident')
    } catch {
      setError('网络异常，请检查连接后重试')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 flex items-center justify-center p-4">
      <Link
        href="/resident/login"
        className="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回登录
      </Link>

      <div className="w-full max-w-md">
        {/* 顶部图标 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">居民注册</h1>
          <p className="text-slate-500 mt-1">加入智慧社区，享受便捷服务</p>
        </div>

        {/* 注册卡片 */}
        <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {/* 错误提示 */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
              <Shield className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 社区编号 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="communityId">
              社区编号
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                id="communityId"
                type="text"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                placeholder="例如：sunshine_001"
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          {/* 姓名 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="name">
              真实姓名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入您的姓名"
                className="pl-10"
                autoComplete="name"
              />
            </div>
          </div>

          {/* 手机号码 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="phone">
              手机号码
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入您的手机号"
                className="pl-10"
                maxLength={11}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* 注册按钮 */}
          <Button
            type="submit"
            className="w-full h-12 text-base gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                注册中...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                立即注册
              </>
            )}
          </Button>

          {/* 登录入口 */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500 mb-2">已有账号？</p>
            <Link href="/resident/login">
              <Button variant="outline" type="button" className="w-full gap-2">
                <LogIn className="w-4 h-4" />
                前往登录
              </Button>
            </Link>
          </div>

          {/* 底部说明 */}
          <p className="mt-4 text-xs text-slate-400 text-center">
            注册后即可使用社区报修、进度查询等服务
          </p>
        </form>

        {/* 装饰 */}
        <div className="mt-6 flex justify-center gap-2">
          <User className="w-4 h-4 text-slate-300" />
          <span className="text-xs text-slate-300">居民端专属入口</span>
          <User className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    </div>
  )
}
