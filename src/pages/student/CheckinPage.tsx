import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { createReadingLog } from '@/services/readingService'
import { uploadCheckinPhoto } from '@/services/storageService'
import { getPersonalProgress } from '@/services/progressService'
import type { Visibility } from '@/types'
import { getTodayReadingRange } from '@/utils/schedule'

export function CheckinPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)!
  const { project, myProjectClass, bibleBooks, loadForUser } = useProjectStore()
  const [bookId, setBookId] = useState('')
  /** Keep as string so clearing the field does not force `0`. */
  const [startChapter, setStartChapter] = useState('1')
  const [endChapter, setEndChapter] = useState('1')
  const [reflection, setReflection] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // Staff without a class: force public visibility
  useEffect(() => {
    if (!profile.class_id) setVisibility('public')
  }, [profile.class_id])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  // Keep bookId in sync with loaded books (Select can look selected while value is still "").
  useEffect(() => {
    if (bibleBooks.length === 0) return
    setBookId((current) => {
      if (current && bibleBooks.some((b) => b.id === current)) return current
      const preferred = myProjectClass?.target_book_id
      if (preferred && bibleBooks.some((b) => b.id === preferred)) return preferred
      return bibleBooks[0]?.id ?? ''
    })
  }, [bibleBooks, myProjectClass?.target_book_id])

  useEffect(() => {
    if (!project) return
    if (myProjectClass) {
      const range = getTodayReadingRange({
        startDate: project.start_date,
        endDate: project.end_date,
        targetStart: myProjectClass.target_start_chapter,
        targetEnd: myProjectClass.target_end_chapter,
      })
      setStartChapter(String(range.start))
      setEndChapter(String(range.end))
      return
    }
    if (!profile.class_id) return
    const run = async () => {
      const personal = await getPersonalProgress(project.id, profile.id, profile.class_id!)
      const next = Math.min(personal.covered + 1, personal.target || 1)
      setStartChapter(String(next))
      setEndChapter(String(next))
    }
    void run()
  }, [project, profile.class_id, profile.id, myProjectClass])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const pickFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('사진은 5MB 이하로 올려주세요.')
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError(null)
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const parseChapter = (raw: string) => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 ? n : null
  }

  const onChapterChange =
    (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw === '' || /^\d+$/.test(raw)) setter(raw)
    }

  const onChapterBlur =
    (value: string, setter: (v: string) => void) => () => {
      if (value === '') return
      const n = parseChapter(value)
      if (n !== null) setter(String(n))
    }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const resolvedBookId =
      (bookId && bibleBooks.some((b) => b.id === bookId) ? bookId : null) ??
      (myProjectClass?.target_book_id &&
      bibleBooks.some((b) => b.id === myProjectClass.target_book_id)
        ? myProjectClass.target_book_id
        : null) ??
      bibleBooks[0]?.id ??
      ''
    if (!resolvedBookId) {
      setError('성경을 선택해주세요.')
      return
    }
    if (resolvedBookId !== bookId) setBookId(resolvedBookId)
    if (!photoFile) {
      setError('성경 페이지 사진을 찍어 올려주세요.')
      return
    }
    const start = parseChapter(startChapter)
    const end = parseChapter(endChapter)
    if (start === null || end === null) {
      setError('시작 장과 종료 장을 1 이상으로 입력해주세요.')
      return
    }
    if (end < start) {
      setError('종료 장은 시작 장보다 크거나 같아야 합니다.')
      return
    }
    if (!project) return
    setLoading(true)
    setError(null)
    try {
      const imageUrl = await uploadCheckinPhoto(profile.id, photoFile)
      await createReadingLog(profile.id, {
        projectId: project.id,
        bookId: resolvedBookId,
        startChapter: start,
        endChapter: end,
        reflection: reflection.trim(),
        visibility,
        imageUrl,
      })
      setDone(true)
      setTimeout(() => navigate('/feed'), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증 실패')
    } finally {
      setLoading(false)
    }
  }

  const bookName =
    bibleBooks.find((b) => b.id === bookId)?.name ??
    myProjectClass?.bible_books?.name ??
    '복음서'

  if (!project) {
    return (
      <div className="px-5 py-8">
        <h1 className="font-display text-2xl text-navy">인증</h1>
        <p className="mt-2 text-muted">활성 프로젝트가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="px-5 pb-8 pt-7">
      <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE</p>
      <h1 className="font-display mt-1 text-3xl text-navy">오늘 읽었어요</h1>
      <p className="mt-2 text-sm text-muted">
        셀피가 아니라, 오늘 읽은 <span className="font-medium text-navy">성경 페이지</span>를
        찍어 올려주세요.
      </p>

      {done ? (
        <Card className="mt-6 border-sage/30 bg-sage/10">
          <p className="font-medium text-sage-dark">인증 완료! 피드에서 바로 확인할 수 있어요.</p>
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Card className="space-y-4 border-none bg-navy text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
              오늘의 말씀
            </p>
            <p className="font-display text-2xl">
              {bookName} {startChapter}
              {endChapter !== startChapter ? `–${endChapter}` : ''}장
            </p>
            <p className="text-sm text-white/70">아래에서 장을 조정할 수도 있어요.</p>
          </Card>

          <Card className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted">성경 페이지 사진</label>
              {photoPreview ? (
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={photoPreview}
                    alt="인증 미리보기"
                    className="max-h-72 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white"
                    aria-label="사진 삭제"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sage/50 bg-sage/10 text-sm font-medium text-sage-dark"
                  >
                    <Camera className="h-6 w-6" />
                    성경 사진 촬영
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-brand-50 text-sm font-medium text-navy"
                  >
                    <ImagePlus className="h-6 w-6" />
                    사진 선택
                  </button>
                </div>
              )}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-muted">성경</label>
              <Select
                required
                value={bookId || bibleBooks[0]?.id || ''}
                onChange={(e) => setBookId(e.target.value)}
              >
                {bibleBooks.length === 0 ? (
                  <option value="">불러오는 중…</option>
                ) : (
                  bibleBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm text-muted">시작 장</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={startChapter}
                  onChange={onChapterChange(setStartChapter)}
                  onBlur={onChapterBlur(startChapter, setStartChapter)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">종료 장</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={endChapter}
                  onChange={onChapterChange(setEndChapter)}
                  onBlur={onChapterBlur(endChapter, setEndChapter)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">오늘의 한 줄 묵상</label>
              <Textarea
                required
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="오늘 말씀에서 가장 기억에 남은 것은?"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">공개 범위</label>
              {profile.class_id ? (
                <Select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                >
                  <option value="public">전체 공개</option>
                  <option value="class">반 친구에게 공개</option>
                </Select>
              ) : (
                <p className="rounded-xl border border-line bg-brand-50 px-3 py-2 text-sm text-navy">
                  반에 소속되지 않아 전체 공개로 올라갑니다.
                </p>
              )}
            </div>
          </Card>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? '업로드 중…' : '사진으로 인증하기'}
          </Button>
        </form>
      )}
    </div>
  )
}
