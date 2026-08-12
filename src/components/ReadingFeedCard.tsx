import { useState, type FormEvent } from 'react'
import { Heart } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { EncouragementType, FeedComment, ReadingLogWithMeta } from '@/types'
import { format, parseISO } from 'date-fns'
import { cn } from '@/utils/cn'

interface ReadingFeedCardProps {
  log: ReadingLogWithMeta
  className?: string
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
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : '댓글 등록 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('space-y-3 overflow-hidden p-0', className)}>
      {log.image_url ? (
        <img
          src={log.image_url}
          alt="인증 사진"
          className="max-h-80 w-full object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{log.profiles?.name ?? '학생'}</p>
            <p className="text-xs text-muted">
              {format(parseISO(log.created_at), 'M월 d일 HH:mm')}
              {log.visibility === 'public' ? ' · 전체공개' : ' · 반공개'}
            </p>
          </div>
          {currentUserId === log.user_id && onDelete ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-danger"
              onClick={() => onDelete(log.id)}
            >
              삭제
            </button>
          ) : null}
        </div>

        <p className="text-sm font-medium text-sky-dark">
          {log.bible_books?.name ?? '성경'} {log.start_chapter}
          {log.end_chapter !== log.start_chapter ? `~${log.end_chapter}` : ''}장
        </p>

        {log.reflection ? (
          <blockquote className="border-l-2 border-sage pl-3 text-sm leading-relaxed text-ink/90">
            “{log.reflection}”
          </blockquote>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-sm text-muted">
            응원 {log.encouragement_count ?? 0} · 댓글 {comments.length}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleLike()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
              liked
                ? 'border-sage/50 bg-sage/15 text-sage-dark'
                : 'border-line text-muted hover:border-sage/40 hover:text-sage-dark',
            )}
          >
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
            {liked ? '응원 취소' : '응원하기'}
          </button>
        </div>

        <div className="space-y-2 border-t border-line/70 pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-medium text-navy">
                  {c.profiles?.name ?? '친구'}
                </span>{' '}
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
              placeholder="한 줄 댓글 (최대 80자)"
              className="h-10"
            />
            <Button type="submit" size="sm" disabled={busy || !commentText.trim()}>
              등록
            </Button>
          </form>
          {commentError ? <p className="text-xs text-danger">{commentError}</p> : null}
        </div>
      </div>
    </Card>
  )
}

export type { EncouragementType }
