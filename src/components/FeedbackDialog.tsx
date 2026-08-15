import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Textarea'
import { createFeedback } from '@/services/feedbackService'
import type { FeedbackKind } from '@/types'

export function FeedbackDialog({
  userId,
  open,
  onClose,
}: {
  userId: string
  open: boolean
  onClose: () => void
}) {
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setKind('bug')
    setContent('')
    setError(null)
    setSuccess(false)
  }, [open])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await createFeedback({ userId, kind, content })
      setSuccess(true)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송 실패')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      onClick={onClose}
    >
      <Card className="w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <p id="feedback-dialog-title" className="text-sm font-medium text-navy">
          버그신고 / 기능제안
        </p>
        {success ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-sage-dark">
              관리자에게 전달했어요. 확인 후 반영할게요.
            </p>
            <Button type="button" className="w-full" onClick={onClose}>
              닫기
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div className="flex gap-2">
              <Chip selected={kind === 'bug'} onClick={() => setKind('bug')}>
                버그신고
              </Chip>
              <Chip selected={kind === 'feature'} onClick={() => setKind('feature')}>
                기능제안
              </Chip>
            </div>
            <Textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                kind === 'bug'
                  ? '어떤 화면에서, 무엇을 눌렀을 때 문제가 생겼는지 적어 주세요.'
                  : '있으면 좋겠는 기능을 구체적으로 적어 주세요.'
              }
              rows={5}
              maxLength={2000}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? '보내는 중…' : '보내기'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
