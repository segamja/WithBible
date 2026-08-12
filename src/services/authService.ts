import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import { completeJoinOnboarding } from '@/services/onboardingService'
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

/** Prefer VITE_APP_URL; fall back to current origin (no hardcoded hosts). */
export function getAppOrigin(): string {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
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
  if (!joinCode) {
    throw new AuthError('가입코드를 입력해주세요. (반 코드 또는 임원 코드)')
  }

  const meta: Record<string, string> = {
    app: 'withbible',
    name: params.name,
    role: params.role ?? 'STUDENT',
    join_code: joinCode,
  }

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
  if (profile) {
    if (authServiceNeedsOnboarding(profile)) {
      await completeJoinOnboarding(joinCode)
      profile = (await getProfile(data.user.id)) ?? profile
    }
    return profile
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new AuthError(
      '가입은 되었지만 세션이 없습니다. 이메일 확인을 끄거나 메일 인증 후 로그인해주세요.',
    )
  }

  await completeJoinOnboarding(joinCode)
  profile = await getProfile(data.user.id)
  if (!profile) throw new AuthError('프로필을 만들 수 없습니다. 잠시 후 다시 시도해주세요.')
  return profile
}

function authServiceNeedsOnboarding(profile: Profile): boolean {
  if (profile.role === 'ADMIN' || profile.role === 'TEACHER') return false
  return profile.role === 'STUDENT' && !profile.class_id
}

export async function signIn(email: string, password: string): Promise<Profile> {
  ensureConfigured()
  // Clear Kakao/student session first — otherwise admin email login feels "stuck"
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new AuthError(error.message)
  if (!data.user?.id) throw new AuthError('로그인에 실패했습니다.')
  const profile = await getProfile(data.user.id)
  if (!profile) {
    throw new AuthError(
      '프로필을 찾을 수 없습니다. With Bible에서 가입한 계정이 아니거나, 프로필이 없습니다.',
    )
  }
  return profile
}

export async function signInWithKakao(): Promise<void> {
  ensureConfigured()
  const origin = getAppOrigin()
  if (!origin) {
    throw new AuthError('앱 URL을 확인할 수 없습니다. VITE_APP_URL을 설정해주세요.')
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) throw new AuthError(error.message)
}

export async function getCurrentSession() {
  ensureConfigured()
  // PKCE: exchange ?code= if present (OAuth redirect to /auth/callback)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) throw new AuthError(exchangeError.message)
    }
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new AuthError(error.message)
  return data.session
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

/** True when a student session still needs class join. ADMIN/TEACHER never. */
export function needsOnboarding(
  sessionUserId: string | null,
  profile: Profile | null,
): boolean {
  if (!sessionUserId) return false
  if (!profile) return true
  if (profile.role === 'ADMIN' || profile.role === 'TEACHER') return false
  if (profile.role === 'STUDENT' && !profile.class_id) return true
  return false
}
