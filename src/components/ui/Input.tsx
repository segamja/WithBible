import type { InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-2xl border border-line/60 bg-panel px-4 text-[15px] text-ink outline-none transition placeholder:text-muted/55',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        'disabled:bg-brand-50 disabled:text-muted',
        className,
      )}
      {...props}
    />
  )
}
