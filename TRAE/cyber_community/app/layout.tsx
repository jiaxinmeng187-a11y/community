import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '智慧社区服务平台',
  description: '为居民提供便捷的报修服务，为居委会提供智能调度管理',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-800 antialiased">
        {children}
      </body>
    </html>
  )
}
