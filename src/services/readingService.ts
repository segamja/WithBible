import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import { reactionLabel } from '@/lib/reactions'
import type {
  CreateReadingInput,
  EncouragementType,
  ReactionCounts,
  ReadingLog,
  ReadingLogWithMeta,
  ReadAlongPreview,
} from '@/types'
import { todayISO } from '@/utils/dday'
import { isUuid, requireUuid } from '@/utils/uuid'

export async function createReadingLog(
  userId: string,
  input: CreateReadingInput,
): Promise<ReadingLog> {
  const readingDate = input.readingDate ?? todayISO()
  const projectId = requireUuid(input.projectId, 'projectId')
  const bookId = requireUuid(input.bookId, 'bookId')
  const uid = requireUuid(userId, 'userId')
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .insert({
      project_id: projectId,
      user_id: uid,
      book_id: bookId,
      start_chapter: input.startChapter,
      end_chapter: input.endChapter,
      reflection: input.reflection,
      visibility: input.visibility,
      image_url: input.imageUrl ?? null,
      reading_date: readingDate,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('오늘 같은 범위로 이미 인증했습니다. 수정하거나 다른 범위를 선택해주세요.')
    }
    throw new Error(error.message)
  }
  return data as ReadingLog
}

export async function updateReadingLog(
  id: string,
  userId: string,
  patch: Partial<{
    start_chapter: number
    end_chapter: number
    reflection: string
    visibility: ReadingLog['visibility']
    book_id: string
  }>,
): Promise<ReadingLog> {
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ReadingLog
}

export async function deleteReadingLog(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.readingLogs)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

type EncRow = { id: string; user_id: string; type: EncouragementType }
type AlongRow = {
  user_id: string
  created_at: string
  profiles?: { id: string; name: string } | null
}

function aggregateEncouragements(
  rows: EncRow[],
  currentUserId?: string,
): {
  reaction_counts: ReactionCounts
  my_reactions: EncouragementType[]
  encouragement_count: number
  has_teacher_cheer: boolean
  my_encouragement: EncouragementType | null
} {
  const reaction_counts: ReactionCounts = {}
  const my_reactions: EncouragementType[] = []
  for (const row of rows) {
    reaction_counts[row.type] = (reaction_counts[row.type] ?? 0) + 1
    if (currentUserId && row.user_id === currentUserId) {
      my_reactions.push(row.type)
    }
  }
  return {
    reaction_counts,
    my_reactions,
    encouragement_count: rows.length,
    has_teacher_cheer: (reaction_counts.teacher_cheer ?? 0) > 0,
    my_encouragement: my_reactions[0] ?? null,
  }
}

function aggregateReadAlongs(
  rows: AlongRow[],
  currentUserId?: string,
): {
  read_along_count: number
  read_along_preview: ReadAlongPreview[]
  my_read_along: boolean
} {
  const preview: ReadAlongPreview[] = []
  let my_read_along = false
  for (const row of rows) {
    if (currentUserId && row.user_id === currentUserId) my_read_along = true
    const name = row.profiles?.name
    if (name && preview.length < 2) {
      preview.push({ user_id: row.user_id, name })
    }
  }
  return {
    read_along_count: rows.length,
    read_along_preview: preview,
    my_read_along,
  }
}

export async function listFeed(params: {
  projectId: string
  classId?: string | null
  limit?: number
  currentUserId?: string
}): Promise<ReadingLogWithMeta[]> {
  let query = supabase
    .from(Tables.readingLogs)
    .select(
      `
      *,
      profiles:wb_profiles!inner(id, name, profile_image, class_id),
      bible_books:wb_bible_books(id, name),
      encouragements:wb_encouragements(id, user_id, type),
      read_alongs:wb_read_alongs(user_id, created_at, profiles:wb_profiles(id, name))
    `,
    )
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 50)

  if (isUuid(params.classId)) {
    query = query.eq('profiles.class_id', params.classId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const encouragements = (row.encouragements as EncRow[] | null) ?? []
    const readAlongs = (row.read_alongs as AlongRow[] | null) ?? []
    const { encouragements: _e, read_alongs: _a, ...rest } = row as typeof row & {
      encouragements?: unknown
      read_alongs?: unknown
    }
    void _e
    void _a
    return {
      ...rest,
      ...aggregateEncouragements(encouragements, params.currentUserId),
      ...aggregateReadAlongs(readAlongs, params.currentUserId),
    } as ReadingLogWithMeta
  })
}

export async function listUserLogs(
  projectId: string,
  userId: string,
): Promise<ReadingLog[]> {
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('reading_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ReadingLog[]
}

export async function listProjectLogs(projectId: string): Promise<ReadingLog[]> {
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .select('*')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  return (data ?? []) as ReadingLog[]
}

export async function listClassLogs(
  projectId: string,
  studentIds: string[],
): Promise<ReadingLog[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .select('*')
    .eq('project_id', projectId)
    .in('user_id', studentIds)
  if (error) throw new Error(error.message)
  return (data ?? []) as ReadingLog[]
}

async function notifyOwner(
  readingLogId: string,
  actorId: string,
  kind: 'reaction' | 'comment' | 'read_along' | 'teacher_cheer',
  message: string,
  reactionType?: EncouragementType,
): Promise<void> {
  try {
    await supabase.rpc('wb_notify_log_owner', {
      p_log_id: readingLogId,
      p_actor_id: actorId,
      p_kind: kind,
      p_reaction_type: reactionType ?? null,
      p_message: message,
    })
  } catch {
    /* notification is best-effort */
  }
}

export async function addEncouragement(
  readingLogId: string,
  userId: string,
  type: EncouragementType,
): Promise<void> {
  const { error } = await supabase.from(Tables.encouragements).upsert(
    {
      reading_log_id: readingLogId,
      user_id: userId,
      type,
    },
    { onConflict: 'reading_log_id,user_id,type' },
  )
  if (error) throw new Error(error.message)

  const kind = type === 'teacher_cheer' ? 'teacher_cheer' : 'reaction'
  const message =
    type === 'teacher_cheer'
      ? '선생님이 말씀읽기를 응원합니다.'
      : `친구가 ${reactionLabel(type)} 응원을 보냈어요.`
  await notifyOwner(readingLogId, userId, kind, message, type)
}

export async function removeEncouragement(
  readingLogId: string,
  userId: string,
  type?: EncouragementType,
): Promise<void> {
  let query = supabase
    .from(Tables.encouragements)
    .delete()
    .eq('reading_log_id', readingLogId)
    .eq('user_id', userId)
  if (type) query = query.eq('type', type)
  const { error } = await query
  if (error) throw new Error(error.message)
}

/** Toggle one reaction type. Returns true if reaction is now active. */
export async function toggleReaction(
  readingLogId: string,
  userId: string,
  type: EncouragementType,
  currentlyActive: boolean,
): Promise<boolean> {
  if (currentlyActive) {
    await removeEncouragement(readingLogId, userId, type)
    return false
  }
  await addEncouragement(readingLogId, userId, type)
  return true
}

export async function toggleLike(
  readingLogId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<boolean> {
  return toggleReaction(readingLogId, userId, 'like', currentlyLiked)
}

export async function getMyEncouragements(
  userId: string,
  logIds: string[],
): Promise<Record<string, EncouragementType[]>> {
  if (logIds.length === 0) return {}
  const { data, error } = await supabase
    .from(Tables.encouragements)
    .select('reading_log_id, type')
    .eq('user_id', userId)
    .in('reading_log_id', logIds)
  if (error) throw new Error(error.message)
  const map: Record<string, EncouragementType[]> = {}
  for (const row of data ?? []) {
    const id = row.reading_log_id as string
    const type = row.type as EncouragementType
    if (!map[id]) map[id] = []
    map[id].push(type)
  }
  return map
}

export async function toggleReadAlong(
  readingLogId: string,
  userId: string,
  currentlyActive: boolean,
): Promise<boolean> {
  if (currentlyActive) {
    const { error } = await supabase
      .from(Tables.readAlongs)
      .delete()
      .eq('reading_log_id', readingLogId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return false
  }
  const { error } = await supabase.from(Tables.readAlongs).upsert(
    { reading_log_id: readingLogId, user_id: userId },
    { onConflict: 'reading_log_id,user_id' },
  )
  if (error) throw new Error(error.message)
  await notifyOwner(readingLogId, userId, 'read_along', '친구도 함께 읽었어요.')
  return true
}

export function subscribeFeedChanges(
  projectId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`wb-feed-${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.readingLogs,
        filter: `project_id=eq.${projectId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.encouragements,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.comments,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.readAlongs,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
