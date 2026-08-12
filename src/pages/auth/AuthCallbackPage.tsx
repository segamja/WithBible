import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentSession } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const oauthError = params.get('error') || params.get('error_description')
        if (oauthError) {
          setError('로그인에 실패했어요. 다시 시도해주세요.')
          return
        }
        // Give supabase-js a moment to parse URL hash/query (PKCE)
        await new Promise((r) => setTimeout(r, 50))
        const session = await getCurrentSession()
        if (cancelled) return
        if (!session?.user) {
          setError('로그인에 실패했어요. 다시 시도해주세요.')
          return
        }
        await refreshProfile()
        if (cancelled) return
        const { onboardingRequired, profile } = useAuthStore.getState()
        if (onboardingRequired) {
          navigate('/onboarding/class', { replace: true })
          return
        }
        if (profile?.role === 'ADMIN') navigate('/admin', { replace: true })
        else if (profile?.role === 'TEACHER') navigate('/teacher', { replace: true })
        else navigate('/', { replace: true })
      } catch {
        if (!cancelled) setError('로그인에 실패했어요. 다시 시도해주세요.')
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [navigate, refreshProfile])

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
        <h1 className="font-display text-2xl text-navy">로그인 실패</h1>
        <p className="mt-3 text-sm text-danger">{error}</p>
        <Link to="/login" className="mt-6">
          <Button className="w-full" size="lg">
            로그인으로 돌아가기
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      카카오 로그인 확인 중…
    </div>
  )
}
