import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { isSupabaseConfigured } from '@/lib/supabase'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.loading)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold tracking-wide text-sky-dark">고등부 복음서 함께 읽기</p>
      <h1 className="font-display mt-2 text-4xl text-navy">with BIBLE</h1>
      <p className="mt-3 text-muted">함께 읽고, 함께 나누고, 함께 완주해요.</p>

      {!isSupabaseConfigured ? (
        <p className="mt-6 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          Supabase 환경변수를 먼저 설정해주세요.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-muted">이메일</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@church.com"
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
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        아직 계정이 없나요?{' '}
        <Link to="/signup" className="font-semibold text-brand-700">
          회원가입
        </Link>
      </p>
    </div>
  )
}
