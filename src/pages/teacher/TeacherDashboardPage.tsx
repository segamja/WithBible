import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ClassJourneyPanel } from '@/components/ClassJourneyPanel'
import { MessageBoard } from '@/components/MessageBoard'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassById, listClassStudents } from '@/services/classService'
import {
  getClassProgress,
  getStudentStatuses,
  getPersonalProgress,
  getClassCommunityWarmth,
} from '@/services/progressService'
import { listFeed, listClassLogs, cheerStudentLatestLog } from '@/services/readingService'
import { todayISO } from '@/utils/dday'
import { calcClassStreak } from '@/utils/schedule'
import type { Profile, StudentStatus } from '@/types'

const statusLabel = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
}

function daysSinceLast(lastReadingDate: string | null): number {
  if (!lastReadingDate) return 999
  return differenceInCalendarDays(parseISO(todayISO()), parseISO(lastReadingDate))
}

export function TeacherDashboardPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [className, setClassName] = useState('담당 반')
  const [progress, setProgress] = useState({
    achievementRate: 0,
    studentCount: 0,
    todayCheckins: 0,
    participatedCount: 0,
  })
  const [personal, setPersonal] = useState({
    covered: 0,
    target: 0,
    rate: 0,
    goalLabel: '',
  })
  const [classStreak, setClassStreak] = useState(0)
  const [warmth, setWarmth] = useState({
    warmth: 0,
    checkins: 0,
    reactions: 0,
    comments: 0,
    readAlongs: 0,
  })
  const [todayFriends, setTodayFriends] = useState<Profile[]>([])
  const [students, setStudents] = useState<StudentStatus[]>([])
  const [recentCount, setRecentCount] = useState(0)
  const [cheerBusyId, setCheerBusyId] = useState<string | null>(null)
  const [cheerMessage, setCheerMessage] = useState<string | null>(null)
  const [cheerError, setCheerError] = useState<string | null>(null)

  const hasClass = Boolean(profile.class_id)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) return
    const run = async () => {
      if (!profile.class_id) {
        const feed = await listFeed({ projectId: project.id, limit: 10 })
        setRecentCount(feed.length)
        return
      }
      const cls = await getClassById(profile.class_id)
      setClassName(cls?.name ?? '담당 반')
      const p = await getClassProgress(project.id, profile.class_id, cls?.name ?? '담당 반')
      setProgress({
        achievementRate: p.achievementRate,
        studentCount: p.studentCount,
        todayCheckins: p.todayCheckins,
        participatedCount: p.participatedCount,
      })
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id)
      setPersonal({
        covered: me.covered,
        target: me.target,
        rate: me.rate,
        goalLabel: me.goalLabel,
      })
      const statuses = await getStudentStatuses(project.id, profile.class_id)
      setStudents(statuses)
      const roster = await listClassStudents(profile.class_id)
      const logs = await listClassLogs(
        project.id,
        roster.map((s) => s.id),
      )
      setClassStreak(calcClassStreak([...new Set(logs.map((l) => l.reading_date))]))
      try {
        setWarmth(await getClassCommunityWarmth(project.id, profile.class_id))
      } catch {
        setWarmth({ warmth: 0, checkins: 0, reactions: 0, comments: 0, readAlongs: 0 })
      }
      const today = todayISO()
      const todayIds = new Set(
        logs.filter((l) => l.reading_date === today).map((l) => l.user_id),
      )
      setTodayFriends(roster.filter((s) => todayIds.has(s.id)))
      const feed = await listFeed({
        projectId: project.id,
        classId: profile.class_id,
        limit: 10,
      })
      setRecentCount(feed.length)
    }
    void run()
  }, [project, profile])

  const onCheerStudent = async (student: StudentStatus) => {
    if (!project) return
    setCheerBusyId(student.userId)
    setCheerError(null)
    setCheerMessage(null)
    try {
      const result = await cheerStudentLatestLog({
        projectId: project.id,
        studentUserId: student.userId,
        teacherUserId: profile.id,
      })
      setCheerMessage(
        result.already
          ? `${student.name} 친구의 최근 인증에는 이미 응원이 있어요.`
          : `${student.name} 친구의 최근 인증 피드에 응원을 남겼어요. (반 공지가 아닙니다)`,
      )
    } catch (err) {
      setCheerError(err instanceof Error ? err.message : '응원 실패')
    } finally {
      setCheerBusyId(null)
    }
  }

  if (!hasClass) {
    return (
      <div className="page pt-7">
        <p className="caption-caps">with BIBLE · 선생님</p>
        <h1 className="page-title mt-1">교사 메뉴</h1>
        <Card className="mt-4">
          <p className="text-sm text-muted">
            담당 반이 아직 없습니다. 최고관리자에게 반 배정을 요청해 주세요.
          </p>
        </Card>
        <Link to="/feed" className="mt-3 block">
          <Button className="w-full" variant="outline">
            피드 보기
          </Button>
        </Link>
      </div>
    )
  }

  const needCheer = students
    .filter((s) => daysSinceLast(s.lastReadingDate) >= 2)
    .sort((a, b) => daysSinceLast(b.lastReadingDate) - daysSinceLast(a.lastReadingDate))

  return (
    <div className="page pt-6">
      <p className="caption-caps">with BIBLE · 교사</p>
      <p className="mt-1 text-sm text-muted">
        학생과 같은 우리반 현황을 보고, 명단·독려·응원 메시지를 관리해요.
      </p>

      <ClassJourneyPanel
        className={className}
        progress={progress}
        personalGoalLabel={personal.goalLabel}
        personalCovered={personal.covered}
        personalTarget={personal.target}
        personalRate={personal.rate}
        classStreak={classStreak}
        warmth={warmth}
        projectEndDate={project?.end_date ?? null}
        todayFriends={todayFriends}
        showPersonal={false}
      />

      <Card className="border-coral/25 bg-coral/10">
        <h2 className="section-title text-base">응원이 필요한 친구</h2>
        <p className="mt-1 text-xs text-muted">
          2일 이상 미인증 · 응원하기는 해당 학생의 최근 인증 피드에만 표시됩니다.
        </p>
        {cheerMessage ? (
          <p className="mt-2 rounded-xl bg-panel/90 px-3 py-2 text-xs font-medium text-sage-dark">
            {cheerMessage}
          </p>
        ) : null}
        {cheerError ? <p className="mt-2 text-xs text-danger">{cheerError}</p> : null}
        <div className="mt-3 space-y-2">
          {needCheer.length === 0 ? (
            <p className="text-sm text-sage-dark">모두 잘 따라오고 있어요 🙌</p>
          ) : (
            needCheer.map((s) => {
              const days = daysSinceLast(s.lastReadingDate)
              return (
                <div
                  key={s.userId}
                  className="flex items-center justify-between gap-2 rounded-xl bg-panel/80 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.lastReadingDate
                        ? `${days}일째 미인증 · 최근 ${s.lastReadingDate}`
                        : '아직 인증 없음'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="sage"
                    type="button"
                    disabled={cheerBusyId === s.userId || !s.lastReadingDate}
                    onClick={() => void onCheerStudent(s)}
                  >
                    {cheerBusyId === s.userId ? '…' : '응원하기'}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-navy">우리반 명단</h2>
        <p className="mt-1 text-xs text-muted">
          학생 {students.length}명 · 상태는 교사에게만 보입니다.
        </p>
        <div className="mt-3 space-y-2">
          {students.length === 0 ? (
            <p className="text-sm text-muted">학생이 없습니다.</p>
          ) : (
            students.map((s) => (
              <div
                key={s.userId}
                className="flex items-center justify-between border-b border-line/70 py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.lastReadingDate ? `최근 ${s.lastReadingDate}` : '미인증'} · 누적{' '}
                    {s.totalChapters}장
                  </p>
                </div>
                <span>{statusLabel[s.status]}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {project ? (
        <MessageBoard
          projectId={project.id}
          authorId={profile.id}
          kind="cheer"
          classId={profile.class_id}
          title="응원의 메시지"
          hint="우리 반 홈에 오늘 하루 동안 보이는 격려 글입니다. 보낸 뒤에는 홈에서만 확인할 수 있어요."
          placeholder={`우리 ${className}!\n조금 늦어도 괜찮아. 오늘부터 다시 함께 읽어보자.`}
          canWrite
        />
      ) : null}

      <div className="flex gap-2">
        <Link to="/feed" className="flex-1">
          <Button className="w-full" variant="outline">
            최근 인증 {recentCount}
          </Button>
        </Link>
        <Link to="/progress" className="flex-1">
          <Button className="w-full" variant="outline">
            반별 현황
          </Button>
        </Link>
      </div>
    </div>
  )
}
