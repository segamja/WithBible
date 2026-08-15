import { Link, Navigate } from 'react-router-dom'
import { MessageBoard } from '@/components/MessageBoard'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { useEffect } from 'react'

export function TeacherAnnouncePage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const hasClass = Boolean(profile.class_id)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  if (!hasClass) {
    return <Navigate to="/teacher" replace />
  }

  if (!project) {
    return (
      <div className="page">
        <p className="text-sm text-muted">진행 중인 프로젝트가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <Link to="/teacher" className="text-sm font-medium text-sky-dark hover:text-navy">
        ← 교사
      </Link>
      <p className="caption-caps mt-2">선생님</p>
      <h1 className="page-title mt-1">응원의 메시지</h1>
      <div className="mt-4">
        <MessageBoard
          projectId={project.id}
          authorId={profile.id}
          kind="cheer"
          classId={profile.class_id}
          title="우리 반 응원"
          hint="담당 반 친구들 홈에만 보입니다."
          placeholder="조금 늦어도 괜찮아! 오늘부터 다시 함께 읽어보자."
          canWrite
        />
      </div>
    </div>
  )
}
