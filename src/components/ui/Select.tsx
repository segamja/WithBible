import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-12 w-full appearance-none rounded-2xl border border-line/60 bg-panel bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat px-4 pr-10 text-[15px] text-ink outline-none transition',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%2345474c%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")]',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        'disabled:bg-brand-50 disabled:text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
