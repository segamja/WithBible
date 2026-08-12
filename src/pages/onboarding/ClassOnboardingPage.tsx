import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'

export function ClassOnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const logout = useAuthStore((s) => s.logout)
  const loading = useAuthStore((s) => s.loading)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linkedClassName, setLinkedClassName] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const { className } = await completeOnboarding(joinCode)
      setLinkedClassName(className)
    } catch (err) {
      setError(err instanceof Error ? err.message : '반 연결 실패')
    }
  }

  if (linkedClassName) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
        <Card className="space-y-4 border-none bg-navy text-white shadow-[0_16px_40px_rgba(23,32,51,0.28)]">
          <p className="text-3xl">🎉</p>
          <h1 className="font-display text-2xl leading-snug">
            {linkedClassName}과 연결되었습니다!
          </h1>
          <p className="text-sm text-white/75">이제 우리 반과 함께 말씀을 읽어보세요.</p>
          <Button
            variant="sage"
            size="lg"
            className="w-full"
            onClick={() => navigate('/', { replace: true })}
          >
            시작하기
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
      <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE</p>
      <h1 className="font-display mt-2 text-[1.85rem] leading-tight text-navy">
        Welcome to with BIBLE 👋
      </h1>
      <p className="mt-3 text-muted">안녕하세요!</p>
      <p className="mt-1 text-lg font-medium text-navy">
        우리 반과 함께
        <br />
        말씀을 읽어볼까요?
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Card className="space-y-3">
          <label className="block text-sm text-muted">우리 반 가입코드를 입력해주세요.</label>
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="BIBLE26-2"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-semibold tracking-wide"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </Card>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? '연결 중…' : '우리 반 연결하기'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm text-muted underline-offset-2 hover:underline"
        onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
      >
        다른 계정으로 로그인
      </button>
    </div>
  )
}
