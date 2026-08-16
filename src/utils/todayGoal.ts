import type { BookTarget } from '@/utils/progress'
import { getTodayReadingRange } from '@/utils/schedule'

export type GoalKind = 'partial' | 'done' | 'done_extra'

export type OfficialRangePart = {
  bookId: string
  bookName: string
  start: number
  end: number
}

export type ChapterSpan = {
  start: number
  end: number
}

export type ActualReadingSpan = {
  bookId: string
  bookName: string
  start: number
  end: number
}

/** Flatten target books in sort order into one chapter sequence, then slice today's official range. */
export function getOfficialTodayParts(params: {
  startDate: string
  endDate: string
  targets: BookTarget[]
  today?: Date
}): OfficialRangePart[] {
  const chapters: Array<{ bookId: string; bookName: string; chapter: number }> = []
  const sorted = [...params.targets].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )
  for (const t of sorted) {
    for (let ch = t.startChapter; ch <= t.endChapter; ch += 1) {
      chapters.push({ bookId: t.bookId, bookName: t.bookName, chapter: ch })
    }
  }
  if (chapters.length === 0) return []

  const slice = getTodayReadingRange({
    startDate: params.startDate,
    endDate: params.endDate,
    targetStart: 1,
    targetEnd: chapters.length,
    today: params.today,
  })
  const from = Math.max(0, slice.start - 1)
  const to = Math.min(chapters.length, slice.end)
  const todayChapters = chapters.slice(from, to)
  if (todayChapters.length === 0) return []

  const parts: OfficialRangePart[] = []
  for (const row of todayChapters) {
    const last = parts[parts.length - 1]
    if (last && last.bookId === row.bookId && last.end + 1 === row.chapter) {
      last.end = row.chapter
    } else {
      parts.push({
        bookId: row.bookId,
        bookName: row.bookName,
        start: row.chapter,
        end: row.chapter,
      })
    }
  }
  return parts
}

export function formatRangeLabel(bookName: string, start: number, end: number): string {
  return start === end ? `${bookName} ${start}장` : `${bookName} ${start}–${end}장`
}

export function formatOfficialRangeLabel(parts: OfficialRangePart[]): string {
  if (parts.length === 0) return '오늘 목표'
  return parts.map((p) => formatRangeLabel(p.bookName, p.start, p.end)).join(' · ')
}

export function officialPartForBook(
  parts: OfficialRangePart[],
  bookId: string,
): OfficialRangePart | null {
  return parts.find((p) => p.bookId === bookId) ?? null
}

/** Compare one continuous actual span to today's official span. Does not merge separate logs. */
export function compareActualToTarget(
  actual: ChapterSpan,
  target: ChapterSpan,
): { kind: GoalKind; remaining: number; extra: number } {
  const extra = Math.max(0, actual.end - target.end)
  const remaining = Math.max(0, target.end - actual.end)
  if (extra > 0) return { kind: 'done_extra', remaining: 0, extra }
  if (remaining === 0) return { kind: 'done', remaining: 0, extra: 0 }
  return { kind: 'partial', remaining, extra: 0 }
}

export function formatGoalStatusCopy(params: {
  bookName: string
  actualEnd: number
  kind: GoalKind
  remaining: number
  extra: number
}): { primary: string; secondary: string } {
  const primary = `${params.bookName} ${params.actualEnd}장까지 읽었어요.`
  if (params.kind === 'partial') {
    return {
      primary,
      secondary: `오늘 목표까지 ${params.remaining}장 남았어요.`,
    }
  }
  if (params.kind === 'done_extra') {
    return {
      primary,
      secondary: `목표보다 ${params.extra}장 더 읽었어요.`,
    }
  }
  return {
    primary,
    secondary: '오늘 목표를 완성했어요.',
  }
}

export function teacherGoalStatusLabel(params: {
  kind: GoalKind | 'none'
  extra: number
}): string {
  if (params.kind === 'done') return '목표 달성'
  if (params.kind === 'done_extra') return `추가 ${params.extra}장`
  return '진행 중'
}

/** Prefer the official-book log with the highest end chapter. Separate logs are not merged. */
export function pickActualForOfficial<
  T extends { book_id: string; start_chapter: number; end_chapter: number },
>(logs: T[], official: OfficialRangePart[]): ActualReadingSpan | null {
  for (const part of official) {
    const mine = logs.filter((l) => l.book_id === part.bookId)
    if (mine.length === 0) continue
    const best = mine.reduce((a, b) => (a.end_chapter >= b.end_chapter ? a : b))
    return {
      bookId: part.bookId,
      bookName: part.bookName,
      start: best.start_chapter,
      end: best.end_chapter,
    }
  }
  return null
}

export function resolveTargetSpan(
  snapshot: { targetStart?: number | null; targetEnd?: number | null },
  official: OfficialRangePart | null,
): ChapterSpan | null {
  if (
    snapshot.targetStart != null &&
    snapshot.targetEnd != null &&
    snapshot.targetStart > 0 &&
    snapshot.targetEnd > 0
  ) {
    return { start: snapshot.targetStart, end: snapshot.targetEnd }
  }
  if (!official) return null
  return { start: official.start, end: official.end }
}

export function chapterRangesOverlap(
  a: ChapterSpan,
  b: ChapterSpan,
): boolean {
  return a.start <= b.end && b.start <= a.end
}
