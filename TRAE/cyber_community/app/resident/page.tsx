"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const CommunityMap3D = dynamic(() => import('@/components/3d/CommunityMap3D').then(m => m.CommunityMap3D), { ssr: false })
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Upload, Send, MessageCircle, User, LogOut, X, Image, AlertTriangle } from 'lucide-react'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  imageUrl?: string | null
  imageBase64?: string | null
  identified?: boolean
  title?: string | null
  summary?: string | null
  severity?: string | null
  reportStatus?: 'idle' | 'reported'
}

export interface ReportedTicket {
  id: string
  description: string
  posX: number
  posZ: number
  buildingName: string
  severity: string
}

interface ResidentInfo {
  buildingName: string
  posX: number
  posZ: number
  unitNumber: string | null
  apartmentNumber: string | null
  displayName: string
}

interface AuthUser {
  id: string
  communityId: string
  buildingId: string | null
  buildingName: string
}

const initialMessages: Message[] = [
  {
    id: '1',
    content: '您好！我是社区服务助手，有什么可以帮您的？您可以上传图片让我帮您识别分析社区问题。',
    isUser: false,
    timestamp: new Date(),
  },
]

export default function ResidentPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [selectedImage, setSelectedImage] = useState<{
    file: File
    preview: string
    base64: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [residentInfo, setResidentInfo] = useState<ResidentInfo | null>(null)
  const [reportedTickets, setReportedTickets] = useState<ReportedTicket[]>([])
  const [residentTickets, setResidentTickets] = useState<Array<{
    id: string
    title: string | null
    description: string | null
    buildingName: string | null
    aiSeverity: string
    status: string
    createdAt: string | null
  }>>([])
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Ref 存储 residentInfo 和 authUser 的最新值，避免闭包问题
  const residentInfoRef = useRef<ResidentInfo | null>(null)
  const authUserRef = useRef<AuthUser | null>(null)

  /** 从后端加载用户的报修历史 */
  const fetchTickets = async (
    userId: string,
    communityId: string,
    info: ResidentInfo,
  ) => {
    try {
      const res = await fetch(
        `/api/tickets?reporterId=${encodeURIComponent(userId)}&communityId=${encodeURIComponent(communityId)}`,
      )
      const data = await res.json()
      if (data.success && data.tickets) {
        setResidentTickets(data.tickets)
      }
    } catch {
      console.error('加载报修记录失败')
    }
  }

  // 登录鉴权
  useEffect(() => {
    try {
      const user = localStorage.getItem('residentUser')
      if (!user) {
        router.replace('/resident/login')
        return
      }
      const parsed = JSON.parse(user)
      if (parsed.role !== 'resident') {
        localStorage.removeItem('residentUser')
        router.replace('/resident/login')
        return
      }

      // 构造居民信息
      const info: ResidentInfo = parsed.buildingName && parsed.posX != null && parsed.posZ != null
        ? {
            buildingName: parsed.buildingName,
            posX: parsed.posX as number,
            posZ: parsed.posZ as number,
            unitNumber: parsed.unitNumber ?? null,
            apartmentNumber: parsed.apartmentNumber ?? null,
            displayName: parsed.name ?? '居民',
          }
        : {
            buildingName: '',
            posX: 0,
            posZ: 0,
            unitNumber: null,
            apartmentNumber: null,
            displayName: parsed.name ?? '居民',
          }

      const user2: AuthUser = {
        id: parsed.userId ?? '',
        communityId: parsed.communityId ?? 'sunshine_001',
        buildingId: parsed.buildingId ?? null,
        buildingName: parsed.buildingName ?? '',
      }

      // 同步写入 state 和 ref
      setResidentInfo(info)
      residentInfoRef.current = info
      setAuthUser(user2)
      authUserRef.current = user2
      setIsAuthReady(true)

      // 加载历史报修记录（直接传 info，不依赖 state）
      fetchTickets(user2.id, user2.communityId, info)
    } catch {
      router.replace('/resident/login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // 保持 ref 与 state 同步
  useEffect(() => { residentInfoRef.current = residentInfo }, [residentInfo])
  useEffect(() => { authUserRef.current = authUser }, [authUser])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  /** 处理图片选择 */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return }
    if (file.size > 10 * 1024 * 1024) { alert('图片大小不能超过 10MB'); return }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? result
      setSelectedImage({ file, preview: result, base64 })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  /** 一键上报 */
  const handleReport = async (messageId: string, title: string, summary: string, severity: string) => {
    const info = residentInfoRef.current
    const user = authUserRef.current
    if (!info || !user) {
      alert('用户信息未加载，请刷新页面后重试')
      return
    }

    // 查找关联的用户消息中的图片 base64（取该 AI 消息前最近的用户消息）
    const msgIndex = messages.findIndex(m => m.id === messageId)
    let imageBase64: string | null = null
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].isUser && messages[i].imageBase64) {
        imageBase64 = messages[i].imageBase64
        break
      }
    }

    // 1. 写数据库
    try {
      const safeTitle = (title || summary).slice(0, 50)
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId: user.communityId,
          reporterId: user.id,
          buildingId: user.buildingId,
          unitNumber: info.unitNumber,
          apartmentNumber: info.apartmentNumber,
          title: safeTitle,
          description: summary,
          imageBase64,
          aiSeverity: severity,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        alert('上报失败：' + (data.error || '未知错误'))
        return
      }
    } catch {
      alert('网络异常，请稍后重试')
      return
    }

    // 2. 更新消息状态
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId ? { ...m, reportStatus: 'reported' as const } : m,
      ),
    )

    // 3. 刷新报修记录
    await fetchTickets(user.id, user.communityId, info)

    // 4. 3D 气泡
    const newTicket: ReportedTicket = {
      id: Date.now().toString(),
      description: title || summary,
      posX: info.posX,
      posZ: info.posZ,
      buildingName: info.buildingName,
      severity,
    }
    setReportedTickets(prev => [...prev, newTicket])
  }

  /** 发送消息 */
  const handleSend = async () => {
    const hasText = inputValue.trim().length > 0
    const hasImage = selectedImage !== null
    if (!hasText && !hasImage) return
    if (isSubmitting) return

    setIsSubmitting(true)

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
      imageUrl: selectedImage?.preview ?? null,
      imageBase64: selectedImage?.base64 ?? null,
    }
    setMessages(prev => [...prev, userMessage])

    const currentText = inputValue.trim()
    const currentImage = selectedImage
    setInputValue('')
    setSelectedImage(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentText,
          imageBase64: currentImage?.base64 ?? null,
        }),
      })
      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.reply ?? '抱歉，服务暂时不可用，请稍后重试。',
        isUser: false,
        timestamp: new Date(),
        identified: data.identified ?? false,
        title: data.title ?? null,
        summary: data.summary ?? null,
        severity: data.severity ?? null,
        reportStatus: data.identified ? 'idle' : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: '网络异常，请检查连接后重试。',
        isUser: false,
        timestamp: new Date(),
      }])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* 顶部栏 */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">社区服务平台</h1>
            <p className="text-xs text-slate-500">居民端</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">
            欢迎回家，{residentInfo?.displayName ?? '居民'}
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('residentUser')
              router.replace('/resident/login')
            }}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-red-600 transition-colors"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 3D 地图 */}
        <div className="flex-1 h-[40vh] md:h-full">
          <CommunityMap3D
            role="resident"
            residentInfo={residentInfo}
            reportedTickets={reportedTickets}
            residentTickets={residentTickets}
          />
        </div>

        {/* 社区助手聊天面板 */}
        <div className="h-[60vh] md:h-full md:w-96 glass-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-slate-200 bg-primary-600">
            <MessageCircle className="w-5 h-5 text-white mr-2" />
            <span className="font-semibold text-white">社区助手</span>
            <span className="ml-auto text-xs text-white/70 bg-white/20 px-2 py-0.5 rounded">
              AI 视觉识别
            </span>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-4 py-3',
                    message.isUser
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none',
                  )}
                >
                  {message.imageUrl && (
                    <div className="mb-2 rounded-md overflow-hidden border border-white/20">
                      <img
                        src={message.imageUrl}
                        alt="上传的图片"
                        className="max-w-full max-h-48 object-contain"
                      />
                    </div>
                  )}
                  {message.content && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p
                    className={`text-xs mt-1.5 ${
                      message.isUser ? 'text-white/60' : 'text-slate-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* 一键上报按钮 */}
                {!message.isUser && message.identified && message.reportStatus === 'idle' && message.summary && (
                  <button
                    onClick={() => handleReport(message.id, message.title ?? message.summary!, message.summary!, message.severity ?? 'high')}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    {message.title ? `一键上报：${message.title}` : '一键上报给居委会'}
                  </button>
                )}

                {/* 已上报标记 */}
                {!message.isUser && message.reportStatus === 'reported' && (
                  <span className="mt-1.5 text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    已上报至居委会
                  </span>
                )}
              </div>
            ))}

            {/* 加载指示器 */}
            {isSubmitting && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg rounded-bl-none px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-slate-400">AI 正在分析...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="p-4 border-t border-slate-200 bg-white/50">
            {selectedImage && (
              <div className="mb-3 relative inline-block">
                <img
                  src={selectedImage.preview}
                  alt="已选图片"
                  className="max-h-32 rounded-lg border border-slate-200 object-contain"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="移除图片"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="mb-2 text-xs text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              上传图片或描述问题，AI 助手将自动识别并为您分析
            </div>

            <div className="flex flex-col gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedImage
                    ? '补充问题描述（可选）...'
                    : '请描述您遇到的问题，或上传图片让我帮您识别...'
                }
                className="resize-none"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-primary-600 transition-colors">
                  {selectedImage ? (
                    <>
                      <Image className="w-4 h-4 text-primary-600" />
                      <span className="text-primary-600">已选择图片</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>上传图片</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
                <Button
                  onClick={handleSend}
                  disabled={isSubmitting || (!inputValue.trim() && !selectedImage)}
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? '分析中...' : '发送'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
