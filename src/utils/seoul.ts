const SEOUL = 'Asia/Seoul'

export function seoulDateParts(date = new Date()): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Start of the current calendar day in Asia/Seoul, as ISO (timestamptz). */
export function seoulTodayStartIso(date = new Date()): string {
  const { year, month, day } = seoulDateParts(date)
  return new Date(`${year}-${month}-${day}T00:00:00+09:00`).toISOString()
}

export function formatSeoulTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: SEOUL,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function cheerPreview(content: string, max = 42): string {
  const line = content.replace(/\s+/g, ' ').trim()
  if (line.length <= max) return line
  return `${line.slice(0, max)}…`
}

export function formatSeoulDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: SEOUL,
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
