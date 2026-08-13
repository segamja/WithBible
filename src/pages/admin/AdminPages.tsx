import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
  listProjectTargets,
  replaceProjectTargets,
  updateProject,
} from '@/services/projectService'
import { getAdminOverview } from '@/services/progressService'
import type { BibleBook, Project } from '@/types'
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

      <div className="flex gap-2">
        <Link to="/checkin" className="flex-1">
          <Button className="w-full" variant="sage">
            말씀 인증
          </Button>
        </Link>
        <Link to="/admin/classes" className="flex-1">
          <Button className="w-full" variant="outline">
            반·임원 코드
          </Button>
        </Link>
        <Link to="/admin/users" className="flex-1">
          <Button className="w-full" variant="outline">
            사용자·역할
          </Button>
        </Link>
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
  const { bibleBooks, loadForUser } = useProjectStore()
  const profile = useAuthStore((s) => s.profile)!
  const [projects, setProjects] = useState<Project[]>([])
  const [title, setTitle] = useState('우리 반 복음서 완독 프로젝트')
  const [description, setDescription] = useState('함께 읽고, 함께 나누고, 함께 완주한다.')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [partyTitle, setPartyTitle] = useState('')
  const [partyDate, setPartyDate] = useState('')
  const [partyPlace, setPartyPlace] = useState('')
  const [partyNote, setPartyNote] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [targetRefresh, setTargetRefresh] = useState(0)
  const [savingTargets, setSavingTargets] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadForUser(profile.class_id)
    void listProjects().then(setProjects)
  }, [loadForUser, profile.class_id])

  useEffect(() => {
    if (projects[0] && !selectedProject) setSelectedProject(projects[0].id)
  }, [projects, selectedProject])

  useEffect(() => {
    if (!selectedProject) return
    void listProjectTargets(selectedProject).then((rows) => {
      setSelectedBookIds(new Set(rows.map((r) => r.book_id)))
    })
  }, [selectedProject, targetRefresh])

  const otBooks = bibleBooks.filter((b) => b.testament === 'OT')
  const ntBooks = bibleBooks.filter((b) => b.testament === 'NT')

  const toggleBook = (id: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectGospels = () => {
    const ids = bibleBooks
      .filter((b) => ['마태복음', '마가복음', '누가복음', '요한복음'].includes(b.name))
      .map((b) => b.id)
    setSelectedBookIds(new Set(ids))
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const project = await createProject({
        title,
        description,
        startDate,
        endDate,
        partyTitle: partyTitle.trim() || null,
        partyDate: partyDate || null,
        partyPlace: partyPlace.trim() || null,
        partyNote: partyNote.trim() || null,
        status: 'active',
      })
      setProjects((prev) => [project, ...prev])
      setSelectedProject(project.id)
      setMessage('프로젝트가 생성되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    }
  }

  const saveTargets = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedProject) return
    setSavingTargets(true)
    setError(null)
    try {
      const books = bibleBooks
        .filter((b) => selectedBookIds.has(b.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      await replaceProjectTargets(
        selectedProject,
        books.map((b) => ({
          bookId: b.id,
          startChapter: 1,
          endChapter: b.chapter_count,
          sortOrder: b.sort_order ?? 0,
        })),
      )
      setTargetRefresh((n) => n + 1)
      setMessage(
        books.length === 0
          ? '읽기 목표를 비웠습니다.'
          : `읽기 목표 ${books.length}권을 저장했습니다. (전체 ${books.reduce((s, b) => s + b.chapter_count, 0)}장)`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '목표 저장 실패')
    } finally {
      setSavingTargets(false)
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
            value={partyTitle}
            onChange={(e) => setPartyTitle(e.target.value)}
            placeholder="마지막 보상 이름 (예: 시상식, 포트럭 파티)"
          />
          <Input
            type="datetime-local"
            value={partyDate}
            onChange={(e) => setPartyDate(e.target.value)}
          />
          <Input
            value={partyPlace}
            onChange={(e) => setPartyPlace(e.target.value)}
            placeholder="장소"
          />
          <Textarea
            value={partyNote}
            onChange={(e) => setPartyNote(e.target.value)}
            placeholder="안내 / 준비물"
          />
          <Button type="submit" className="w-full">
            프로젝트 생성
          </Button>
        </Card>
      </form>

      <form onSubmit={saveTargets} className="space-y-3">
        <Card className="space-y-3">
          <h2 className="font-semibold">읽기 목표 (성경 선택)</h2>
          <p className="text-sm text-muted">
            구약·신약 66권 중 읽을 책을 고르세요. 선택한 책의 전체 장이 목표가 됩니다. (예: 4복음서 =
            마태·마가·누가·요한)
          </p>
          <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectGospels}>
              4복음서 선택
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedBookIds(new Set(ntBooks.map((b) => b.id)))}
            >
              신약 전체
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedBookIds(new Set())}
            >
              선택 해제
            </Button>
          </div>
          <BookPickSection title="신약" books={ntBooks} selected={selectedBookIds} onToggle={toggleBook} />
          <BookPickSection title="구약" books={otBooks} selected={selectedBookIds} onToggle={toggleBook} />
          <p className="text-sm text-muted">선택 {selectedBookIds.size}권</p>
          <Button type="submit" variant="secondary" className="w-full" disabled={savingTargets}>
            {savingTargets ? '저장 중…' : '읽기 목표 저장'}
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

      {selectedProject ? <SavedProjectTargets projectId={selectedProject} refresh={targetRefresh} /> : null}
    </div>
  )
}

function BookPickSection({
  title,
  books,
  selected,
  onToggle,
}: {
  title: string
  books: BibleBook[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (books.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-navy">{title}</p>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line/70 p-2">
        {books.map((b) => (
          <label
            key={b.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-50"
          >
            <input
              type="checkbox"
              checked={selected.has(b.id)}
              onChange={() => onToggle(b.id)}
              className="accent-navy"
            />
            <span className="flex-1">{b.name}</span>
            <span className="text-xs text-muted">{b.chapter_count}장</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function SavedProjectTargets({ projectId, refresh }: { projectId: string; refresh: number }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listProjectTargets>>>([])

  useEffect(() => {
    void listProjectTargets(projectId).then(setRows)
  }, [projectId, refresh])

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">저장된 읽기 목표가 없습니다. 위에서 책을 선택해 저장하세요.</p>
      </Card>
    )
  }

  const total = rows.reduce((s, r) => s + (r.end_chapter - r.start_chapter + 1), 0)
  return (
    <Card>
      <h2 className="font-semibold">저장된 읽기 목표</h2>
      <p className="mt-1 text-xs text-muted">
        {rows.length}권 · 총 {total}장
      </p>
      <div className="mt-2 space-y-2 text-sm">
        {rows.map((r) => (
          <p key={r.id}>
            {r.bible_books?.name} {r.start_chapter}~{r.end_chapter}장
          </p>
        ))}
      </div>
    </Card>
  )
}
