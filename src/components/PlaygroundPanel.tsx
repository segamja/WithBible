import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import {
  countByOption,
  deletePlaygroundResponse,
  getTodayPlayground,
  getYesterdayPlayground,
  listPlaygroundResponses,
  subscribePlaygroundResponses,
  upsertPlaygroundResponse,
} from '@/services/playgroundService'
import type { PlaygroundContent, PlaygroundResponse } from '@/types'
import { isMaster } from '@/lib/roles'
import { cn } from '@/utils/cn'

export function PlaygroundPanel() {
  const profile = useAuthStore((s) => s.profile)!
  const [content, setContent] = useState<PlaygroundContent | null>(null)
  const [responses, setResponses] = useState<PlaygroundResponse[]>([])
  const [yesterday, setYesterday] = useState<{
    content: PlaygroundContent
    responses: PlaygroundResponse[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justJoined, setJustJoined] = useState(false)
  const [textValue, setTextValue] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [today, yday] = await Promise.all([
        getTodayPlayground(),
        getYesterdayPlayground().catch(() => null),
      ])
      setYesterday(yday)
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
  const canChange = Boolean(content?.allow_change)
  const isChoice =
    content?.participation_type === 'POLL' || content?.participation_type === 'EMOTION'
  const isWord = content?.participation_type === 'WORD_INPUT'

  const submitChoice = async (optionId: string) => {
    if (!content || saving) return
    if (joined && !canChange) return
    setSaving(true)
    setError(null)
    try {
      await upsertPlaygroundResponse({
        contentId: content.id,
        userId: profile.id,
        optionId,
      })
      setJustJoined(true)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '고르지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  const submitText = async (e: FormEvent) => {
    e.preventDefault()
    if (!content || saving) return
    if (joined && !canChange) return
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
      setJustJoined(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '남기지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  const peekFriends = async () => {
    if (!content || saving) return
    if (joined) return
    setSaving(true)
    setError(null)
    try {
      await upsertPlaygroundResponse({
        contentId: content.id,
        userId: profile.id,
        optionId: 'peek',
      })
      setJustJoined(true)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="py-10 text-center">
        <p className="text-sm text-muted">오늘 질문 여는 중…</p>
      </Card>
    )
  }

  if (missing || !content || isWord) {
    return (
      <div className="space-y-4">
        <YesterdayRecap recap={yesterday} />
        <Card className="py-10 text-center">
          <p className="font-medium text-navy">오늘은 질문을 준비하는 중이에요</p>
          <p className="mt-1 text-sm text-muted">조금 뒤에 다시 들어와 볼까요?</p>
        </Card>
      </div>
    )
  }

  const optionCounts = countByOption(responses, content.options)
  const maxCount = Math.max(1, ...optionCounts.map((o) => o.count))
  const textList = responses.filter((r) => r.response_text?.trim())
  const showResults = joined && isChoice
  const showTexts = joined && !isChoice

  return (
    <div className="space-y-4">
      <YesterdayRecap recap={yesterday} />
      <Card className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted">🎮 놀이터</p>
          <p className="mt-1 text-sm font-semibold text-sky-dark">오늘 하나만 골라봐!</p>
          <h2 className="mt-2 font-display text-[1.45rem] leading-snug text-navy">
            {content.prompt}
          </h2>
        </div>

        {isChoice ? (
          <div className={cn('grid gap-2', content.options.length <= 2 ? 'grid-cols-1' : 'grid-cols-2')}>
            {content.options.map((opt) => {
              const selected = mine?.option_id === opt.id
              const locked = joined && !canChange
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={saving || locked}
                  onClick={() => void submitChoice(opt.id)}
                  className={cn(
                    'min-h-14 rounded-2xl border px-3 py-3.5 text-left text-[15px] font-semibold transition',
                    selected
                      ? 'border-navy bg-navy text-white'
                      : 'border-line/50 bg-brand-50 text-navy hover:border-sky hover:bg-sky-soft',
                    locked && !selected && 'opacity-60',
                  )}
                >
                  {opt.emoji ? <span className="mr-1.5 text-lg">{opt.emoji}</span> : null}
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : (
          <form onSubmit={(e) => void submitText(e)} className="space-y-2">
            {!joined || canChange ? (
              <>
                <Textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="한 줄만 있어도 OK!"
                  maxLength={80}
                  className="min-h-20"
                />
                <Button type="submit" className="w-full" disabled={saving || !textValue.trim()}>
                  {saving ? '남기는 중…' : '등록'}
                </Button>
                {!joined ? (
                  <button
                    type="button"
                    className="w-full text-sm font-medium text-sky-dark"
                    disabled={saving}
                    onClick={() => void peekFriends()}
                  >
                    건너뛰고 친구들 답 보기
                  </button>
                ) : null}
              </>
            ) : (
              <p className="rounded-2xl bg-brand-50 px-3 py-2 text-sm text-navy">참여 완료!</p>
            )}
          </form>
        )}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {justJoined && joined ? (
          <p className="text-sm font-semibold text-sage-dark">참여 완료!</p>
        ) : null}
      </Card>

      {showResults ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-navy">친구들은 이렇게 골랐어요</p>
          {optionCounts.map((opt) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy">
                  {opt.emoji ? `${opt.emoji} ` : ''}
                  {opt.label}
                </span>
                <span className="tabular-nums font-medium text-navy">{opt.percent}%</span>
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

      {showTexts ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-navy">친구들의 답</p>
          {textList.length === 0 ? (
            <p className="text-sm text-muted">아직 한 줄이 없어요. 첫 번째여도 괜찮아요.</p>
          ) : (
            <ul className="space-y-2">
              {textList.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2 text-sm">
                  <p>
                    <span className="font-medium text-navy">{row.profiles?.name ?? '친구'}</span>{' '}
                    <span className="text-ink/90">{row.response_text}</span>
                  </p>
                  {isMaster(profile.role) ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-muted hover:text-danger"
                      onClick={() => {
                        if (window.confirm('이 답을 삭제할까요?')) {
                          void deletePlaygroundResponse(row.id).then(() => refresh())
                        }
                      }}
                    >
                      삭제
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  )
}

function YesterdayRecap({
  recap,
}: {
  recap: { content: PlaygroundContent; responses: PlaygroundResponse[] } | null
}) {
  if (!recap) return null
  const optionCounts = countByOption(recap.responses, recap.content.options)
  const voted = optionCounts.filter((o) => o.count > 0)
  const maxPercent = voted.length === 0 ? 0 : Math.max(...voted.map((o) => o.percent))
  const winners = voted.filter((o) => o.percent === maxPercent)
  const maxCount = Math.max(1, ...optionCounts.map((o) => o.count))

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-navy">어제 친구들은 이렇게 골랐어요</p>
        <p className="mt-1 text-sm leading-snug text-muted">{recap.content.prompt}</p>
      </div>
      {voted.length === 0 ? (
        <p className="text-sm text-muted">어제 참여한 친구가 아직 없어요.</p>
      ) : (
        <>
          {winners.length === 1 ? (
            <p className="rounded-2xl bg-sage-soft px-3 py-2 text-sm font-semibold text-navy">
              1등 · {winners[0].emoji ? `${winners[0].emoji} ` : ''}
              {winners[0].label} {winners[0].percent}%
            </p>
          ) : (
            <p className="rounded-2xl bg-sage-soft px-3 py-2 text-sm font-semibold text-navy">
              공동 1등 · {winners.map((w) => `${w.emoji ? `${w.emoji} ` : ''}${w.label} ${w.percent}%`).join(' · ')}
            </p>
          )}
          {optionCounts.map((opt) => (
            <div key={opt.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-navy">
                  {opt.emoji ? `${opt.emoji} ` : ''}
                  {opt.label}
                </span>
                <span className="tabular-nums font-medium text-navy">{opt.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-50">
                <div
                  className="h-full rounded-full bg-sky/70"
                  style={{ width: `${Math.round((opt.count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
