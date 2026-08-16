import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  createPlaygroundPoll,
  listPlaygroundContents,
  setPlaygroundActive,
} from '@/services/playgroundService'
import type { PlaygroundContent, PlaygroundOption } from '@/types'

const ALL_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI']
const SUN = ['SUN']
const WEEKEND = ['SAT', 'SUN']

export function AdminPlaygroundPage() {
  const [rows, setRows] = useState<PlaygroundContent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState<PlaygroundContent['category']>('DAILY')
  const [daySet, setDaySet] = useState<'all' | 'week' | 'weekend' | 'sun'>('all')
  const [optA, setOptA] = useState('')
  const [optB, setOptB] = useState('')
  const [optC, setOptC] = useState('')
  const [optD, setOptD] = useState('')

  const refresh = async () => {
    setRows(await listPlaygroundContents())
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
  }, [])

  const onToggle = async (row: PlaygroundContent) => {
    setBusyId(row.id)
    setError(null)
    try {
      await setPlaygroundActive(row.id, !row.active)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setBusyId(null)
    }
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const labels = [optA, optB, optC, optD].map((s) => s.trim()).filter(Boolean)
    if (!prompt.trim() || labels.length < 2) {
      setError('질문과 선택지 2개 이상이 필요해요.')
      return
    }
    const options: PlaygroundOption[] = labels.map((label, i) => ({
      id: `opt${i + 1}`,
      label,
    }))
    const days =
      daySet === 'week' ? WEEK : daySet === 'sun' ? SUN : daySet === 'weekend' ? WEEKEND : ALL_DAYS
    setError(null)
    setMessage(null)
    try {
      await createPlaygroundPoll({
        category,
        title: '오늘 하나만 골라봐',
        prompt: prompt.trim(),
        options,
        days,
      })
      setPrompt('')
      setOptA('')
      setOptB('')
      setOptC('')
      setOptD('')
      setMessage('질문을 올렸어요. 잘못됐으면 바로 비활성화하면 됩니다.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    }
  }

  return (
    <div className="page pt-6">
      <Link to="/admin" className="text-sm font-medium text-sky-dark hover:text-navy">
        ← 관리
      </Link>
      <h1 className="page-title mt-2">놀이터 질문</h1>
      <p className="mt-1 text-sm text-muted">
        잘못된 질문은 즉시 끄세요. 데이터는 지우지 않습니다.
      </p>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-sage-dark">{message}</p> : null}

      <Card className="mt-4 space-y-3">
        <h2 className="font-semibold text-navy">질문 추가</h2>
        <form onSubmit={(e) => void onCreate(e)} className="space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="시험 끝난 날 제일 먼저 하고 싶은 것은?"
            className="min-h-16"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={category} onChange={(e) => setCategory(e.target.value as PlaygroundContent['category'])}>
              <option value="DAILY">일상</option>
              <option value="BALANCE">밸런스</option>
              <option value="FOOD">음식</option>
              <option value="SCHOOL">학교(평일)</option>
              <option value="FAITH">주일</option>
              <option value="WEEKEND">주말</option>
              <option value="FRIEND">친구</option>
              <option value="HOBBY">취미</option>
            </Select>
            <Select value={daySet} onChange={(e) => setDaySet(e.target.value as typeof daySet)}>
              <option value="all">매일</option>
              <option value="week">평일만</option>
              <option value="weekend">토·일</option>
              <option value="sun">주일만</option>
            </Select>
          </div>
          <Input value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="선택지 1" />
          <Input value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="선택지 2" />
          <Input value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="선택지 3 (선택)" />
          <Input value={optD} onChange={(e) => setOptD(e.target.value)} placeholder="선택지 4 (선택)" />
          <Button type="submit" className="w-full">
            등록
          </Button>
        </form>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold text-navy">목록 · {rows.length}개</h2>
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-2 border-b border-line/50 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy">{row.prompt}</p>
                <p className="text-xs text-muted">
                  {row.category} · {row.participation_type}
                  {row.participation_type === 'WORD_INPUT' ? ' · 끝말잇기' : ''}
                  {row.active ? '' : ' · 꺼짐'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={row.active ? 'outline' : 'sage'}
                disabled={busyId === row.id}
                onClick={() => void onToggle(row)}
              >
                {row.active ? '끄기' : '켜기'}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
