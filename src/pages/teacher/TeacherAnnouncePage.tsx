import { useEffect, useState, type FormEvent } from 'react'
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

export function TeacherAnnouncePage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [content, setContent] = useState('')
  const [list, setList] = useState<{ id: string; content: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    if (!project) return
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
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '공지 로드 실패'))
  }, [project, profile.class_id])

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
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">격려 공지</h1>
      <p className="text-muted">반 전체에게 따뜻한 메시지를 남겨주세요.</p>

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
