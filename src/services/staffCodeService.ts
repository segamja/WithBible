import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

export interface StaffCode {
  id: string
  code: string
  label: string
  is_active: boolean
  target_role: Extract<UserRole, 'STAFF' | 'SUB_MASTER'>
  created_at: string
}

export async function listStaffCodes(): Promise<StaffCode[]> {
  const { data, error } = await supabase.rpc('wb_list_staff_codes')
  if (error) throw new Error(error.message)
  return (data ?? []) as StaffCode[]
}

export async function upsertStaffCode(
  code: string,
  label: string,
  targetRole: 'STAFF' | 'SUB_MASTER' = 'STAFF',
): Promise<StaffCode> {
  const { data, error } = await supabase.rpc('wb_upsert_staff_code', {
    p_code: code.trim().toUpperCase(),
    p_label: label,
    p_target_role: targetRole,
  })
  if (error) throw new Error(error.message)
  return data as StaffCode
}
