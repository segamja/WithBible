import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'

export function getDDayLabel(endDate: string, today = new Date()): string {
  const end = startOfDay(parseISO(endDate))
  const now = startOfDay(today)
  const diff = differenceInCalendarDays(end, now)

  if (diff === 0) return '오늘은 완주 DAY!'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

export function getDDayNumber(endDate: string, today = new Date()): number {
  const end = startOfDay(parseISO(endDate))
  const now = startOfDay(today)
  return differenceInCalendarDays(end, now)
}

export function todayISO(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}
