import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { clearStaleAppCaches } from '@/lib/version'

/** Hard logout then land on login (clears stuck onboarding / Kakao sessions). */
export function LogoutPage() {
  const logout = useAuthStore((s) => s.logout)
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await clearStaleAppCaches()
        await logout()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '로그아웃 실패')
        }
      } finally {
        if (!cancelled) {
          const next = searchParams.get('next')
          // Allow only same-origin relative paths
          const target =
            next && next.startsWith('/') && !next.startsWith('//') ? next : '/login'
          window.location.replace(target)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [logout, searchParams])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-muted">
      <p>로그아웃 중…</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  )
}
