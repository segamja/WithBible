import { useState, type FormEvent } from 'react'
import { Hand, MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { EncouragementType, FeedComment, ReadingLogWithMeta } from '@/types'
import { format, parseISO } from 'date-fns'
import { cn } from '@/utils/cn'

interface ReadingFeedCardProps {
  log: ReadingLogWithMeta
  className?: string
  classLabel?: string | null
  liked?: boolean
  comments?: FeedComment[]
  onLike: (logId: string, liked: boolean) => Promise<void>
  onComment: (logId: string, content: string) => Promise<void>
  currentUserId?: string
  onDelete?: (logId: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
}

export function ReadingFeedCard({
  log,
  className,
  classLabel,
  liked = false,
  comments = [],
  onLike,
  onComment,
  currentUserId,
  onDelete,
  onDeleteComment,
}: ReadingFeedCardProps) {
  const [busy, setBusy] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)

  const handleLike = async () => {
    setBusy(true)
    try {
      await onLike(log.id, liked)
    } finally {
      setBusy(false)
    }
  }

  const handleComment = async (e: FormEvent) => {
    e.preventDefault()
    const content = commentText.trim()
    if (!content) return
    setBusy(true)
    setCommentError(null)
    try {
      await onComment(log.id, content)
      setCommentText('')
      setShowComments(true)
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : '댓글 등록 실패')
    } finally {
      setBusy(false)
    }
  }

  const bookLabel = `${log.bible_books?.name ?? '성경'} ${log.start_chapter}${
    log.end_chapter !== log.start_chapter ? `-${log.end_chapter}` : ''
  }장`
  const displayName = classLabel
    ? `${log.profiles?.name ?? '학생'} (${classLabel})`
    : (log.profiles?.name ?? '학생')

  return (
    <Card className={cn('space-y-3', className)}>
      <div className="flex items-start gap-3">
        {log.profiles?.profile_image ? (
          <img
            src={log.profiles.profile_image}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky/25 text-sm font-semibold text-sky-dark">
            {(log.profiles?.name ?? '?').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{displayName}</p>
              <p className="text-xs text-muted">
                {format(parseISO(log.created_at), 'a h:mm')}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-semibold text-sage-dark">
              📖 {bookLabel}
            </span>
          </div>
        </div>
      </div>

      {log.image_url ? (
        <img
          src={log.image_url}
          alt="인증 사진"
          className="max-h-80 w-full rounded-2xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex min-h-28 items-center justify-center rounded-2xl border border-line/60 bg-brand-50 px-4 text-center text-sm text-muted">
          No photo uploaded today, but reading completed.
        </div>
      )}

      {log.reflection ? (
        <p className="text-sm leading-relaxed text-ink/90">{log.reflection}</p>
      ) : null}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleLike()}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium transition',
            liked ? 'text-sage-dark' : 'text-muted hover:text-sage-dark',
          )}
        >
          <Hand className={cn('h-5 w-5', liked && 'fill-sage/30')} />
          응원하기
          <span className="tabular-nums">{log.encouragement_count ?? 0}</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="tabular-nums">{comments.length}</span>
        </button>
        {currentUserId === log.user_id && onDelete ? (
          <button
            type="button"
            className="ml-auto text-xs text-muted hover:text-danger"
            onClick={() => onDelete(log.id)}
          >
            삭제
          </button>
        ) : null}
      </div>

      {showComments ? (
        <div className="space-y-2 border-t border-line/50 pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-medium text-navy">{c.profiles?.name ?? '친구'}</span>{' '}
                <span className="text-ink/90">{c.content}</span>
              </p>
              {currentUserId === c.user_id && onDeleteComment ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted hover:text-danger"
                  onClick={() => void onDeleteComment(c.id)}
                >
                  삭제
                </button>
              ) : null}
            </div>
          ))}
          <form onSubmit={handleComment} className="flex gap-2">
            <Input
              value={commentText}
              maxLength={80}
              disabled={busy}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="응원 댓글"
              className="h-10 rounded-full"
            />
            <Button type="submit" size="sm" disabled={busy || !commentText.trim()}>
              등록
            </Button>
          </form>
          {commentError ? <p className="text-xs text-danger">{commentError}</p> : null}
        </div>
      ) : null}
    </Card>
  )
}

export type { EncouragementType }
