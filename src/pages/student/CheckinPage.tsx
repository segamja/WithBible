import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChapterPicker, ChapterSpanPicks } from '@/components/ui/ChapterPicker'
import { Field } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { createReadingLog, getReadingLog, updateReadingLog, getLiveTodayTogether } from '@/services/readingService'
import { uploadCheckinPhoto } from '@/services/storageService'
import { getPersonalProgress, getReadingTargets } from '@/services/progressService'
import type { BibleBook } from '@/types'
import {
  compareActualToTarget,
  formatGoalStatusCopy,
  formatOfficialRangeLabel,
  getOfficialTodayParts,
  officialPartForBook,
  type OfficialRangePart,
} from '@/utils/todayGoal'

type BookRange = { start: number; end: number }

function parseChapter(raw: string) {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

function clampToRange(n: number, range: BookRange) {
  return Math.min(range.end, Math.max(range.start, n))
}

export function CheckinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const profile = useAuthStore((s) => s.profile)!
  const { project, myProjectClass, bibleBooks, loadForUser } = useProjectStore()
  const [bookId, setBookId] = useState('')
  const [startChapter, setStartChapter] = useState('1')
  const [endChapter, setEndChapter] = useState('1')
  const [reflection, setReflection] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [goalBooks, setGoalBooks] = useState<BibleBook[]>([])
  const [bookRanges, setBookRanges] = useState<Record<string, BookRange>>({})
  /** 책별 이어서 읽을 시작 장 (마지막 인증 장의 다음) */
  const [resumeByBook, setResumeByBook] = useState<Record<string, number>>({})
  const [officialParts, setOfficialParts] = useState<OfficialRangePart[]>([])
  const [todayTogether, setTodayTogether] = useState<{ count: number; goalLabel: string }>({
    count: 0,
    goalLabel: '',
  })
  const [doneCopy, setDoneCopy] = useState<{ primary: string; secondary: string } | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) return
    const run = async () => {
      const targets = await getReadingTargets(project.id, profile.class_id)
      setOfficialParts(
        getOfficialTodayParts({
          startDate: project.start_date,
          endDate: project.end_date,
          targets,
        }),
      )
      try {
        setTodayTogether(await getLiveTodayTogether(project.id))
      } catch {
        setTodayTogether({ count: 0, goalLabel: '' })
      }
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

      const ranges: Record<string, BookRange> = {}
      for (const t of targets) {
        const full = bibleBooks.find((b) => b.id === t.bookId)
        const max = full?.chapter_count ?? t.endChapter
        ranges[t.bookId] = {
          start: Math.max(1, t.startChapter),
          end: Math.min(max, t.endChapter),
        }
      }
      setBookRanges(ranges)

      if (books.length === 0) {
        setBookId('')
        setError('관리자가 설정한 읽기 목표 성경이 없습니다. 설정에서 목표 책을 저장해주세요.')
        return
      }

      if (editId) {
        const log = await getReadingLog(editId)
        if (!log || log.user_id !== profile.id) {
          setError('내 인증만 수정할 수 있어요.')
          return
        }
        if (!books.some((b) => b.id === log.book_id)) {
          const extra = bibleBooks.find((b) => b.id === log.book_id)
          if (extra) {
            books.push(extra)
            ranges[extra.id] = { start: 1, end: extra.chapter_count }
            setBookRanges({ ...ranges, [extra.id]: { start: 1, end: extra.chapter_count } })
          }
        }
        setGoalBooks(books)
        setBookId(log.book_id)
        setStartChapter(String(log.start_chapter))
        setEndChapter(String(log.end_chapter))
        setReflection(log.reflection ?? '')
        setExistingImage(log.image_url)
        setError(null)
        return
      }

      setGoalBooks(books)
      const personal = await getPersonalProgress(project.id, profile.id, profile.class_id)
      const resume: Record<string, number> = {}
      for (const b of personal.byBook) {
        const range = ranges[b.bookId] ?? { start: b.startChapter, end: b.endChapter }
        resume[b.bookId] = clampToRange(b.nextChapter, range)
      }
      for (const b of books) {
        if (resume[b.id] == null) {
          resume[b.id] = ranges[b.id]?.start ?? 1
        }
      }
      setResumeByBook(resume)

      const nextBook = personal.byBook.find((b) => b.covered < b.target) ?? personal.byBook[0]
      const preferred =
        nextBook?.bookId ?? targets[0]?.bookId ?? books[0]?.id ?? ''

      const resolvedBookId =
        preferred && books.some((b) => b.id === preferred) ? preferred : books[0].id
      setBookId(resolvedBookId)
      setError(null)

      const next = resume[resolvedBookId] ?? ranges[resolvedBookId]?.start ?? 1
      setStartChapter(String(next))
      setEndChapter(String(next))
    }
    void run().catch((e) => setError(e instanceof Error ? e.message : '목표 성경 로드 실패'))
  }, [project, profile.class_id, profile.id, bibleBooks, editId])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const activeRange = useMemo<BookRange>(() => {
    const fromTarget = bookId ? bookRanges[bookId] : undefined
    if (fromTarget) return fromTarget
    const book = goalBooks.find((b) => b.id === bookId)
    return { start: 1, end: book?.chapter_count ?? 1 }
  }, [bookId, bookRanges, goalBooks])

  const applyStart = (raw: string) => {
    setStartChapter(raw)
    const start = parseChapter(raw)
    const end = parseChapter(endChapter)
    if (start === null) return
    if (end === null || end < start) setEndChapter(String(start))
  }

  const applyEnd = (raw: string) => {
    setEndChapter(raw)
    const end = parseChapter(raw)
    const start = parseChapter(startChapter)
    if (end === null || start === null) return
    if (end < start) setStartChapter(String(end))
  }

  const onBookChange = (nextBookId: string) => {
    setBookId(nextBookId)
    const range = bookRanges[nextBookId] ?? {
      start: 1,
      end: goalBooks.find((b) => b.id === nextBookId)?.chapter_count ?? 1,
    }
    const nextStart = clampToRange(resumeByBook[nextBookId] ?? range.start, range)
    setStartChapter(String(nextStart))
    setEndChapter(String(nextStart))
  }

  /** 빠른 선택: 시작 장부터 N장 → 종료 장 = 시작 + N - 1 */
  const pickChapterSpan = (count: number) => {
    const start = clampToRange(parseChapter(startChapter) ?? activeRange.start, activeRange)
    const end = clampToRange(start + count - 1, activeRange)
    setStartChapter(String(start))
    setEndChapter(String(end))
  }

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

  const displayPhoto = photoPreview ?? existingImage

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setExistingImage(null)
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
    if (!photoFile && !existingImage) {
      setError('성경 페이지 사진을 찍어 올려주세요.')
      return
    }
    const start = parseChapter(startChapter)
    const end = parseChapter(endChapter)
    if (start === null || end === null) {
      setError('시작 장과 종료 장을 1 이상으로 입력해주세요.')
      return
    }
    if (start < activeRange.start || end > activeRange.end) {
      setError(`${activeRange.start}~${activeRange.end}장 범위에서 선택해주세요.`)
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
      const snapshot = officialPartForBook(officialParts, resolvedBookId)
      const targetStart = snapshot?.start ?? null
      const targetEnd = snapshot?.end ?? null
      const imageUrl = photoFile
        ? await uploadCheckinPhoto(profile.id, photoFile)
        : existingImage
      if (editId) {
        await updateReadingLog(editId, profile.id, {
          book_id: resolvedBookId,
          start_chapter: start,
          end_chapter: end,
          reflection: reflection.trim(),
          image_url: imageUrl,
          target_start_chapter: targetStart,
          target_end_chapter: targetEnd,
        })
      } else {
        await createReadingLog(profile.id, {
          projectId: project.id,
          bookId: resolvedBookId,
          startChapter: start,
          endChapter: end,
          reflection: reflection.trim(),
          visibility: 'public',
          imageUrl,
          targetStartChapter: targetStart,
          targetEndChapter: targetEnd,
        })
      }
      const submittedBookName =
        goalBooks.find((b) => b.id === resolvedBookId)?.name ??
        myProjectClass?.bible_books?.name ??
        '복음서'
      if (snapshot) {
        const cmp = compareActualToTarget(
          { start, end },
          { start: snapshot.start, end: snapshot.end },
        )
        setDoneCopy(
          formatGoalStatusCopy({
            bookName: submittedBookName,
            actualEnd: end,
            kind: cmp.kind,
            remaining: cmp.remaining,
            extra: cmp.extra,
          }),
        )
      } else {
        setDoneCopy({
          primary: `${submittedBookName} ${end}장까지 읽었어요.`,
          secondary: editId
            ? '수정했어요. 피드에서 확인할 수 있어요.'
            : '인증 완료! 피드에서 바로 확인할 수 있어요.',
        })
      }
      setDone(true)
      setTimeout(() => navigate('/feed'), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : editId ? '수정 실패' : '인증 실패')
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
  const startNum = parseChapter(startChapter)
  const endNum = parseChapter(endChapter)
  const spanCount =
    startNum !== null && endNum !== null && endNum >= startNum ? endNum - startNum + 1 : null
  const resumeAt = bookId ? resumeByBook[bookId] : null
  const resumeHint =
    resumeAt != null && resumeAt > (bookRanges[bookId]?.start ?? 1)
      ? `이어서 읽기 · 지난번 다음인 ${resumeAt}장부터 자동 선택됨`
      : null
  const officialGoalLabel =
    officialParts.length > 0 ? formatOfficialRangeLabel(officialParts) : null

  if (!project) {
    return (
      <div className="page">
        <PageHeader title="오늘의 말씀 인증" description="활성 프로젝트가 없습니다." />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title={editId ? '인증 수정' : '오늘의 말씀 인증'}
        centered
        onBack={() => navigate(-1)}
      />

      {done ? (
        <Card className="border-sage/25 bg-sage-soft">
          <p className="font-medium text-sage-dark">
            {doneCopy?.primary ??
              (editId
                ? '수정했어요. 피드에서 확인할 수 있어요.'
                : '인증 완료! 피드에서 바로 확인할 수 있어요.')}
          </p>
          {doneCopy?.secondary ? (
            <p className="mt-1 text-sm text-navy">{doneCopy.secondary}</p>
          ) : null}
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Card className="space-y-3">
            <p className="caption-caps">Today&apos;s Reading</p>
            {officialGoalLabel ? (
              <p className="text-xs font-medium text-muted">오늘 목표 · {officialGoalLabel}</p>
            ) : null}
            {todayTogether.goalLabel ? (
              <p className="text-sm font-medium text-sky-dark">
                🙌 지금 {todayTogether.count}명이 오늘 목표를 함께 읽었어요
              </p>
            ) : null}
            <p className="font-display text-xl text-navy">{rangeLabel}</p>

            <Select
              required
              value={bookId || goalBooks[0]?.id || ''}
              onChange={(e) => onBookChange(e.target.value)}
              disabled={goalBooks.length === 0}
            >
              {goalBooks.length === 0 ? (
                <option value="">목표 성경 없음</option>
              ) : (
                goalBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({bookRanges[b.id]?.start ?? 1}–
                    {bookRanges[b.id]?.end ?? b.chapter_count}장)
                  </option>
                ))
              )}
            </Select>

            {resumeHint ? (
              <p className="rounded-2xl bg-sky-soft px-3 py-2 text-xs font-medium text-sky-dark">
                {resumeHint}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <ChapterPicker
                label="시작 장"
                value={startChapter}
                min={activeRange.start}
                max={activeRange.end}
                onChange={applyStart}
              />
              <ChapterPicker
                label="종료 장"
                value={endChapter}
                min={activeRange.start}
                max={activeRange.end}
                onChange={applyEnd}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">
                빠른 선택 · 시작 장부터 몇 장?
              </p>
              <ChapterSpanPicks
                startChapter={startNum ?? activeRange.start}
                maxChapter={activeRange.end}
                selectedCount={spanCount}
                onPick={pickChapterSpan}
              />
            </div>

            <p className="text-xs text-muted">
              시작 장은 내가 읽은 다음 장으로 자동 선택됩니다. 빠른 선택의 「2장」은 시작 장부터
              2장(예: 10→종료 11)입니다.
            </p>
          </Card>

          <div className="rounded-[1.5rem] border border-dashed border-line/70 bg-panel px-4 py-6 shadow-[0_4px_20px_rgba(23,32,51,0.03)]">
            {displayPhoto ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={displayPhoto}
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
                </p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full whitespace-nowrap px-3 text-[13px]"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-4 w-4 shrink-0" />
                사진 촬영
              </Button>
              <Button
                type="button"
                variant="soft"
                className="w-full whitespace-nowrap px-3 text-[13px]"
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4 shrink-0" />
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

          <Field label="오늘 마음에 남은 한 줄" hint="선택 사항 · 성경 구절이 아니어도 괜찮아요">
            <Textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="오늘 말씀에서 가장 기억에 남은 것은?"
            />
          </Field>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || goalBooks.length === 0}
          >
            {loading ? (editId ? '저장 중…' : '업로드 중…') : editId ? '수정 저장하기' : '말씀 인증하기'}
          </Button>
        </form>
      )}
    </div>
  )
}
