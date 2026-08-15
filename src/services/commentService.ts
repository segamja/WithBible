import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { FeedComment } from '@/types'
import { isUuid, requireUuid } from '@/utils/uuid'

export async function listCommentsForLogs(
  logIds: string[],
): Promise<Record<string, FeedComment[]>> {
  if (logIds.length === 0) return {}
  const { data, error } = await supabase
    .from(Tables.comments)
    .select('*, profiles:wb_profiles(name)')
    .in('reading_log_id', logIds)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const map: Record<string, FeedComment[]> = {}
  for (const row of data ?? []) {
    const item = row as FeedComment
    const key = item.reading_log_id
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}

export async function addComment(input: {
  readingLogId: string
  userId: string
  content: string
}): Promise<FeedComment> {
  const readingLogId = requireUuid(input.readingLogId, 'readingLogId')
  const userId = requireUuid(input.userId, 'userId')
  const content = input.content.trim()
  if (!content) throw new Error('댓글을 입력해주세요.')
  if (content.length > 80) throw new Error('댓글은 80자 이내로 작성해주세요.')

  const { data, error } = await supabase
    .from(Tables.comments)
    .insert({
      reading_log_id: readingLogId,
      user_id: userId,
      content,
    })
    .select('*, profiles:wb_profiles(name)')
    .single()
  if (error) throw new Error(error.message)

  try {
    await supabase.rpc('wb_notify_log_owner', {
      p_log_id: readingLogId,
      p_actor_id: userId,
      p_kind: 'comment',
      p_reaction_type: null,
      p_message: '친구가 응원 댓글을 남겼어요.',
    })
  } catch {
    /* best-effort */
  }

  return data as FeedComment
}

export async function deleteComment(id: string, userId: string): Promise<void> {
  if (!isUuid(id)) return
  const { error } = await supabase
    .from(Tables.comments)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}
