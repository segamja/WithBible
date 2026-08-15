import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MessageBoard } from '@/components/MessageBoard'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getAdminOverview } from '@/services/progressService'
import { getDDayLabel } from '@/utils/dday'
import type { Project } from '@/types'
import { listProjects } from '@/services/projectService'
import { listAdminUsers, type AdminUserRow } from '@/services/adminUserService'
import { roleLabel } from '@/lib/roles'
import { listClasses } from '@/services/classService'

export function OpsPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { loadForUser } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [classNames, setClassNames] = useState<Record<string, string>>({})
  const [overview, setOverview] = useState({
    classCount: 0,
    studentCount: 0,
    todayCheckins: 0,
    avgParticipation: 0,
    avgAchievement: 0,
    classes: [] as Awaited<ReturnType<typeof getAdminOverview>>['classes'],
  })

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    const run = async () => {
      const projects = await listProjects()
      const active = projects.find((p) => p.status === 'active') ?? projects[0] ?? null
      setProject(active)
      if (active) setOverview(await getAdminOverview(active.id))
      try {
        setUsers(await listAdminUsers())
        const cls = await listClasses()
        const map: Record<string, string> = {}
        for (const c of cls) map[c.id] = c.name
        setClassNames(map)
      } catch {
        setUsers([])
      }
    }
    void run()
  }, [])

  return (
    <div className="page">
      <div className="space-y-1.5">
        <p className="caption-caps">with BIBLE · 강도사님</p>
        <h1 className="page-title">고등부 운영</h1>
        {project ? (
          <>
            <p className="font-medium text-navy">{project.title}</p>
            <p className="text-sm text-muted">{getDDayLabel(project.end_date)}</p>
          </>
        ) : (
          <p className="text-sm text-muted">진행 중인 프로젝트가 없습니다.</p>
        )}
        <p className="text-sm text-muted">
          전체 현황과 공지·응원 메시지를 관리해요. 시스템 설정·계정 삭제는 최고관리자만 할 수
          있습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/feed">
          <Button className="w-full" variant="sage" size="sm">
            피드
          </Button>
        </Link>
        <Link to="/progress">
          <Button className="w-full" variant="outline" size="sm">
            반별 현황
          </Button>
        </Link>
      </div>

      <Card className="grid grid-cols-2 gap-3">
        {[
          ['전체 반', `${overview.classCount}개`],
          ['전체 학생', `${overview.studentCount}명`],
          ['오늘 인증', `${overview.todayCheckins}명`],
          ['전체 참여율', `${overview.avgParticipation}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-brand-50 px-3 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-navy">{value}</p>
          </div>
        ))}
      </Card>

      <Card>
        <p className="caption-caps">Average Progress</p>
        <p className="stat-number mt-2">
          {overview.avgAchievement}
          <span className="ml-0.5 text-2xl">%</span>
        </p>
        <ProgressBar value={overview.avgAchievement} className="mt-3" />
      </Card>

      {project ? (
        <>
          <MessageBoard
            projectId={project.id}
            authorId={profile.id}
            kind="notice"
            title="공지사항"
            hint="고등부 전체 홈에 보이는 공식 공지입니다."
            placeholder="복음서 읽기 안내를 남겨주세요."
            canWrite
          />
          <MessageBoard
            projectId={project.id}
            authorId={profile.id}
            kind="cheer"
            title="응원의 메시지"
            hint="모든 학생 홈에 보이는 격려 글입니다."
            placeholder="우리 고등부 친구들, 오늘도 말씀 안에서 힘내요!"
            canWrite
          />
        </>
      ) : null}

      <Card>
        <h2 className="font-semibold text-navy">학생·교사 목록</h2>
        <p className="mt-1 text-xs text-muted">조회만 가능합니다. 역할 변경은 최고관리자만 할 수 있어요.</p>
        <div className="mt-3 space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted">목록을 불러오지 못했거나 비어 있습니다.</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between border-b border-line/70 py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">
                    {roleLabel(u.role)}
                    {u.class_id ? ` · ${classNames[u.class_id] ?? '반'}` : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
