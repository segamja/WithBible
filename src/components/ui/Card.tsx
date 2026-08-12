import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[1.35rem] border border-line/50 bg-panel p-4 shadow-[0_10px_30px_rgba(23,32,51,0.06)]',
        className,
      )}
      {...props}
    />
  )
}
