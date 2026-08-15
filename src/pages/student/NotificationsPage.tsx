import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuthStore } from '@/stores/authStore'
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '@/services/notificationService'
import type { AppNotification } from '@/types'
import { format, parseISO } from 'date-fns'

export function NotificationsPage() {
  const profile = useAuthStore((s) => s.profile)!
  const [items, setItems] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setItems(await listMyNotifications(profile.id))
  }, [profile.id])

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '알림 로드 실패'))
  }, [refresh])

  useEffect(() => {
    return subscribeNotifications(profile.id, () => {
      void refresh()
    })
  }, [profile.id, refresh])

  return (
    <div className="page">
      <PageHeader title="알림" description="친구가 보낸 응원을 모아봐요" />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void markAllNotificationsRead(profile.id)
              .then(refresh)
              .catch((e) => setError(e instanceof Error ? e.message : '읽음 처리 실패'))
          }
        >
          모두 읽음
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-navy">아직 알림이 없어요</p>
          <p className="mt-1 text-sm text-muted">친구들이 응원하면 여기에 모여요.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                n.is_read
                  ? 'border-line/40 bg-panel'
                  : 'border-sky/30 bg-sky-soft/40'
              }`}
              onClick={() =>
                void markNotificationRead(n.id, profile.id).then(refresh)
              }
            >
              <p className="text-sm font-medium text-navy">{n.message}</p>
              <p className="mt-1 text-xs text-muted">
                {n.actor?.name ? `${n.actor.name} · ` : ''}
                {format(parseISO(n.created_at), 'M/d a h:mm')}
              </p>
              {n.reading_log_id ? (
                <Link
                  to="/feed"
                  className="mt-2 inline-block text-xs font-semibold text-sky-dark"
                  onClick={(e) => e.stopPropagation()}
                >
                  피드에서 보기
                </Link>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
