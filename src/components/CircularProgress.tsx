import { cn } from '@/utils/cn'

export function CircularProgress({
  value,
  size = 168,
  stroke = 12,
  className,
  label = '진행률',
}: {
  value: number
  size?: number
  stroke?: number
  className?: string
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className={cn('relative mx-auto', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-brand-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-sky transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-4xl text-navy">{Math.round(pct)}%</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  )
}
