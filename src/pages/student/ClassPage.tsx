import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CircularProgress } from '@/components/CircularProgress'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassById, listClassStudents } from '@/services/classService'
import { getClassProgress, getPersonalProgress } from '@/services/progressService'
import { listAnnouncements } from '@/services/announcementService'
import { listClassLogs } from '@/services/readingService'
import { roleHome } from '@/layouts/AppShell'
import { getDDayLabel, todayISO } from '@/utils/dday'
import { calcClassStreak } from '@/utils/schedule'
import type { Profile } from '@/types'
import { cn } from '@/utils/cn'

export function ClassPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [className, setClassName] = useState('우리 반')
  const [progress, setProgress] = useState({
    achievementRate: 0,
    participationRate: 0,
    studentCount: 0,
    todayCheckins: 0,
    weekCheckins: 0,
    participatedCount: 0,
  })
  const [personal, setPersonal] = useState({
    covered: 0,
    target: 0,
    rate: 0,
    goalLabel: '',
  })
  const [classStreak, setClassStreak] = useState(0)
  const [todayFriends, setTodayFriends] = useState<Profile[]>([])
  const [anns, setAnns] = useState<{ content: string; author?: string }[]>([])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project || !profile.class_id) return
    const run = async () => {
      const cls = await getClassById(profile.class_id!)
      setClassName(cls?.name ?? '우리 반')
      const p = await getClassProgress(project.id, profile.class_id!, cls?.name ?? '우리 반')
      setProgress({
        achievementRate: p.achievementRate,
        participationRate: p.participationRate,
        studentCount: p.studentCount,
        todayCheckins: p.todayCheckins,
        weekCheckins: p.weekCheckins,
        participatedCount: p.participatedCount,
      })
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id)
      setPersonal({
        covered: me.covered,
        target: me.target,
        rate: me.rate,
        goalLabel: me.goalLabel,
      })

      const students = await listClassStudents(profile.class_id!)
      const logs = await listClassLogs(
        project.id,
        students.map((s) => s.id),
      )
      setClassStreak(calcClassStreak([...new Set(logs.map((l) => l.reading_date))]))
      const today = todayISO()
      const todayIds = new Set(
        logs.filter((l) => l.reading_date === today).map((l) => l.user_id),
      )
      setTodayFriends(students.filter((s) => todayIds.has(s.id)))

      const list = await listAnnouncements({
        projectId: project.id,
        classId: profile.class_id,
      })
      setAnns(
        list.map((a) => ({
          content: a.content,
          author: a.profiles?.name,
        })),
      )
    }
    void run()
  }, [project, profile])

  if (!profile.class_id) {
    return <Navigate to={roleHome(profile.role)} replace />
  }

  return (
    <div className="space-y-4 px-5 pb-8 pt-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {profile.profile_image ? (
            <img
              src={profile.profile_image}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky/25 text-sm font-semibold text-sky-dark">
              {profile.name.slice(0, 1)}
            </div>
          )}
          <h1 className="font-display text-xl text-navy">with BIBLE</h1>
        </div>
      </header>

      <Card className="space-y-5">
        <h2 className="text-center font-semibold text-navy">
          {className} · 우리 반 복음서 여행
        </h2>
        <CircularProgress value={progress.achievementRate} />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-brand-50 px-2 py-2.5">
            <p className="text-muted">전체</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{progress.studentCount}명</p>
          </div>
          <div className="rounded-xl bg-brand-50 px-2 py-2.5">
            <p className="text-muted">참여</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">
              {progress.participatedCount}명
            </p>
          </div>
          <div className="rounded-xl bg-sky/25 px-2 py-2.5">
            <p className="text-sky-dark">오늘 인증</p>
            <p className="mt-0.5 text-sm font-semibold text-sky-dark">
              {progress.todayCheckins}명
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-muted">{personal.goalLabel}</p>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">🔥 우리 반 공동 Streak</p>
          <p className="mt-1 font-semibold text-navy">
            {classStreak > 0 ? `${classStreak} 일 연속 말씀읽기` : '오늘 함께 시작해 볼까요?'}
          </p>
        </div>
      </Card>

      {project ? (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">🎯 완주까지</p>
            <p className="mt-1 font-display text-2xl text-navy">
              {getDDayLabel(project.end_date)}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/20 text-sage-dark">
            <Flag className="h-5 w-5" />
          </div>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-navy">오늘 함께 읽은 친구들</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-muted">
            {progress.todayCheckins}/{progress.studentCount}
          </span>
        </div>
        {todayFriends.length === 0 ? (
          <p className="text-sm text-muted">아직 오늘 인증한 친구가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {todayFriends.map((s) => (
              <div key={s.id} className="flex w-16 flex-col items-center gap-1">
                {s.profile_image ? (
                  <img
                    src={s.profile_image}
                    alt={s.name}
                    className={cn('h-12 w-12 rounded-full object-cover ring-2 ring-sage/50')}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/20 text-sm font-semibold text-sage-dark ring-2 ring-sage/40">
                    {s.name.slice(0, 1)}
                  </div>
                )}
                <p className="w-full truncate text-center text-[11px] text-muted">{s.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card>
        <h2 className="font-semibold text-navy">나의 진행률</h2>
        <p className="mt-2 font-display text-2xl text-sage-dark">
          {personal.covered} / {personal.target}장 · {personal.rate}%
        </p>
      </Card>

      <Link to="/progress">
        <Button variant="outline" className="w-full">
          전체 반별 현황 보기
        </Button>
      </Link>

      <div className="space-y-3">
        <h2 className="font-semibold">공지</h2>
        {anns.length === 0 ? (
          <p className="text-sm text-muted">아직 공지가 없습니다.</p>
        ) : (
          anns.map((a, idx) => (
            <Card key={idx}>
              {a.author ? <p className="text-xs text-muted">{a.author}</p> : null}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{a.content}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
