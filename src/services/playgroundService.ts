import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type {
  PlaygroundContent,
  PlaygroundOption,
  PlaygroundParticipationType,
  PlaygroundResponse,
} from '@/types'
import { requireUuid } from '@/utils/uuid'

function isMissingTable(error: { message?: string; code?: string } | null): boolean {
  const msg = (error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST205' ||
    msg.includes('wb_playground') ||
    msg.includes('wb_get_today_playground') ||
    msg.includes('schema cache')
  )
}

function parseOptions(raw: unknown): PlaygroundOption[] {
  if (!Array.isArray(raw)) return []
  const out: PlaygroundOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : null
    const label = typeof row.label === 'string' ? row.label : null
    if (!id || !label) continue
    out.push({
      id,
      label,
      emoji: typeof row.emoji === 'string' ? row.emoji : undefined,
    })
  }
  return out
}

function parseContent(raw: unknown): PlaygroundContent | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null
  const type = row.participation_type
  if (
    type !== 'POLL' &&
    type !== 'EMOTION' &&
    type !== 'TEXT' &&
    type !== 'WORD_INPUT'
  ) {
    return null
  }
  return {
    id: row.id,
    category: row.category as PlaygroundContent['category'],
    title: row.title,
    prompt: typeof row.prompt === 'string' ? row.prompt : row.title,
    participation_type: type as PlaygroundParticipationType,
    options: parseOptions(row.options),
    starting_word: typeof row.starting_word === 'string' ? row.starting_word : null,
    allowed_days_of_week: Array.isArray(row.allowed_days_of_week)
      ? row.allowed_days_of_week.filter((d): d is string => typeof d === 'string')
      : [],
    safety_level: typeof row.safety_level === 'string' ? row.safety_level : 'SAFE',
    active: row.active !== false,
    allow_change: row.allow_change === true,
    played_date: typeof row.played_date === 'string' ? row.played_date : '',
  }
}

export async function getTodayPlayground(): Promise<PlaygroundContent | null> {
  const { data, error } = await supabase.rpc('wb_get_today_playground')
  if (error) {
    if (isMissingTable(error)) return null
    throw new Error(error.message)
  }
  return parseContent(data)
}

export async function listPlaygroundResponses(
  contentId: string,
): Promise<PlaygroundResponse[]> {
  const id = requireUuid(contentId, 'contentId')
  const { data, error } = await supabase
    .from(Tables.playgroundResponses)
    .select('*, profiles:wb_profiles(name)')
    .eq('content_id', id)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []) as PlaygroundResponse[]
}

export async function upsertPlaygroundResponse(input: {
  contentId: string
  userId: string
  optionId?: string | null
  responseText?: string | null
}): Promise<void> {
  const contentId = requireUuid(input.contentId, 'contentId')
  const userId = requireUuid(input.userId, 'userId')
  const optionId = input.optionId?.trim() || null
  const responseText = input.responseText?.trim() || null
  if (!optionId && !responseText) {
    throw new Error('참여 내용을 입력해주세요.')
  }
  if (responseText && responseText.length > 80) {
    throw new Error('80자 이내로 작성해주세요.')
  }

  const { error } = await supabase.from(Tables.playgroundResponses).upsert(
    {
      content_id: contentId,
      user_id: userId,
      option_id: optionId,
      response_text: responseText,
    },
    { onConflict: 'content_id,user_id' },
  )
  if (error) throw new Error(error.message)
}

export async function getPlaygroundTeaser(): Promise<{
  title: string
  prompt: string
  participantCount: number
} | null> {
  const today = await getTodayPlayground()
  if (!today) return null
  const list = await listPlaygroundResponses(today.id)
  return {
    title: today.title,
    prompt: today.prompt,
    participantCount: list.length,
  }
}

export function subscribePlaygroundResponses(
  contentId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`wb-playground-${contentId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.playgroundResponses,
        filter: `content_id=eq.${contentId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function countByOption(
  responses: PlaygroundResponse[],
  options: PlaygroundOption[],
): { id: string; label: string; emoji?: string; count: number; percent: number }[] {
  const map = new Map<string, number>()
  let total = 0
  for (const row of responses) {
    if (!row.option_id || row.option_id === 'peek') continue
    map.set(row.option_id, (map.get(row.option_id) ?? 0) + 1)
    total += 1
  }
  return options.map((opt) => {
    const count = map.get(opt.id) ?? 0
    return {
      ...opt,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    }
  })
}

export async function listPlaygroundContents(): Promise<PlaygroundContent[]> {
  const { data, error } = await supabase
    .from(Tables.playgroundContents)
    .select('*')
    .order('active', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => parseContent({ ...row, played_date: '' }))
    .filter((row): row is PlaygroundContent => Boolean(row))
}

export async function setPlaygroundActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from(Tables.playgroundContents)
    .update({ active })
    .eq('id', requireUuid(id, 'id'))
  if (error) throw new Error(error.message)
}

export async function createPlaygroundPoll(input: {
  category: PlaygroundContent['category']
  title: string
  prompt: string
  options: PlaygroundOption[]
  days: string[]
}): Promise<void> {
  const { error } = await supabase.from(Tables.playgroundContents).insert({
    category: input.category,
    title: input.title.trim() || '오늘 하나만 골라봐',
    prompt: input.prompt.trim(),
    participation_type: 'POLL',
    options: input.options,
    allowed_days_of_week: input.days,
    safety_level: 'SAFE',
    active: true,
    allow_change: false,
  })
  if (error) throw new Error(error.message)
}

export async function deletePlaygroundResponse(id: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.playgroundResponses)
    .delete()
    .eq('id', requireUuid(id, 'id'))
  if (error) throw new Error(error.message)
}
