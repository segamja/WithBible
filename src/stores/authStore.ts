import { create } from 'zustand'
import * as authService from '@/services/authService'
import type { Profile, UserRole } from '@/types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  initialized: boolean
  error: string | null
  init: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    name: string
    joinCode?: string
  }) => Promise<void>
  logout: () => Promise<void>
  setProfile: (profile: Profile | null) => void
  hasRole: (...roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  loading: false,
  initialized: false,
  error: null,

  init: async () => {
    try {
      const userId = await authService.getSessionUserId()
      if (!userId) {
        set({ profile: null, initialized: true })
        return
      }
      const profile = await authService.getProfile(userId)
      set({ profile, initialized: true })
    } catch (e) {
      set({
        profile: null,
        initialized: true,
        error: e instanceof Error ? e.message : '인증 초기화 실패',
      })
    }

    authService.onAuthStateChange(async (userId) => {
      if (!userId) {
        set({ profile: null })
        return
      }
      try {
        const profile = await authService.getProfile(userId)
        set({ profile })
      } catch {
        set({ profile: null })
      }
    })
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const profile = await authService.signIn(email, password)
      set({ profile, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '로그인 실패',
      })
      throw e
    }
  },

  register: async (input) => {
    set({ loading: true, error: null })
    try {
      const profile = await authService.signUp(input)
      set({ profile, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : '회원가입 실패',
      })
      throw e
    }
  },

  logout: async () => {
    await authService.signOut()
    set({ profile: null })
  },

  setProfile: (profile) => set({ profile }),

  hasRole: (...roles) => {
    const role = get().profile?.role
    return role ? roles.includes(role) : false
  },
}))
