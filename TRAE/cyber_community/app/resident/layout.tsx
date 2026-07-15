import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '智慧社区 - 居民服务',
  description: '社区居民报修服务平台',
}

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
