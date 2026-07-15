"use client"

import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  
  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }
  
  const sizeStyles = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  }
  
  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    />
  )
}
