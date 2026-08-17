import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type {
  ChatterComment,
  ChatterPost,
  ChatterReactionCounts,
  ChatterReactionType,
} from '@/types'
import { chatterSafetyMessage } from '@/utils/chatterSafety'
import { requireUuid } from '@/utils/uuid'

export const CHATTER_POST_MAX = 200
export const CHATTER_POST_DB_MAX = 500
export const CHATTER_REPLY_MAX = 80

type ReactionRow = { post_id: string; user_id: string; type: ChatterReactionType }

function attachMeta(
  posts: ChatterPost[],
  reactions: ReactionRow[],
  comments: ChatterComment[],
  currentUserId?: string,
): ChatterPost[] {
  const reactionsByPost = new Map<string, ReactionRow[]>()
  for (const row of reactions) {
    const list = reactionsByPost.get(row.post_id) ?? []
    list.push(row)
    reactionsByPost.set(row.post_id, list)
  }
  const commentsByPost = new Map<string, ChatterComment[]>()
  for (const row of comments) {
    const list = commentsByPost.get(row.post_id) ?? []
    list.push(row)
    commentsByPost.set(row.post_id, list)
  }

  return posts.map((post) => {
    const rows = reactionsByPost.get(post.id) ?? []
    const reaction_counts: ChatterReactionCounts = {}
    const my_reactions: ChatterReactionType[] = []
    for (const row of rows) {
      reaction_counts[row.type] = (reaction_counts[row.type] ?? 0) + 1
      if (currentUserId && row.user_id === currentUserId) {
        my_reactions.push(row.type)
      }
    }
    return {
      ...post,
      reaction_counts,
      my_reactions,
      comments: commentsByPost.get(post.id) ?? [],
    }
  })
}

function missingSchema(message: string, needle: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes(needle.toLowerCase()) || lower.includes('schema cache')
}

export async function listChatterPosts(currentUserId: string): Promise<ChatterPost[]> {
  const uid = requireUuid(currentUserId, 'userId')
  const select = '*, profiles:wb_profiles(name, profile_image)'

  let { data, error } = await supabase
    .from(Tables.chatterPosts)
    .select(select)
    .is('hidden_at', null)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error && /hidden_at/i.test(error.message)) {
    ;({ data, error } = await supabase
      .from(Tables.chatterPosts)
      .select(select)
      .order('created_at', { ascending: false })
      .limit(80))
  }
  if (error) throw new Error(error.message)

  const posts = (data ?? []) as ChatterPost[]
  const ids = posts.map((p) => p.id)
  if (ids.length === 0) return []

  const [{ data: reactions, error: reactionError }, { data: comments, error: commentError }] =
    await Promise.all([
      supabase
        .from(Tables.chatterReactions)
        .select('post_id, user_id, type')
        .in('post_id', ids),
      supabase
        .from(Tables.chatterComments)
        .select('*, profiles:wb_profiles(name)')
        .in('post_id', ids)
        .order('created_at', { ascending: true }),
    ])
  if (reactionError) throw new Error(reactionError.message)
  if (commentError) throw new Error(commentError.message)

  return attachMeta(
    posts,
    (reactions ?? []) as ReactionRow[],
    (comments ?? []) as ChatterComment[],
    uid,
  )
}

export async function createChatterPost(input: {
  authorId: string
  content: string
}): Promise<ChatterPost> {
  const authorId = requireUuid(input.authorId, 'authorId')
  const content = input.content.trim()
  if (!content) throw new Error('한마디를 입력해주세요.')
  if (content.length > CHATTER_POST_MAX) {
    throw new Error(`글은 ${CHATTER_POST_MAX}자 이내로 작성해주세요.`)
  }
  const blocked = chatterSafetyMessage(content)
  if (blocked) throw new Error(blocked)

  const { data, error } = await supabase
    .from(Tables.chatterPosts)
    .insert({
      author_id: authorId,
      content,
    })
    .select('*, profiles:wb_profiles(name, profile_image)')
    .single()
  if (error) throw new Error(error.message)
  return {
    ...(data as ChatterPost),
    reaction_counts: {},
    my_reactions: [],
    comments: [],
  }
}

export async function updateChatterPost(
  id: string,
  authorId: string,
  content: string,
): Promise<void> {
  const postId = requireUuid(id, 'postId')
  const uid = requireUuid(authorId, 'authorId')
  const text = content.trim()
  if (!text) throw new Error('한마디를 입력해주세요.')
  if (text.length > CHATTER_POST_DB_MAX) {
    throw new Error(`글은 ${CHATTER_POST_DB_MAX}자 이내로 작성해주세요.`)
  }
  const blocked = chatterSafetyMessage(text)
  if (blocked) throw new Error(blocked)

  const { error } = await supabase
    .from(Tables.chatterPosts)
    .update({ content: text })
    .eq('id', postId)
    .eq('author_id', uid)
  if (error) throw new Error(error.message)
}

export async function deleteChatterPost(id: string): Promise<void> {
  const postId = requireUuid(id, 'postId')
  const { error } = await supabase.from(Tables.chatterPosts).delete().eq('id', postId)
  if (error) throw new Error(error.message)
}

export async function hideChatterPost(id: string): Promise<void> {
  const postId = requireUuid(id, 'postId')
  const { error } = await supabase
    .from(Tables.chatterPosts)
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) {
    if (/hidden_at/i.test(error.message)) {
      throw new Error('숨기기는 027 마이그레이션 후에 열려요.')
    }
    throw new Error(error.message)
  }
}

export async function reportChatterPost(postId: string, reporterId: string): Promise<void> {
  const pid = requireUuid(postId, 'postId')
  const uid = requireUuid(reporterId, 'reporterId')
  const { error } = await supabase.from(Tables.chatterReports).insert({
    post_id: pid,
    reporter_id: uid,
  })
  if (error?.code === '23505') throw new Error('이미 알려주셨어요.')
  if (error) {
    if (missingSchema(error.message, 'wb_chatter_reports')) {
      throw new Error('신고 기능은 027 마이그레이션 후에 열려요.')
    }
    throw new Error(error.message)
  }
}

export async function toggleChatterReaction(
  postId: string,
  userId: string,
  type: ChatterReactionType,
  active: boolean,
): Promise<void> {
  const pid = requireUuid(postId, 'postId')
  const uid = requireUuid(userId, 'userId')
  if (active) {
    const { error } = await supabase
      .from(Tables.chatterReactions)
      .delete()
      .eq('post_id', pid)
      .eq('user_id', uid)
      .eq('type', type)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await supabase.from(Tables.chatterReactions).insert({
    post_id: pid,
    user_id: uid,
    type,
  })
  if (error && error.code !== '23505') {
    if (/type_check|check constraint/i.test(error.message)) {
      throw new Error('새 반응은 027 마이그레이션 후에 열려요.')
    }
    throw new Error(error.message)
  }
}

export async function addChatterComment(input: {
  postId: string
  userId: string
  content: string
}): Promise<ChatterComment> {
  const postId = requireUuid(input.postId, 'postId')
  const userId = requireUuid(input.userId, 'userId')
  const content = input.content.trim()
  if (!content) throw new Error('답글을 입력해주세요.')
  if (content.length > CHATTER_REPLY_MAX) throw new Error('답글은 80자 이내로 작성해주세요.')
  const blocked = chatterSafetyMessage(content)
  if (blocked) throw new Error(blocked)

  const { data, error } = await supabase
    .from(Tables.chatterComments)
    .insert({ post_id: postId, user_id: userId, content })
    .select('*, profiles:wb_profiles(name)')
    .single()
  if (error) throw new Error(error.message)
  return data as ChatterComment
}

export async function deleteChatterComment(id: string): Promise<void> {
  const commentId = requireUuid(id, 'commentId')
  const { error } = await supabase.from(Tables.chatterComments).delete().eq('id', commentId)
  if (error) throw new Error(error.message)
}

export function subscribeChatterChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('wb-chatter')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: Tables.chatterPosts },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: Tables.chatterComments },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: Tables.chatterReactions },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
