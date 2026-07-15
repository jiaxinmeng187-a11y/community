import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '智慧社区综合调度中心',
  description: '居委会管理端 - 工单调度与派发',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      {children}
    </div>
  )
}
