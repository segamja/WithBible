import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getPersonalProgress } from '@/services/progressService'
import { getAuthProviderAvatarUrl, updateProfile } from '@/services/authService'
import { uploadProfilePhoto } from '@/services/storageService'
import { rememberAccount } from '@/lib/savedAccounts'
import { roleLabel } from '@/lib/roles'

export function MePage() {
  const profile = useAuthStore((s) => s.profile)!
  const setProfile = useAuthStore((s) => s.setProfile)
  const { project, classes, loadForUser } = useProjectStore()
  const myClass = classes.find((c) => c.id === profile.class_id)
  const [personal, setPersonal] = useState<Awaited<ReturnType<typeof getPersonalProgress>> | null>(
    null,
  )
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoMessage, setPhotoMessage] = useState<string | null>(null)
  const [providerAvatar, setProviderAvatar] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    rememberAccount(profile, profile.email ? 'email' : 'kakao')
  }, [profile])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    void getAuthProviderAvatarUrl()
      .then(setProviderAvatar)
      .catch(() => setProviderAvatar(null))
  }, [profile.id])

  useEffect(() => {
    if (!project) {
      setPersonal(null)
      return
    }
    void getPersonalProgress(project.id, profile.id, profile.class_id)
      .then(setPersonal)
      .catch(() => setPersonal(null))
  }, [project, profile.id, profile.class_id])

  const applyPhoto = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('이미지 파일만 올릴 수 있어요.')
      return
    }
    setPhotoBusy(true)
    setPhotoError(null)
    setPhotoMessage(null)
    try {
      const url = await uploadProfilePhoto(profile.id, file)
      const next = await updateProfile(profile.id, { profile_image: url })
      setProfile(next)
      rememberAccount(next, next.email ? 'email' : 'kakao')
      setPhotoMessage('프로필 사진을 바꿨어요.')
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '사진 업로드 실패')
    } finally {
      setPhotoBusy(false)
    }
  }

  const restoreProviderPhoto = async () => {
    setPhotoBusy(true)
    setPhotoError(null)
    setPhotoMessage(null)
    try {
      const url = providerAvatar ?? (await getAuthProviderAvatarUrl())
      if (!url) {
        setPhotoError('카카오 등 로그인 기본 사진이 없어요.')
        return
      }
      const next = await updateProfile(profile.id, { profile_image: url })
      setProfile(next)
      rememberAccount(next, next.email ? 'email' : 'kakao')
      setProviderAvatar(url)
      setPhotoMessage('로그인 기본 사진으로 되돌렸어요.')
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '사진 복원 실패')
    } finally {
      setPhotoBusy(false)
    }
  }

  const canRestoreProvider =
    Boolean(providerAvatar) && providerAvatar !== profile.profile_image

  return (
    <div className="page">
      <PageHeader eyebrow="내 정보" title="마이" description="계정과 이번 기간 읽기 목표를 확인해요." />

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-sky/30"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-soft text-lg font-semibold text-sky-dark">
                {profile.name.slice(0, 1)}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-navy text-white shadow">
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl text-navy">{profile.name}</p>
            <p className="truncate text-sm text-muted">{profile.email || '이메일 없음'}</p>
            <p className="mt-1 text-xs text-muted">
              카카오 로그인 시 기본은 카카오 프로필 사진이에요. 원하면 직접 바꿀 수 있어요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full whitespace-nowrap px-3 text-[13px]"
            disabled={photoBusy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4 shrink-0" />
            사진 촬영
          </Button>
          <Button
            type="button"
            variant="soft"
            className="w-full whitespace-nowrap px-3 text-[13px]"
            disabled={photoBusy}
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4 shrink-0" />
            앨범에서 선택
          </Button>
        </div>
        {canRestoreProvider ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="sm"
            disabled={photoBusy}
            onClick={() => void restoreProviderPhoto()}
          >
            카카오/로그인 기본 사진으로
          </Button>
        ) : null}
        {photoBusy ? <p className="text-xs text-muted">사진 저장 중…</p> : null}
        {photoMessage ? <p className="text-xs font-medium text-sage-dark">{photoMessage}</p> : null}
        {photoError ? <p className="text-xs text-danger">{photoError}</p> : null}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            void applyPhoto(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void applyPhoto(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs text-muted">역할</p>
            <p className="mt-0.5 font-semibold text-navy">{roleLabel(profile.role)}</p>
          </div>
          <div className="rounded-2xl bg-brand-50 px-3 py-2.5">
            <p className="text-xs text-muted">반</p>
            <p className="mt-0.5 font-semibold text-navy">{myClass?.name ?? '미배정'}</p>
          </div>
        </div>
        {project ? (
          <p className="text-sm text-muted">
            프로젝트 · <span className="font-medium text-navy">{project.title}</span>
          </p>
        ) : null}
      </Card>

      {project && personal ? (
        <Card className="space-y-4">
          <div>
            <p className="caption-caps">Reading Goal</p>
            <h2 className="section-title mt-1">{personal.goalLabel}</h2>
            <p className="mt-1 text-sm text-muted">{personal.readUpToLabel}</p>
          </div>
          <p className="stat-number text-sage-dark">
            {personal.rate}
            <span className="ml-1 text-2xl">%</span>
          </p>
          <p className="text-sm text-muted">
            {personal.covered} / {personal.target}장
          </p>
          <ProgressBar value={personal.rate} />
          <div className="space-y-2">
            {personal.byBook.map((b) => (
              <div key={b.bookId} className="rounded-2xl bg-brand-50 px-3.5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy">{b.bookName}</p>
                  <p className="font-semibold text-sage-dark">{b.rate}%</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {b.covered}/{b.target}장 읽음 · 목표 {b.startChapter}~{b.endChapter}장
                </p>
                <ProgressBar value={b.rate} className="mt-2 h-2" />
              </div>
            ))}
          </div>
          <Link to="/checkin" className="block">
            <Button className="w-full" variant="sage">
              말씀 인증하러 가기
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            {project ? '진행률을 불러오는 중이거나 목표가 없습니다.' : '활성 프로젝트가 없습니다.'}
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {profile.role === 'MASTER' ? (
          <Link to="/admin" className="block">
            <Button variant="outline" className="w-full">
              시스템 관리
            </Button>
          </Link>
        ) : null}
        {profile.role === 'SUB_MASTER' ? (
          <Link to="/ops" className="block">
            <Button variant="outline" className="w-full">
              고등부 운영
            </Button>
          </Link>
        ) : null}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            window.location.assign(`/logout?next=${encodeURIComponent('/login?switch=1')}`)
          }}
        >
          다른 계정으로 전환
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.assign('/logout')
          }}
        >
          로그아웃
        </Button>
      </div>
    </div>
  )
}
