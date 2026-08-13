export interface ChapterRange {
  start: number
  end: number
}

export interface BookChapterLog {
  book_id: string
  start_chapter: number
  end_chapter: number
}

export interface BookTarget {
  bookId: string
  bookName: string
  startChapter: number
  endChapter: number
  sortOrder?: number
}

export interface BookProgressRow {
  bookId: string
  bookName: string
  startChapter: number
  endChapter: number
  covered: number
  target: number
  rate: number
}

/** Unique chapters covered within [targetStart, targetEnd] (single book, legacy) */
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

/** Multi-book: unique (bookId, chapter) pairs within each target range */
export function progressAgainstTargets(
  logs: BookChapterLog[],
  targets: BookTarget[],
): {
  covered: number
  target: number
  rate: number
  byBook: BookProgressRow[]
  goalLabel: string
  readUpToLabel: string
} {
  const byBook: BookProgressRow[] = targets.map((t) => {
    const set = new Set<number>()
    for (const log of logs) {
      if (log.book_id !== t.bookId) continue
      const from = Math.max(log.start_chapter, t.startChapter)
      const to = Math.min(log.end_chapter, t.endChapter)
      for (let ch = from; ch <= to; ch += 1) set.add(ch)
    }
    const target = targetChapterCount(t.startChapter, t.endChapter)
    const covered = set.size
    return {
      bookId: t.bookId,
      bookName: t.bookName,
      startChapter: t.startChapter,
      endChapter: t.endChapter,
      covered,
      target,
      rate: target === 0 ? 0 : Math.round((covered / target) * 100),
    }
  })

  const covered = byBook.reduce((s, b) => s + b.covered, 0)
  const target = byBook.reduce((s, b) => s + b.target, 0)
  const goalLabel =
    byBook.length === 0
      ? '목표 미설정'
      : byBook.length === 1
        ? `${byBook[0].bookName} ${byBook[0].startChapter}~${byBook[0].endChapter}장`
        : byBook.map((b) => b.bookName).join(' · ')

  const readParts = byBook
    .filter((b) => b.covered > 0)
    .map((b) => {
      if (b.covered >= b.target) return `${b.bookName} 완료`
      // Contiguous-from-start estimate: start + covered - 1
      const upTo = Math.min(b.startChapter + b.covered - 1, b.endChapter)
      return `${b.bookName} ${upTo}장까지`
    })
  const readUpToLabel =
    readParts.length === 0 ? '아직 인증한 장이 없어요' : readParts.join(' · ')

  return {
    covered,
    target,
    rate: target === 0 ? 0 : Math.round((covered / target) * 100),
    byBook,
    goalLabel,
    readUpToLabel,
  }
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
