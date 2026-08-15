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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-surface px-6 py-10">
      <p className="caption-caps">with BIBLE</p>
      <h1 className="page-title mt-1">회원가입</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        가입코드는{' '}
        <span className="font-medium text-navy">WB-학년-반</span>,{' '}
        <span className="font-medium text-navy">T-WB-학년-반</span>,{' '}
        <span className="font-medium text-navy">STAFF26</span> 형식입니다. 코드 종류에 따라 권한이
        정해집니다.
      </p>

      {done ? (
        <div className="mt-8 space-y-4 rounded-[1.5rem] border border-sage/25 bg-sage-soft p-5">
          <p className="font-medium text-sage-dark">가입이 완료되었습니다.</p>
          <p className="text-sm text-muted">
            이메일 확인이 켜져 있다면 메일함을 확인해주세요. 바로 로그인되면 홈으로 이동합니다.
          </p>
          <Link to="/" className="font-semibold text-navy">
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
            <label className="mb-1.5 block text-sm text-muted">가입코드 (학생/선생님/임원선생님)</label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="WB-학년-반 또는 T-WB-학년-반 또는 STAFF26"
              autoCapitalize="characters"
            />
            <p className="mt-1 text-xs text-muted">
              예: 학생 WB-2-1 · 담임 T-WB-2-1 · 임원 STAFF26
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">임원·강도사님 코드 (선택)</label>
            <Input
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              placeholder="STAFF26"
              autoCapitalize="characters"
            />
            <p className="mt-1 text-xs text-muted">
              담임은 교사 코드(T-…)만 넣으면 됩니다. 최고관리자는 가입 코드로 만들지 않습니다.
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
