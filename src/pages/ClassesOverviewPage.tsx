import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getAdminOverview } from '@/services/progressService'
import { getDDayLabel } from '@/utils/dday'
import type { ClassProgress } from '@/types'

export function ClassesOverviewPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [classes, setClasses] = useState<ClassProgress[]>([])
  const [avg, setAvg] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) return
    let cancelled = false
    const load = () => {
      void getAdminOverview(project.id)
        .then((overview) => {
          if (cancelled) return
          setClasses(
            [...overview.classes].sort((a, b) => b.achievementRate - a.achievementRate),
          )
          setAvg(overview.avgAchievement)
          setError(null)
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : '현황 로드 실패')
        })
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [project])

  return (
    <div className="min-h-dvh bg-surface px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <p className="caption-caps">with BIBLE</p>
          <h1 className="page-title mt-1 sm:text-4xl">반별 진행 현황</h1>
          {project ? (
            <p className="mt-2 text-sm text-muted">
              {project.title} · {getDDayLabel(project.end_date)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">활성 프로젝트가 없습니다.</p>
          )}
        </header>

        <Card className="bg-sage-soft/70">
          <p className="caption-caps">Average</p>
          <p className="stat-number mt-2">
            {avg}
            <span className="ml-0.5 text-2xl">%</span>
          </p>
          <ProgressBar value={avg} className="mt-3" />
        </Card>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const tone =
              c.achievementRate >= 70
                ? 'border-sage/20'
                : c.achievementRate >= 40
                  ? 'border-streak/40'
                  : 'border-coral/25'
            return (
              <Card key={c.classId} className={tone}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl text-navy">{c.className}</h2>
                  <span className="font-display text-2xl text-sage-dark">
                    {c.achievementRate}%
                  </span>
                </div>
                <ProgressBar value={c.achievementRate} className="mt-3" />
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">학생</dt>
                    <dd className="font-semibold">{c.studentCount}명</dd>
                  </div>
                  <div>
                    <dt className="text-muted">참여율</dt>
                    <dd className="font-semibold">{c.participationRate}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted">오늘 인증</dt>
                    <dd className="font-semibold">{c.todayCheckins}명</dd>
                  </div>
                  <div>
                    <dt className="text-muted">평균 읽은 장</dt>
                    <dd className="font-semibold">
                      {c.coveredChapters}/{c.targetChapters}
                    </dd>
                  </div>
                </dl>
              </Card>
            )
          })}
        </div>

        {classes.length === 0 && !error ? (
          <p className="text-sm text-muted">아직 반 목표 데이터가 없습니다.</p>
        ) : null}
      </div>
    </div>
  )
}
