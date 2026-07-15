"use client"

import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        className
      )}
      {...props}
    />
  )
}
