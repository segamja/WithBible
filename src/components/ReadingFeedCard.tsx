import { useState, type FormEvent } from 'react'
import { MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  formatTogetherLabel,
  QUICK_COMMENTS,
  STUDENT_REACTIONS,
  TEACHER_REACTION,
  type ReactionDef,
} from '@/lib/reactions'
import type {
  EncouragementType,
  FeedComment,
  ReadingLogWithMeta,
  UserRole,
} from '@/types'
import { format, parseISO } from 'date-fns'
import { cn } from '@/utils/cn'

interface ReadingFeedCardProps {
  log: ReadingLogWithMeta
  className?: string
  classLabel?: string | null
  myReactions?: EncouragementType[]
  comments?: FeedComment[]
  currentUserId?: string
  currentUserRole?: UserRole
  onReaction: (logId: string, type: EncouragementType, active: boolean) => Promise<void>
  onReadAlong: (logId: string, active: boolean) => Promise<void>
  onComment: (logId: string, content: string) => Promise<void>
  onQuickComment: (logId: string, content: string) => Promise<void>
  onDelete?: (logId: string) => Promise<void>
  onDeleteComment?: (commentId: string) => Promise<void>
}

export function ReadingFeedCard({
  log,
  className,
  classLabel,
  myReactions = [],
  comments = [],
  currentUserId,
  currentUserRole = 'STUDENT',
  onReaction,
  onReadAlong,
  onComment,
  onQuickComment,
  onDelete,
  onDeleteComment,
}: ReadingFeedCardProps) {
  const [busy, setBusy] = useState(false)
  const [busyType, setBusyType] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(comments.length > 0)

  const isTeacher = currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN'
  const reactionButtons: ReactionDef[] = isTeacher
    ? [...STUDENT_REACTIONS, TEACHER_REACTION]
    : STUDENT_REACTIONS

  const mySet = new Set(myReactions.length ? myReactions : log.my_reactions ?? [])
  const counts = log.reaction_counts ?? {}
  const togetherLabel = formatTogetherLabel(
    (log.read_along_preview ?? []).map((p) => p.name),
    log.read_along_count ?? 0,
  )
  const myReadAlong = log.my_read_along ?? false

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(true)
    setBusyType(key)
    try {
      await fn()
    } finally {
      setBusy(false)
      setBusyType(null)
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

  const handleQuick = async (text: string) => {
    setCommentError(null)
    await run(`quick-${text}`, async () => {
      await onQuickComment(log.id, text)
    })
  }

  const bookLabel = `${log.bible_books?.name ?? '성경'} ${log.start_chapter}${
    log.end_chapter !== log.start_chapter ? `-${log.end_chapter}` : ''
  }장`
  const authorName = log.profiles?.name ?? '친구'
  const timeLabel = format(parseISO(log.created_at), 'a h:mm')

  const countLine = STUDENT_REACTIONS.filter((r) => (counts[r.type] ?? 0) > 0)
  const teacherCheerCount = counts.teacher_cheer ?? 0

  const myQuickSet = new Set(
    comments
      .filter((c) => c.user_id === currentUserId)
      .map((c) => c.content.trim()),
  )
  const quickCounts = Object.fromEntries(
    QUICK_COMMENTS.map((text) => [
      text,
      comments.filter((c) => c.content.trim() === text).length,
    ]),
  ) as Record<(typeof QUICK_COMMENTS)[number], number>

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
            {authorName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{authorName}</p>
              <p className="text-xs text-muted">
                {classLabel ? `${classLabel} · ` : ''}
                {timeLabel}
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
          사진 없이 읽기 인증을 남겼어요.
        </div>
      )}

      {log.reflection?.trim() ? (
        <blockquote className="rounded-2xl border border-line/40 bg-brand-50/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            오늘 말씀에서 마음에 남은 것
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-navy">
            “{log.reflection.trim()}”
          </p>
        </blockquote>
      ) : null}

      {teacherCheerCount > 0 ? (
        <p className="rounded-2xl bg-streak/15 px-3 py-2 text-sm font-medium text-navy">
          💛 선생님이 {authorName}님의 말씀읽기를 응원합니다.
        </p>
      ) : null}

      {(countLine.length > 0 || teacherCheerCount > 0) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums text-muted">
          {countLine.map((r) => (
            <span key={r.type} aria-label={`${r.label} ${counts[r.type]}`}>
              {r.emoji} {counts[r.type]}
            </span>
          ))}
          {teacherCheerCount > 0 ? (
            <span aria-label={`선생님 응원 ${teacherCheerCount}`}>
              💛 {teacherCheerCount}
            </span>
          ) : null}
        </div>
      )}

      {togetherLabel ? (
        <p className="text-sm font-medium text-sky-dark">🙌 {togetherLabel}</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-t border-line/30 pt-3">
        {reactionButtons.map((r) => {
          const active = mySet.has(r.type)
          return (
            <button
              key={r.type}
              type="button"
              disabled={busy}
              aria-label={r.label}
              aria-pressed={active}
              onClick={() =>
                void run(r.type, () => onReaction(log.id, r.type, active))
              }
              className={cn(
                'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg transition active:scale-95',
                active
                  ? 'bg-sage-soft ring-2 ring-sage/40'
                  : 'bg-brand-50 hover:bg-sky-soft',
                busyType === r.type && 'opacity-70',
              )}
            >
              <span aria-hidden>{r.emoji}</span>
            </button>
          )
        })}
        {currentUserId === log.user_id && onDelete ? (
          <button
            type="button"
            className="ml-auto self-center text-xs text-muted hover:text-danger"
            onClick={() => onDelete(log.id)}
          >
            삭제
          </button>
        ) : null}
      </div>

      {currentUserId && currentUserId !== log.user_id ? (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run('read-along', () => onReadAlong(log.id, myReadAlong))
          }
          className={cn(
            'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.99]',
            myReadAlong
              ? 'bg-sky-soft text-sky-dark'
              : 'border border-line/60 bg-panel text-navy hover:bg-brand-50',
          )}
        >
          🙌 나도 읽었어요
          {(log.read_along_count ?? 0) > 0 ? (
            <span className="tabular-nums opacity-80">{log.read_along_count}</span>
          ) : null}
        </button>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_COMMENTS.map((text) => {
          const active = myQuickSet.has(text)
          const n = quickCounts[text] ?? 0
          return (
            <button
              key={text}
              type="button"
              disabled={busy}
              aria-pressed={active}
              aria-label={`${text}${n > 0 ? ` ${n}명` : ''}`}
              onClick={() => void handleQuick(text)}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition active:scale-95',
                active
                  ? 'bg-sage-soft text-sage-dark ring-2 ring-sage/30'
                  : 'bg-brand-50 text-navy hover:bg-sky-soft',
              )}
            >
              <span>{text}</span>
              {n > 0 ? <span className="tabular-nums opacity-80">{n}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-brand-50 hover:text-navy"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-4 w-4" />
          댓글
          <span className="tabular-nums">{comments.length}</span>
        </button>
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
              placeholder="응원 한마디 남기기…"
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
