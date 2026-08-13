import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Mon–Sun of current week; filled days that have a reading date */
export function WeekStreak({
  readingDates,
  today = new Date(),
}: {
  readingDates: string[]
  today?: Date
}) {
  const set = new Set(readingDates)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  return (
    <div className="flex items-center justify-between gap-1 pt-1">
      {DAY_LABELS.map((label, i) => {
        const day = addDays(weekStart, i)
        const key = format(day, 'yyyy-MM-dd')
        const done = set.has(key)
        const isFuture = day > today
        return (
          <div key={`${label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                done
                  ? 'bg-streak text-navy'
                  : isFuture
                    ? 'bg-brand-50 text-line'
                    : 'bg-brand-100 text-muted',
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </div>
            <span className="text-[11px] font-medium text-muted">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function datesInIso(dates: string[]): string[] {
  return dates.map((d) => {
    try {
      return format(parseISO(d), 'yyyy-MM-dd')
    } catch {
      return d
    }
  })
}
