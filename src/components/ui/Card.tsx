import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.4rem] border border-line/30 bg-panel p-4 shadow-[0_6px_20px_rgba(23,32,51,0.05)]',
        className,
      )}
      {...props}
    />
  )
}
