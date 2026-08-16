import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, MessageCircle, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { STUDENT_REACTIONS } from '@/lib/reactions'
import { isMaster } from '@/lib/roles'
import { useAuthStore } from '@/stores/authStore'
import {
  addChatterComment,
  createChatterPost,
  deleteChatterComment,
  deleteChatterPost,
  listChatterPosts,
  subscribeChatterChanges,
  toggleChatterReaction,
  updateChatterPost,
} from '@/services/chatterService'
import { uploadChatterPhoto } from '@/services/storageService'
import type { ChatterPost, ChatterReactionType, ReactionCounts } from '@/types'
import { cn } from '@/utils/cn'

export function ChatterBoard() {
  const profile = useAuthStore((s) => s.profile)!
  const [posts, setPosts] = useState<ChatterPost[]>([])
  const [content, setContent] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setPosts(await listChatterPosts(profile.id))
      setMissing(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '목록을 불러오지 못했어요'
      if (msg.toLowerCase().includes('wb_chatter') || msg.includes('schema cache')) {
        setMissing(true)
        return
      }
      setError(msg)
    }
  }, [profile.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (missing) return
    const unsubscribe = subscribeChatterChanges(() => {
      void refresh()
    })
    return () => unsubscribe()
  }, [missing, refresh])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const pickPhoto = (file?: File) => {
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      let imageUrl: string | null = null
      if (photo) {
        imageUrl = await uploadChatterPhoto(profile.id, photo)
      }
      await createChatterPost({
        authorId: profile.id,
        content: text,
        imageUrl,
      })
      setContent('')
      clearPhoto()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '글을 올리지 못했어요')
    } finally {
      setLoading(false)
    }
  }

  if (missing) {
    return (
      <Card className="py-10 text-center">
        <p className="font-medium text-navy">왁자지껄을 준비 중이에요</p>
        <p className="mt-1 text-sm text-muted">관리자가 023 마이그레이션을 실행하면 열려요.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 있었던 일, 생각난 말 한마디…"
          maxLength={500}
          className="min-h-24"
        />
        {photoPreview ? (
          <div className="relative overflow-hidden rounded-2xl">
            <img src={photoPreview} alt="" className="max-h-52 w-full object-cover" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white"
              aria-label="사진 삭제"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            사진 (선택)
          </Button>
          <Button type="submit" className="ml-auto" disabled={loading || !content.trim()}>
            {loading ? '올리는 중…' : '글 남기기'}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
      </form>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {posts.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-medium text-navy">아직 글이 없어요</p>
          <p className="mt-1 text-sm text-muted">첫 한마디를 남겨볼까요?</p>
        </Card>
      ) : (
        posts.map((post) => (
          <ChatterCard
            key={post.id}
            post={post}
            currentUserId={profile.id}
            canModerate={isMaster(profile.role)}
            onReaction={async (postId, type, active) => {
              await toggleChatterReaction(postId, profile.id, type, active)
              setPosts((prev) =>
                prev.map((item) => {
                  if (item.id !== postId) return item
                  const counts: ReactionCounts = { ...(item.reaction_counts ?? {}) }
                  const mine = new Set(item.my_reactions ?? [])
                  if (active) {
                    mine.delete(type)
                    counts[type] = Math.max(0, (counts[type] ?? 1) - 1)
                  } else {
                    mine.add(type)
                    counts[type] = (counts[type] ?? 0) + 1
                  }
                  return { ...item, reaction_counts: counts, my_reactions: [...mine] }
                }),
              )
            }}
            onEdit={async (postId, next) => {
              await updateChatterPost(postId, profile.id, next)
              setPosts((prev) =>
                prev.map((item) => (item.id === postId ? { ...item, content: next } : item)),
              )
            }}
            onDelete={async (postId) => {
              await deleteChatterPost(postId)
              setPosts((prev) => prev.filter((item) => item.id !== postId))
            }}
            onComment={async (postId, text) => {
              const row = await addChatterComment({
                postId,
                userId: profile.id,
                content: text,
              })
              setPosts((prev) =>
                prev.map((item) => {
                  if (item.id !== postId) return item
                  if ((item.comments ?? []).some((c) => c.id === row.id)) return item
                  return { ...item, comments: [...(item.comments ?? []), row] }
                }),
              )
            }}
            onDeleteComment={async (commentId) => {
              await deleteChatterComment(commentId)
              setPosts((prev) =>
                prev.map((item) => ({
                  ...item,
                  comments: (item.comments ?? []).filter((c) => c.id !== commentId),
                })),
              )
            }}
          />
        ))
      )}
    </div>
  )
}

function ChatterCard({
  post,
  currentUserId,
  canModerate,
  onReaction,
  onEdit,
  onDelete,
  onComment,
  onDeleteComment,
}: {
  post: ChatterPost
  currentUserId: string
  canModerate: boolean
  onReaction: (postId: string, type: ChatterReactionType, active: boolean) => Promise<void>
  onEdit: (postId: string, content: string) => Promise<void>
  onDelete: (postId: string) => Promise<void>
  onComment: (postId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.content)
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState((post.comments?.length ?? 0) > 0)
  const [busy, setBusy] = useState(false)
  const mine = currentUserId === post.author_id
  const mySet = new Set(post.my_reactions ?? [])
  const counts = post.reaction_counts ?? {}
  const comments = post.comments ?? []
  const name = post.profiles?.name ?? '친구'
  const timeLabel = format(parseISO(post.created_at), 'M/d a h:mm')

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        {post.profiles?.profile_image ? (
          <img
            src={post.profiles.profile_image}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-soft text-sm font-semibold text-sky-dark">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{name}</p>
          <p className="text-xs text-muted">{timeLabel}</p>
        </div>
      </div>

      {editing && mine ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            className="min-h-20"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !draft.trim()}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  try {
                    await onEdit(post.id, draft.trim())
                    setEditing(false)
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              저장
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-navy">{post.content}</p>
      )}

      {post.image_url ? (
        <img
          src={post.image_url}
          alt=""
          className="max-h-72 w-full rounded-2xl object-cover"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-t border-line/30 pt-2.5">
        {STUDENT_REACTIONS.map((r) => {
          const type = r.type as ChatterReactionType
          const active = mySet.has(type)
          return (
            <button
              key={type}
              type="button"
              disabled={busy}
              aria-label={r.label}
              aria-pressed={active}
              onClick={() =>
                void (async () => {
                  setBusy(true)
                  try {
                    await onReaction(post.id, type, active)
                  } finally {
                    setBusy(false)
                  }
                })()
              }
              className={cn(
                'inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-md px-1 text-[15px] leading-none transition active:scale-95',
                active ? 'bg-sage-soft/80' : 'hover:bg-brand-50',
              )}
            >
              <span aria-hidden>{r.emoji}</span>
              {(counts[type] ?? 0) > 0 ? (
                <span className="text-[11px] tabular-nums text-muted">{counts[type]}</span>
              ) : null}
            </button>
          )
        })}
        {mine || canModerate ? (
          <div className="ml-auto flex items-center gap-3">
            {mine ? (
              <button
                type="button"
                className="text-xs font-medium text-sky-dark hover:text-navy"
                onClick={() => {
                  setDraft(post.content)
                  setEditing(true)
                }}
              >
                수정
              </button>
            ) : null}
            <button
              type="button"
              className="text-xs text-muted hover:text-danger"
              onClick={() => {
                if (window.confirm('이 글을 삭제할까요?')) void onDelete(post.id)
              }}
            >
              삭제
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-muted hover:bg-brand-50 hover:text-navy"
        onClick={() => setShowComments((v) => !v)}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        댓글
        <span className="tabular-nums">{comments.length}</span>
      </button>

      {showComments ? (
        <div className="space-y-2 border-t border-line/50 pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-medium text-navy">{c.profiles?.name ?? '친구'}</span>{' '}
                <span className="text-ink/90">{c.content}</span>
              </p>
              {currentUserId === c.user_id || canModerate ? (
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
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const text = commentText.trim()
              if (!text) return
              void (async () => {
                await onComment(post.id, text)
                setCommentText('')
              })()
            }}
          >
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글 남기기"
              maxLength={80}
              className="h-10"
            />
            <Button type="submit" size="sm" disabled={!commentText.trim()}>
              등록
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  )
}
