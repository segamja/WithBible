import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AnnouncementRow } from '@/services/announcementService'
import { cheerPreview, formatSeoulTime } from '@/utils/seoul'

export function CheerTodayCard({ cheers }: { cheers: AnnouncementRow[] }) {
  const [open, setOpen] = useState<AnnouncementRow | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (cheers.length === 0) return null

  return (
    <>
      <Card className="space-y-3">
        <p className="text-sm font-medium text-navy">오늘의 응원</p>
        <ul className="divide-y divide-line/30">
          {cheers.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 py-2.5 text-left"
                onClick={() => setOpen(item)}
              >
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-sky-soft px-2 py-0.5 font-medium text-sky-dark">
                    {item.class_id ? '우리반' : '고등부'}
                  </span>
                  <span>{item.profiles?.name ?? '선생님'}</span>
                  <span>·</span>
                  <span>{formatSeoulTime(item.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-snug text-navy">{cheerPreview(item.content)}</p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cheer-dialog-title"
          onClick={() => setOpen(null)}
        >
          <Card
            className="max-h-[80dvh] w-full max-w-md overflow-y-auto space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="cheer-dialog-title" className="text-sm font-medium text-navy">
              응원의 메시지
            </p>
            <p className="text-xs text-muted">
              {open.class_id ? '우리반' : '고등부'} · {open.profiles?.name ?? '선생님'} ·{' '}
              {formatSeoulTime(open.created_at)}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{open.content}</p>
            <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(null)}>
              닫기
            </Button>
          </Card>
        </div>
      ) : null}
    </>
  )
}
