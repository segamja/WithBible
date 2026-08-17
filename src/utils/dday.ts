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

/** Calendar day in Korea, not UTC (UTC still yesterday until 09:00 KST). */
export function kstDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function todayISO(date = new Date()): string {
  return kstDayKey(date)
}

export function yesterdayISO(date = new Date()): string {
  const noonKst = new Date(`${todayISO(date)}T12:00:00+09:00`)
  return kstDayKey(new Date(noonKst.getTime() - 24 * 60 * 60 * 1000))
}

/** Posted date + time as Korea wall-clock (e.g. 8월 17일 · 오전 1:04). */
export function formatPostedAtKst(iso: string): { dateLabel: string; timeLabel: string } {
  const d = new Date(iso)
  return {
    dateLabel: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
    }).format(d),
    timeLabel: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d),
  }
}

/** Project start–end as a Korean calendar range (e.g. 8월 3일 – 8월 31일). */
export function formatProjectRange(startDate: string, endDate: string): string {
  const fmt = (iso: string) =>
    parseISO(iso).toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
    })
  return `${fmt(startDate)} – ${fmt(endDate)}`
}
