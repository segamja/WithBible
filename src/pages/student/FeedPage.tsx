import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ReadingFeedCard } from '@/components/ReadingFeedCard'
import { ChatterBoard } from '@/components/ChatterBoard'
import { PlaygroundPanel } from '@/components/PlaygroundPanel'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  deleteReadingLog,
  listFeed,
  subscribeFeedChanges,
  toggleReaction,
} from '@/services/readingService'
import {
  addComment,
  deleteComment,
  listCommentsForLogs,
} from '@/services/commentService'
import { countUnreadNotifications } from '@/services/notificationService'
import type { FeedComment, ReadingLogWithMeta, ReactionCounts } from '@/types'
import { cn } from '@/utils/cn'

const FEED_TABS = [
  { id: 'logs', label: '말씀인증' },
  { id: 'chatter', label: '왁자지껄' },
  { id: 'playground', label: '놀이터' },
] as const

type FeedTab = (typeof FEED_TABS)[number]['id']

function tabFromParam(value: string | null): FeedTab {
  if (value === 'chatter' || value === 'playground') return value
  return 'logs'
}

export function FeedPage({ scope = 'all' }: { scope?: 'class' | 'all' }) {
  const profile = useAuthStore((s) => s.profile)!
  const [params, setParams] = useSearchParams()
  const tab = tabFromParam(params.get('tab'))
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    void countUnreadNotifications(profile.id)
      .then(setUnread)
      .catch(() => setUnread(0))
  }, [profile.id])

  const title = FEED_TABS.find((t) => t.id === tab)?.label ?? '말씀인증'

  return (
    <div className="page">
      <header className="flex items-center justify-between gap-3">
        {profile.profile_image ? (
          <img
            src={profile.profile_image}
            alt=""
            className="h-10 w-10 rounded-full object-cover ring-2 ring-panel"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-sm font-semibold text-sky-dark">
            {profile.name.slice(0, 1)}
          </div>
        )}
        <h1 className="font-display text-lg text-navy">{title}</h1>
        <Link
          to="/notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg"
          aria-label="알림"
        >
          🔔
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-brand-50 p-1">
        {FEED_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params)
              if (item.id === 'logs') next.delete('tab')
              else next.set('tab', item.id)
              setParams(next, { replace: true })
            }}
            className={cn(
              'rounded-xl py-2 text-sm font-semibold transition',
              tab === item.id ? 'bg-panel text-navy shadow-sm' : 'text-muted',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'logs' ? <LogsFeed scope={scope} /> : null}
      {tab === 'chatter' ? <ChatterBoard /> : null}
      {tab === 'playground' ? <PlaygroundPanel /> : null}
    </div>
  )
}

function LogsFeed({ scope }: { scope: 'class' | 'all' }) {
  const profile = useAuthStore((s) => s.profile)!
  const { project, classes, loadForUser } = useProjectStore()
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [commentsByLog, setCommentsByLog] = useState<Record<string, FeedComment[]>>({})
  const [error, setError] = useState<string | null>(null)

  const classNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of classes) map.set(c.id, c.name)
    return map
  }, [classes])

  const refresh = useCallback(async () => {
    if (!project) return
    const logs = await listFeed({
      projectId: project.id,
      classId: scope === 'class' ? profile.class_id : null,
      limit: 80,
      currentUserId: profile.id,
    })
    setFeed(logs)
    setCommentsByLog(await listCommentsForLogs(logs.map((l) => l.id)))
  }, [project, profile.class_id, profile.id, scope])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '피드 로드 실패'))
  }, [refresh])

  useEffect(() => {
    if (!project) return
    const unsubscribe = subscribeFeedChanges(project.id, () => {
      void refresh()
    })
    return () => unsubscribe()
  }, [project, refresh])

  return (
    <>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {feed.length === 0 ? (
        <CardEmpty />
      ) : (
        feed.map((log) => (
          <ReadingFeedCard
            key={log.id}
            log={log}
            classLabel={
              log.profiles?.class_id
                ? classNameById.get(log.profiles.class_id) ?? null
                : null
            }
            myReactions={log.my_reactions ?? []}
            comments={commentsByLog[log.id] ?? []}
            currentUserId={profile.id}
            currentUserRole={profile.role}
            onReaction={async (logId, type, active) => {
              await toggleReaction(logId, profile.id, type, active)
              setFeed((prev) =>
                prev.map((item) => {
                  if (item.id !== logId) return item
                  const counts: ReactionCounts = { ...(item.reaction_counts ?? {}) }
                  const mine = new Set(item.my_reactions ?? [])
                  if (active) {
                    mine.delete(type)
                    counts[type] = Math.max(0, (counts[type] ?? 1) - 1)
                  } else {
                    mine.add(type)
                    counts[type] = (counts[type] ?? 0) + 1
                  }
                  const my_reactions = [...mine]
                  return {
                    ...item,
                    reaction_counts: counts,
                    my_reactions,
                    encouragement_count: Object.values(counts).reduce(
                      (a, b) => a + (b ?? 0),
                      0,
                    ),
                    has_teacher_cheer: (counts.teacher_cheer ?? 0) > 0,
                  }
                }),
              )
            }}
            onComment={async (logId, content) => {
              const row = await addComment({
                readingLogId: logId,
                userId: profile.id,
                content,
              })
              setCommentsByLog((prev) => {
                const list = prev[logId] ?? []
                if (list.some((c) => c.id === row.id)) return prev
                if (
                  list.some(
                    (c) => c.user_id === profile.id && c.content.trim() === content.trim(),
                  )
                ) {
                  return prev
                }
                return { ...prev, [logId]: [...list, row] }
              })
            }}
            onDelete={async (logId) => {
              await deleteReadingLog(logId, profile.id)
              setFeed((prev) => prev.filter((item) => item.id !== logId))
            }}
            onDeleteComment={async (commentId) => {
              await deleteComment(commentId, profile.id)
              setCommentsByLog((prev) => {
                const next: Record<string, FeedComment[]> = {}
                for (const [logId, list] of Object.entries(prev)) {
                  next[logId] = list.filter((c) => c.id !== commentId)
                }
                return next
              })
            }}
          />
        ))
      )}
    </>
  )
}

function CardEmpty() {
  return (
    <Card className="py-12 text-center">
      <p className="font-medium text-navy">아직 게시된 인증이 없어요</p>
      <p className="mt-1 text-sm text-muted">오늘 말씀을 읽고 첫 피드를 남겨볼까요?</p>
    </Card>
  )
}
