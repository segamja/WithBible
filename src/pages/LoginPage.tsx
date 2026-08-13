import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SavedAccountList } from '@/components/SavedAccountList'
import { roleHome } from '@/layouts/AppShell'
import { useAuthStore } from '@/stores/authStore'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AppVersionBadge } from '@/components/AppVersionBadge'
import { APP_VERSION, clearStaleAppCaches } from '@/lib/version'
import type { SavedAccount } from '@/lib/savedAccounts'
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
  const switching = searchParams.get('switch') === '1'
  const [showEmail, setShowEmail] = useState(switching)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(
    switching ? '전환할 계정을 고른 뒤 비밀번호를 입력하세요.' : null,
  )
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem('wb_app_version', APP_VERSION)
    } catch {
      /* ignore */
    }
  }, [])

  const pickAccount = (account: SavedAccount) => {
    setError(null)
    setPassword('')
    if (account.provider === 'kakao' || !account.email) {
      setShowEmail(false)
      setHint(
        `${account.name}(${account.role === 'ADMIN' ? '관리자' : account.role === 'TEACHER' ? '교사' : '학생'})는 카카오 로그인으로 들어오세요.`,
      )
      return
    }
    setEmail(account.email)
    setShowEmail(true)
    setHint(`${account.name} 계정 · 비밀번호만 입력하면 됩니다.`)
    window.setTimeout(() => passwordRef.current?.focus(), 50)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await clearStaleAppCaches()
      const profile = await login(email, password)
      const { onboardingRequired } = useAuthStore.getState()
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-surface px-6 py-10">
      <p className="caption-caps">Modern Christian Youth</p>
      <h1 className="font-display mt-2 text-[2.4rem] leading-none text-navy">with BIBLE</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        함께 읽는 말씀, 함께 자라는 우리
      </p>
      <AppVersionBadge className="mt-3" />

      {switching ? (
        <p className="mt-4 rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-dark">
          계정 전환 모드 · 아래에서 계정을 선택하세요.
        </p>
      ) : null}

      {!isSupabaseConfigured ? (
        <p className="mt-6 rounded-2xl bg-streak/20 px-4 py-3 text-sm text-navy">
          Supabase 환경변수를 먼저 설정해주세요.
        </p>
      ) : null}

      <SavedAccountList
        className="mt-6"
        title="계정 선택"
        hint="한 번 로그인한 계정이 이 기기에 기억됩니다. (비밀번호는 저장하지 않아요)"
        onPick={pickAccount}
      />

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => void onKakao()}
          disabled={loading || !isSupabaseConfigured}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] text-[15px] font-semibold text-[#191919] shadow-[0_4px_14px_rgba(254,229,0,0.35)] transition active:scale-[0.98] disabled:opacity-50"
        >
          <KakaoIcon className="h-5 w-5" />
          카카오로 시작하기
        </button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={() => setShowEmail((v) => !v)}
        >
          이메일로 시작하기
        </Button>

        <Link
          to="/admin/login"
          className="flex h-12 w-full items-center justify-center rounded-full bg-navy text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(23,32,51,0.18)] transition hover:bg-navy-deep active:scale-[0.98]"
        >
          관리자 로그인
        </Link>
      </div>

      {hint ? <p className="mt-4 text-sm text-sky-dark">{hint}</p> : null}

      {showEmail ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">이메일</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@church.com"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">비밀번호</label>
            <Input
              ref={passwordRef}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </Button>
          <p className="text-center text-sm text-muted">
            아직 계정이 없나요?{' '}
            <Link to="/signup" className="font-semibold text-navy">
              회원가입
            </Link>
          </p>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </div>
  )
}
