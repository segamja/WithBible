import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Flag, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  CHATTER_PICKER_REACTIONS,
  chatterCountTypes,
} from '@/lib/chatterReactions'
import { isMaster } from '@/lib/roles'
import { useAuthStore } from '@/stores/authStore'
import {
  addChatterComment,
  CHATTER_POST_DB_MAX,
  CHATTER_POST_MAX,
  CHATTER_REPLY_MAX,
  createChatterPost,
  deleteChatterComment,
  deleteChatterPost,
  hideChatterPost,
  listChatterPosts,
  reportChatterPost,
  subscribeChatterChanges,
  toggleChatterReaction,
  updateChatterPost,
} from '@/services/chatterService'
import type { ChatterPost, ChatterReactionCounts, ChatterReactionType } from '@/types'
import { cn } from '@/utils/cn'
import { todayChatterPrompt } from '@/utils/chatterPrompt'
import { chatterSafetyMessage } from '@/utils/chatterSafety'
import { formatPostedAtKst } from '@/utils/dday'

const NOTE_BG = ['bg-[#fbf6ea]', 'bg-sky-soft', 'bg-sage-soft', 'bg-[#f8e8e6]'] as const
const NOTE_ROT = ['-1.2deg', '1.3deg', '-0.7deg', '1deg'] as const

function noteTheme(id: string): { bg: string; rot: string } {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0
  const i = Math.abs(h) % NOTE_BG.length
  return { bg: NOTE_BG[i], rot: NOTE_ROT[i] }
}

export function ChatterBoard() {
  const profile = useAuthStore((s) => s.profile)!
  const [posts, setPosts] = useState<ChatterPost[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const prompt = todayChatterPrompt()

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

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = content.trim()
    if (!text || loading) return
    const blocked = chatterSafetyMessage(text)
    if (blocked) {
      setError(blocked)
      return
    }
    setLoading(true)
    setError(null)
    const tempId = `temp-${Date.now()}`
    const optimistic: ChatterPost = {
      id: tempId,
      author_id: profile.id,
      content: text,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { name: profile.name, profile_image: profile.profile_image },
      reaction_counts: {},
      my_reactions: [],
      comments: [],
    }
    setPosts((prev) => [optimistic, ...prev.filter((p) => p.id !== tempId)])
    setContent('')
    try {
      const row = await createChatterPost({ authorId: profile.id, content: text })
      setPosts((prev) => {
        const rest = prev.filter((p) => p.id !== tempId && p.id !== row.id)
        return [row, ...rest]
      })
    } catch (err) {
      setPosts((prev) => prev.filter((p) => p.id !== tempId))
      setContent(text)
      setError(err instanceof Error ? err.message : '글을 올리지 못했어요')
    } finally {
      setLoading(false)
    }
  }

  if (missing) {
    return (
      <div className="rounded-[1.25rem] bg-panel px-5 py-10 text-center shadow-[0_4px_20px_rgba(23,32,51,0.04)]">
        <p className="font-medium text-navy">시끌벅적을 준비 중이에요</p>
        <p className="mt-1 text-sm text-muted">관리자가 023 마이그레이션을 실행하면 열려요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-[17px] text-navy">그냥 한마디 하고 가!</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">오늘의 한마디 · {prompt}</p>
      </div>

      <LetterComposer
        value={content}
        loading={loading}
        onChange={setContent}
        onSubmit={() => void onSubmit()}
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {posts.length === 0 ? (
        <div className="rounded-[1.25rem] bg-[#fbf6ea] px-5 py-10 text-center shadow-[0_2px_10px_rgba(23,32,51,0.05)]">
          <p className="font-medium text-navy">아직 붙어 있는 메모가 없어요</p>
          <p className="mt-1 text-sm text-muted">편지지에 첫 한마디를 남겨볼까요?</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-x-clip px-1">
          {posts.map((post) => (
            <ChatterNote
              key={post.id}
              post={post}
              currentUserId={profile.id}
              canModerate={isMaster(profile.role)}
              pending={post.id.startsWith('temp-')}
              onReaction={async (postId, type, active) => {
                await toggleChatterReaction(postId, profile.id, type, active)
                setPosts((prev) =>
                  prev.map((item) => {
                    if (item.id !== postId) return item
                    const counts: ChatterReactionCounts = { ...(item.reaction_counts ?? {}) }
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
              onHide={async (postId) => {
                await hideChatterPost(postId)
                setPosts((prev) => prev.filter((item) => item.id !== postId))
              }}
              onReport={async (postId) => {
                await reportChatterPost(postId, profile.id)
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
          ))}
        </div>
      )}
    </div>
  )
}

function LetterComposer({
  value,
  loading,
  onChange,
  onSubmit,
}: {
  value: string
  loading: boolean
  onChange: (next: string) => void
  onSubmit: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [docked, setDocked] = useState(false)
  const [bottom, setBottom] = useState(0)

  useEffect(() => {
    if (!focused) {
      setDocked(false)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewBottom = vv.offsetTop + vv.height
      const covered = rect.bottom > viewBottom - 12
      setDocked(keyboard > 72 && covered)
      setBottom(keyboard)
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [focused])

  return (
    <>
      {docked ? <div className="h-[4.75rem]" aria-hidden /> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div
          ref={wrapRef}
          className={cn(
            'relative overflow-hidden rounded-[1.15rem] border border-[#ead9be] shadow-[0_2px_10px_rgba(23,32,51,0.05)]',
            docked && 'fixed inset-x-0 z-50 mx-auto max-w-lg px-5',
          )}
          style={docked ? { bottom: `calc(${bottom}px + 8px)` } : undefined}
        >
          <div
            className="relative bg-[#fbf6ea]"
            style={{
              backgroundImage:
                'linear-gradient(to bottom, transparent 27px, rgba(198,165,130,0.32) 28px)',
              backgroundSize: '100% 28px',
              backgroundPosition: '0 14px',
            }}
          >
            <div className="pointer-events-none absolute bottom-2 left-10 top-2 w-px bg-[#e8c4c4]/80" />
            <div className="flex items-end gap-2 py-2.5 pl-12 pr-2">
              <input
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, CHATTER_POST_MAX))}
                onFocus={() => setFocused(true)}
                onBlur={(e) => {
                  const next = e.relatedTarget as Node | null
                  if (wrapRef.current?.contains(next)) return
                  window.setTimeout(() => setFocused(false), 80)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSubmit()
                  }
                }}
                maxLength={CHATTER_POST_MAX}
                placeholder="한마디 남겨봐..."
                aria-label="한마디 남기기"
                className="min-w-0 flex-1 bg-transparent pb-0.5 text-[15px] text-navy outline-none placeholder:text-muted/55"
              />
              <button
                type="submit"
                disabled={loading || !value.trim()}
                aria-label="남기기"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white shadow-[0_3px_8px_rgba(23,32,51,0.18)] transition active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {value.length > 160 ? (
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
            {value.length}/{CHATTER_POST_MAX}
          </p>
        ) : null}
      </form>
    </>
  )
}

function ChatterNote({
  post,
  currentUserId,
  canModerate,
  pending,
  onReaction,
  onEdit,
  onDelete,
  onHide,
  onReport,
  onComment,
  onDeleteComment,
}: {
  post: ChatterPost
  currentUserId: string
  canModerate: boolean
  pending: boolean
  onReaction: (postId: string, type: ChatterReactionType, active: boolean) => Promise<void>
  onEdit: (postId: string, content: string) => Promise<void>
  onDelete: (postId: string) => Promise<void>
  onHide: (postId: string) => Promise<void>
  onReport: (postId: string) => Promise<void>
  onComment: (postId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.content)
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState((post.comments?.length ?? 0) > 0)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mine = currentUserId === post.author_id
  const mySet = new Set(post.my_reactions ?? [])
  const counts = post.reaction_counts ?? {}
  const comments = post.comments ?? []
  const name = post.profiles?.name ?? '친구'
  const { dateLabel, timeLabel } = formatPostedAtKst(post.created_at)
  const theme = noteTheme(post.id)
  const shown = chatterCountTypes(counts)
  const editMax = Math.min(CHATTER_POST_DB_MAX, Math.max(CHATTER_POST_MAX, post.content.length))

  return (
    <article
      className={cn(
        'relative px-3.5 pb-3 pt-4 shadow-[0_3px_10px_rgba(23,32,51,0.07)]',
        theme.bg,
        pending && 'opacity-70',
      )}
      style={{ transform: `rotate(${theme.rot})` }}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-0 h-2.5 w-11 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-white/70 shadow-sm"
      />
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-navy">{name}</p>
        <p className="shrink-0 text-[10px] text-muted">
          {dateLabel} · {timeLabel}
        </p>
      </div>

      {editing && mine ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={editMax}
            className="min-h-16 bg-white/60"
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
                  setNoteError(null)
                  try {
                    await onEdit(post.id, draft.trim())
                    setEditing(false)
                  } catch (err) {
                    setNoteError(err instanceof Error ? err.message : '수정하지 못했어요')
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
        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-snug text-navy">{post.content}</p>
      )}

      {post.image_url ? (
        <img
          src={post.image_url}
          alt=""
          className="mt-2 max-h-52 w-full rounded-lg object-cover"
        />
      ) : null}

      {noteError ? <p className="mt-2 text-xs text-danger">{noteError}</p> : null}
      {notice ? <p className="mt-2 text-xs text-sage-dark">{notice}</p> : null}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={busy || pending}
          className="inline-flex min-h-7 items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] leading-none hover:bg-white/50"
          onClick={() => setShowPicker((v) => !v)}
        >
          {shown.length === 0 ? (
            <span className="text-muted">＋</span>
          ) : (
            shown.map((r) => (
              <span key={r.type} className="inline-flex items-center gap-0.5">
                <span aria-hidden>{r.emoji}</span>
                <span className="text-[11px] tabular-nums text-muted">{counts[r.type]}</span>
              </span>
            ))
          )}
        </button>

        <button
          type="button"
          className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted hover:bg-white/50 hover:text-navy"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageCircle className="h-3 w-3" />
          답글
          {comments.length > 0 ? <span className="tabular-nums">{comments.length}</span> : null}
        </button>

        <div className="ml-auto flex items-center gap-2">
          {!mine && !pending ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/50 hover:text-navy"
              aria-label="신고"
              onClick={() => {
                if (!window.confirm('이 글을 신고할까요?')) return
                void (async () => {
                  setNoteError(null)
                  setNotice(null)
                  try {
                    await onReport(post.id)
                    setNotice('알려주셔서 고마워요.')
                  } catch (err) {
                    setNoteError(err instanceof Error ? err.message : '신고하지 못했어요')
                  }
                })()
              }}
            >
              <Flag className="h-3 w-3" />
            </button>
          ) : null}
          {mine ? (
            <button
              type="button"
              className="text-[11px] font-medium text-sky-dark hover:text-navy"
              onClick={() => {
                setDraft(post.content)
                setEditing(true)
              }}
            >
              수정
            </button>
          ) : null}
          {canModerate && !mine ? (
            <button
              type="button"
              className="text-[11px] text-muted hover:text-danger"
              onClick={() => {
                if (window.confirm('이 글을 숨길까요?')) {
                  void onHide(post.id).catch((err) => {
                    setNoteError(err instanceof Error ? err.message : '숨기지 못했어요')
                  })
                }
              }}
            >
              숨김
            </button>
          ) : null}
          {mine || canModerate ? (
            <button
              type="button"
              className="text-[11px] text-muted hover:text-danger"
              onClick={() => {
                if (window.confirm('이 글을 삭제할까요?')) void onDelete(post.id)
              }}
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>

      {showPicker ? (
        <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl bg-white/55 p-1.5">
          {CHATTER_PICKER_REACTIONS.map((r) => {
            const active = mySet.has(r.type)
            return (
              <button
                key={r.type}
                type="button"
                disabled={busy || pending}
                aria-label={r.label}
                aria-pressed={active}
                onClick={() =>
                  void (async () => {
                    setBusy(true)
                    setNoteError(null)
                    try {
                      await onReaction(post.id, r.type, active)
                    } catch (err) {
                      setNoteError(err instanceof Error ? err.message : '반응을 남기지 못했어요')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg text-[16px] transition active:scale-95',
                  active ? 'bg-sage-soft' : 'hover:bg-white',
                )}
              >
                <span aria-hidden>{r.emoji}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {showComments ? (
        <div className="mt-2 space-y-1.5 border-t border-navy/10 pt-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-[13px]">
              <p>
                <span className="font-medium text-navy">{c.profiles?.name ?? '친구'}</span>{' '}
                <span className="text-ink/90">{c.content}</span>
              </p>
              {currentUserId === c.user_id || canModerate ? (
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-muted hover:text-danger"
                  onClick={() => void onDeleteComment(c.id)}
                >
                  삭제
                </button>
              ) : null}
            </div>
          ))}
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const text = commentText.trim()
              if (!text || pending) return
              const blocked = chatterSafetyMessage(text)
              if (blocked) {
                setNoteError(blocked)
                return
              }
              void (async () => {
                setNoteError(null)
                try {
                  await onComment(post.id, text)
                  setCommentText('')
                } catch (err) {
                  setNoteError(err instanceof Error ? err.message : '답글을 남기지 못했어요')
                }
              })()
            }}
          >
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="한마디"
              maxLength={CHATTER_REPLY_MAX}
              className="h-9 rounded-xl bg-white/70 text-sm"
            />
            <Button type="submit" size="sm" disabled={!commentText.trim() || pending}>
              등록
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  )
}
