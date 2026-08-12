import { listClassLogs, listProjectLogs } from '@/services/readingService'
import { listClassStudents, listClasses } from '@/services/classService'
import { getProjectClass, listProjectClasses } from '@/services/projectService'
import type { ClassProgress, ReadingLog, StudentStatus } from '@/types'
import {
  achievementRate,
  participationStatus,
  personalCoveredChapters,
  targetChapterCount,
  uniqueCoveredChapters,
} from '@/utils/progress'
import { todayISO } from '@/utils/dday'
import { subDays } from 'date-fns'

function rangesFromLogs(logs: ReadingLog[]) {
  return logs.map((l) => ({ start: l.start_chapter, end: l.end_chapter }))
}

export async function getClassProgress(
  projectId: string,
  classId: string,
  className: string,
): Promise<ClassProgress> {
  const students = await listClassStudents(classId)
  const studentIds = students.map((s) => s.id)
  const logs = await listClassLogs(projectId, studentIds)
  const pc = await getProjectClass(projectId, classId)

  const targetStart = pc?.target_start_chapter ?? 1
  const targetEnd = pc?.target_end_chapter ?? 1
  const targetChapters = targetChapterCount(targetStart, targetEnd)
  const coveredChapters = uniqueCoveredChapters(rangesFromLogs(logs), targetStart, targetEnd)
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
    studentCount: students.length,
    participatedCount: participated,
    participationRate:
      students.length === 0 ? 0 : Math.round((participated / students.length) * 100),
    coveredChapters,
    targetChapters,
    achievementRate: achievementRate(rangesFromLogs(logs), targetStart, targetEnd),
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

  return students.map((student) => {
    const mine = logs.filter((l) => l.user_id === student.id)
    const last = mine
      .map((l) => l.reading_date)
      .sort()
      .at(-1) ?? null
    return {
      userId: student.id,
      name: student.name,
      lastReadingDate: last,
      totalChapters: personalCoveredChapters(
        mine.map((l) => ({ start: l.start_chapter, end: l.end_chapter })),
      ),
      status: participationStatus(last),
    }
  })
}

export async function getPersonalProgress(
  projectId: string,
  userId: string,
  classId: string,
): Promise<{ covered: number; target: number; rate: number; bookName: string }> {
  const pc = await getProjectClass(projectId, classId)
  const logs = await listClassLogs(projectId, [userId])
  const targetStart = pc?.target_start_chapter ?? 1
  const targetEnd = pc?.target_end_chapter ?? 1
  const covered = uniqueCoveredChapters(
    logs.map((l) => ({ start: l.start_chapter, end: l.end_chapter })),
    targetStart,
    targetEnd,
  )
  const target = targetChapterCount(targetStart, targetEnd)
  return {
    covered,
    target,
    rate: target === 0 ? 0 : Math.round((covered / target) * 100),
    bookName: pc?.bible_books?.name ?? '복음서',
  }
}

export async function getAdminOverview(projectId: string): Promise<{
  classCount: number
  studentCount: number
  todayCheckins: number
  avgParticipation: number
  avgAchievement: number
  classes: ClassProgress[]
}> {
  const classes = await listClasses()
  const pcs = await listProjectClasses(projectId)
  const allLogs = await listProjectLogs(projectId)
  const today = todayISO()

  const progresses: ClassProgress[] = []
  let studentCount = 0
  let sumPart = 0
  let sumAch = 0

  for (const cls of classes) {
    const hasTarget = pcs.some((p) => p.class_id === cls.id)
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
