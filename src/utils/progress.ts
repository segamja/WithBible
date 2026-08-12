export interface ChapterRange {
  start: number
  end: number
}

/** Unique chapters covered within [targetStart, targetEnd] */
export function uniqueCoveredChapters(
  ranges: ChapterRange[],
  targetStart: number,
  targetEnd: number,
): number {
  const set = new Set<number>()
  for (const range of ranges) {
    const from = Math.max(range.start, targetStart)
    const to = Math.min(range.end, targetEnd)
    for (let ch = from; ch <= to; ch += 1) {
      set.add(ch)
    }
  }
  return set.size
}

export function targetChapterCount(start: number, end: number): number {
  return Math.max(0, end - start + 1)
}

export function achievementRate(
  ranges: ChapterRange[],
  targetStart: number,
  targetEnd: number,
): number {
  const target = targetChapterCount(targetStart, targetEnd)
  if (target === 0) return 0
  const covered = uniqueCoveredChapters(ranges, targetStart, targetEnd)
  return Math.round((covered / target) * 100)
}

export function personalCoveredChapters(ranges: ChapterRange[]): number {
  const set = new Set<number>()
  for (const range of ranges) {
    for (let ch = range.start; ch <= range.end; ch += 1) {
      set.add(ch)
    }
  }
  return set.size
}

export function daysSince(dateISO: string | null, today = new Date()): number | null {
  if (!dateISO) return null
  const then = new Date(`${dateISO}T00:00:00`)
  const now = new Date(today.toISOString().slice(0, 10) + 'T00:00:00')
  return Math.floor((now.getTime() - then.getTime()) / 86400000)
}

export function participationStatus(
  lastReadingDate: string | null,
  today = new Date(),
): 'green' | 'yellow' | 'red' {
  const days = daysSince(lastReadingDate, today)
  if (days === null) return 'red'
  if (days <= 1) return 'green'
  if (days <= 3) return 'yellow'
  return 'red'
}
