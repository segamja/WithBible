import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type {
  ChatterComment,
  ChatterPost,
  ChatterReactionType,
  ReactionCounts,
} from '@/types'
import { requireUuid } from '@/utils/uuid'

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
    const reaction_counts: ReactionCounts = {}
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

export async function listChatterPosts(currentUserId: string): Promise<ChatterPost[]> {
  const uid = requireUuid(currentUserId, 'userId')
  const { data, error } = await supabase
    .from(Tables.chatterPosts)
    .select('*, profiles:wb_profiles(name, profile_image)')
    .order('created_at', { ascending: false })
    .limit(80)
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
  imageUrl?: string | null
}): Promise<ChatterPost> {
  const authorId = requireUuid(input.authorId, 'authorId')
  const content = input.content.trim()
  if (!content) throw new Error('내용을 입력해주세요.')
  if (content.length > 500) throw new Error('글은 500자 이내로 작성해주세요.')

  const { data, error } = await supabase
    .from(Tables.chatterPosts)
    .insert({
      author_id: authorId,
      content,
      image_url: input.imageUrl ?? null,
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
  if (!text) throw new Error('내용을 입력해주세요.')
  if (text.length > 500) throw new Error('글은 500자 이내로 작성해주세요.')

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
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function addChatterComment(input: {
  postId: string
  userId: string
  content: string
}): Promise<ChatterComment> {
  const postId = requireUuid(input.postId, 'postId')
  const userId = requireUuid(input.userId, 'userId')
  const content = input.content.trim()
  if (!content) throw new Error('댓글을 입력해주세요.')
  if (content.length > 80) throw new Error('댓글은 80자 이내로 작성해주세요.')

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
