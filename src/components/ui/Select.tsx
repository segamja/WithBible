import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-xl border border-line bg-panel px-3 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
