import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassById } from '@/services/classService'
import { getClassProgress, getStudentStatuses } from '@/services/progressService'
import { listFeed } from '@/services/readingService'
import { getDDayLabel, todayISO } from '@/utils/dday'
import type { StudentStatus } from '@/types'

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
    participationRate: 0,
    studentCount: 0,
    todayCheckins: 0,
    weekCheckins: 0,
  })
  const [students, setStudents] = useState<StudentStatus[]>([])
  const [recentCount, setRecentCount] = useState(0)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project || !profile.class_id) return
    const run = async () => {
      const cls = await getClassById(profile.class_id!)
      setClassName(cls?.name ?? '담당 반')
      const p = await getClassProgress(project.id, profile.class_id!, cls?.name ?? '담당 반')
      setProgress(p)
      setStudents(await getStudentStatuses(project.id, profile.class_id!))
      const feed = await listFeed({ projectId: project.id, classId: profile.class_id, limit: 10 })
      setRecentCount(feed.length)
    }
    void run()
  }, [project, profile])

  const needCheer = students
    .filter((s) => daysSinceLast(s.lastReadingDate) >= 2)
    .sort((a, b) => daysSinceLast(b.lastReadingDate) - daysSinceLast(a.lastReadingDate))

  return (
    <div className="space-y-4 px-5 pb-8 pt-7">
      <div>
        <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE · 교사</p>
        <h1 className="font-display mt-1 text-3xl text-navy">{className}</h1>
        {project ? <p className="mt-2 text-muted">{getDDayLabel(project.end_date)}</p> : null}
      </div>

      <Card className="border-none bg-navy text-white">
        <p className="text-sm text-white/70">반 목표 달성률</p>
        <p className="font-display mt-1 text-5xl">{progress.achievementRate}%</p>
        <ProgressBar value={progress.achievementRate} className="mt-3 bg-white/15" />
      </Card>

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted">전체 학생</p>
          <p className="text-xl font-semibold text-navy">{progress.studentCount}명</p>
        </div>
        <div>
          <p className="text-muted">오늘 인증</p>
          <p className="text-xl font-semibold text-navy">{progress.todayCheckins}명</p>
        </div>
        <div>
          <p className="text-muted">이번 주 참여</p>
          <p className="text-xl font-semibold text-navy">{progress.weekCheckins}명</p>
        </div>
        <div>
          <p className="text-muted">참여율</p>
          <p className="text-xl font-semibold text-navy">{progress.participationRate}%</p>
        </div>
      </Card>

      <Card className="border-coral/30 bg-coral/10">
        <h2 className="font-semibold text-navy">응원이 필요한 친구</h2>
        <p className="mt-1 text-xs text-muted">2일 이상 미인증 · 학생 화면에는 표시되지 않습니다.</p>
        <div className="mt-3 space-y-2">
          {needCheer.length === 0 ? (
            <p className="text-sm text-sage-dark">모두 잘 따라오고 있어요 🙌</p>
          ) : (
            needCheer.map((s) => {
              const days = daysSinceLast(s.lastReadingDate)
              return (
                <div
                  key={s.userId}
                  className="flex items-center justify-between rounded-xl bg-panel/80 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-navy">{s.name}</p>
                    <p className="text-xs text-muted">
                      {s.lastReadingDate
                        ? `${days}일째 미인증 · 최근 ${s.lastReadingDate}`
                        : '아직 인증 없음'}
                    </p>
                  </div>
                  <Link to="/teacher/announce">
                    <Button size="sm" variant="sage">
                      응원하기
                    </Button>
                  </Link>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <div className="flex gap-2">
        <Link to="/teacher/announce" className="flex-1">
          <Button className="w-full" variant="secondary">
            격려 메시지
          </Button>
        </Link>
        <Link to="/teacher/feed" className="flex-1">
          <Button className="w-full" variant="outline">
            최근 인증 {recentCount}
          </Button>
        </Link>
      </div>

      <Card>
        <h2 className="font-semibold text-navy">학생별 상태</h2>
        <p className="mt-1 text-xs text-muted">학생 화면에는 표시되지 않습니다.</p>
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
    </div>
  )
}
