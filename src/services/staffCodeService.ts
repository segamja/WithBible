import { supabase } from '@/lib/supabase'

export interface StaffCode {
  id: string
  code: string
  label: string
  is_active: boolean
  created_at: string
}

export async function listStaffCodes(): Promise<StaffCode[]> {
  const { data, error } = await supabase.rpc('wb_list_staff_codes')
  if (error) throw new Error(error.message)
  return (data ?? []) as StaffCode[]
}

export async function upsertStaffCode(code: string, label = '임원 선생님'): Promise<StaffCode> {
  const { data, error } = await supabase.rpc('wb_upsert_staff_code', {
    p_code: code.trim().toUpperCase(),
    p_label: label,
  })
  if (error) throw new Error(error.message)
  return data as StaffCode
}
