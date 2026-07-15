"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Building2, User, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-600 mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            智慧社区服务平台
          </h1>
          <p className="text-slate-500">
            为居民提供便捷服务，为居委会提供智能管理
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <User className="w-7 h-7 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">居民服务端</h2>
                <p className="text-sm text-slate-500">居民报修、查询进度</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              在线提交报修问题，AI自动识别问题类型与紧急程度，实时跟踪处理进度。
            </p>
            <Link href="/resident/login">
              <Button className="w-full gap-2 group-hover:gap-3 transition-all">
                进入居民端
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>

          <Card className="p-8 hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                <Building2 className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">管理调度端</h2>
                <p className="text-sm text-slate-500">工单管理、派单调度</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              全景监控社区楼栋，智能调度工单派发，高效管理社区服务。
            </p>
            <Link href="/admin">
              <Button variant="outline" className="w-full gap-2 group-hover:gap-3 transition-all">
                进入管理端
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <p>智慧社区 · 便民服务试点项目</p>
        </div>
      </div>
    </div>
  )
}
