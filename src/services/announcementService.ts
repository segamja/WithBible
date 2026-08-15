import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { Announcement, AnnouncementKind } from '@/types'
import { seoulTodayStartIso } from '@/utils/seoul'
import { emptyToNull, isUuid, requireUuid } from '@/utils/uuid'

const TODAY_CHEER_LIMIT = 20

export async function purgeOldCheers(): Promise<void> {
  await supabase.rpc('wb_purge_old_cheers')
}

export type AnnouncementRow = Announcement & { profiles?: { name: string } }

export async function listAnnouncements(params: {
  projectId: string
  kind: AnnouncementKind
  classId?: string | null
}): Promise<AnnouncementRow[]> {
  if (!isUuid(params.projectId)) return []
  let query = supabase
    .from(Tables.announcements)
    .select('*, profiles:wb_profiles(name)')
    .eq('project_id', params.projectId)
    .eq('kind', params.kind)
    .order('created_at', { ascending: false })
    .limit(20)

  if (params.kind === 'notice') {
    query = query.is('class_id', null)
  } else if (isUuid(params.classId)) {
    query = query.or(`class_id.is.null,class_id.eq.${params.classId}`)
  } else {
    query = query.is('class_id', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AnnouncementRow[]
}

export async function listTodayCheers(
  projectId: string,
  classId?: string | null,
): Promise<AnnouncementRow[]> {
  await purgeOldCheers()
  if (!isUuid(projectId)) return []
  let query = supabase
    .from(Tables.announcements)
    .select('*, profiles:wb_profiles(name)')
    .eq('project_id', projectId)
    .eq('kind', 'cheer')
    .gte('created_at', seoulTodayStartIso())
    .order('created_at', { ascending: false })
    .limit(TODAY_CHEER_LIMIT)

  if (isUuid(classId)) {
    query = query.or(`class_id.is.null,class_id.eq.${classId}`)
  } else {
    query = query.is('class_id', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as AnnouncementRow[]
}

export async function createAnnouncement(input: {
  projectId: string
  classId: string | null
  authorId: string
  content: string
  kind: AnnouncementKind
}): Promise<Announcement> {
  const projectId = requireUuid(input.projectId, 'projectId')
  const authorId = requireUuid(input.authorId, 'authorId')
  const classId = emptyToNull(input.classId)
  if (classId && !isUuid(classId)) throw new Error('잘못된 반 ID입니다.')
  if (input.kind === 'notice' && classId) {
    throw new Error('공지사항은 고등부 전체에만 등록할 수 있습니다.')
  }
  if (input.kind === 'cheer' && classId === undefined) {
    throw new Error('응원 메시지 대상이 없습니다.')
  }
  if (input.kind === 'cheer') {
    await purgeOldCheers()
  }
  const { data, error } = await supabase
    .from(Tables.announcements)
    .insert({
      project_id: projectId,
      class_id: classId,
      author_id: authorId,
      content: input.content,
      kind: input.kind,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Announcement
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from(Tables.announcements).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
