import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReadingFeedCard } from '@/components/ReadingFeedCard'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  deleteReadingLog,
  getMyEncouragements,
  listFeed,
  subscribeFeedChanges,
  toggleLike,
} from '@/services/readingService'
import {
  addComment,
  deleteComment,
  listCommentsForLogs,
} from '@/services/commentService'
import type { EncouragementType, FeedComment, ReadingLogWithMeta } from '@/types'

export function FeedPage({ scope = 'all' }: { scope?: 'class' | 'all' }) {
  const profile = useAuthStore((s) => s.profile)!
  const { project, classes, loadForUser } = useProjectStore()
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [myEnc, setMyEnc] = useState<Record<string, EncouragementType>>({})
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
    })
    setFeed(logs)
    setMyEnc(await getMyEncouragements(profile.id, logs.map((l) => l.id)))
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
        <span className="w-10" aria-hidden />
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
            liked={Boolean(myEnc[log.id])}
            comments={commentsByLog[log.id] ?? []}
            currentUserId={profile.id}
            onLike={async (logId, liked) => {
              await toggleLike(logId, profile.id, liked)
              setMyEnc((prev) => {
                const next = { ...prev }
                if (liked) delete next[logId]
                else next[logId] = 'like'
                return next
              })
              setFeed((prev) =>
                prev.map((item) =>
                  item.id === logId
                    ? {
                        ...item,
                        encouragement_count: Math.max(
                          0,
                          (item.encouragement_count ?? 0) + (liked ? -1 : 1),
                        ),
                      }
                    : item,
                ),
              )
            }}
            onComment={async (logId, content) => {
              const row = await addComment({
                readingLogId: logId,
                userId: profile.id,
                content,
              })
              setCommentsByLog((prev) => ({
                ...prev,
                [logId]: [...(prev[logId] ?? []), row],
              }))
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
