import { cn } from '@/utils/cn'

interface ProgressBarProps {
  value: number
  className?: string
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-3.5 w-full overflow-hidden rounded-full bg-brand-100', className)}>
      <div
        className="h-full rounded-full bg-sage transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
