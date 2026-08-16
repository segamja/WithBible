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
import { formatOfficialRangeLabel, getOfficialTodayParts } from '@/utils/todayGoal'
import {
  dayKey,
  listDayKeysInclusive,
  listGoalCompleters,
  listGoalCompletersAsOf,
  readingDateAsKst,
  resolveOfficialForLog,
} from '@/utils/goalCover'
import { getProject, listProjectClasses, listProjectTargets } from '@/services/projectService'
import type { BookTarget } from '@/utils/progress'

export async function createReadingLog(
  userId: string,
  input: CreateReadingInput,
): Promise<ReadingLog> {
  const readingDate = input.readingDate ?? todayISO()
  const projectId = requireUuid(input.projectId, 'projectId')
  const bookId = requireUuid(input.bookId, 'bookId')
  const uid = requireUuid(userId, 'userId')
  const payload: Record<string, unknown> = {
    project_id: projectId,
    user_id: uid,
    book_id: bookId,
    start_chapter: input.startChapter,
    end_chapter: input.endChapter,
    reflection: input.reflection,
    visibility: input.visibility,
    image_url: input.imageUrl ?? null,
    reading_date: readingDate,
  }
  if (input.targetStartChapter != null) payload.target_start_chapter = input.targetStartChapter
  if (input.targetEndChapter != null) payload.target_end_chapter = input.targetEndChapter

  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .insert(payload)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('오늘 같은 범위로 이미 인증했습니다. 수정하거나 다른 범위를 선택해주세요.')
    }
    const missingSnap =
      /target_start_chapter|target_end_chapter/.test(error.message) &&
      (input.targetStartChapter != null || input.targetEndChapter != null)
    if (missingSnap) {
      delete payload.target_start_chapter
      delete payload.target_end_chapter
      const retry = await supabase.from(Tables.readingLogs).insert(payload).select('*').single()
      if (retry.error) throw new Error(retry.error.message)
      return persistTogetherSnapshot(retry.data as ReadingLog)
    }
    throw new Error(error.message)
  }
  return persistTogetherSnapshot(data as ReadingLog)
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
    image_url?: string | null
    target_start_chapter?: number | null
    target_end_chapter?: number | null
  }>,
): Promise<ReadingLog> {
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('오늘 같은 범위로 이미 인증했습니다. 다른 범위를 선택해주세요.')
    }
    const missingSnap = /target_start_chapter|target_end_chapter/.test(error.message)
    if (missingSnap) {
      const { target_start_chapter: _s, target_end_chapter: _e, ...rest } = patch
      void _s
      void _e
      const retry = await supabase
        .from(Tables.readingLogs)
        .update(rest)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single()
      if (retry.error) throw new Error(retry.error.message)
      return retry.data as ReadingLog
    }
    throw new Error(error.message)
  }
  return data as ReadingLog
}

export async function getReadingLog(id: string): Promise<ReadingLog | null> {
  if (!isUuid(id)) return null
  const { data, error } = await supabase
    .from(Tables.readingLogs)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ReadingLog | null) ?? null
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

  const logs = (data ?? []).map((row) => {
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

  return attachTogetherFromSnapshot(logs)
}

type TogetherRow = {
  user_id: string
  book_id: string
  start_chapter: number
  end_chapter: number
  reading_date: string
  created_at?: string
  target_start_chapter?: number | null
  target_end_chapter?: number | null
  profiles?: { id: string; name: string; class_id?: string | null } | { id: string; name: string; class_id?: string | null }[] | null
}

function peerName(profiles: TogetherRow['profiles']): string | null {
  if (!profiles) return null
  const row = Array.isArray(profiles) ? profiles[0] : profiles
  return row?.name ?? null
}

async function loadFeedTargets(projectId: string): Promise<BookTarget[]> {
  const rows = await listProjectTargets(projectId)
  if (rows.length > 0) {
    return rows.map((r) => ({
      bookId: r.book_id,
      bookName: r.bible_books?.name ?? '성경',
      startChapter: r.start_chapter,
      endChapter: r.end_chapter,
      sortOrder: r.sort_order,
    }))
  }
  const pcs = await listProjectClasses(projectId)
  if (!pcs[0]) return []
  return [
    {
      bookId: pcs[0].target_book_id,
      bookName: pcs[0].bible_books?.name ?? '성경',
      startChapter: pcs[0].target_start_chapter,
      endChapter: pcs[0].target_end_chapter,
    },
  ]
}

async function fetchTogetherRows(params: {
  projectId: string
  classId?: string | null
  startDate: string
  endDate: string
}): Promise<TogetherRow[]> {
  let memberIds: string[] | null = null
  if (isUuid(params.classId)) {
    const { data: members, error: memberError } = await supabase
      .from(Tables.profiles)
      .select('id')
      .eq('class_id', params.classId)
    if (memberError) throw new Error(memberError.message)
    memberIds = (members ?? []).map((row) => row.id as string)
    if (memberIds.length === 0) return []
  }

  const pageSize = 1000
  const rows: TogetherRow[] = []
  let includeSnap = true
  let from = 0
  for (;;) {
    const columns = includeSnap
      ? `
          user_id,
          book_id,
          start_chapter,
          end_chapter,
          reading_date,
          created_at,
          target_start_chapter,
          target_end_chapter,
          profiles:wb_profiles(id, name, class_id)
        `
      : `
          user_id,
          book_id,
          start_chapter,
          end_chapter,
          reading_date,
          created_at,
          profiles:wb_profiles(id, name, class_id)
        `
    let q = supabase
      .from(Tables.readingLogs)
      .select(columns)
      .eq('project_id', params.projectId)
      .gte('reading_date', params.startDate)
      .lte('reading_date', params.endDate)
      .range(from, from + pageSize - 1)
    if (memberIds) q = q.in('user_id', memberIds)
    const { data, error } = await q
    if (error && includeSnap && /target_start_chapter|target_end_chapter/.test(error.message)) {
      includeSnap = false
      continue
    }
    if (error || !data) break
    rows.push(...(data as unknown as TogetherRow[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function asGoalLog(row: TogetherRow) {
  return {
    user_id: row.user_id,
    book_id: row.book_id,
    start_chapter: row.start_chapter,
    end_chapter: row.end_chapter,
    reading_date: row.reading_date,
    created_at: row.created_at,
    name: peerName(row.profiles),
  }
}

function parsePreviewSnapshot(value: unknown): ReadAlongPreview[] {
  if (!Array.isArray(value)) return []
  const out: ReadAlongPreview[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { user_id?: unknown; name?: unknown }
    if (typeof row.user_id !== 'string' || typeof row.name !== 'string') continue
    out.push({ user_id: row.user_id, name: row.name })
  }
  return out
}

function attachTogetherFromSnapshot(logs: ReadingLogWithMeta[]): ReadingLogWithMeta[] {
  return logs.map((log) => {
    const count = log.together_count_snapshot
    return {
      ...log,
      together_count: typeof count === 'number' && count > 0 ? count : 0,
      together_preview: parsePreviewSnapshot(log.together_preview_snapshot),
      together_goal_label: log.together_goal_label_snapshot ?? null,
    }
  })
}

async function buildOfficialByDate(projectId: string, peers: TogetherRow[]) {
  const project = await getProject(projectId)
  const targets = await loadFeedTargets(projectId)
  const peerDates = peers.map((row) => dayKey(row.reading_date)).filter(Boolean)
  const startDate =
    dayKey(project?.start_date) || peerDates.reduce((a, b) => (a < b ? a : b), peerDates[0] ?? '')
  const endDate =
    dayKey(project?.end_date) || peerDates.reduce((a, b) => (a > b ? a : b), peerDates[0] ?? '')
  const officialByDate = new Map<string, ReturnType<typeof getOfficialTodayParts>>()
  for (const date of listDayKeysInclusive(startDate, endDate)) {
    let official =
      project && targets.length > 0
        ? getOfficialTodayParts({
            startDate: project.start_date,
            endDate: project.end_date,
            targets,
            today: readingDateAsKst(date),
          })
        : []
    if (official.length === 0) {
      const snap = peers.find(
        (row) =>
          dayKey(row.reading_date) === date &&
          row.target_start_chapter != null &&
          row.target_end_chapter != null,
      )
      if (snap?.target_start_chapter && snap.target_end_chapter) {
        official = [
          {
            bookId: snap.book_id,
            bookName: '',
            start: snap.target_start_chapter,
            end: snap.target_end_chapter,
          },
        ]
      }
    }
    officialByDate.set(date, official)
  }
  return { project, startDate, endDate, officialByDate }
}

async function persistTogetherSnapshot(log: ReadingLog): Promise<ReadingLog> {
  try {
    const { officialByDate, startDate, endDate } = await buildOfficialByDate(log.project_id, [
      {
        user_id: log.user_id,
        book_id: log.book_id,
        start_chapter: log.start_chapter,
        end_chapter: log.end_chapter,
        reading_date: log.reading_date,
        created_at: log.created_at,
        target_start_chapter: log.target_start_chapter,
        target_end_chapter: log.target_end_chapter,
      },
    ])
    const peers = await fetchTogetherRows({
      projectId: log.project_id,
      startDate,
      endDate,
    })
    const official = resolveOfficialForLog(log, officialByDate)
    const people = listGoalCompletersAsOf(peers.map(asGoalLog), official, log.created_at)
    const preview: ReadAlongPreview[] = []
    for (const person of people) {
      if (person.user_id === log.user_id) continue
      if (person.name && preview.length < 2) {
        preview.push({ user_id: person.user_id, name: person.name })
      }
    }
    const patch = {
      together_count_snapshot: people.length,
      together_preview_snapshot: preview,
      together_goal_label_snapshot: formatOfficialRangeLabel(official),
    }
    const { data, error } = await supabase
      .from(Tables.readingLogs)
      .update(patch)
      .eq('id', log.id)
      .select('*')
      .single()
    if (error && /together_count_snapshot|together_preview_snapshot|together_goal_label_snapshot/.test(error.message)) {
      return log
    }
    if (error) return log
    return (data as ReadingLog) ?? { ...log, ...patch }
  } catch {
    return log
  }
}

/** Live completers of today's official goal (Home / 인증). Not used by feed cards. */
export async function getLiveTodayTogether(projectId: string): Promise<{
  count: number
  goalLabel: string
}> {
  const today = todayISO()
  const { officialByDate, startDate, endDate } = await buildOfficialByDate(projectId, [])
  const official = officialByDate.get(today) ?? []
  if (official.length === 0) return { count: 0, goalLabel: '' }
  const peers = await fetchTogetherRows({ projectId, startDate, endDate })
  const todayLogs = peers.filter((row) => dayKey(row.reading_date) === today).map(asGoalLog)
  return {
    count: listGoalCompleters(todayLogs, official).length,
    goalLabel: formatOfficialRangeLabel(official),
  }
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

/** Attach teacher cheer to a student's latest reading log (shows on that post in feed). */
export async function cheerStudentLatestLog(input: {
  projectId: string
  studentUserId: string
  teacherUserId: string
}): Promise<{ logId: string; already: boolean }> {
  const projectId = requireUuid(input.projectId, 'projectId')
  const studentUserId = requireUuid(input.studentUserId, 'studentUserId')
  const teacherUserId = requireUuid(input.teacherUserId, 'teacherUserId')

  const { data: log, error } = await supabase
    .from(Tables.readingLogs)
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', studentUserId)
    .order('reading_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!log?.id) {
    throw new Error('아직 읽기 인증이 없어 피드에 응원할 수 없습니다.')
  }

  const { data: existing, error: existError } = await supabase
    .from(Tables.encouragements)
    .select('id')
    .eq('reading_log_id', log.id)
    .eq('user_id', teacherUserId)
    .eq('type', 'teacher_cheer')
    .maybeSingle()
  if (existError) throw new Error(existError.message)
  if (existing) {
    return { logId: log.id as string, already: true }
  }

  await addEncouragement(log.id as string, teacherUserId, 'teacher_cheer')
  return { logId: log.id as string, already: false }
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
