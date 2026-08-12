import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingError'
  }
}

export interface OnboardingResult {
  joinKind: 'class' | 'staff'
  role: UserRole
  classId: string | null
  displayName: string
}

function mapRpcError(message: string): string {
  if (message.includes('JOIN_CODE_REQUIRED')) {
    return '가입코드를 입력해주세요.'
  }
  if (message.includes('JOIN_CODE_NOT_FOUND')) {
    return '가입코드를 찾을 수 없어요. 다시 확인해주세요.'
  }
  if (message.includes('JOIN_CODE_INACTIVE')) {
    return '사용할 수 없는 가입코드예요. 선생님께 문의해주세요.'
  }
  if (message.includes('ALREADY_LINKED')) {
    return '이미 다른 반에 연결된 계정입니다.'
  }
  if (message.includes('ALREADY_STAFF')) {
    return '이미 임원/교사로 등록된 계정입니다.'
  }
  if (message.includes('ALREADY_ADMIN')) {
    return '관리자 계정은 가입코드로 변경할 수 없어요.'
  }
  if (message.includes('NOT_STUDENT')) {
    return '학생 계정만 반 가입코드를 사용할 수 있어요.'
  }
  if (message.includes('not authenticated')) {
    return '로그인이 필요해요. 다시 로그인해 주세요.'
  }
  return message || '가입코드 연결에 실패했어요. 잠시 후 다시 시도해주세요.'
}

/** Link current user via class code (STUDENT) or staff code (TEACHER, no class). */
export async function completeJoinOnboarding(joinCode: string): Promise<OnboardingResult> {
  if (!isSupabaseConfigured) {
    throw new OnboardingError('Supabase 환경변수가 설정되지 않았습니다.')
  }

  const trimmed = joinCode.trim()
  if (!trimmed) {
    throw new OnboardingError('가입코드를 입력해주세요.')
  }

  const { data, error } = await supabase.rpc('wb_complete_join_onboarding', {
    p_join_code: trimmed.toUpperCase(),
  })

  if (error) {
    throw new OnboardingError(mapRpcError(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.join_kind || !row?.display_name || !row?.role) {
    throw new OnboardingError('가입코드를 찾을 수 없어요. 다시 확인해주세요.')
  }

  const joinKind = row.join_kind === 'staff' ? 'staff' : 'class'
  return {
    joinKind,
    role: row.role as UserRole,
    classId: (row.class_id as string | null) ?? null,
    displayName: row.display_name as string,
  }
}

/** @deprecated Use completeJoinOnboarding */
export async function completeStudentOnboarding(joinCode: string) {
  const result = await completeJoinOnboarding(joinCode)
  if (result.joinKind !== 'class' || !result.classId) {
    throw new OnboardingError('반 가입코드를 찾을 수 없어요. 다시 확인해주세요.')
  }
  return { class_id: result.classId, class_name: result.displayName }
}
