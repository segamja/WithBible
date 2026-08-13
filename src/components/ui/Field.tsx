import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-muted">{label}</label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted/80">{hint}</p> : null}
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        selected
          ? 'border-navy bg-navy text-white shadow-sm'
          : 'border-line/50 bg-brand-50 text-navy hover:border-sky hover:bg-sky-soft',
        className,
      )}
    >
      {children}
    </button>
  )
}
