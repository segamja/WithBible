import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

/** Hard logout then land on login (clears stuck onboarding sessions). */
export function LogoutPage() {
  const logout = useAuthStore((s) => s.logout)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await logout()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '로그아웃 실패')
        }
      } finally {
        if (!cancelled) {
          // Full navigation so auth state cannot bounce back to onboarding
          window.location.replace('/login')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [logout])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-muted">
      <p>로그아웃 중…</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  )
}
