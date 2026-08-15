import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Field'
import {
  deleteFeedback,
  listFeedback,
  markFeedbackRead,
  type FeedbackRow,
} from '@/services/feedbackService'
import { formatSeoulDateTime } from '@/utils/seoul'
import type { FeedbackKind } from '@/types'

const kindLabel: Record<FeedbackKind, string> = {
  bug: '버그신고',
  feature: '기능제안',
}

export function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [filter, setFilter] = useState<'all' | FeedbackKind | 'unread'>('unread')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setRows(await listFeedback())
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요'))
  }, [])

  const visible = rows.filter((row) => {
    if (filter === 'unread') return !row.read_at
    if (filter === 'bug' || filter === 'feature') return row.kind === filter
    return true
  })

  return (
    <div className="page">
      <div>
        <Link to="/admin" className="text-sm font-medium text-sky-dark hover:text-navy">
          ← 현황
        </Link>
        <p className="caption-caps mt-2">최고관리자</p>
        <h1 className="page-title mt-1">버그신고 / 기능제안</h1>
        <p className="mt-2 text-sm text-muted">홈에서 보낸 글만 여기 모입니다. 다른 역할은 볼 수 없어요.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['unread', '안 읽음'],
            ['all', '전체'],
            ['bug', '버그'],
            ['feature', '기능'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </Chip>
        ))}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {visible.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {filter === 'unread' ? '읽지 않은 글이 없습니다.' : '아직 도착한 글이 없습니다.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((row) => (
            <Card
              key={row.id}
              className={row.read_at ? 'space-y-2' : 'space-y-2 border-sky/40 bg-sky-soft/40'}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-sky-soft px-2 py-0.5 font-medium text-sky-dark">
                  {kindLabel[row.kind]}
                </span>
                <span>{row.profiles?.name ?? '알 수 없음'}</span>
                <span>·</span>
                <span>{formatSeoulDateTime(row.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.content}</p>
              <div className="flex gap-3">
                {!row.read_at ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-sky-dark"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setBusyId(row.id)
                      void markFeedbackRead(row.id)
                        .then(() =>
                          setRows((prev) =>
                            prev.map((item) =>
                              item.id === row.id ? { ...item, read_at: new Date().toISOString() } : item,
                            ),
                          ),
                        )
                        .catch((e) => setError(e instanceof Error ? e.message : '읽음 처리 실패'))
                        .finally(() => setBusyId(null))
                    }}
                  >
                    읽음
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-muted hover:text-danger"
                  disabled={busyId === row.id}
                  onClick={() => {
                    setBusyId(row.id)
                    void deleteFeedback(row.id)
                      .then(() => setRows((prev) => prev.filter((item) => item.id !== row.id)))
                      .catch((e) => setError(e instanceof Error ? e.message : '삭제 실패'))
                      .finally(() => setBusyId(null))
                  }}
                >
                  삭제
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
