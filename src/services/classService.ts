import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { ClassRow, Profile } from '@/types'
import { emptyToNull, isUuid } from '@/utils/uuid'

export async function listClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase.from(Tables.classes).select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as ClassRow[]
}

export async function getClassById(id: string): Promise<ClassRow | null> {
  if (!isUuid(id)) return null
  const { data, error } = await supabase
    .from(Tables.classes)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as ClassRow | null
}

export async function getClassByJoinCode(
  code: string,
): Promise<Pick<ClassRow, 'id' | 'name'> | null> {
  const cleaned = emptyToNull(code)
  if (!cleaned) return null
  const { data, error } = await supabase.rpc('wb_lookup_class_by_join_code', {
    p_join_code: cleaned.toUpperCase(),
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) return null
  return { id: row.id as string, name: row.name as string }
}

export async function createClass(input: {
  name: string
  joinCode: string
  teacherId?: string | null
}): Promise<ClassRow> {
  const { data, error } = await supabase
    .from(Tables.classes)
    .insert({
      name: input.name,
      join_code: input.joinCode.toUpperCase(),
      teacher_id: input.teacherId ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ClassRow
}

export async function updateClass(
  id: string,
  patch: Partial<Pick<ClassRow, 'name' | 'join_code' | 'teacher_id'>>,
): Promise<ClassRow> {
  if (!isUuid(id)) throw new Error('잘못된 반 ID입니다.')
  const cleanPatch = {
    ...patch,
    teacher_id:
      patch.teacher_id === undefined ? undefined : emptyToNull(patch.teacher_id),
  }
  const { data, error } = await supabase
    .from(Tables.classes)
    .update(cleanPatch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ClassRow
}

export async function listClassStudents(classId: string): Promise<Profile[]> {
  if (!isUuid(classId)) return []
  const { data, error } = await supabase
    .from(Tables.profiles)
    .select('*')
    .eq('class_id', classId)
    .eq('role', 'STUDENT')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.from(Tables.profiles).select('*').order('created_at', {
    ascending: false,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function assignUserToClass(
  userId: string,
  classId: string | null,
): Promise<Profile> {
  if (!isUuid(userId)) throw new Error('잘못된 사용자 ID입니다.')
  const cleanClassId = emptyToNull(classId)
  if (cleanClassId && !isUuid(cleanClassId)) {
    throw new Error('잘못된 반 ID입니다.')
  }
  const { data, error } = await supabase
    .from(Tables.profiles)
    .update({ class_id: cleanClassId })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export async function updateUserRole(
  userId: string,
  role: Profile['role'],
): Promise<Profile> {
  if (!isUuid(userId)) throw new Error('잘못된 사용자 ID입니다.')
  const { data, error } = await supabase
    .from(Tables.profiles)
    .update({ role })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}
