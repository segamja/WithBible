import { differenceInCalendarDays, parseISO, startOfDay, subDays, format } from 'date-fns'
import { todayISO } from '@/utils/dday'

export function greetingPartsForNow(name: string, now = new Date()): { period: string; name: string } {
  const hour = now.getHours()
  const short = name.trim() || '친구'
  const period = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return { period, name: short }
}

export function greetingForNow(name: string, now = new Date()): string {
  const { period, name: short } = greetingPartsForNow(name, now)
  return `${period}, ${short}`
}

/** Distribute target chapters evenly across project days (no backlog carry). */
export function getTodayReadingRange(params: {
  startDate: string
  endDate: string
  targetStart: number
  targetEnd: number
  today?: Date
}): { start: number; end: number; dayIndex: number; totalDays: number; chaptersToday: number } {
  const today = startOfDay(params.today ?? new Date())
  const start = startOfDay(parseISO(params.startDate))
  const end = startOfDay(parseISO(params.endDate))
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1)
  const totalChapters = Math.max(0, params.targetEnd - params.targetStart + 1)
  let dayIndex = differenceInCalendarDays(today, start)
  if (dayIndex < 0) dayIndex = 0
  if (dayIndex > totalDays - 1) dayIndex = totalDays - 1

  const base = Math.floor(totalChapters / totalDays)
  const remainder = totalChapters % totalDays

  let offset = 0
  for (let d = 0; d < dayIndex; d += 1) {
    offset += base + (d < remainder ? 1 : 0)
  }
  const chaptersToday = Math.max(1, base + (dayIndex < remainder ? 1 : 0))
  const rangeStart = Math.min(params.targetStart + offset, params.targetEnd)
  const rangeEnd = Math.min(rangeStart + chaptersToday - 1, params.targetEnd)

  return {
    start: rangeStart,
    end: rangeEnd,
    dayIndex,
    totalDays,
    chaptersToday: Math.max(0, rangeEnd - rangeStart + 1),
  }
}

export function calcPersonalStreak(readingDates: string[], today = todayISO()): number {
  const set = new Set(readingDates)
  let cursor = today
  if (!set.has(cursor)) {
    cursor = format(subDays(parseISO(today), 1), 'yyyy-MM-dd')
    if (!set.has(cursor)) return 0
  }
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = format(subDays(parseISO(cursor), 1), 'yyyy-MM-dd')
  }
  return streak
}

/** Class streak: consecutive days with at least one check-in in the class. */
export function calcClassStreak(classReadingDates: string[], today = todayISO()): number {
  return calcPersonalStreak(classReadingDates, today)
}
