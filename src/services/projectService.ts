import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { BibleBook, Project, ProjectClass, ProjectStatus } from '@/types'
import { isUuid, requireUuid } from '@/utils/uuid'

export async function listBibleBooks(): Promise<BibleBook[]> {
  const { data, error } = await supabase.from(Tables.bibleBooks).select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as BibleBook[]
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from(Tables.projects)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Project[]
}

export async function getActiveProject(): Promise<Project | null> {
  const { data, error } = await supabase
    .from(Tables.projects)
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Project | null
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from(Tables.projects)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Project | null
}

export async function createProject(input: {
  title: string
  description?: string
  startDate: string
  endDate: string
  status?: ProjectStatus
  partyDate?: string | null
  partyPlace?: string | null
  partyNote?: string | null
}): Promise<Project> {
  const { data, error } = await supabase
    .from(Tables.projects)
    .insert({
      title: input.title,
      description: input.description ?? null,
      start_date: input.startDate,
      end_date: input.endDate,
      status: input.status ?? 'active',
      party_date: input.partyDate ?? null,
      party_place: input.partyPlace ?? null,
      party_note: input.partyNote ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Project
}

export async function updateProject(
  id: string,
  patch: Partial<{
    title: string
    description: string | null
    start_date: string
    end_date: string
    status: ProjectStatus
    party_date: string | null
    party_place: string | null
    party_note: string | null
  }>,
): Promise<Project> {
  const { data, error } = await supabase
    .from(Tables.projects)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Project
}

/** Wipe reading logs / likes / comments / announcements for a project. Keeps users & classes. */
export async function resetProjectActivity(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('wb_admin_reset_project_activity', {
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
}

export async function getProjectClass(
  projectId: string,
  classId: string,
): Promise<(ProjectClass & { bible_books?: BibleBook }) | null> {
  if (!isUuid(projectId) || !isUuid(classId)) return null
  const { data, error } = await supabase
    .from(Tables.projectClasses)
    .select('*, bible_books:wb_bible_books(*)')
    .eq('project_id', projectId)
    .eq('class_id', classId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as (ProjectClass & { bible_books?: BibleBook }) | null
}

export async function listProjectClasses(
  projectId: string,
): Promise<(ProjectClass & { bible_books?: BibleBook; classes?: { id: string; name: string } })[]> {
  const { data, error } = await supabase
    .from(Tables.projectClasses)
    .select('*, bible_books:wb_bible_books(*), classes:wb_classes(id, name)')
    .eq('project_id', projectId)
  if (error) throw new Error(error.message)
  return (data ?? []) as (ProjectClass & {
    bible_books?: BibleBook
    classes?: { id: string; name: string }
  })[]
}

export async function upsertProjectClass(input: {
  projectId: string
  classId: string
  targetBookId: string
  targetStartChapter: number
  targetEndChapter: number
}): Promise<ProjectClass> {
  const projectId = requireUuid(input.projectId, 'projectId')
  const classId = requireUuid(input.classId, 'classId')
  const targetBookId = requireUuid(input.targetBookId, 'targetBookId')
  const { data, error } = await supabase
    .from(Tables.projectClasses)
    .upsert(
      {
        project_id: projectId,
        class_id: classId,
        target_book_id: targetBookId,
        target_start_chapter: input.targetStartChapter,
        target_end_chapter: input.targetEndChapter,
      },
      { onConflict: 'project_id,class_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ProjectClass
}
