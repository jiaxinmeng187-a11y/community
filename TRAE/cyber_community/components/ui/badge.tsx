"use client"

import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'high' | 'mid' | 'low'
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-700',
    high: 'bg-red-100 text-red-700',
    mid: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  }
  
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}
