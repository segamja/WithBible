import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  createProject,
  listProjects,
  listProjectClasses,
  updateProject,
  upsertProjectClass,
} from '@/services/projectService'
import { getAdminOverview } from '@/services/progressService'
import type { Project } from '@/types'
import { getDDayLabel } from '@/utils/dday'

export function AdminDashboardPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { loadForUser } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
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
      if (active) {
        setOverview(await getAdminOverview(active.id))
      }
    }
    void run()
  }, [])

  return (
    <div className="space-y-4 px-5 py-8">
      <div>
        <p className="text-sm text-brand-700">관리자</p>
        <h1 className="font-display mt-1 text-3xl text-brand-900">전체 현황</h1>
        {project ? (
          <>
            <p className="mt-2 font-medium">{project.title}</p>
            <p className="text-muted">{getDDayLabel(project.end_date)}</p>
          </>
        ) : (
          <p className="mt-2 text-muted">프로젝트를 먼저 생성해주세요.</p>
        )}
      </div>

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted">전체 반</p>
          <p className="text-xl font-semibold">{overview.classCount}개</p>
        </div>
        <div>
          <p className="text-muted">전체 학생</p>
          <p className="text-xl font-semibold">{overview.studentCount}명</p>
        </div>
        <div>
          <p className="text-muted">오늘 인증</p>
          <p className="text-xl font-semibold">{overview.todayCheckins}명</p>
        </div>
        <div>
          <p className="text-muted">전체 참여율</p>
          <p className="text-xl font-semibold">{overview.avgParticipation}%</p>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-muted">평균 진행률</p>
        <p className="font-display text-4xl text-brand-700">{overview.avgAchievement}%</p>
        <ProgressBar value={overview.avgAchievement} className="mt-3" />
      </Card>

      <Card>
        <h2 className="font-semibold">반별 현황</h2>
        <div className="mt-3 space-y-2">
          {overview.classes.map((c) => {
            const status =
              c.achievementRate >= 70 ? '🟢' : c.achievementRate >= 40 ? '🟡' : '🔴'
            return (
              <div
                key={c.classId}
                className="flex items-center justify-between border-b border-line/70 py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {c.className} · {c.studentCount}명
                  </p>
                  <p className="text-xs text-muted">
                    참여 {c.participationRate}% · 달성 {c.achievementRate}%
                  </p>
                </div>
                <span>{status}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

export function AdminProjectsPage() {
  const { bibleBooks, classes, loadForUser } = useProjectStore()
  const profile = useAuthStore((s) => s.profile)!
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('우리 반 복음서 완독 프로젝트')
  const [description, setDescription] = useState('함께 읽고, 함께 나누고, 함께 완주한다.')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [partyDate, setPartyDate] = useState('')
  const [partyPlace, setPartyPlace] = useState('교회 3층')
  const [partyNote, setPartyNote] = useState('각자 함께 나눌 음식을 준비해주세요!')
  const [selectedProject, setSelectedProject] = useState('')
  const [classId, setClassId] = useState('')
  const [bookId, setBookId] = useState('')
  const [startChapter, setStartChapter] = useState(1)
  const [endChapter, setEndChapter] = useState(28)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadForUser(profile.class_id)
    void listProjects().then(setProjects)
  }, [loadForUser, profile.class_id])

  useEffect(() => {
    if (classes[0] && !classId) setClassId(classes[0].id)
    if (bibleBooks[0] && !bookId) {
      setBookId(bibleBooks[0].id)
      setEndChapter(bibleBooks[0].chapter_count)
    }
    if (projects[0] && !selectedProject) setSelectedProject(projects[0].id)
  }, [classes, bibleBooks, projects, classId, bookId, selectedProject])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const project = await createProject({
        title,
        description,
        startDate,
        endDate,
        partyDate: partyDate || null,
        partyPlace,
        partyNote,
        status: 'active',
      })
      setProjects((prev) => [project, ...prev])
      setSelectedProject(project.id)
      setMessage('프로젝트가 생성되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    }
  }

  const saveTarget = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await upsertProjectClass({
        projectId: selectedProject,
        classId,
        targetBookId: bookId,
        targetStartChapter: Number(startChapter),
        targetEndChapter: Number(endChapter),
      })
      setMessage('반 목표가 저장되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '목표 저장 실패')
    }
  }

  return (
    <div className="space-y-6 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">프로젝트</h1>

      <form onSubmit={create} className="space-y-3">
        <Card className="space-y-3">
          <h2 className="font-semibold">새 프로젝트</h2>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <Input
            type="datetime-local"
            value={partyDate}
            onChange={(e) => setPartyDate(e.target.value)}
          />
          <Input
            value={partyPlace}
            onChange={(e) => setPartyPlace(e.target.value)}
            placeholder="파티 장소"
          />
          <Textarea
            value={partyNote}
            onChange={(e) => setPartyNote(e.target.value)}
            placeholder="준비물/안내"
          />
          <Button type="submit" className="w-full">
            프로젝트 생성
          </Button>
        </Card>
      </form>

      <form onSubmit={saveTarget} className="space-y-3">
        <Card className="space-y-3">
          <h2 className="font-semibold">반별 목표 설정</h2>
          <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={bookId}
            onChange={(e) => {
              setBookId(e.target.value)
              const book = bibleBooks.find((b) => b.id === e.target.value)
              if (book) setEndChapter(book.chapter_count)
            }}
          >
            {bibleBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min={1}
              value={startChapter}
              onChange={(e) => setStartChapter(Number(e.target.value))}
            />
            <Input
              type="number"
              min={1}
              value={endChapter}
              onChange={(e) => setEndChapter(Number(e.target.value))}
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            목표 저장
          </Button>
        </Card>
      </form>

      <Card className="space-y-2">
        <h2 className="font-semibold">프로젝트 목록</h2>
        {projects.map((p) => (
          <div key={p.id} className="border-b border-line/70 py-2 text-sm last:border-0">
            <p className="font-medium">{p.title}</p>
            <p className="text-xs text-muted">
              {p.start_date} ~ {p.end_date} · {p.status}
            </p>
            <button
              type="button"
              className="mt-1 text-xs text-brand-700"
              onClick={() =>
                void updateProject(p.id, {
                  status: p.status === 'active' ? 'completed' : 'active',
                }).then(() => listProjects().then(setProjects))
              }
            >
              {p.status === 'active' ? '완료 처리' : '활성화'}
            </button>
          </div>
        ))}
      </Card>

      {message ? <p className="text-sm text-brand-700">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {selectedProject ? (
        <ProjectTargets projectId={selectedProject} />
      ) : null}
    </div>
  )
}

function ProjectTargets({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listProjectClasses>>
  >([])

  useEffect(() => {
    void listProjectClasses(projectId).then(setRows)
  }, [projectId])

  if (rows.length === 0) return null
  return (
    <Card>
      <h2 className="font-semibold">저장된 반 목표</h2>
      <div className="mt-2 space-y-2 text-sm">
        {rows.map((r) => (
          <p key={r.id}>
            {r.classes?.name} · {r.bible_books?.name} {r.target_start_chapter}~
            {r.target_end_chapter}장
          </p>
        ))}
      </div>
    </Card>
  )
}
