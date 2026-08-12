import { create } from 'zustand'
import * as authService from '@/services/authService'
import * as onboardingService from '@/services/onboardingService'
import type { Profile, UserRole } from '@/types'

interface AuthState {
  profile: Profile | null
  sessionUserId: string | null
  loading: boolean
  initialized: boolean
  error: string | null
  onboardingRequired: boolean
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithKakao: () => Promise<void>
  register: (input: {
    email: string
    password: string
    name: string
    joinCode?: string
  }) => Promise<void>
  completeOnboarding: (joinCode: string) => Promise<{
    joinKind: 'class' | 'staff'
    displayName: string
    role: UserRole
  }>
  refreshProfile: () => Promise<void>
  logout: () => Promise<void>
  setProfile: (profile: Profile | null) => void
  hasRole: (...roles: UserRole[]) => boolean
}

function computeOnboarding(sessionUserId: string | null, profile: Profile | null) {
  return authService.needsOnboarding(sessionUserId, profile)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  sessionUserId: null,
  loading: false,
  initialized: false,
  error: null,
  onboardingRequired: false,

  init: async () => {
    try {
      const userId = await authService.getSessionUserId()
      if (!userId) {
        set({
          profile: null,
          sessionUserId: null,
          onboardingRequired: false,
          initialized: true,
        })
      } else {
        const profile = await authService.getProfile(userId)
        set({
          profile,
          sessionUserId: userId,
          onboardingRequired: computeOnboarding(userId, profile),
          initialized: true,
        })
      }
    } catch (e) {
      set({
        profile: null,
        sessionUserId: null,
        onboardingRequired: false,
        initialized: true,
        error: e instanceof Error ? e.message : '인증 초기화 실패',
      })
    }

    authService.onAuthStateChange(async (userId) => {
      if (!userId) {
        set({
          profile: null,
          sessionUserId: null,
          onboardingRequired: false,
        })
        return
      }
      try {
        const profile = await authService.getProfile(userId)
        set({
          profile,
          sessionUserId: userId,
          onboardingRequired: computeOnboarding(userId, profile),
        })
      } catch {
        set({
          profile: null,
          sessionUserId: userId,
          onboardingRequired: true,
        })
      }
    })
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const profile = await authService.signIn(email, password)
      const userId = profile.id
      set({
        profile,
        sessionUserId: userId,
        onboardingRequired: computeOnboarding(userId, profile),
        loading: false,
      })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '로그인 실패',
      })
      throw e
    }
  },

  loginWithKakao: async () => {
    set({ loading: true, error: null })
    try {
      await authService.signInWithKakao()
      // Redirect away — loading may stay until page unload
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '카카오 로그인 실패',
      })
      throw e
    }
  },

  register: async (input) => {
    set({ loading: true, error: null })
    try {
      const profile = await authService.signUp(input)
      set({
        profile,
        sessionUserId: profile.id,
        onboardingRequired: computeOnboarding(profile.id, profile),
        loading: false,
      })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '회원가입 실패',
      })
      throw e
    }
  },

  completeOnboarding: async (joinCode) => {
    set({ loading: true, error: null })
    try {
      const result = await onboardingService.completeJoinOnboarding(joinCode)
      const userId = get().sessionUserId ?? (await authService.getSessionUserId())
      if (!userId) throw new Error('로그인이 필요해요.')
      const profile = await authService.getProfile(userId)
      set({
        profile,
        sessionUserId: userId,
        onboardingRequired: computeOnboarding(userId, profile),
        loading: false,
      })
      return {
        joinKind: result.joinKind,
        displayName: result.displayName,
        role: result.role,
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '가입코드 연결 실패',
      })
      throw e
    }
  },

  refreshProfile: async () => {
    const userId = get().sessionUserId ?? (await authService.getSessionUserId())
    if (!userId) {
      set({
        profile: null,
        sessionUserId: null,
        onboardingRequired: false,
      })
      return
    }
    const profile = await authService.getProfile(userId)
    set({
      profile,
      sessionUserId: userId,
      onboardingRequired: computeOnboarding(userId, profile),
    })
  },

  logout: async () => {
    await authService.signOut()
    set({
      profile: null,
      sessionUserId: null,
      onboardingRequired: false,
    })
  },

  setProfile: (profile) =>
    set((state) => ({
      profile,
      onboardingRequired: computeOnboarding(state.sessionUserId, profile),
    })),

  hasRole: (...roles) => {
    const role = get().profile?.role
    return role ? roles.includes(role) : false
  },
}))
