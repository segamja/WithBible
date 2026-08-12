import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export class OnboardingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnboardingError'
  }
}

export interface OnboardingResult {
  class_id: string
  class_name: string
}

function mapRpcError(message: string): string {
  if (message.includes('JOIN_CODE_REQUIRED')) {
    return '반 가입코드를 입력해주세요.'
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
  if (message.includes('NOT_STUDENT')) {
    return '학생 계정만 반 가입코드를 사용할 수 있어요.'
  }
  if (message.includes('not authenticated')) {
    return '로그인이 필요해요. 다시 로그인해 주세요.'
  }
  return message || '반 연결에 실패했어요. 잠시 후 다시 시도해주세요.'
}

/** Link the current auth user to a class via join code (creates STUDENT profile if needed). */
export async function completeStudentOnboarding(
  joinCode: string,
): Promise<OnboardingResult> {
  if (!isSupabaseConfigured) {
    throw new OnboardingError('Supabase 환경변수가 설정되지 않았습니다.')
  }

  const trimmed = joinCode.trim()
  if (!trimmed) {
    throw new OnboardingError('반 가입코드를 입력해주세요.')
  }

  const { data, error } = await supabase.rpc('wb_complete_student_onboarding', {
    p_join_code: trimmed.toUpperCase(),
  })

  if (error) {
    throw new OnboardingError(mapRpcError(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.class_id || !row?.class_name) {
    throw new OnboardingError('반 가입코드를 찾을 수 없어요. 다시 확인해주세요.')
  }

  return {
    class_id: row.class_id as string,
    class_name: row.class_name as string,
  }
}
