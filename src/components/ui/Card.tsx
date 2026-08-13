import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] border border-line/20 bg-panel p-5 shadow-[0_4px_20px_rgba(23,32,51,0.04)]',
        className,
      )}
      {...props}
    />
  )
}
