import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">마이</h1>
      <Card className="space-y-2">
        <p className="text-sm text-muted">이름</p>
        <p className="text-xl font-semibold">{profile.name}</p>
        <p className="text-sm text-muted">{profile.email || '이메일 없음'}</p>
        <p className="pt-2 text-sm">
          역할 · <span className="font-medium">{profile.role}</span>
        </p>
        <p className="text-sm">
          반 · <span className="font-medium">{myClass?.name ?? '미배정'}</span>
        </p>
        {project ? (
          <p className="text-sm">
            프로젝트 · <span className="font-medium">{project.title}</span>
          </p>
        ) : null}
      </Card>

      {project && personal ? (
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-medium text-sky-dark">이번 기간 읽기 목표</p>
            <h2 className="font-display mt-1 text-xl text-navy">{personal.goalLabel}</h2>
            <p className="mt-1 text-sm text-muted">{personal.readUpToLabel}</p>
          </div>
          <p className="font-display text-3xl text-sage-dark">
            {personal.covered} / {personal.target}장 · {personal.rate}%
          </p>
          <ProgressBar value={personal.rate} />
          <div className="space-y-2">
            {personal.byBook.map((b) => (
              <div key={b.bookId} className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy">{b.bookName}</p>
                  <p className="font-semibold text-sage-dark">{b.rate}%</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {b.covered}/{b.target}장 읽음 · 목표 {b.startChapter}~{b.endChapter}장
                </p>
                <ProgressBar value={b.rate} className="mt-2" />
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
