import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassById } from '@/services/classService'
import { getClassProgress, getPersonalProgress } from '@/services/progressService'
import { listAnnouncements } from '@/services/announcementService'
import { roleHome } from '@/layouts/AppShell'
import { getDDayLabel } from '@/utils/dday'

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
  })
  const [personal, setPersonal] = useState({
    covered: 0,
    target: 0,
    rate: 0,
    goalLabel: '',
    byBook: [] as Awaited<ReturnType<typeof getPersonalProgress>>['byBook'],
  })
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
      })
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id)
      setPersonal({
        covered: me.covered,
        target: me.target,
        rate: me.rate,
        goalLabel: me.goalLabel,
        byBook: me.byBook,
      })
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
    <div className="space-y-4 px-5 pb-8 pt-7">
      <div>
        <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE · 우리반</p>
        <h1 className="font-display mt-1 text-3xl text-navy">{className}</h1>
        {project ? (
          <p className="mt-2 text-muted">{getDDayLabel(project.end_date)}</p>
        ) : null}
      </div>

      <Card className="border-none bg-navy text-white">
        <p className="text-sm text-white/70">우리 반 진행률</p>
        <p className="font-display text-5xl">{progress.achievementRate}%</p>
        <ProgressBar value={progress.achievementRate} className="mt-3 bg-white/15" />
        <p className="mt-3 text-sm text-white/70">{personal.goalLabel || '목표 미설정'}</p>
      </Card>

      <Card>
        <h2 className="font-semibold text-navy">나의 진행률</h2>
        <p className="mt-2 font-display text-2xl text-sage-dark">
          {personal.covered} / {personal.target}장 · {personal.rate}%
        </p>
        <ProgressBar value={personal.rate} className="mt-3" />
        {personal.byBook.length > 1 ? (
          <div className="mt-3 space-y-2 text-sm">
            {personal.byBook.map((b) => (
              <div key={b.bookId} className="flex justify-between gap-2 border-b border-line/60 py-1 last:border-0">
                <span>
                  {b.bookName} {b.startChapter}~{b.endChapter}장
                </span>
                <span className="font-medium text-navy">
                  {b.covered}/{b.target} · {b.rate}%
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted">전체 학생</p>
          <p className="text-xl font-semibold">{progress.studentCount}명</p>
        </div>
        <div>
          <p className="text-muted">오늘 인증</p>
          <p className="text-xl font-semibold">{progress.todayCheckins}명</p>
        </div>
        <div>
          <p className="text-muted">이번 주 참여</p>
          <p className="text-xl font-semibold">{progress.weekCheckins}명</p>
        </div>
        <div>
          <p className="text-muted">참여율</p>
          <p className="text-xl font-semibold">{progress.participationRate}%</p>
        </div>
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
