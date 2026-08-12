import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type {
  CreateReadingInput,
  EncouragementType,
  ReadingLog,
  ReadingLogWithMeta,
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

export async function listFeed(params: {
  projectId: string
  classId?: string | null
  limit?: number
}): Promise<ReadingLogWithMeta[]> {
  let query = supabase
    .from(Tables.readingLogs)
    .select(
      `
      *,
      profiles:wb_profiles!inner(id, name, profile_image, class_id),
      bible_books:wb_bible_books(id, name),
      encouragements:wb_encouragements(id, user_id, type)
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
    const encouragements =
      (row.encouragements as { id: string; user_id: string; type: EncouragementType }[]) ?? []
    const { encouragements: _removed, ...rest } = row as typeof row & {
      encouragements?: unknown
    }
    void _removed
    return {
      ...rest,
      encouragement_count: encouragements.length,
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
    { onConflict: 'reading_log_id,user_id' },
  )
  if (error) throw new Error(error.message)
}

export async function toggleLike(
  readingLogId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<boolean> {
  if (currentlyLiked) {
    await removeEncouragement(readingLogId, userId)
    return false
  }
  await addEncouragement(readingLogId, userId, 'like')
  return true
}

export async function removeEncouragement(
  readingLogId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from(Tables.encouragements)
    .delete()
    .eq('reading_log_id', readingLogId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function getMyEncouragements(
  userId: string,
  logIds: string[],
): Promise<Record<string, EncouragementType>> {
  if (logIds.length === 0) return {}
  const { data, error } = await supabase
    .from(Tables.encouragements)
    .select('reading_log_id, type')
    .eq('user_id', userId)
    .in('reading_log_id', logIds)
  if (error) throw new Error(error.message)
  const map: Record<string, EncouragementType> = {}
  for (const row of data ?? []) {
    map[row.reading_log_id as string] = row.type as EncouragementType
  }
  return map
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
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
