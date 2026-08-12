import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEffect } from 'react'

export function MePage() {
  const profile = useAuthStore((s) => s.profile)!
  const logout = useAuthStore((s) => s.logout)
  const { project, classes, loadForUser } = useProjectStore()
  const myClass = classes.find((c) => c.id === profile.class_id)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  return (
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">마이</h1>
      <Card className="space-y-2">
        <p className="text-sm text-muted">이름</p>
        <p className="text-xl font-semibold">{profile.name}</p>
        <p className="text-sm text-muted">{profile.email}</p>
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
      <Button variant="outline" className="w-full" onClick={() => void logout()}>
        로그아웃
      </Button>
    </div>
  )
}
