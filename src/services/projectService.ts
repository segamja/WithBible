import { supabase } from '@/lib/supabase'
import { DEFAULT_DEPARTMENT_TITLE } from '@/lib/branding'
import { Tables } from '@/lib/tables'
import type { BibleBook, Project, ProjectClass, ProjectStatus, ProjectTarget } from '@/types'
import { isUuid, requireUuid } from '@/utils/uuid'

export async function listBibleBooks(): Promise<BibleBook[]> {
  const ordered = await supabase
    .from(Tables.bibleBooks)
    .select('*')
    .order('sort_order', { ascending: true })
  if (!ordered.error) return (ordered.data ?? []) as BibleBook[]

  // sort_order column may not exist until migration 013
  const { data, error } = await supabase.from(Tables.bibleBooks).select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as BibleBook[]
}

export async function listProjectTargets(
  projectId: string,
): Promise<(ProjectTarget & { bible_books?: BibleBook })[]> {
  if (!isUuid(projectId)) return []
  const { data, error } = await supabase
    .from(Tables.projectTargets)
    .select('*, bible_books:wb_bible_books(*)')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as (ProjectTarget & { bible_books?: BibleBook })[]
}

/** Replace project reading targets (multi-book). Also links all active classes. */
export async function replaceProjectTargets(
  projectId: string,
  targets: { bookId: string; startChapter: number; endChapter: number; sortOrder: number }[],
): Promise<void> {
  const pid = requireUuid(projectId, 'projectId')
  const { error: delErr } = await supabase.from(Tables.projectTargets).delete().eq('project_id', pid)
  if (delErr) throw new Error(delErr.message)

  if (targets.length > 0) {
    const { error: insErr } = await supabase.from(Tables.projectTargets).insert(
      targets.map((t) => ({
        project_id: pid,
        book_id: requireUuid(t.bookId, 'bookId'),
        start_chapter: t.startChapter,
        end_chapter: t.endChapter,
        sort_order: t.sortOrder,
      })),
    )
    if (insErr) throw new Error(insErr.message)
  }

  // Keep project_classes in sync so every active class is enrolled (legacy fields = first book)
  const { data: classes, error: classErr } = await supabase.from(Tables.classes).select('id, is_active')
  if (classErr) throw new Error(classErr.message)

  const first = targets[0]
  const activeClasses = (classes ?? []).filter((c) => c.is_active !== false)
  if (!first || activeClasses.length === 0) return

  for (const cls of activeClasses) {
    const { error: upErr } = await supabase.from(Tables.projectClasses).upsert(
      {
        project_id: pid,
        class_id: cls.id,
        target_book_id: first.bookId,
        target_start_chapter: first.startChapter,
        target_end_chapter: first.endChapter,
      },
      { onConflict: 'project_id,class_id' },
    )
    if (upErr) throw new Error(upErr.message)
  }
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
  departmentTitle?: string | null
  partyTitle?: string | null
  partySubtitle?: string | null
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
      department_title: input.departmentTitle?.trim() || DEFAULT_DEPARTMENT_TITLE,
      party_title: input.partyTitle ?? null,
      party_subtitle: input.partySubtitle ?? null,
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
    department_title: string | null
    party_title: string | null
    party_subtitle: string | null
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
