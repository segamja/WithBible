import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { createReadingLog } from '@/services/readingService'
import { uploadCheckinPhoto } from '@/services/storageService'
import { getPersonalProgress, getReadingTargets } from '@/services/progressService'
import type { BibleBook, Visibility } from '@/types'

export function CheckinPage() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)!
  const { project, myProjectClass, bibleBooks, loadForUser } = useProjectStore()
  const [bookId, setBookId] = useState('')
  const [startChapter, setStartChapter] = useState('1')
  const [endChapter, setEndChapter] = useState('1')
  const [reflection, setReflection] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  /** Only books set as project reading goals (설정) */
  const [goalBooks, setGoalBooks] = useState<BibleBook[]>([])
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile.class_id) setVisibility('public')
  }, [profile.class_id])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) return
    const run = async () => {
      const targets = await getReadingTargets(project.id, profile.class_id)
      const books: BibleBook[] = targets.map((t) => {
        const full = bibleBooks.find((b) => b.id === t.bookId)
        return (
          full ?? {
            id: t.bookId,
            name: t.bookName,
            testament: 'NT',
            chapter_count: t.endChapter,
            sort_order: t.sortOrder,
          }
        )
      })
      setGoalBooks(books)

      if (books.length === 0) {
        setBookId('')
        setError('관리자가 설정한 읽기 목표 성경이 없습니다. 설정에서 목표 책을 저장해주세요.')
        return
      }

      const personal = await getPersonalProgress(project.id, profile.id, profile.class_id)
      const nextBook = personal.byBook.find((b) => b.covered < b.target) ?? personal.byBook[0]
      const preferred =
        nextBook?.bookId ??
        targets[0]?.bookId ??
        books[0]?.id ??
        ''

      setBookId((current) => {
        if (current && books.some((b) => b.id === current)) return current
        return preferred && books.some((b) => b.id === preferred) ? preferred : books[0].id
      })
      setError(null)

      if (nextBook) {
        const next = Math.min(nextBook.covered + 1, nextBook.endChapter)
        setStartChapter(String(next))
        setEndChapter(String(next))
      }
    }
    void run().catch((e) => setError(e instanceof Error ? e.message : '목표 성경 로드 실패'))
  }, [project, profile.class_id, profile.id, bibleBooks])

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

  const onChapterBlur = (value: string, setter: (v: string) => void) => () => {
    if (value === '') return
    const n = parseChapter(value)
    if (n !== null) setter(String(n))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const resolvedBookId =
      (bookId && goalBooks.some((b) => b.id === bookId) ? bookId : null) ?? goalBooks[0]?.id ?? ''
    if (!resolvedBookId) {
      setError('목표로 설정된 성경이 없습니다. 관리자 설정에서 읽기 목표를 저장해주세요.')
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
    goalBooks.find((b) => b.id === bookId)?.name ??
    myProjectClass?.bible_books?.name ??
    '복음서'
  const rangeLabel = `${bookName} ${startChapter}${
    endChapter !== startChapter ? `-${endChapter}` : ''
  }장`

  if (!project) {
    return (
      <div className="px-5 py-8">
        <h1 className="font-display text-2xl text-navy">오늘의 말씀 인증</h1>
        <p className="mt-2 text-muted">활성 프로젝트가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="px-5 pb-8 pt-5">
      <header className="relative mb-5 flex items-center justify-center">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-0 rounded-full p-2 text-navy hover:bg-brand-50"
          aria-label="뒤로"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl text-navy">오늘의 말씀 인증</h1>
      </header>

      {done ? (
        <Card className="border-sage/30 bg-sage/10">
          <p className="font-medium text-sage-dark">인증 완료! 피드에서 바로 확인할 수 있어요.</p>
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Card className="space-y-2">
            <p className="font-semibold text-navy">오늘 읽은 말씀</p>
            <p className="font-display text-xl text-ink">{rangeLabel}</p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Select
                required
                value={bookId || goalBooks[0]?.id || ''}
                onChange={(e) => setBookId(e.target.value)}
                className="col-span-3"
                disabled={goalBooks.length === 0}
              >
                {goalBooks.length === 0 ? (
                  <option value="">목표 성경 없음</option>
                ) : (
                  goalBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </Select>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={startChapter}
                onChange={onChapterChange(setStartChapter)}
                onBlur={onChapterBlur(startChapter, setStartChapter)}
                aria-label="시작 장"
              />
              <span className="flex items-center justify-center text-sm text-muted">~</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={endChapter}
                onChange={onChapterChange(setEndChapter)}
                onBlur={onChapterBlur(endChapter, setEndChapter)}
                aria-label="종료 장"
              />
            </div>
          </Card>

          <div className="rounded-[1.4rem] border border-dashed border-line bg-panel/60 px-4 py-6">
            {photoPreview ? (
              <div className="relative overflow-hidden rounded-2xl">
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
              <div className="flex flex-col items-center text-center">
                <Camera className="h-10 w-10 text-muted" strokeWidth={1.5} />
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  읽은 성경 부분이 보이도록 촬영해주세요
                  <br />
                  (얼굴 제외)
                </p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                성경 사진 촬영
              </Button>
              <Button
                type="button"
                variant="soft"
                className="w-full"
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                사진 선택
              </Button>
            </div>
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

          <div className="space-y-2">
            <p className="font-semibold text-navy">✍️ 오늘 마음에 남은 한 줄</p>
            <Card className="p-0">
              <Textarea
                required
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="오늘 말씀에서 가장 기억에 남은 것은?"
                className="min-h-28 border-0 bg-transparent shadow-none"
              />
            </Card>
          </div>

          {profile.class_id ? (
            <div>
              <label className="mb-1.5 block text-sm text-muted">공개 범위</label>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
              >
                <option value="public">전체 공개</option>
                <option value="class">반 친구에게 공개</option>
              </Select>
            </div>
          ) : (
            <p className="rounded-2xl bg-brand-50 px-3 py-2 text-sm text-navy">
              반에 소속되지 않아 전체 공개로 올라갑니다.
            </p>
          )}

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || goalBooks.length === 0}
          >
            {loading ? '업로드 중…' : '말씀 인증하기'}
          </Button>
        </form>
      )}
    </div>
  )
}
