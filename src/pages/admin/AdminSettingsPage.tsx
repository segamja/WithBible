import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
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

  const load = async () => {
    const projects = await listProjects()
    const active = projects.find((p) => p.status === 'active') ?? (await getActiveProject())
    setProject(active)
    if (!active) return
    setTitle(active.title)
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
      <div className="space-y-4 px-5 py-8">
        <h1 className="font-display text-3xl text-brand-900">설정</h1>
        <p className="text-muted">활성 프로젝트가 없습니다. 프로젝트 메뉴에서 먼저 생성하세요.</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-6 px-5 py-8">
      <div>
        <p className="text-sm text-brand-700">관리자</p>
        <h1 className="font-display mt-1 text-3xl text-brand-900">프로젝트 설정</h1>
        <p className="mt-2 text-sm text-muted">
          타이틀 · 기간 · 읽기 목표 성경 · 마지막 보상을 관리합니다.
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <Card className="space-y-3">
          <h2 className="font-semibold">1. 타이틀</h2>
          <div>
            <label className="mb-1.5 block text-sm text-muted">프로젝트명</label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">설명</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">2. 기간</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm text-muted">시작일</label>
              <Input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">목표일</label>
              <Input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">3. 읽기 목표 성경</h2>
          <p className="text-xs text-muted">
            선택한 책만 «오늘의 말씀 인증» 목록에 나오고, 목표 대비 % 계산에 사용됩니다.
          </p>
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
          <p className="text-sm text-muted">
            선택 {selectedBookIds.size}권
            {selectedBookIds.size > 0
              ? ` · ${bibleBooks
                  .filter((b) => selectedBookIds.has(b.id))
                  .reduce((s, b) => s + b.chapter_count, 0)}장`
              : ''}
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">4. 마지막 보상</h2>
          <p className="text-xs text-muted">
            포트럭 파티, 시상식, 완주 파티 등 이름을 직접 정할 수 있습니다.
          </p>
          <div>
            <label className="mb-1.5 block text-sm text-muted">보상 / 행사 이름</label>
            <Input
              value={partyTitle}
              onChange={(e) => setPartyTitle(e.target.value)}
              placeholder="예: 포트럭 파티, 시상식"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">일시</label>
            <Input
              type="datetime-local"
              value={partyDate}
              onChange={(e) => setPartyDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">장소</label>
            <Input
              value={partyPlace}
              onChange={(e) => setPartyPlace(e.target.value)}
              placeholder="예: 교회 3층"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">안내 / 준비물</label>
            <Textarea
              value={partyNote}
              onChange={(e) => setPartyNote(e.target.value)}
              placeholder="예: 함께 나눌 음식 준비, 시상식 복장 안내 등"
            />
          </div>
        </Card>

        {message ? <p className="text-sm text-brand-700">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? '저장 중…' : '설정 저장'}
        </Button>
      </form>

      <Card className="space-y-3 border-danger/30">
        <h2 className="font-semibold text-danger">전체 데이터 리셋</h2>
        <p className="text-sm text-muted">
          이 프로젝트의 인증·사진·좋아요·댓글·공지를 모두 삭제합니다. 반/사용자/프로젝트
          설정(타이틀·기간·읽기 목표·보상)은 유지됩니다.
        </p>
        <Input
          value={resetConfirm}
          onChange={(e) => setResetConfirm(e.target.value)}
          placeholder="확인: RESET 입력"
        />
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
      <div className="rounded-xl border border-line/70 p-3 text-sm text-muted">
        {title} 목록을 불러오지 못했습니다. DB에 마이그레이션 013을 적용했는지 확인해주세요.
      </div>
    )
  }
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
