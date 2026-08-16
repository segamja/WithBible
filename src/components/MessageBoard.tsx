import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type AnnouncementRow,
} from '@/services/announcementService'
import type { AnnouncementKind } from '@/types'
import { formatSeoulDateTime } from '@/utils/seoul'

export function MessageBoard({
  projectId,
  authorId,
  kind,
  classId = null,
  title,
  hint,
  placeholder,
  canWrite,
  showHistory,
}: {
  projectId: string
  authorId: string
  kind: AnnouncementKind
  classId?: string | null
  title: string
  hint: string
  placeholder: string
  canWrite: boolean
  showHistory?: boolean
}) {
  const keepHistory = showHistory ?? kind !== 'cheer'
  const [content, setContent] = useState('')
  const [list, setList] = useState<AnnouncementRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!keepHistory) return
    const rows = await listAnnouncements({ projectId, kind, classId })
    setList(kind === 'notice' ? rows.filter((r) => r.class_id == null) : rows)
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요'))
  }, [projectId, kind, classId, keepHistory])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text || !canWrite) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await createAnnouncement({
        projectId,
        classId: kind === 'notice' ? null : classId,
        authorId,
        content: text,
        kind,
      })
      setContent('')
      if (keepHistory) {
        await load()
      } else {
        setSuccess(
          classId
            ? '우리 반 홈에 전달됐어요. 오늘 하루 동안 보여요.'
            : '모든 학생 홈에 전달됐어요. 오늘 하루 동안 보여요.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-title text-base">{title}</h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {canWrite ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <Card>
            <Textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              rows={4}
            />
          </Card>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {success ? <p className="text-sm text-sage-dark">{success}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '등록 중…' : '등록'}
          </Button>
        </form>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : null}
      {keepHistory ? (
        <div className="space-y-3">
          {list.length === 0 ? (
            <p className="text-sm text-muted">아직 등록된 글이 없습니다.</p>
          ) : (
            list.map((item) => (
              <Card key={item.id} className="space-y-2">
                <p className="text-xs text-muted">
                  {item.profiles?.name ? `${item.profiles.name} · ` : ''}
                  {formatSeoulDateTime(item.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.content}</p>
                {canWrite ? (
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-danger"
                    onClick={() =>
                      void deleteAnnouncement(item.id).then(() =>
                        setList((prev) => prev.filter((x) => x.id !== item.id)),
                      )
                    }
                  >
                    삭제
                  </button>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
