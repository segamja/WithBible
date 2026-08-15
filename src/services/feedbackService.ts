import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { Feedback, FeedbackKind } from '@/types'

export type FeedbackRow = Feedback & {
  profiles?: { name: string; role?: string } | null
}

export async function createFeedback(input: {
  userId: string
  kind: FeedbackKind
  content: string
}): Promise<void> {
  const content = input.content.trim()
  if (content.length < 5) throw new Error('내용을 조금 더 적어 주세요.')
  const { error } = await supabase.from(Tables.feedback).insert({
    user_id: input.userId,
    kind: input.kind,
    content,
  })
  if (error) throw new Error(error.message)
}

export async function listFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from(Tables.feedback)
    .select('*, profiles:wb_profiles(name, role)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as FeedbackRow[]
}

export async function countUnreadFeedback(): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.feedback)
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markFeedbackRead(id: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.feedback)
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from(Tables.feedback).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
