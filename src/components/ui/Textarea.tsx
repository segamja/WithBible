import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-xl border border-line bg-panel px-3 py-2.5 text-ink outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-200',
        className,
      )}
      {...props}
    />
  )
}
