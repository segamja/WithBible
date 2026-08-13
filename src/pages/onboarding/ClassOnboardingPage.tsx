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
      setError('가입코드를 입력해주세요.')
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
        ? '교사 권한과 반이 함께 연결됐어요.'
        : success.joinKind === 'staff'
          ? '임원으로 등록됐어요. 반 현황은 담임 선생님 화면입니다.'
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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center bg-surface px-6 py-10">
      <p className="caption-caps">with BIBLE</p>
      <h1 className="page-title mt-2">
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
            <label className="mb-1.5 block text-sm text-muted">
              가입코드 (학생 / 담임 교사 / 임원)
            </label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="WB-학년-반 또는 T-WB-학년-반 또는 STAFF26"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-semibold tracking-wide"
            />
            <p className="mt-1 text-xs text-muted">
              예: 학생 WB-2-1 · 담임 T-WB-2-1 · 임원 STAFF26
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">
              임원 코드 + 학생 반 코드 (선택)
            </label>
            <Input
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              placeholder="임원 코드 STAFF26 (위에 학생 코드와 함께)"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-semibold tracking-wide"
            />
            <p className="mt-1 text-xs text-muted">
              보통은 위 한 칸만 쓰면 됩니다. 담임은 교사 코드(T-…)만 넣으면 권한이 부여됩니다.
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
      </div>
    </div>
  )
}
