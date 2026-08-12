import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingError'
  }
}

export type JoinKind = 'class' | 'staff' | 'teacher_class'

export interface OnboardingResult {
  joinKind: JoinKind
  role: UserRole
  classId: string | null
  displayName: string
}

function mapRpcError(message: string): string {
  if (message.includes('JOIN_CODE_REQUIRED')) {
    return '반 가입코드 또는 교사 코드를 입력해주세요.'
  }
  if (message.includes('STAFF_CODE_NOT_FOUND')) {
    return '교사/임원 코드를 찾을 수 없어요. 다시 확인해주세요.'
  }
  if (message.includes('JOIN_CODE_NOT_FOUND')) {
    return '반 가입코드를 찾을 수 없어요. 다시 확인해주세요.'
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
    return '학생 계정만 반 가입코드만으로 연결할 수 있어요.'
  }
  if (message.includes('not authenticated')) {
    return '로그인이 필요해요. 다시 로그인해 주세요.'
  }
  return message || '가입코드 연결에 실패했어요. 잠시 후 다시 시도해주세요.'
}

function parseJoinKind(raw: unknown): JoinKind {
  if (raw === 'staff') return 'staff'
  if (raw === 'teacher_class') return 'teacher_class'
  return 'class'
}

/** Class code and/or staff code. Both → TEACHER + class. */
export async function completeJoinOnboarding(
  joinCode: string,
  staffCode?: string | null,
): Promise<OnboardingResult> {
  if (!isSupabaseConfigured) {
    throw new OnboardingError('Supabase 환경변수가 설정되지 않았습니다.')
  }

  const classTrimmed = joinCode.trim()
  const staffTrimmed = (staffCode ?? '').trim()
  if (!classTrimmed && !staffTrimmed) {
    throw new OnboardingError('반 가입코드 또는 교사 코드를 입력해주세요.')
  }

  const { data, error } = await supabase.rpc('wb_complete_join_onboarding', {
    p_join_code: classTrimmed ? classTrimmed.toUpperCase() : '',
    p_staff_code: staffTrimmed ? staffTrimmed.toUpperCase() : null,
  })

  if (error) {
    throw new OnboardingError(mapRpcError(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.join_kind || !row?.display_name || !row?.role) {
    throw new OnboardingError('가입코드를 찾을 수 없어요. 다시 확인해주세요.')
  }

  return {
    joinKind: parseJoinKind(row.join_kind),
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
