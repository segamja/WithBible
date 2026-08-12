import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { PartyBanner } from '@/components/PartyBanner'
import { CompletionBanner } from '@/components/CompletionBanner'
import { ReadingFeedCard } from '@/components/ReadingFeedCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassProgress, getPersonalProgress } from '@/services/progressService'
import { listAnnouncements } from '@/services/announcementService'
import {
  getMyEncouragements,
  listClassLogs,
  listFeed,
  toggleLike,
} from '@/services/readingService'
import {
  addComment,
  deleteComment,
  listCommentsForLogs,
} from '@/services/commentService'
import { getClassById, listClassStudents } from '@/services/classService'
import type { EncouragementType, FeedComment, ReadingLogWithMeta } from '@/types'
import { getDDayLabel } from '@/utils/dday'
import {
  calcClassStreak,
  calcPersonalStreak,
  getTodayReadingRange,
  greetingForNow,
} from '@/utils/schedule'

export function StudentHomePage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, myProjectClass, loadForUser } = useProjectStore()
  const [rate, setRate] = useState(0)
  const [progressMeta, setProgressMeta] = useState({
    studentCount: 0,
    todayCheckins: 0,
    participatedCount: 0,
  })
  const [personal, setPersonal] = useState({ covered: 0, target: 0, rate: 0, bookName: '' })
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [myEnc, setMyEnc] = useState<Record<string, EncouragementType>>({})
  const [commentsByLog, setCommentsByLog] = useState<Record<string, FeedComment[]>>({})
  const [className, setClassName] = useState('우리 반')
  const [personalStreak, setPersonalStreak] = useState(0)
  const [classStreak, setClassStreak] = useState(0)
  const [todayRange, setTodayRange] = useState({ start: 1, end: 1 })

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project || !profile.class_id) return
    const run = async () => {
      const cls = await getClassById(profile.class_id!)
      setClassName(cls?.name ?? '우리 반')
      const progress = await getClassProgress(project.id, profile.class_id!, cls?.name ?? '우리 반')
      setRate(progress.achievementRate)
      setProgressMeta({
        studentCount: progress.studentCount,
        todayCheckins: progress.todayCheckins,
        participatedCount: progress.participatedCount,
      })
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id!)
      setPersonal(me)

      const targetStart = myProjectClass?.target_start_chapter ?? 1
      const targetEnd = myProjectClass?.target_end_chapter ?? (me.target || 1)
      if (myProjectClass) {
        setTodayRange(
          getTodayReadingRange({
            startDate: project.start_date,
            endDate: project.end_date,
            targetStart,
            targetEnd,
          }),
        )
      }

      const students = await listClassStudents(profile.class_id!)
      const logs = await listClassLogs(
        project.id,
        students.map((s) => s.id),
      )
      const myDates = logs.filter((l) => l.user_id === profile.id).map((l) => l.reading_date)
      const classDates = [...new Set(logs.map((l) => l.reading_date))]
      setPersonalStreak(calcPersonalStreak(myDates))
      setClassStreak(calcClassStreak(classDates))

      const anns = await listAnnouncements({
        projectId: project.id,
        classId: profile.class_id,
      })
      setAnnouncement(anns[0]?.content ?? null)
      const feedLogs = await listFeed({ projectId: project.id, limit: 5 })
      setFeed(feedLogs)
      setMyEnc(await getMyEncouragements(profile.id, feedLogs.map((l) => l.id)))
      setCommentsByLog(await listCommentsForLogs(feedLogs.map((l) => l.id)))
    }
    void run()
  }, [project, profile, myProjectClass])

  const bookName = myProjectClass?.bible_books?.name ?? personal.bookName ?? '복음서'
  const completed = rate >= 100
  const days = project
    ? Math.max(
        1,
        differenceInCalendarDays(parseISO(project.end_date), parseISO(project.start_date)) + 1,
      )
    : 0

  return (
    <div className="space-y-4 px-5 pb-8 pt-7">
      <header>
        <p className="text-sm font-semibold tracking-wide text-sky-dark">with BIBLE</p>
        <h1 className="font-display mt-1 text-[1.85rem] leading-tight text-navy">
          {greetingForNow(profile.name)}
        </h1>
        <p className="mt-2 text-sm text-muted">오늘도 우리 반과 함께 말씀을 읽어볼까요?</p>
      </header>

      {project ? (
        <Card className="space-y-4 border-none bg-navy text-white shadow-[0_16px_40px_rgba(23,32,51,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
                오늘의 말씀
              </p>
              <h2 className="font-display mt-2 text-2xl leading-snug">
                {bookName} {todayRange.start}
                {todayRange.end !== todayRange.start ? `–${todayRange.end}` : ''}장
              </h2>
            </div>
            <div className="rounded-2xl bg-streak px-3 py-2 text-center text-navy">
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">완주</p>
              <p className="font-display text-lg">{getDDayLabel(project.end_date)}</p>
            </div>
          </div>
          <p className="text-sm text-white/75">{className} · 나의 진행 {personal.rate}%</p>
          <Link to="/checkin" className="block">
            <Button variant="sage" className="w-full" size="lg">
              오늘 읽었어요 ✓
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-muted">진행 중인 프로젝트가 없습니다.</p>
        </Card>
      )}

      {completed && project ? (
        <CompletionBanner bookName={bookName} friendCount={feed.length} days={days} />
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-sky-dark">우리 반 복음서 여행</p>
            <h3 className="font-display mt-1 text-xl text-navy">{bookName} 완독까지</h3>
          </div>
          <p className="font-display text-3xl text-sage-dark">{rate}%</p>
        </div>
        <ProgressBar value={rate} />
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
          <div className="rounded-xl bg-brand-50 px-2 py-2">
            <p className="font-semibold text-navy">
              {progressMeta.participatedCount}/{progressMeta.studentCount}
            </p>
            <p>참여</p>
          </div>
          <div className="rounded-xl bg-brand-50 px-2 py-2">
            <p className="font-semibold text-navy">{progressMeta.todayCheckins}명</p>
            <p>오늘 인증</p>
          </div>
          <div className="rounded-xl bg-streak/30 px-2 py-2">
            <p className="font-semibold text-navy">🔥 {classStreak}일</p>
            <p>반 Streak</p>
          </div>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3 border-streak/40 bg-streak/15">
        <div>
          <p className="text-sm font-medium text-navy">나의 연속 읽기</p>
          <p className="mt-1 text-sm text-muted">
            {personalStreak > 0
              ? `${personalStreak}일 연속 말씀읽기`
              : '오늘 다시 시작해볼까요?'}
          </p>
        </div>
        <p className="font-display text-3xl text-navy">🔥 {personalStreak}</p>
      </Card>

      {announcement ? (
        <Card>
          <p className="text-sm font-medium text-sky-dark">반 공지</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{announcement}</p>
        </Card>
      ) : null}

      {project?.party_date || project?.party_title ? (
        <PartyBanner
          title={project.party_title}
          dateLabel={
            project.party_date
              ? format(parseISO(project.party_date), 'M월 d일 · a h시')
              : null
          }
          place={project.party_place}
          note={project.party_note}
        />
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-navy">친구 활동</h3>
          <Link to="/feed" className="text-sm font-medium text-sky-dark">
            전체 보기
          </Link>
        </div>
        <div className="space-y-3">
          {feed.length === 0 ? (
            <p className="text-sm text-muted">아직 인증이 없습니다. 첫 인증의 주인공이 되어보세요.</p>
          ) : (
            feed.map((log) => (
              <ReadingFeedCard
                key={log.id}
                log={log}
                liked={Boolean(myEnc[log.id])}
                comments={commentsByLog[log.id] ?? []}
                currentUserId={profile.id}
                onLike={async (logId, currentlyLiked) => {
                  const next = await toggleLike(logId, profile.id, currentlyLiked)
                  setMyEnc((prev) => {
                    const copy = { ...prev }
                    if (next) copy[logId] = 'like'
                    else delete copy[logId]
                    return copy
                  })
                  setFeed((prev) =>
                    prev.map((item) =>
                      item.id === logId
                        ? {
                            ...item,
                            encouragement_count: Math.max(
                              0,
                              (item.encouragement_count ?? 0) + (next ? 1 : -1),
                            ),
                          }
                        : item,
                    ),
                  )
                }}
                onComment={async (logId, content) => {
                  const created = await addComment({
                    readingLogId: logId,
                    userId: profile.id,
                    content,
                  })
                  setCommentsByLog((prev) => ({
                    ...prev,
                    [logId]: [...(prev[logId] ?? []), created],
                  }))
                }}
                onDeleteComment={async (commentId) => {
                  await deleteComment(commentId, profile.id)
                  setCommentsByLog((prev) => {
                    const next: Record<string, FeedComment[]> = {}
                    for (const [key, list] of Object.entries(prev)) {
                      next[key] = list.filter((c) => c.id !== commentId)
                    }
                    return next
                  })
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
