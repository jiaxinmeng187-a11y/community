"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const CommunityMap3D = dynamic(() => import('@/components/3d/CommunityMap3D').then(m => m.CommunityMap3D), { ssr: false })
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Building2, User, Clock, AlertTriangle, CheckCircle, Settings, Bell, LogOut } from 'lucide-react'

interface Ticket {
  id: string
  buildingName: string | null
  buildingId: string | null
  unitNumber: string | null
  apartmentNumber: string | null
  reporterName: string | null
  description: string | null
  imageUrl: string | null
  aiSeverity: string
  status: string
  createdAt: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [focusTicketId, setFocusTicketId] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [assignTicketId, setAssignTicketId] = useState<string | null>(null)
  const [workerId, setWorkerId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // 登录鉴权：未登录则跳转登录页
  useEffect(() => {
    const stored = localStorage.getItem('adminUser')
    if (!stored) {
      router.replace('/admin/login')
      return
    }
    try {
      const user = JSON.parse(stored)
      if (user.role !== 'admin') {
        localStorage.removeItem('adminUser')
        router.replace('/admin/login')
        return
      }
      setAdminName(user.name || '管理员')
      setIsAuthReady(true) // 鉴权通过后才渲染管理端
    } catch {
      localStorage.removeItem('adminUser')
      router.replace('/admin/login')
    }
  }, [router])

  useEffect(() => {
    fetch('/api/tickets?communityId=sunshine_001')
      .then(r => r.json())
      .then(d => {
        if (d.success) setTickets(d.tickets)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])
  
  const pendingTickets = tickets.filter(t => t.status === 'pending')
  const processingTickets = tickets.filter(t => t.status === 'processing')
  const doneTickets = tickets.filter(t => t.status === 'done')

  const handleViewDetail = (ticketId: string) => {
    setFocusTicketId(ticketId)
  }

  const handleAssign = async () => {
    if (!workerId.trim()) { alert('请输入工号'); return }
    setAssignLoading(true)
    try {
      const res = await fetch('/api/tickets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: assignTicketId, workerId: workerId.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        alert('派单失败：' + (data.error || '未知错误'))
        return
      }
      // 刷新工单列表
      setTickets(prev => prev.map(t =>
        t.id === assignTicketId ? { ...t, status: 'processing' } : t,
      ))
      setAssignTicketId(null)
      setWorkerId('')
    } catch {
      alert('网络异常，请稍后重试')
    } finally {
      setAssignLoading(false)
    }
  }

  const severityConfig: Record<string, { variant: 'high' | 'mid' | 'low'; label: string; icon: typeof AlertTriangle }> = {
    high: { variant: 'high', label: '紧急', icon: AlertTriangle },
    mid: { variant: 'mid', label: '中等', icon: Bell },
    low: { variant: 'low', label: '轻微', icon: CheckCircle },
  }

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">智慧社区综合调度中心</h1>
              <p className="text-sm text-slate-500">居委会管理端</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
              {adminName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('adminUser')
                router.replace('/admin/login')
              }}
            >
              <LogOut className="w-4 h-4 mr-1" />
              退出
            </Button>
            <div className="relative">
              <Button variant="ghost" size="sm">
                <Bell className="w-4 h-4" />
              </Button>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingTickets.length}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-4">
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">待处理</p>
                  <p className="text-2xl font-bold text-red-600">{pendingTickets.length}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">处理中</p>
                  <p className="text-2xl font-bold text-amber-600">{processingTickets.length}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">已完成</p>
                  <p className="text-2xl font-bold text-green-600">{doneTickets.length}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">总工单</p>
                  <p className="text-2xl font-bold text-slate-700">{tickets.length}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </header>

      <Card className="flex flex-col md:flex-row h-[calc(100vh-280px)] md:h-[calc(100vh-220px)] shadow-xl overflow-hidden">
        <div className="flex-[7] min-h-[300px] md:min-h-0 border-b md:border-b-0 md:border-r border-slate-200">
          <CommunityMap3D role="admin" tickets={tickets} focusTicketId={focusTicketId} onFocusComplete={() => setFocusTicketId(null)} />
        </div>

        <div className="flex-[3] flex flex-col bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary-600" />
                工单调度与派发
              </span>
              <Badge variant="high" className="px-2 py-1">
                {pendingTickets.length} 待处理
              </Badge>
            </CardTitle>
            <p className="text-sm text-slate-500">点击派单按钮分配给工作人员</p>
          </CardHeader>

          <ScrollArea className="flex-1 p-4 space-y-3">
            {pendingTickets.map((ticket) => {
              const severity = severityConfig[ticket.aiSeverity] || severityConfig.low
              const SeverityIcon = severity.icon
              const timeStr = ticket.createdAt
                ? new Date(ticket.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : ''
              
              return (
                <div
                  key={ticket.id}
                  className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={severity.variant}>
                        <SeverityIcon className="w-3 h-3 mr-1" />
                        AI评估：{severity.label}
                      </Badge>
                    </div>
                    {timeStr && <span className="text-xs text-slate-400">{timeStr}</span>}
                  </div>
                  
                  <p className="text-sm text-slate-700 mb-3 line-clamp-2">{ticket.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      <span>
                        {ticket.buildingName || '未知楼栋'}
                        {ticket.unitNumber && ticket.apartmentNumber
                          ? ` ${ticket.unitNumber}单元${ticket.apartmentNumber}`
                          : ticket.apartmentNumber
                            ? ` ${ticket.apartmentNumber}`
                            : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{ticket.reporterName || '未知'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewDetail(ticket.id)}>
                      查看详情
                    </Button>
                    {ticket.status === 'pending' && (
                      <Button size="sm" className="flex-1" onClick={() => setAssignTicketId(ticket.id)}>
                        派单
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            
            {pendingTickets.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <CheckCircle className="w-12 h-12 mb-2" />
                <p>暂无待处理工单</p>
              </div>
            )}
            
            {loading && (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <p>加载中...</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </Card>

      {/* 派单对话框 */}
      {assignTicketId && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={() => { setAssignTicketId(null); setWorkerId('') }}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-w-[90vw] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-lg">派发工单</h3>
              <button
                onClick={() => { setAssignTicketId(null); setWorkerId('') }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <label className="block text-sm text-slate-600 mb-1.5">工作人员工号</label>
            <input
              type="text"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              placeholder="请输入工号"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAssign() }}
            />

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setAssignTicketId(null); setWorkerId('') }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAssign}
                disabled={assignLoading}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {assignLoading ? '派单中...' : '确认派单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
