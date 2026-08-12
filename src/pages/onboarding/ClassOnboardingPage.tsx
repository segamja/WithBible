import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { roleHome } from '@/layouts/AppShell'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types'

export function ClassOnboardingPage() {
  const navigate = useNavigate()
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const loading = useAuthStore((s) => s.loading)
  const profile = useAuthStore((s) => s.profile)
  const [joinCode, setJoinCode] = useState('')
  const [staffCode, setStaffCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    joinKind: 'class' | 'staff' | 'teacher_class'
    displayName: string
    role: UserRole
  } | null>(null)
  const [switching, setSwitching] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!joinCode.trim() && !staffCode.trim()) {
      setError('반 가입코드 또는 교사 코드를 입력해주세요.')
      return
    }
    try {
      const result = await completeOnboarding(joinCode, staffCode.trim() || null)
      setSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입코드 연결 실패')
    }
  }

  const goLogout = () => {
    setSwitching(true)
    window.location.assign('/logout')
  }

  if (success) {
    const title =
      success.joinKind === 'teacher_class'
        ? `${success.displayName} 담임 교사로 등록되었습니다!`
        : success.joinKind === 'staff'
          ? `${success.displayName}으로 등록되었습니다!`
          : `${success.displayName}과 연결되었습니다!`
    const subtitle =
      success.joinKind === 'teacher_class'
        ? '교사 권한과 반이 함께 연결됐어요. 학생들과 함께 말씀을 읽어보세요.'
        : success.joinKind === 'staff'
          ? '말씀을 읽고 인증하며, 친구들을 격려해 주세요. (반 현황은 담임 선생님 화면입니다)'
          : '이제 우리 반과 함께 말씀을 읽어보세요.'

    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10">
        <Card className="space-y-4 border-none bg-navy text-white shadow-[0_16px_40px_rgba(23,32,51,0.28)]">
          <p className="text-3xl">🎉</p>
          <h1 className="font-display text-2xl leading-snug">{title}</h1>
          <p className="text-sm text-white/75">{subtitle}</p>
          <Button
            variant="sage"
            size="lg"
            className="w-full"
            onClick={() => navigate(roleHome(success.role), { replace: true })}
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
        가입코드를 입력하고
        <br />
        말씀을 함께 읽어볼까요?
      </p>
      {profile?.name ? (
        <p className="mt-2 text-sm text-muted">현재 계정 · {profile.name}</p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Card className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm text-muted">반 가입코드</label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="예: BIBLE26-2"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-semibold tracking-wide"
            />
            <p className="mt-1 text-xs text-muted">학생 · 담임 교사 모두 반 코드를 넣습니다.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">교사/임원 코드 (선택)</label>
            <Input
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              placeholder="예: STAFF26"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-semibold tracking-wide"
            />
            <p className="mt-1 text-xs text-muted">
              담임이면 반 코드 + 교사 코드를 함께 넣으면 TEACHER로 등록됩니다. 임원만이면 교사
              코드만 넣어도 됩니다.
            </p>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </Card>
        <Button type="submit" className="w-full" size="lg" disabled={loading || switching}>
          {loading ? '연결 중…' : '시작하기'}
        </Button>
      </form>

      <div className="mt-8 space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          disabled={switching}
          onClick={goLogout}
        >
          {switching ? '이동 중…' : '로그아웃 · 다른 계정으로 로그인'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          size="lg"
          disabled={switching}
          onClick={() => {
            setSwitching(true)
            window.location.assign('/admin/login')
          }}
        >
          관리자 로그인
        </Button>
        <p className="text-center text-xs text-muted">
          운영자는 카카오가 아니라 관리자 로그인(이메일)을 사용하세요.
        </p>
      </div>
    </div>
  )
}
