export type OfficialGoalPart = {
  bookId: string
  start: number
  end: number
}

export type GoalCoverLog = {
  user_id: string
  book_id: string
  start_chapter: number
  end_chapter: number
  reading_date?: string
  created_at?: string
  name?: string | null
}

export function dayKey(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/** Unique chapters in logs fully cover every chapter of every official part. Extra chapters beyond the goal still count. */
export function coversOfficialGoal(
  logs: Array<{ book_id: string; start_chapter: number; end_chapter: number }>,
  official: OfficialGoalPart[],
): boolean {
  if (official.length === 0) return false
  for (const part of official) {
    const covered = new Set<number>()
    for (const log of logs) {
      if (log.book_id !== part.bookId) continue
      const from = Math.min(log.start_chapter, log.end_chapter)
      const to = Math.max(log.start_chapter, log.end_chapter)
      for (let ch = from; ch <= to; ch += 1) covered.add(ch)
    }
    for (let ch = part.start; ch <= part.end; ch += 1) {
      if (!covered.has(ch)) return false
    }
  }
  return true
}

export function listGoalCompleters(
  dayLogs: GoalCoverLog[],
  official: OfficialGoalPart[],
): { user_id: string; name: string | null }[] {
  if (official.length === 0) return []
  const byUser = new Map<string, GoalCoverLog[]>()
  for (const log of dayLogs) {
    const list = byUser.get(log.user_id) ?? []
    list.push(log)
    byUser.set(log.user_id, list)
  }
  const out: { user_id: string; name: string | null }[] = []
  for (const [userId, logs] of byUser) {
    if (!coversOfficialGoal(logs, official)) continue
    out.push({ user_id: userId, name: logs.find((l) => l.name)?.name ?? null })
  }
  return out
}

/** Avoid UTC midnight shifting the calendar day when slicing the official range. */
export function readingDateAsKst(iso: string): Date {
  const day = iso.slice(0, 10)
  return new Date(`${day}T12:00:00+09:00`)
}

export function officialFingerprint(parts: OfficialGoalPart[]): string {
  return parts.map((p) => `${p.bookId}:${p.start}-${p.end}`).join('|')
}

export function listDayKeysInclusive(start: string, end: string): string[] {
  const from = dayKey(start)
  const to = dayKey(end)
  if (!from || !to) return []
  const out: string[] = []
  let ms = readingDateAsKst(from).getTime()
  const last = readingDateAsKst(to).getTime()
  while (ms <= last) {
    out.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(ms)),
    )
    ms += 24 * 60 * 60 * 1000
  }
  return out
}

/** Higher score = this log is more likely that day's official reading. */
export function scoreRangeAgainstOfficial(
  log: { book_id: string; start_chapter: number; end_chapter: number },
  official: OfficialGoalPart[],
): number {
  if (official.length === 0) return 0
  const from = Math.min(log.start_chapter, log.end_chapter)
  const to = Math.max(log.start_chapter, log.end_chapter)
  if (coversOfficialGoal([log], official)) {
    const only = official[0]
    if (
      official.length === 1 &&
      log.book_id === only.bookId &&
      from === only.start &&
      to === only.end
    ) {
      return 100
    }
    return 60
  }
  for (const part of official) {
    if (log.book_id !== part.bookId) continue
    if (from <= part.end && part.start <= to) return 10
  }
  return 0
}

export function resolveOfficialForLog<T extends OfficialGoalPart>(
  log: { book_id: string; start_chapter: number; end_chapter: number; reading_date: string },
  officialByDate: Map<string, T[]>,
): T[] {
  const own = dayKey(log.reading_date)
  const ownParts = officialByDate.get(own) ?? []
  let bestParts = ownParts
  let bestScore = scoreRangeAgainstOfficial(log, ownParts) + (ownParts.length > 0 ? 5 : 0)

  for (const [date, parts] of officialByDate) {
    if (parts.length === 0) continue
    let score = scoreRangeAgainstOfficial(log, parts)
    if (date === own) score += 5
    if (score > bestScore) {
      bestScore = score
      bestParts = parts
    }
  }
  return bestParts
}

/** Completers of a goal range, even if the log's stored date is the UTC/KST-shifted neighbor day. */
export function listGoalCompletersAnyDay(
  allLogs: GoalCoverLog[],
  official: OfficialGoalPart[],
): { user_id: string; name: string | null }[] {
  if (official.length === 0) return []
  const byUserDay = new Map<string, GoalCoverLog[]>()
  for (const log of allLogs) {
    const key = `${log.user_id}::${dayKey(log.reading_date)}`
    const list = byUserDay.get(key) ?? []
    list.push(log)
    byUserDay.set(key, list)
  }
  const seen = new Map<string, string | null>()
  for (const dayLogs of byUserDay.values()) {
    if (!coversOfficialGoal(dayLogs, official)) continue
    const userId = dayLogs[0]?.user_id
    if (!userId || seen.has(userId)) continue
    seen.set(userId, dayLogs.find((l) => l.name)?.name ?? null)
  }
  return [...seen.entries()].map(([user_id, name]) => ({ user_id, name }))
}

/** Completers of a goal using only logs posted at or before asOf (ISO timestamptz). */
export function listGoalCompletersAsOf(
  allLogs: GoalCoverLog[],
  official: OfficialGoalPart[],
  asOf: string,
): { user_id: string; name: string | null }[] {
  const cutoff = new Date(asOf).getTime()
  if (!Number.isFinite(cutoff)) return []
  return listGoalCompletersAnyDay(
    allLogs.filter((log) => {
      if (!log.created_at) return true
      const t = new Date(log.created_at).getTime()
      return Number.isFinite(t) && t <= cutoff
    }),
    official,
  )
}
