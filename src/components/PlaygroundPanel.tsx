import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import {
  countByOption,
  getTodayPlayground,
  listPlaygroundResponses,
  subscribePlaygroundResponses,
  upsertPlaygroundResponse,
} from '@/services/playgroundService'
import type { PlaygroundContent, PlaygroundResponse } from '@/types'
import { cn } from '@/utils/cn'

const CATEGORY_LABEL: Record<PlaygroundContent['category'], string> = {
  SCHOOL: '학교',
  FOOD: '음식',
  GAME: '놀이',
  EMOTION: '마음',
  TEXT: '한마디',
  THANKFUL: '감사',
  BIBLE_LIGHT: '말씀',
}

export function PlaygroundPanel() {
  const profile = useAuthStore((s) => s.profile)!
  const [content, setContent] = useState<PlaygroundContent | null>(null)
  const [responses, setResponses] = useState<PlaygroundResponse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [textValue, setTextValue] = useState('')

  const refresh = useCallback(async () => {
    try {
      const today = await getTodayPlayground()
      if (!today) {
        setMissing(true)
        setContent(null)
        return
      }
      setMissing(false)
      setContent(today)
      const list = await listPlaygroundResponses(today.id)
      setResponses(list)
      const mine = list.find((r) => r.user_id === profile.id)
      if (mine?.response_text) setTextValue(mine.response_text)
    } catch (e) {
      setError(e instanceof Error ? e.message : '놀이터를 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }, [profile.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!content?.id) return
    const unsubscribe = subscribePlaygroundResponses(content.id, () => {
      void listPlaygroundResponses(content.id).then(setResponses)
    })
    return () => unsubscribe()
  }, [content?.id])

  const mine = responses.find((r) => r.user_id === profile.id) ?? null
  const joined = Boolean(mine)

  const submitChoice = async (optionId: string) => {
    if (!content || saving) return
    setSaving(true)
    setError(null)
    try {
      await upsertPlaygroundResponse({
        contentId: content.id,
        userId: profile.id,
        optionId,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '참여하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  const submitText = async (e: FormEvent) => {
    e.preventDefault()
    if (!content || saving) return
    const text = textValue.trim()
    if (!text) return
    setSaving(true)
    setError(null)
    try {
      await upsertPlaygroundResponse({
        contentId: content.id,
        userId: profile.id,
        responseText: text,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="py-10 text-center">
        <p className="text-sm text-muted">오늘의 놀이터를 열고 있어요…</p>
      </Card>
    )
  }

  if (missing || !content) {
    return (
      <Card className="py-10 text-center">
        <p className="font-medium text-navy">놀이터를 준비 중이에요</p>
        <p className="mt-1 text-sm text-muted">관리자가 023 마이그레이션을 실행하면 열려요.</p>
      </Card>
    )
  }

  const optionCounts = countByOption(responses, content.options)
  const maxCount = Math.max(1, ...optionCounts.map((o) => o.count))
  const isChoice =
    content.participation_type === 'POLL' || content.participation_type === 'EMOTION'
  const textList = responses.filter((r) => r.response_text?.trim())

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted">
            오늘의 놀이터 · {CATEGORY_LABEL[content.category]}
          </p>
          <h2 className="mt-1 font-display text-xl text-navy">{content.title}</h2>
          <p className="mt-1 text-xs text-muted">매일 새로운 내용으로 바뀌어요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{content.prompt}</p>
          {content.participation_type === 'WORD_INPUT' && content.starting_word ? (
            <p className="mt-2 rounded-2xl bg-brand-50 px-3 py-2 text-sm font-medium text-navy">
              시작 단어 · {content.starting_word}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">{responses.length}명 참여</p>
        </div>

        {isChoice ? (
          <div className="grid grid-cols-2 gap-2">
            {content.options.map((opt) => {
              const selected = mine?.option_id === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={saving}
                  onClick={() => void submitChoice(opt.id)}
                  className={cn(
                    'min-h-14 rounded-2xl border px-3 py-3 text-left text-sm font-medium transition',
                    selected
                      ? 'border-navy bg-navy text-white'
                      : 'border-line/50 bg-brand-50 text-navy hover:border-sky hover:bg-sky-soft',
                  )}
                >
                  {opt.emoji ? <span className="mr-1.5">{opt.emoji}</span> : null}
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : (
          <form onSubmit={(e) => void submitText(e)} className="space-y-2">
            {content.participation_type === 'WORD_INPUT' ? (
              <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="이어서 한 단어"
                maxLength={12}
              />
            ) : (
              <Textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="짧은 한마디를 남겨주세요"
                maxLength={80}
                className="min-h-20"
              />
            )}
            <Button type="submit" className="w-full" disabled={saving || !textValue.trim()}>
              {mine ? (saving ? '수정 중…' : '수정하기') : saving ? '참여 중…' : '참여하기'}
            </Button>
          </form>
        )}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </Card>

      {joined && isChoice ? (
        <Card className="space-y-3">
          <p className="text-sm font-medium text-muted">참여 결과 · 명 수만 보여요</p>
          {optionCounts.map((opt) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy">
                  {opt.emoji ? `${opt.emoji} ` : ''}
                  {opt.label}
                </span>
                <span className="tabular-nums text-muted">{opt.count}명</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-50">
                <div
                  className="h-full rounded-full bg-sky/70"
                  style={{ width: `${Math.round((opt.count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {joined && !isChoice ? (
        <Card className="space-y-3">
          <p className="text-sm font-medium text-muted">
            {content.participation_type === 'WORD_INPUT' ? '이어진 단어' : '남겨진 한마디'}
          </p>
          {content.participation_type === 'WORD_INPUT' && content.starting_word ? (
            <p className="text-sm font-semibold text-navy">{content.starting_word}</p>
          ) : null}
          {textList.length === 0 ? (
            <p className="text-sm text-muted">아직 이어진 말이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {textList.map((row) => (
                <li key={row.id} className="text-sm">
                  {content.participation_type === 'WORD_INPUT' ? (
                    <span className="font-medium text-navy">{row.response_text}</span>
                  ) : (
                    <>
                      <span className="font-medium text-navy">
                        {row.profiles?.name ?? '친구'}
                      </span>{' '}
                      <span className="text-ink/90">{row.response_text}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {!joined ? (
        <p className="px-1 text-center text-xs text-muted">
          참여하면 오늘 결과를 볼 수 있어요. 순위는 없고, 내일은 다른 내용으로 바뀌어요.
        </p>
      ) : null}
    </div>
  )
}
