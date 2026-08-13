import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getPersonalProgress } from '@/services/progressService'

export function MePage() {
  const profile = useAuthStore((s) => s.profile)!
  const logout = useAuthStore((s) => s.logout)
  const { project, classes, loadForUser } = useProjectStore()
  const myClass = classes.find((c) => c.id === profile.class_id)
  const [personal, setPersonal] = useState<Awaited<ReturnType<typeof getPersonalProgress>> | null>(
    null,
  )

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) {
      setPersonal(null)
      return
    }
    void getPersonalProgress(project.id, profile.id, profile.class_id)
      .then(setPersonal)
      .catch(() => setPersonal(null))
  }, [project, profile.id, profile.class_id])

  return (
    <div className="page">
      <PageHeader eyebrow="내 정보" title="마이" description="계정과 이번 기간 읽기 목표를 확인해요." />

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          {profile.profile_image ? (
            <img
              src={profile.profile_image}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-2 ring-sky/30"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-soft text-lg font-semibold text-sky-dark">
              {profile.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-xl text-navy">{profile.name}</p>
            <p className="truncate text-sm text-muted">{profile.email || '이메일 없음'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs text-muted">역할</p>
            <p className="mt-0.5 font-semibold text-navy">{profile.role}</p>
          </div>
          <div className="rounded-2xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs text-muted">반</p>
            <p className="mt-0.5 font-semibold text-navy">{myClass?.name ?? '미배정'}</p>
          </div>
        </div>
        {project ? (
          <p className="text-sm text-muted">
            프로젝트 · <span className="font-medium text-navy">{project.title}</span>
          </p>
        ) : null}
      </Card>

      {project && personal ? (
        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Reading Goal</p>
            <h2 className="section-title mt-1">{personal.goalLabel}</h2>
            <p className="mt-1 text-sm text-muted">{personal.readUpToLabel}</p>
          </div>
          <p className="stat-number text-sage-dark">
            {personal.rate}
            <span className="ml-1 text-2xl">%</span>
          </p>
          <p className="text-sm text-muted">
            {personal.covered} / {personal.target}장
          </p>
          <ProgressBar value={personal.rate} />
          <div className="space-y-2">
            {personal.byBook.map((b) => (
              <div key={b.bookId} className="rounded-2xl bg-brand-50 px-3.5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy">{b.bookName}</p>
                  <p className="font-semibold text-sage-dark">{b.rate}%</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {b.covered}/{b.target}장 읽음 · 목표 {b.startChapter}~{b.endChapter}장
                </p>
                <ProgressBar value={b.rate} className="mt-2 h-2" />
              </div>
            ))}
          </div>
          <Link to="/checkin" className="block">
            <Button className="w-full" variant="sage">
              말씀 인증하러 가기
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            {project ? '진행률을 불러오는 중이거나 목표가 없습니다.' : '활성 프로젝트가 없습니다.'}
          </p>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={() => void logout()}>
        로그아웃
      </Button>
    </div>
  )
}
