import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { roleHome } from '@/layouts/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AppVersionBadge } from '@/components/AppVersionBadge'
import { clearStaleAppCaches } from '@/lib/version'
import type { Profile } from '@/types'

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#191919"
        d="M12 4C7.03 4 3 7.14 3 11c0 2.45 1.6 4.6 4.02 5.86-.13.47-.47 1.7-.54 1.97-.08.3.11.3.23.22.1-.07 1.55-1.05 2.18-1.48.68.1 1.39.15 2.11.15 4.97 0 9-3.14 9-7S16.97 4 12 4z"
      />
    </svg>
  )
}

function goAfterProfile(profile: Profile, onboardingRequired: boolean) {
  // Full page load so onboarding/Kakao state cannot bounce the user back
  if (onboardingRequired) {
    window.location.replace('/onboarding/class')
    return
  }
  window.location.replace(roleHome(profile.role))
}

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loginWithKakao = useAuthStore((s) => s.loginWithKakao)
  const loading = useAuthStore((s) => s.loading)
  const [searchParams] = useSearchParams()
  const adminMode = searchParams.get('mode') === 'admin'
  const [showEmail, setShowEmail] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'oauth' ? '로그인에 실패했어요. 다시 시도해주세요.' : null,
  )
  const [info, setInfo] = useState<string | null>(
    adminMode
      ? '운영자는 카카오가 아니라 이메일로 로그인하세요. 먼저 다른 계정 세션을 끊었습니다.'
      : null,
  )

  useEffect(() => {
    // Persist bundle version for early cache bust on next visit
    void import('@/lib/version').then(({ APP_VERSION }) => {
      try {
        localStorage.setItem('wb_app_version', APP_VERSION)
      } catch {
        /* ignore */
      }
    })
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    try {
      await clearStaleAppCaches()
      const profile = await login(email, password)
      const { onboardingRequired } = useAuthStore.getState()
      if (adminMode && profile.role !== 'ADMIN') {
        setError(
          `이 계정 역할은 ${profile.role} 입니다. 운영자(ADMIN)가 아닙니다. Supabase에서 role을 ADMIN으로 바꾼 뒤 다시 로그인하세요.`,
        )
        return
      }
      if (onboardingRequired) {
        setInfo('학생 온보딩으로 이동합니다. 운영자라면 로그아웃 후 ADMIN 이메일로 로그인하세요.')
      }
      goAfterProfile(profile, onboardingRequired)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    }
  }

  const onKakao = async () => {
    setError(null)
    try {
      await loginWithKakao()
    } catch (err) {
      setError(err instanceof Error ? err.message : '카카오 로그인 실패')
    }
  }

  const hardResetToAdminLogin = () => {
    window.location.assign(`/logout?next=${encodeURIComponent('/login?mode=admin')}`)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE</p>
      <h1 className="font-display mt-2 text-4xl text-navy">with BIBLE</h1>
      <p className="mt-3 text-muted">함께 읽는 말씀, 함께 자라는 우리</p>
      <AppVersionBadge className="mt-3" />

      {!isSupabaseConfigured ? (
        <p className="mt-6 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          Supabase 환경변수를 먼저 설정해주세요.
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-line bg-brand-50/80 p-4 text-sm text-navy">
        <p className="font-semibold">운영자(관리자) 로그인</p>
        <p className="mt-1 text-muted">
          카카오·학생 세션이 남아 있으면 /admin에 들어갈 수 없습니다. 아래 버튼으로 세션을 끊은 뒤
          이메일로 로그인하세요.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          onClick={hardResetToAdminLogin}
        >
          세션 초기화 후 운영자 로그인
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {!adminMode ? (
          <button
            type="button"
            onClick={() => void onKakao()}
            disabled={loading || !isSupabaseConfigured}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] text-[15px] font-semibold text-[#191919] transition active:scale-[0.98] disabled:opacity-50"
          >
            <KakaoIcon className="h-5 w-5" />
            카카오로 시작하기
          </button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={() => setShowEmail((v) => !v)}
        >
          이메일로 시작하기
        </Button>
      </div>

      {showEmail ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">이메일</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@church.com"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">비밀번호</label>
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? '로그인 중…' : adminMode ? '운영자 로그인' : '로그인'}
          </Button>
          <p className="text-center text-sm text-muted">
            아직 계정이 없나요?{' '}
            <Link to="/signup" className="font-semibold text-navy">
              회원가입
            </Link>
          </p>
        </form>
      ) : null}

      {info ? <p className="mt-4 text-sm text-sky-dark">{info}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </div>
  )
}
