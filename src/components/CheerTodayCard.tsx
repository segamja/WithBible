import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AnnouncementRow } from '@/services/announcementService'
import { cheerPreview, formatSeoulTime } from '@/utils/seoul'

function CheerMeta({ item }: { item: AnnouncementRow }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="rounded-full bg-sky-soft px-2 py-0.5 font-medium text-sky-dark">
        {item.class_id ? '우리반' : '고등부'}
      </span>
      <span>{item.profiles?.name ?? '선생님'}</span>
      <span>·</span>
      <span>{formatSeoulTime(item.created_at)}</span>
    </div>
  )
}

export function CheerTodayCard({ cheers }: { cheers: AnnouncementRow[] }) {
  const [open, setOpen] = useState(false)
  const latest = cheers[0]
  const extraCount = Math.max(0, cheers.length - 1)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!latest) return null

  return (
    <>
      <button type="button" className="block w-full text-left" onClick={() => setOpen(true)}>
        <Card className="space-y-2">
          <p className="text-sm font-medium text-navy">
            오늘의 응원
            {cheers.length > 1 ? <span className="text-muted"> · {cheers.length}</span> : null}
          </p>
          <CheerMeta item={latest} />
          <p className="text-sm leading-snug text-navy">{cheerPreview(latest.content)}</p>
          {extraCount > 0 ? (
            <p className="text-xs font-medium text-sky-dark">이전 응원 {extraCount}개 더 보기</p>
          ) : (
            <p className="text-xs font-medium text-sky-dark">전체 보기</p>
          )}
        </Card>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cheer-dialog-title"
          onClick={() => setOpen(false)}
        >
          <Card
            className="max-h-[80dvh] w-full max-w-md space-y-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="cheer-dialog-title" className="text-sm font-medium text-navy">
              오늘의 응원 · {cheers.length}
            </p>
            <ul className="divide-y divide-line/30">
              {cheers.map((item) => (
                <li key={item.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <CheerMeta item={item} />
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.content}</p>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)}>
              닫기
            </Button>
          </Card>
        </div>
      ) : null}
    </>
  )
}
