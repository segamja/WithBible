import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { Announcement } from '@/types'
import { emptyToNull, isUuid, requireUuid } from '@/utils/uuid'

export async function listAnnouncements(params: {
  projectId: string
  classId?: string | null
}): Promise<(Announcement & { profiles?: { name: string } })[]> {
  if (!isUuid(params.projectId)) return []
  let query = supabase
    .from(Tables.announcements)
    .select('*, profiles:wb_profiles(name)')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (isUuid(params.classId)) {
    // 반 공지만 (전교/school-wide class_id null 제외)
    query = query.eq('class_id', params.classId)
  } else {
    // classId 없으면 목록을 비움 — 전교 공지 작성/조회 중단
    return []
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as (Announcement & { profiles?: { name: string } })[]
}

export async function createAnnouncement(input: {
  projectId: string
  classId: string | null
  authorId: string
  content: string
}): Promise<Announcement> {
  const projectId = requireUuid(input.projectId, 'projectId')
  const authorId = requireUuid(input.authorId, 'authorId')
  const classId = emptyToNull(input.classId)
  if (!classId || !isUuid(classId)) {
    throw new Error('공지사항은 담당 반에만 등록할 수 있습니다.')
  }
  const { data, error } = await supabase
    .from(Tables.announcements)
    .insert({
      project_id: projectId,
      class_id: classId,
      author_id: authorId,
      content: input.content,
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
