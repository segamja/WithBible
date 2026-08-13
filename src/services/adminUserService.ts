import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'
import { isUuid } from '@/utils/uuid'

export interface AdminUserRow {
  id: string
  name: string
  email: string | null
  role: UserRole
  class_id: string | null
  created_at: string
  has_email_login: boolean
  reading_log_count: number
  is_ghost: boolean
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('wb_admin_list_users')
  if (error) throw new Error(error.message)
  return ((data ?? []) as AdminUserRow[]).map((row) => ({
    ...row,
    reading_log_count: Number(row.reading_log_count) || 0,
    is_ghost: Boolean(row.is_ghost),
    has_email_login: Boolean(row.has_email_login),
  }))
}

export async function deleteAdminUser(userId: string): Promise<void> {
  if (!isUuid(userId)) throw new Error('잘못된 사용자 ID입니다.')
  const { error } = await supabase.rpc('wb_admin_delete_user', {
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function resetAdminUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  if (!isUuid(userId)) throw new Error('잘못된 사용자 ID입니다.')
  if (newPassword.trim().length < 6) {
    throw new Error('비밀번호는 6자 이상이어야 합니다.')
  }
  const { error } = await supabase.rpc('wb_admin_reset_password', {
    p_user_id: userId,
    p_new_password: newPassword.trim(),
  })
  if (error) throw new Error(error.message)
}

/** 임시 비밀번호 (관리자가 사용자에게 전달) */
export function generateTempPassword(): string {
  const n = Math.floor(100000 + Math.random() * 900000)
  return `wb${n}`
}
