import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-2xl border border-line/60 bg-panel px-4 py-3 text-[15px] leading-relaxed text-ink outline-none transition placeholder:text-muted/55',
        'focus:border-navy focus:ring-2 focus:ring-navy/10',
        'disabled:bg-brand-50 disabled:text-muted',
        className,
      )}
      {...props}
    />
  )
}
