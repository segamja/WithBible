import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import {
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
} from '@/services/announcementService'

/** 담임 반 공지 작성 (교사 탭과 동일). 반 미배정이면 교사 홈으로. */
export function TeacherAnnouncePage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [content, setContent] = useState('')
  const [list, setList] = useState<{ id: string; content: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hasClass = Boolean(profile.class_id)

  const refresh = async () => {
    if (!project || !profile.class_id) return
    const rows = await listAnnouncements({
      projectId: project.id,
      classId: profile.class_id,
    })
    setList(rows.map((r) => ({ id: r.id, content: r.content })))
  }

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!hasClass) return
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '공지 로드 실패'))
  }, [project, profile.class_id, hasClass])

  if (!hasClass) {
    return <Navigate to="/teacher" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!project || !profile.class_id) return
    setLoading(true)
    setError(null)
    try {
      await createAnnouncement({
        projectId: project.id,
        classId: profile.class_id,
        authorId: profile.id,
        content: content.trim(),
      })
      setContent('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '공지 작성 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div>
        <Link to="/teacher" className="text-sm font-medium text-sky-dark hover:text-navy">
          ← 교사
        </Link>
        <p className="caption-caps mt-2">Teacher</p>
        <h1 className="page-title mt-1">공지사항</h1>
        <p className="mt-2 text-sm text-muted">
          우리 반 친구들 홈에만 보이는 메시지를 남겨주세요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Card>
          <Textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`우리 ${profile.name} 반!\n이번 주도 함께 읽어봐요.`}
          />
        </Card>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '등록 중…' : '공지 등록'}
        </Button>
      </form>

      <div className="space-y-3">
        {list.map((item) => (
          <Card key={item.id} className="space-y-2">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.content}</p>
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
          </Card>
        ))}
      </div>
    </div>
  )
}
