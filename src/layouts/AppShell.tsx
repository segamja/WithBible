import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { BottomNav } from '@/components/BottomNav'
import type { UserRole } from '@/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/utils/cn'

export function roleHome(role: UserRole) {
  if (role === 'ADMIN') return '/admin'
  return '/'
}

export function AppShell() {
  const { profile, sessionUserId, onboardingRequired, initialized } = useAuthStore()
  const location = useLocation()
  const wide = location.pathname.startsWith('/progress')

  if (!initialized) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-surface text-muted">
        <p className="caption-caps">with BIBLE</p>
        <p className="text-sm">불러오는 중…</p>
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <p className="caption-caps">with BIBLE</p>
        <h1 className="page-title">환경 설정이 필요해요</h1>
        <p className="text-sm leading-relaxed text-muted">
          `.env`에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 설정한 뒤 다시 실행해주세요.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Supabase SQL Editor에서 `supabase/migrations`와 `seed.sql`을 실행하세요.
        </p>
      </div>
    )
  }

  if (!sessionUserId) {
    return <Navigate to="/login" replace />
  }

  if (onboardingRequired) {
    return <Navigate to="/onboarding/class" replace />
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  return (
    <div
      className={cn(
        'mx-auto min-h-dvh bg-surface pb-28',
        wide ? 'max-w-4xl' : 'max-w-lg',
      )}
    >
      <Outlet />
      <BottomNav role={profile.role} classId={profile.class_id} />
    </div>
  )
}

export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const profile = useAuthStore((s) => s.profile)
  if (!profile) return <Navigate to="/login" replace />
  if (!allow.includes(profile.role)) {
    return <Navigate to={roleHome(profile.role)} replace />
  }
  return <Outlet />
}

/**
 * Login/signup pages.
 * Do NOT bounce incomplete (onboarding) sessions back to onboarding —
 * that trapped users who needed to switch accounts.
 */
export function GuestOnly() {
  const { profile, onboardingRequired, initialized } = useAuthStore()
  if (!initialized) return null
  if (profile && !onboardingRequired) {
    return <Navigate to={roleHome(profile.role)} replace />
  }
  return <Outlet />
}

/** Session required; must still complete class join. */
export function OnboardingOnly() {
  const { sessionUserId, onboardingRequired, profile, initialized } = useAuthStore()
  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        With Bible 불러오는 중…
      </div>
    )
  }
  if (!sessionUserId) {
    return <Navigate to="/login" replace />
  }
  if (!onboardingRequired) {
    return <Navigate to={profile ? roleHome(profile.role) : '/'} replace />
  }
  return <Outlet />
}
