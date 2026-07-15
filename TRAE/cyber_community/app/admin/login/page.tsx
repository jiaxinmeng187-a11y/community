'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function AdminLoginPage() {
  const router = useRouter()
  const [communityId, setCommunityId] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!communityId.trim()) {
      setError('请输入社区编号')
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号码')
      return
    }
    if (!password || password.length < 6) {
      setError('密码至少6位')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId: communityId.trim(), phone, password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || '登录失败')
        return
      }

      localStorage.setItem('adminUser', JSON.stringify(data.user))
      router.push('/admin')
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-amber-50 to-slate-200 p-4">
      <Card className="w-full max-w-sm shadow-xl border-slate-200/80">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold text-slate-800">
            🔐 管理端登录
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">赛博居委会 · 智慧社区综合调度中心</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">小区编号</label>
              <Input
                type="text"
                placeholder="如 sunshine_001"
                value={communityId}
                onChange={(e) => setCommunityId(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">管理员手机号</label>
              <Input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={11}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">管理密码</label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full bg-slate-800 hover:bg-slate-700 text-white',
                loading && 'opacity-70',
              )}
            >
              {loading ? '登录中...' : '登录管理端'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
