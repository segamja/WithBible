import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AnnouncementRow } from '@/services/announcementService'
import { cheerPreview, formatSeoulDateTime } from '@/utils/seoul'

const HOME_NOTICE_LIMIT = 3

function NoticeMeta({ item }: { item: AnnouncementRow }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span>{item.profiles?.name ?? '운영'}</span>
      <span>·</span>
      <span>{formatSeoulDateTime(item.created_at)}</span>
    </div>
  )
}

export function NoticeHomeCard({ notices }: { notices: AnnouncementRow[] }) {
  const [open, setOpen] = useState(false)
  const shown = notices.slice(0, HOME_NOTICE_LIMIT)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (shown.length === 0) return null

  return (
    <>
      <button type="button" className="block w-full text-left" onClick={() => setOpen(true)}>
        <Card className="space-y-3">
          <p className="text-sm font-medium text-sky-dark">
            공지사항
            {shown.length > 1 ? <span className="text-muted"> · {shown.length}</span> : null}
          </p>
          <ul className="divide-y divide-line/30">
            {shown.map((item) => (
              <li key={item.id} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
                <NoticeMeta item={item} />
                <p className="text-sm leading-snug text-navy">{cheerPreview(item.content)}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium text-sky-dark">전체 보기</p>
        </Card>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notice-dialog-title"
          onClick={() => setOpen(false)}
        >
          <Card
            className="max-h-[80dvh] w-full max-w-md space-y-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="notice-dialog-title" className="text-sm font-medium text-navy">
              공지사항 · {shown.length}
            </p>
            <ul className="divide-y divide-line/30">
              {shown.map((item) => (
                <li key={item.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <NoticeMeta item={item} />
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
