import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MessageBoard } from '@/components/MessageBoard'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getDDayLabel } from '@/utils/dday'

export function StaffPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  return (
    <div className="page pt-7">
      <div>
        <p className="caption-caps">with BIBLE · 임원선생님</p>
        <h1 className="page-title mt-1">임원 메뉴</h1>
        {project ? <p className="mt-2 text-muted">{getDDayLabel(project.end_date)}</p> : null}
        <p className="mt-2 text-sm text-muted">
          고등부 전체를 응원하고, 공개된 진행 현황을 함께 봐요. 공식 공지는 강도사님·최고관리자가
          남깁니다.
        </p>
      </div>

      <div className="flex gap-2">
        <Link to="/feed" className="flex-1">
          <Button className="w-full" variant="outline">
            피드 보기
          </Button>
        </Link>
        <Link to="/progress" className="flex-1">
          <Button className="w-full" variant="secondary">
            전체 반 진행
          </Button>
        </Link>
      </div>

      {project ? (
        <MessageBoard
          projectId={project.id}
          authorId={profile.id}
          kind="cheer"
          title="응원의 메시지"
          hint="모든 학생 홈에 오늘 하루 동안 보이는 격려 글입니다. 보낸 뒤에는 홈에서만 확인할 수 있어요."
          placeholder="우리 고등부 친구들, 오늘도 말씀 안에서 힘내요!"
          canWrite
        />
      ) : (
        <Card>
          <p className="text-sm text-muted">진행 중인 프로젝트가 없습니다.</p>
        </Card>
      )}
    </div>
  )
}
