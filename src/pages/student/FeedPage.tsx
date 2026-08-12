import { useCallback, useEffect, useState } from 'react'
import { ReadingFeedCard } from '@/components/ReadingFeedCard'
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
  const { project, loadForUser } = useProjectStore()
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [myEnc, setMyEnc] = useState<Record<string, EncouragementType>>({})
  const [commentsByLog, setCommentsByLog] = useState<Record<string, FeedComment[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

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
    setLive(true)
    const unsubscribe = subscribeFeedChanges(project.id, () => {
      void refresh()
    })
    return () => {
      unsubscribe()
      setLive(false)
    }
  }, [project, refresh])

  return (
    <div className="space-y-4 px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-brand-900">인증 피드</h1>
          <p className="mt-2 text-muted">사진 인증에 좋아요와 한 줄 댓글을 남겨요.</p>
        </div>
        {live ? (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />
            LIVE
          </span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {feed.length === 0 ? (
        <p className="text-sm text-muted">아직 게시된 인증이 없습니다.</p>
      ) : (
        feed.map((log) => (
          <ReadingFeedCard
            key={log.id}
            log={log}
            liked={Boolean(myEnc[log.id])}
            comments={commentsByLog[log.id] ?? []}
            currentUserId={profile.id}
            onDelete={async (id) => {
              await deleteReadingLog(id, profile.id)
              setFeed((prev) => prev.filter((item) => item.id !== id))
            }}
            onLike={async (logId, currentlyLiked) => {
              const next = await toggleLike(logId, profile.id, currentlyLiked)
              setMyEnc((prev) => {
                const copy = { ...prev }
                if (next) copy[logId] = 'like'
                else delete copy[logId]
                return copy
              })
              setFeed((prev) =>
                prev.map((item) =>
                  item.id === logId
                    ? {
                        ...item,
                        encouragement_count: Math.max(
                          0,
                          (item.encouragement_count ?? 0) + (next ? 1 : -1),
                        ),
                      }
                    : item,
                ),
              )
            }}
            onComment={async (logId, content) => {
              const created = await addComment({
                readingLogId: logId,
                userId: profile.id,
                content,
              })
              setCommentsByLog((prev) => ({
                ...prev,
                [logId]: [...(prev[logId] ?? []), created],
              }))
            }}
            onDeleteComment={async (commentId) => {
              await deleteComment(commentId, profile.id)
              setCommentsByLog((prev) => {
                const next: Record<string, FeedComment[]> = {}
                for (const [key, list] of Object.entries(prev)) {
                  next[key] = list.filter((c) => c.id !== commentId)
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
