import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import { listClassLogs, listProjectLogs } from '@/services/readingService'
import { listClassStudents, listClasses } from '@/services/classService'
import {
  getProject,
  getProjectClass,
  listProjectClasses,
  listProjectTargets,
} from '@/services/projectService'
import type { ClassProgress, ReadingLog, StudentStatus } from '@/types'
import {
  participationStatus,
  progressAgainstTargets,
  type BookTarget,
} from '@/utils/progress'
import { todayISO } from '@/utils/dday'
import { computeClassWarmth } from '@/lib/reactions'
import { subDays } from 'date-fns'
import {
  compareActualToTarget,
  formatOfficialRangeLabel,
  formatRangeLabel,
  getOfficialTodayParts,
  pickActualForOfficial,
  resolveTargetSpan,
} from '@/utils/todayGoal'

export async function getReadingTargets(
  projectId: string,
  classId?: string | null,
): Promise<BookTarget[]> {
  const rows = await listProjectTargets(projectId)
  if (rows.length > 0) {
    return rows.map((r) => ({
      bookId: r.book_id,
      bookName: r.bible_books?.name ?? '성경',
      startChapter: r.start_chapter,
      endChapter: r.end_chapter,
      sortOrder: r.sort_order,
    }))
  }

  // Legacy fallback: per-class single book
  if (classId) {
    const pc = await getProjectClass(projectId, classId)
    if (pc) {
      return [
        {
          bookId: pc.target_book_id,
          bookName: pc.bible_books?.name ?? '성경',
          startChapter: pc.target_start_chapter,
          endChapter: pc.target_end_chapter,
        },
      ]
    }
  }

  const pcs = await listProjectClasses(projectId)
  if (pcs[0]) {
    return [
      {
        bookId: pcs[0].target_book_id,
        bookName: pcs[0].bible_books?.name ?? '성경',
        startChapter: pcs[0].target_start_chapter,
        endChapter: pcs[0].target_end_chapter,
      },
    ]
  }
  return []
}

export async function getClassProgress(
  projectId: string,
  classId: string,
  className: string,
): Promise<ClassProgress> {
  const students = await listClassStudents(classId)
  const studentIds = students.map((s) => s.id)
  const logs = await listClassLogs(projectId, studentIds)
  const targets = await getReadingTargets(projectId, classId)
  const targetChapters = progressAgainstTargets([], targets).target

  // 반 진행률 = 학생별 개인 달성률(%)의 산술평균
  let sumRate = 0
  let sumCovered = 0
  for (const student of students) {
    const mine = logs.filter((l) => l.user_id === student.id)
    const prog = progressAgainstTargets(mine, targets)
    sumRate += prog.rate
    sumCovered += prog.covered
  }
  const n = students.length
  const achievementRate = n === 0 ? 0 : Math.round(sumRate / n)
  const coveredChapters = n === 0 ? 0 : Math.round(sumCovered / n)

  const participated = new Set(logs.map((l) => l.user_id)).size
  const today = todayISO()
  const weekStart = todayISO(subDays(new Date(), 6))
  const todayCheckins = new Set(
    logs.filter((l) => l.reading_date === today).map((l) => l.user_id),
  ).size
  const weekCheckins = new Set(
    logs.filter((l) => l.reading_date >= weekStart).map((l) => l.user_id),
  ).size

  return {
    classId,
    className,
    studentCount: n,
    participatedCount: participated,
    participationRate: n === 0 ? 0 : Math.round((participated / n) * 100),
    coveredChapters,
    targetChapters,
    achievementRate,
    todayCheckins,
    weekCheckins,
  }
}

export async function getStudentStatuses(
  projectId: string,
  classId: string,
): Promise<StudentStatus[]> {
  const students = await listClassStudents(classId)
  const logs = await listClassLogs(
    projectId,
    students.map((s) => s.id),
  )
  const targets = await getReadingTargets(projectId, classId)
  const project = await getProject(projectId)
  const today = todayISO()
  const official = project
    ? getOfficialTodayParts({
        startDate: project.start_date,
        endDate: project.end_date,
        targets,
      })
    : []
  const todayTargetLabel = formatOfficialRangeLabel(official)

  return students.map((student) => {
    const mine = logs.filter((l) => l.user_id === student.id)
    const last = mine
      .map((l) => l.reading_date)
      .sort()
      .at(-1) ?? null
    const prog = progressAgainstTargets(mine, targets)
    const todayLogs = mine.filter((l) => l.reading_date === today)
    const actual = pickActualForOfficial(todayLogs, official)
    let todayGoalKind: StudentStatus['todayGoalKind'] = 'none'
    let todayExtraChapters = 0
    let todayActualLabel: string | null = null
    if (actual) {
      todayActualLabel = formatRangeLabel(actual.bookName, actual.start, actual.end)
      const part = official.find((p) => p.bookId === actual.bookId) ?? null
      const logRow = todayLogs.find(
        (l) =>
          l.book_id === actual.bookId &&
          l.start_chapter === actual.start &&
          l.end_chapter === actual.end,
      )
      const target = resolveTargetSpan(
        {
          targetStart: logRow?.target_start_chapter,
          targetEnd: logRow?.target_end_chapter,
        },
        part,
      )
      if (target) {
        const cmp = compareActualToTarget(
          { start: actual.start, end: actual.end },
          target,
        )
        todayGoalKind = cmp.kind
        todayExtraChapters = cmp.extra
      }
    }
    return {
      userId: student.id,
      name: student.name,
      lastReadingDate: last,
      totalChapters: prog.covered,
      status: participationStatus(last),
      todayActualLabel,
      todayTargetLabel,
      todayGoalKind,
      todayExtraChapters,
    }
  })
}

export async function getPersonalProgress(
  projectId: string,
  userId: string,
  classId: string | null,
): Promise<{
  covered: number
  target: number
  rate: number
  bookName: string
  goalLabel: string
  readUpToLabel: string
  byBook: Array<
    ReturnType<typeof progressAgainstTargets>['byBook'][number] & {
      maxChapter: number
      nextChapter: number
    }
  >
}> {
  const targets = await getReadingTargets(projectId, classId)
  const logs = await listClassLogs(projectId, [userId])
  const prog = progressAgainstTargets(logs, targets)

  // Exact "read up to" / resume chapter from max end_chapter per target book
  const byBook = prog.byBook.map((b) => {
    let maxCh = 0
    for (const log of logs) {
      if (log.book_id !== b.bookId) continue
      const to = Math.min(log.end_chapter, b.endChapter)
      if (to >= b.startChapter) maxCh = Math.max(maxCh, to)
    }
    const nextChapter =
      maxCh === 0
        ? b.startChapter
        : maxCh >= b.endChapter
          ? b.endChapter
          : maxCh + 1
    return { ...b, maxChapter: maxCh, nextChapter }
  })

  const readParts = byBook
    .map((b) => {
      if (b.maxChapter === 0) return null
      if (b.covered >= b.target) return `${b.bookName} 완료`
      return `${b.bookName} ${b.maxChapter}장까지`
    })
    .filter((x): x is string => Boolean(x))

  return {
    covered: prog.covered,
    target: prog.target,
    rate: prog.rate,
    bookName: prog.goalLabel,
    goalLabel: prog.goalLabel,
    readUpToLabel:
      readParts.length === 0 ? '아직 인증한 장이 없어요' : readParts.join(' · '),
    byBook,
  }
}

/** Prefer security-definer RPC so all roles see every class fairly */
export async function getAdminOverview(projectId: string): Promise<{
  classCount: number
  studentCount: number
  todayCheckins: number
  avgParticipation: number
  avgAchievement: number
  classes: ClassProgress[]
}> {
  const { data, error } = await supabase.rpc('wb_get_classes_progress', {
    p_project_id: projectId,
  })

  if (!error && Array.isArray(data)) {
    const progresses: ClassProgress[] = data.map((row: Record<string, unknown>) => ({
      classId: String(row.class_id),
      className: String(row.class_name),
      studentCount: Number(row.student_count) || 0,
      participatedCount: Number(row.participated_count) || 0,
      participationRate: Number(row.participation_rate) || 0,
      coveredChapters: Number(row.covered_chapters) || 0,
      targetChapters: Number(row.target_chapters) || 0,
      achievementRate: Number(row.achievement_rate) || 0,
      todayCheckins: Number(row.today_checkins) || 0,
      weekCheckins: Number(row.week_checkins) || 0,
    }))

    const allLogs = await listProjectLogs(projectId).catch(() => [] as ReadingLog[])
    const today = todayISO()
    const todayCheckins = new Set(
      allLogs.filter((l) => l.reading_date === today).map((l) => l.user_id),
    ).size

    const sumPart = progresses.reduce((s, c) => s + c.participationRate, 0)
    const sumAch = progresses.reduce((s, c) => s + c.achievementRate, 0)
    const studentCount = progresses.reduce((s, c) => s + c.studentCount, 0)

    return {
      classCount: progresses.length,
      studentCount,
      todayCheckins,
      avgParticipation:
        progresses.length === 0 ? 0 : Math.round(sumPart / progresses.length),
      avgAchievement:
        progresses.length === 0 ? 0 : Math.round(sumAch / progresses.length),
      classes: progresses,
    }
  }

  // Fallback if RPC not migrated yet
  const classes = await listClasses()
  const pcs = await listProjectClasses(projectId)
  const targets = await getReadingTargets(projectId)
  const allLogs = await listProjectLogs(projectId)
  const today = todayISO()
  const progresses: ClassProgress[] = []
  let studentCount = 0
  let sumPart = 0
  let sumAch = 0

  for (const cls of classes) {
    if (cls.is_active === false) continue
    const hasTarget = targets.length > 0 || pcs.some((p) => p.class_id === cls.id)
    if (!hasTarget) continue
    const progress = await getClassProgress(projectId, cls.id, cls.name)
    progresses.push(progress)
    studentCount += progress.studentCount
    sumPart += progress.participationRate
    sumAch += progress.achievementRate
  }

  const todayCheckins = new Set(
    allLogs.filter((l) => l.reading_date === today).map((l) => l.user_id),
  ).size

  return {
    classCount: progresses.length,
    studentCount,
    todayCheckins,
    avgParticipation:
      progresses.length === 0 ? 0 : Math.round(sumPart / progresses.length),
    avgAchievement:
      progresses.length === 0 ? 0 : Math.round(sumAch / progresses.length),
    classes: progresses,
  }
}

export function suggestedTodayRange(
  coveredChapters: number,
  targetEnd: number,
  chaptersPerDay = 1,
): { start: number; end: number } {
  const start = Math.min(coveredChapters + 1, targetEnd)
  const end = Math.min(start + chaptersPerDay - 1, targetEnd)
  return { start, end }
}

/** Today's community activity for one class (no rankings). */
export async function getClassCommunityWarmth(
  projectId: string,
  classId: string,
): Promise<{
  checkins: number
  reactions: number
  comments: number
  readAlongs: number
  warmth: number
}> {
  const students = await listClassStudents(classId)
  const studentIds = students.map((s) => s.id)
  if (studentIds.length === 0) {
    return { checkins: 0, reactions: 0, comments: 0, readAlongs: 0, warmth: 0 }
  }

  const today = todayISO()
  const logs = await listClassLogs(projectId, studentIds)
  const todayLogs = logs.filter((l) => l.reading_date === today)
  const logIds = todayLogs.map((l) => l.id)
  const checkins = new Set(todayLogs.map((l) => l.user_id)).size

  if (logIds.length === 0) {
    return { checkins: 0, reactions: 0, comments: 0, readAlongs: 0, warmth: 0 }
  }

  const [{ count: reactions }, { count: comments }, { count: readAlongs }] =
    await Promise.all([
      supabase
        .from(Tables.encouragements)
        .select('id', { count: 'exact', head: true })
        .in('reading_log_id', logIds),
      supabase
        .from(Tables.comments)
        .select('id', { count: 'exact', head: true })
        .in('reading_log_id', logIds),
      supabase
        .from(Tables.readAlongs)
        .select('id', { count: 'exact', head: true })
        .in('reading_log_id', logIds),
    ])

  const stats = {
    checkins,
    reactions: reactions ?? 0,
    comments: comments ?? 0,
    readAlongs: readAlongs ?? 0,
  }
  return { ...stats, warmth: computeClassWarmth(stats) }
}
