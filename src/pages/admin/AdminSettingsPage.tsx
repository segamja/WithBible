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
  resetProjectActivity,
  updateProject,
} from '@/services/projectService'
import type { Project } from '@/types'

function toDatetimeLocal(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AdminSettingsPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { loadForUser, refreshProjects } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [partyDate, setPartyDate] = useState('')
  const [partyPlace, setPartyPlace] = useState('')
  const [partyNote, setPartyNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = async () => {
    const projects = await listProjects()
    const active = projects.find((p) => p.status === 'active') ?? (await getActiveProject())
    setProject(active)
    if (!active) return
    setTitle(active.title)
    setDescription(active.description ?? '')
    setStartDate(active.start_date)
    setEndDate(active.end_date)
    setPartyDate(toDatetimeLocal(active.party_date))
    setPartyPlace(active.party_place ?? '')
    setPartyNote(active.party_note ?? '')
  }

  useEffect(() => {
    void loadForUser(profile.class_id)
    void load().catch((e) => setError(e instanceof Error ? e.message : '설정 로드 실패'))
  }, [loadForUser, profile.class_id])

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
        party_date: partyDate ? new Date(partyDate).toISOString() : null,
        party_place: partyPlace.trim() || null,
        party_note: partyNote.trim() || null,
      })
      setProject(updated)
      await refreshProjects()
      setMessage('프로젝트 설정을 저장했습니다.')
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
        <p className="mt-2 text-sm text-muted">타이틀 · 기간 · 완주 보상(포트럭)을 관리합니다.</p>
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
          <h2 className="font-semibold">3. 마지막 보상 (포트럭 파티)</h2>
          <div>
            <label className="mb-1.5 block text-sm text-muted">파티 일시</label>
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
              placeholder="각자 함께 나눌 음식을 준비해주세요!"
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
          설정(타이틀·기간·보상)은 유지됩니다.
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
