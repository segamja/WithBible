import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import { getClassByJoinCode } from '@/services/classService'
import type { Profile, UserRole } from '@/types'
import { emptyToNull, isUuid } from '@/utils/uuid'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new AuthError(
      'Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.',
    )
  }
}

async function waitForProfile(userId: string, attempts = 6): Promise<Profile | null> {
  for (let i = 0; i < attempts; i += 1) {
    const profile = await getProfile(userId)
    if (profile) return profile
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

export async function signUp(params: {
  email: string
  password: string
  name: string
  joinCode?: string
  role?: UserRole
}): Promise<Profile> {
  ensureConfigured()

  const joinCode = emptyToNull(params.joinCode)
  const meta: Record<string, string> = {
    app: 'withbible',
    name: params.name,
    role: params.role ?? 'STUDENT',
  }
  if (joinCode) meta.join_code = joinCode

  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: meta },
  })
  if (error) throw new AuthError(error.message)
  if (!data.user?.id || !isUuid(data.user.id)) {
    throw new AuthError('회원가입에 실패했습니다.')
  }

  let profile = await waitForProfile(data.user.id)
  if (profile) return profile

  // Fallback when trigger is delayed / missing — only works if session exists
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new AuthError(
      '가입은 되었지만 세션이 없습니다. 이메일 확인을 끄거나 메일 인증 후 로그인해주세요.',
    )
  }

  let classId: string | null = null
  if (joinCode) {
    const cls = await getClassByJoinCode(joinCode)
    classId = cls?.id ?? null
  }

  const { data: inserted, error: insertError } = await supabase
    .from(Tables.profiles)
    .upsert({
      id: data.user.id,
      name: params.name,
      email: params.email,
      role: params.role ?? 'STUDENT',
      class_id: classId,
    })
    .select('*')
    .single()
  if (insertError) throw new AuthError(insertError.message)
  return inserted as Profile
}

export async function signIn(email: string, password: string): Promise<Profile> {
  ensureConfigured()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AuthError(error.message)
  if (!data.user?.id) throw new AuthError('로그인에 실패했습니다.')
  const profile = await getProfile(data.user.id)
  if (!profile) throw new AuthError('프로필을 찾을 수 없습니다. 관리자에게 문의해주세요.')
  return profile
}

export async function signOut(): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.auth.signOut()
  if (error) throw new AuthError(error.message)
}

export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id ?? null
  return isUuid(id) ? id : null
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isUuid(userId)) return null
  const { data, error } = await supabase
    .from(Tables.profiles)
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new AuthError(error.message)
  return data as Profile | null
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'name' | 'profile_image' | 'class_id' | 'role'>>,
): Promise<Profile> {
  if (!isUuid(userId)) throw new AuthError('잘못된 사용자 ID입니다.')
  const cleanPatch = {
    ...patch,
    class_id: patch.class_id === undefined ? undefined : emptyToNull(patch.class_id),
  }
  const { data, error } = await supabase
    .from(Tables.profiles)
    .update(cleanPatch)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw new AuthError(error.message)
  return data as Profile
}

export function onAuthStateChange(callback: (userId: string | null) => void) {
  if (!isSupabaseConfigured) {
    callback(null)
    return { data: { subscription: { unsubscribe: () => undefined } } }
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null
    callback(isUuid(id) ? id : null)
  })
}
