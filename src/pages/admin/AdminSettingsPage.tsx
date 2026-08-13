import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip, Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  getActiveProject,
  listProjects,
  listProjectTargets,
  replaceProjectTargets,
  resetProjectActivity,
  updateProject,
} from '@/services/projectService'
import { DEFAULT_DEPARTMENT_TITLE } from '@/lib/branding'
import type { BibleBook, Project } from '@/types'

function toDatetimeLocal(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminSettingsPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { bibleBooks, loadForUser, refreshProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [title, setTitle] = useState('')
  const [departmentTitle, setDepartmentTitle] = useState(DEFAULT_DEPARTMENT_TITLE)
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [partyTitle, setPartyTitle] = useState('')
  const [partyDate, setPartyDate] = useState('')
  const [partyPlace, setPartyPlace] = useState('')
  const [partyNote, setPartyNote] = useState('')
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetting, setResetting] = useState(false)

  const otBooks = bibleBooks.filter((b) => b.testament === 'OT')
  const ntBooks = bibleBooks.filter((b) => b.testament === 'NT')
  const selectedChapters = bibleBooks
    .filter((b) => selectedBookIds.has(b.id))
    .reduce((s, b) => s + b.chapter_count, 0)

  const load = async () => {
    const projects = await listProjects()
    const active = projects.find((p) => p.status === 'active') ?? (await getActiveProject())
    setProject(active)
    if (!active) return
    setTitle(active.title)
    setDepartmentTitle(active.department_title?.trim() || DEFAULT_DEPARTMENT_TITLE)
    setDescription(active.description ?? '')
    setStartDate(active.start_date)
    setEndDate(active.end_date)
    setPartyTitle(active.party_title ?? '')
    setPartyDate(toDatetimeLocal(active.party_date))
    setPartyPlace(active.party_place ?? '')
    setPartyNote(active.party_note ?? '')
    const targets = await listProjectTargets(active.id)
    setSelectedBookIds(new Set(targets.map((t) => t.book_id)))
  }

  useEffect(() => {
    void loadForUser(profile.class_id)
    void load().catch((e) => setError(e instanceof Error ? e.message : '설정 로드 실패'))
  }, [loadForUser, profile.class_id])

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

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!project) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateProject(project.id, {
        title: title.trim(),
        department_title: departmentTitle.trim() || DEFAULT_DEPARTMENT_TITLE,
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        party_title: partyTitle.trim() || null,
        party_date: partyDate ? new Date(partyDate).toISOString() : null,
        party_place: partyPlace.trim() || null,
        party_note: partyNote.trim() || null,
      })

      const books = bibleBooks
        .filter((b) => selectedBookIds.has(b.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      await replaceProjectTargets(
        project.id,
        books.map((b) => ({
          bookId: b.id,
          startChapter: 1,
          endChapter: b.chapter_count,
          sortOrder: b.sort_order ?? 0,
        })),
      )

      setProject(updated)
      await refreshProjects()
      const totalChapters = books.reduce((s, b) => s + b.chapter_count, 0)
      setMessage(
        books.length === 0
          ? '설정을 저장했습니다. (읽기 목표 책이 비어 있어요 — 인증 목록이 비게 됩니다)'
          : `설정을 저장했습니다. 읽기 목표 ${books.length}권 · ${totalChapters}장`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const onReset = async () => {
    if (!project) return
    if (resetConfirm !== 'RESET') {
      setError('확인을 위해 RESET 을 정확히 입력해주세요.')
      return
    }
    setResetting(true)
    setError(null)
    setMessage(null)
    try {
      await resetProjectActivity(project.id)
      setResetConfirm('')
      setMessage('인증·좋아요·댓글·공지 데이터를 초기화했습니다. (반/사용자/설정은 유지)')
    } catch (err) {
      setError(err instanceof Error ? err.message : '리셋 실패')
    } finally {
      setResetting(false)
    }
  }

  if (!project) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="관리자"
          title="프로젝트 설정"
          description="활성 프로젝트가 없습니다. 프로젝트 메뉴에서 먼저 생성하세요."
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="관리자"
        title="프로젝트 설정"
        description="부서 타이틀 · 프로젝트 · 기간 · 읽기 목표 · 마지막 보상을 한곳에서 관리합니다."
      />

      <form onSubmit={onSave} className="space-y-4">
        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Section 01</p>
            <h2 className="section-title mt-1">타이틀</h2>
          </div>
          <Field
            label="부서 타이틀 (홈 표시)"
            hint={`홈 화면 상단에 보입니다. 비우면 기본값 「${DEFAULT_DEPARTMENT_TITLE}」이 사용됩니다.`}
          >
            <Input
              value={departmentTitle}
              onChange={(e) => setDepartmentTitle(e.target.value)}
              placeholder={DEFAULT_DEPARTMENT_TITLE}
            />
          </Field>
          <Field label="프로젝트명">
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="설명">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Section 02</p>
            <h2 className="section-title mt-1">기간</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
            <Field label="목표일">
              <Input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Section 03</p>
            <h2 className="section-title mt-1">읽기 목표 성경</h2>
            <p className="mt-1 text-sm text-muted">
              선택한 책만 인증 목록에 나오고, 목표 대비 % 계산에 사용됩니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={selectGospels}>
              4복음서
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedBookIds(new Set(ntBooks.map((b) => b.id)))}
            >
              신약 전체
            </Button>
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => setSelectedBookIds(new Set())}
            >
              선택 해제
            </Button>
          </div>

          <BookPickSection
            title="신약"
            books={ntBooks}
            selected={selectedBookIds}
            onToggle={toggleBook}
          />
          <BookPickSection
            title="구약"
            books={otBooks}
            selected={selectedBookIds}
            onToggle={toggleBook}
          />

          <div className="rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-dark">
            선택 <span className="font-semibold">{selectedBookIds.size}</span>권
            {selectedBookIds.size > 0 ? (
              <>
                {' '}
                · <span className="font-semibold">{selectedChapters}</span>장
              </>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Section 04</p>
            <h2 className="section-title mt-1">마지막 보상</h2>
            <p className="mt-1 text-sm text-muted">
              포트럭 파티, 시상식, 완주 파티 등 이름을 직접 정할 수 있습니다.
            </p>
          </div>
          <Field label="보상 / 행사 이름">
            <Input
              value={partyTitle}
              onChange={(e) => setPartyTitle(e.target.value)}
              placeholder="예: 포트럭 파티, 시상식"
            />
          </Field>
          <Field label="일시">
            <Input
              type="datetime-local"
              value={partyDate}
              onChange={(e) => setPartyDate(e.target.value)}
            />
          </Field>
          <Field label="장소">
            <Input
              value={partyPlace}
              onChange={(e) => setPartyPlace(e.target.value)}
              placeholder="예: 교회 3층"
            />
          </Field>
          <Field label="안내 / 준비물">
            <Textarea
              value={partyNote}
              onChange={(e) => setPartyNote(e.target.value)}
              placeholder="예: 함께 나눌 음식 준비, 시상식 복장 안내 등"
            />
          </Field>
        </Card>

        {message ? (
          <p className="rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-dark">{message}</p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-danger">{error}</p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? '저장 중…' : '설정 저장'}
        </Button>
      </form>

      <Card className="space-y-4 border-coral/25 bg-coral/5">
        <div>
          <h2 className="section-title text-danger">전체 데이터 리셋</h2>
          <p className="mt-1 text-sm text-muted">
            이 프로젝트의 인증·사진·좋아요·댓글·공지를 모두 삭제합니다. 반/사용자/프로젝트
            설정(타이틀·기간·읽기 목표·보상)은 유지됩니다.
          </p>
        </div>
        <Field label="확인 문구">
          <Input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="확인: RESET 입력"
          />
        </Field>
        <Button
          type="button"
          variant="danger"
          className="w-full"
          disabled={resetting}
          onClick={() => void onReset()}
        >
          {resetting ? '리셋 중…' : '활동 데이터 전체 리셋'}
        </Button>
      </Card>
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
  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line/70 bg-brand-50 px-4 py-3 text-sm text-muted">
        {title} 목록을 불러오지 못했습니다. DB에 마이그레이션 013을 적용했는지 확인해주세요.
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-navy">{title}</p>
      <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-brand-50/80 p-3">
        {books.map((b) => (
          <Chip key={b.id} selected={selected.has(b.id)} onClick={() => onToggle(b.id)}>
            {b.name}
            <span className={selected.has(b.id) ? 'text-white/70' : 'text-muted'}>
              {b.chapter_count}
            </span>
          </Chip>
        ))}
      </div>
    </div>
  )
}
