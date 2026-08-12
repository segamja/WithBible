import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { BottomNav } from '@/components/BottomNav'
import type { UserRole } from '@/types'
import { isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/utils/cn'

export function AppShell() {
  const { profile, initialized } = useAuthStore()
  const location = useLocation()
  const wide = location.pathname.startsWith('/progress')

  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        With Bible 불러오는 중…
      </div>
    )
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-3xl text-brand-800">With Bible</h1>
        <p className="text-muted">
          `.env`에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 설정한 뒤 다시 실행해주세요.
        </p>
        <p className="text-sm text-muted">
          Supabase SQL Editor에서 `supabase/migrations`와 `seed.sql`을 실행하세요.
        </p>
      </div>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className={cn('mx-auto min-h-dvh pb-24', wide ? 'max-w-4xl' : 'max-w-lg')}>
      <Outlet />
      <BottomNav role={profile.role} />
    </div>
  )
}

export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const profile = useAuthStore((s) => s.profile)
  if (!profile) return <Navigate to="/login" replace />
  if (!allow.includes(profile.role)) {
    if (profile.role === 'ADMIN') return <Navigate to="/admin" replace />
    if (profile.role === 'TEACHER') return <Navigate to="/teacher" replace />
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export function GuestOnly() {
  const { profile, initialized } = useAuthStore()
  if (!initialized) return null
  if (profile) {
    if (profile.role === 'ADMIN') return <Navigate to="/admin" replace />
    if (profile.role === 'TEACHER') return <Navigate to="/teacher" replace />
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
