import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'

export function SignupPage() {
  const register = useAuthStore((s) => s.register)
  const loading = useAuthStore((s) => s.loading)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [staffCode, setStaffCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!joinCode.trim() && !staffCode.trim()) {
      setError('반 가입코드 또는 교사 코드를 입력해주세요.')
      return
    }
    try {
      await register({
        name,
        email,
        password,
        joinCode: joinCode.trim() || undefined,
        staffCode: staffCode.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <h1 className="font-display text-3xl text-brand-900">회원가입</h1>
      <p className="mt-2 text-muted">
        학생은 반 코드, 담임 교사는 반 코드+교사 코드, 임원은 교사 코드만 입력하세요.
      </p>

      {done ? (
        <div className="mt-8 space-y-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="font-medium text-brand-800">가입이 완료되었습니다.</p>
          <p className="text-sm text-muted">
            이메일 확인이 켜져 있다면 메일함을 확인해주세요. 바로 로그인되면 홈으로 이동합니다.
          </p>
          <Link to="/" className="font-semibold text-brand-700">
            홈으로
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">이름</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">이메일</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          <div>
            <label className="mb-1.5 block text-sm text-muted">반 가입코드</label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="예: BIBLE26-2"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">교사/임원 코드 (선택)</label>
            <Input
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              placeholder="예: STAFF26"
              autoCapitalize="characters"
            />
            <p className="mt-1 text-xs text-muted">
              둘 다 넣으면 가입과 동시에 TEACHER 권한 + 해당 반 담임으로 연결됩니다.
            </p>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? '가입 중…' : '가입하기'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        이미 계정이 있나요?{' '}
        <Link to="/login" className="font-semibold text-brand-700">
          로그인
        </Link>
      </p>
    </div>
  )
}
