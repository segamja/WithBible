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
    void getAdminOverview(project.id)
      .then((overview) => {
        setClasses(
          [...overview.classes].sort((a, b) => b.achievementRate - a.achievementRate),
        )
        setAvg(overview.avgAchievement)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '현황 로드 실패'))
  }, [project])

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <p className="text-sm font-medium text-brand-700">With Bible</p>
          <h1 className="font-display mt-1 text-3xl text-brand-900 sm:text-4xl">
            반별 진행 현황
          </h1>
          {project ? (
            <p className="mt-2 text-muted">
              {project.title} · {getDDayLabel(project.end_date)}
            </p>
          ) : (
            <p className="mt-2 text-muted">활성 프로젝트가 없습니다.</p>
          )}
        </header>

        <Card className="border-brand-200 bg-brand-50">
          <p className="text-sm text-muted">전체 평균 진행률</p>
          <p className="font-display text-5xl text-brand-700">{avg}%</p>
          <ProgressBar value={avg} className="mt-3" />
        </Card>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const tone =
              c.achievementRate >= 70
                ? 'border-brand-200 bg-panel'
                : c.achievementRate >= 40
                  ? 'border-warn/30 bg-panel'
                  : 'border-danger/20 bg-panel'
            return (
              <Card key={c.classId} className={tone}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-2xl text-brand-900">{c.className}</h2>
                  <span className="font-display text-2xl text-brand-700">
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
                    <dt className="text-muted">커버 장</dt>
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
