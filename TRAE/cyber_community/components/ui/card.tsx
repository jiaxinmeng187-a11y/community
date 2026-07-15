"use client"

import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-lg font-semibold leading-none tracking-tight',
        className
      )}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props} />
  )
}
