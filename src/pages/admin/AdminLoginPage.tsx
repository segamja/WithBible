import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SavedAccountList } from '@/components/SavedAccountList'
import { AppVersionBadge } from '@/components/AppVersionBadge'
import { useAuthStore } from '@/stores/authStore'
import { isSupabaseConfigured } from '@/lib/supabase'
import { APP_VERSION, clearStaleAppCaches } from '@/lib/version'
import type { SavedAccount } from '@/lib/savedAccounts'

/**
 * Dedicated operator login (MyLevelUp `/admin/auth` style).
 * Email only — Kakao/student sessions are cleared before sign-in.
 */
export function AdminLoginPage() {
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const loading = useAuthStore((s) => s.loading)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(true)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem('wb_app_version', APP_VERSION)
    } catch {
      /* ignore */
    }
  }, [])

  // Always start admin login from a clean session
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await clearStaleAppCaches()
        await logout()
      } catch {
        /* ignore — still show form */
      } finally {
        if (!cancelled) setPreparing(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [logout])

  const pickAccount = (account: SavedAccount) => {
    if (!account.email) {
      setError('이 계정은 이메일이 없어 관리자 로그인에 쓸 수 없습니다.')
      return
    }
    setEmail(account.email)
    setPassword('')
    setError(null)
    window.setTimeout(() => passwordRef.current?.focus(), 50)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const profile = await login(email, password)
      if (profile.role !== 'ADMIN') {
        setError(
          `이 계정은 ${profile.role} 입니다. 운영자(ADMIN)만 이 화면으로 로그인할 수 있어요.`,
        )
        await logout().catch(() => undefined)
        return
      }
      window.location.replace('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-surface px-6 py-10">
      <p className="caption-caps">with BIBLE · 운영</p>
      <h1 className="page-title mt-2">관리자 로그인</h1>
      <p className="mt-2 text-sm text-muted">운영자 전용 · 이메일 계정으로 입장합니다.</p>
      <AppVersionBadge className="mt-3" />

      {!isSupabaseConfigured ? (
        <p className="mt-6 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          Supabase 환경변수를 먼저 설정해주세요.
        </p>
      ) : null}

      {preparing ? (
        <p className="mt-8 text-sm text-muted">세션 정리 중…</p>
      ) : (
        <>
          <SavedAccountList
            className="mt-6"
            title="관리자 계정 선택"
            hint="관리자로 로그인한 적 있는 계정을 고르고 비밀번호만 입력하세요."
            filter={(a) => a.role === 'ADMIN' && Boolean(a.email)}
            onPick={pickAccount}
          />

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
                autoFocus
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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !isSupabaseConfigured}
            >
              {loading ? '로그인 중…' : '관리자로 입장'}
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        <Link
          to="/login?switch=1"
          className="font-medium text-navy underline-offset-2 hover:underline"
        >
          ← 학생·교사 계정으로 전환
        </Link>
      </p>
    </div>
  )
}
