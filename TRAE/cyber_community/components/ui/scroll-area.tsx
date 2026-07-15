"use client"

import { cn } from '@/lib/utils'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div
      className={cn('relative overflow-auto rounded-lg', className)}
      {...props}
    >
      {children}
    </div>
  )
}
