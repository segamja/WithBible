import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ReadingFeedCard } from '@/components/ReadingFeedCard'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  deleteReadingLog,
  listFeed,
  subscribeFeedChanges,
  toggleReaction,
  toggleReadAlong,
} from '@/services/readingService'
import {
  addComment,
  deleteComment,
  listCommentsForLogs,
  toggleQuickComment,
} from '@/services/commentService'
import { countUnreadNotifications } from '@/services/notificationService'
import type { FeedComment, ReadingLogWithMeta, ReactionCounts } from '@/types'

export function FeedPage({ scope = 'all' }: { scope?: 'class' | 'all' }) {
  const profile = useAuthStore((s) => s.profile)!
  const { project, classes, loadForUser } = useProjectStore()
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [commentsByLog, setCommentsByLog] = useState<Record<string, FeedComment[]>>({})
  const [unread, setUnread] = useState(0)
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
    try {
      setUnread(await countUnreadNotifications(profile.id))
    } catch {
      setUnread(0)
    }
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
        <h1 className="font-display text-lg text-navy">함께 읽는 피드</h1>
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
            onReadAlong={async (logId, active) => {
              await toggleReadAlong(logId, profile.id, active)
              setFeed((prev) =>
                prev.map((item) => {
                  if (item.id !== logId) return item
                  const count = Math.max(
                    0,
                    (item.read_along_count ?? 0) + (active ? -1 : 1),
                  )
                  let preview = [...(item.read_along_preview ?? [])]
                  if (active) {
                    preview = preview.filter((p) => p.user_id !== profile.id)
                  } else if (
                    !preview.some((p) => p.user_id === profile.id) &&
                    preview.length < 2
                  ) {
                    preview = [...preview, { user_id: profile.id, name: profile.name }]
                  }
                  return {
                    ...item,
                    my_read_along: !active,
                    read_along_count: count,
                    read_along_preview: preview,
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
                // same text already shown from prior insert
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
            onQuickComment={async (logId, content) => {
              const { active, comment } = await toggleQuickComment({
                readingLogId: logId,
                userId: profile.id,
                content,
              })
              setCommentsByLog((prev) => {
                const list = prev[logId] ?? []
                if (!active) {
                  return {
                    ...prev,
                    [logId]: list.filter(
                      (c) =>
                        !(
                          c.user_id === profile.id &&
                          c.content.trim() === content.trim()
                        ),
                    ),
                  }
                }
                if (!comment) return prev
                if (list.some((c) => c.id === comment.id)) return prev
                if (
                  list.some(
                    (c) =>
                      c.user_id === profile.id && c.content.trim() === content.trim(),
                  )
                ) {
                  return prev
                }
                return { ...prev, [logId]: [...list, comment] }
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
    </div>
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
