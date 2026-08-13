import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

function clampChapter(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function ChapterPicker({
  label,
  value,
  min = 1,
  max,
  onChange,
  className,
}: {
  label: string
  value: string
  min?: number
  max: number
  onChange: (next: string) => void
  className?: string
}) {
  const safeMax = Math.max(min, max)
  const options = Array.from({ length: safeMax - min + 1 }, (_, i) => min + i)
  const numeric = Number(value)
  const selected =
    Number.isInteger(numeric) && numeric >= min && numeric <= safeMax ? String(numeric) : ''

  const setFromNumber = (n: number) => {
    onChange(String(clampChapter(n, min, safeMax)))
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="grid grid-cols-[minmax(3.75rem,1fr)_minmax(4.75rem,1.1fr)] gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={value}
          aria-label={label}
          placeholder={`${min}`}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || /^\d+$/.test(raw)) onChange(raw)
          }}
          onBlur={() => {
            if (value === '') {
              onChange(String(min))
              return
            }
            const n = Number(value)
            if (Number.isInteger(n)) setFromNumber(n)
          }}
          className="h-12 min-w-0 rounded-2xl border border-line/60 bg-panel px-2 text-center text-[15px] font-semibold tabular-nums tracking-tight text-navy outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10"
        />
        <div className="relative min-w-0">
          <select
            value={selected}
            aria-label={`${label} 목록`}
            onChange={(e) => {
              if (e.target.value) onChange(e.target.value)
            }}
            className="h-12 w-full appearance-none rounded-2xl border border-line/60 bg-brand-50 px-2 pr-7 text-[13px] font-semibold text-navy outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10"
          >
            {selected === '' ? <option value="">장</option> : null}
            {options.map((n) => (
              <option key={n} value={n}>
                {n}장
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </div>
    </div>
  )
}

/** Quick pick: how many chapters from the current start chapter (1장=그날 1장, 2장=시작~시작+1) */
export function ChapterSpanPicks({
  startChapter,
  maxChapter,
  selectedCount,
  onPick,
}: {
  startChapter: number
  maxChapter: number
  selectedCount?: number | null
  onPick: (count: number) => void
}) {
  const remaining = Math.max(0, maxChapter - startChapter + 1)
  const picks = [1, 2, 3, 4, 5].filter((n) => n <= remaining || n === 1)
  if (picks.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {picks.map((n) => {
        const active = selectedCount === n
        const end = Math.min(startChapter + n - 1, maxChapter)
        const disabled = startChapter > maxChapter
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            title={
              n === 1
                ? `${startChapter}장만`
                : `${startChapter}–${end}장 (${n}장)`
            }
            onClick={() => onPick(n)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold transition disabled:opacity-40',
              active
                ? 'border-navy bg-navy text-white'
                : 'border-line/50 bg-panel text-navy hover:bg-sky-soft',
            )}
          >
            {n}장
          </button>
        )
      })}
    </div>
  )
}
