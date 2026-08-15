import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Users } from 'lucide-react'
import { ChurchLogoHeader } from '@/components/ChurchLogoHeader'
import { PartyBanner } from '@/components/PartyBanner'
import { CompletionBanner } from '@/components/CompletionBanner'
import { WeekStreak } from '@/components/WeekStreak'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassProgress, getPersonalProgress, getClassCommunityWarmth } from '@/services/progressService'
import { CheerTodayCard } from '@/components/CheerTodayCard'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { listAnnouncements, listTodayCheers, type AnnouncementRow } from '@/services/announcementService'
import { listClassLogs, listFeed } from '@/services/readingService'
import { getClassById, listClassStudents } from '@/services/classService'
import type { ReadingLogWithMeta } from '@/types'
import { departmentTitleOf } from '@/lib/branding'
import { homeGreetingLine } from '@/lib/roles'
import { getDDayLabel } from '@/utils/dday'
import { calcPersonalStreak, getTodayReadingRange, greetingPartsForNow } from '@/utils/schedule'
import { differenceInCalendarDays, parseISO } from 'date-fns'

export function StudentHomePage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, myProjectClass, loadForUser } = useProjectStore()
  const [rate, setRate] = useState(0)
  const [progressMeta, setProgressMeta] = useState({
    studentCount: 0,
    todayCheckins: 0,
    participatedCount: 0,
  })
  const [warmth, setWarmth] = useState(0)
  const [personal, setPersonal] = useState({
    covered: 0,
    target: 0,
    rate: 0,
    bookName: '',
    goalLabel: '',
    readUpToLabel: '아직 인증한 장이 없어요',
  })
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [cheers, setCheers] = useState<AnnouncementRow[]>([])
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [className, setClassName] = useState('우리 반')
  const [personalStreak, setPersonalStreak] = useState(0)
  const [myDates, setMyDates] = useState<string[]>([])
  const [todayRange, setTodayRange] = useState({ start: 1, end: 1 })
  const [todayBookName, setTodayBookName] = useState('복음서')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project) return
    const run = async () => {
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id)
      setPersonal({
        covered: me.covered,
        target: me.target,
        rate: me.rate,
        bookName: me.bookName,
        goalLabel: me.goalLabel,
        readUpToLabel: me.readUpToLabel,
      })

      const currentBook = me.byBook.find((b) => b.covered < b.target) ?? me.byBook[0]
      if (currentBook) {
        const nextChapter = Math.min(currentBook.covered + 1, currentBook.endChapter)
        setTodayBookName(currentBook.bookName)
        setTodayRange({ start: nextChapter, end: nextChapter })
      } else if (myProjectClass) {
        setTodayBookName(myProjectClass.bible_books?.name ?? '복음서')
        setTodayRange(
          getTodayReadingRange({
            startDate: project.start_date,
            endDate: project.end_date,
            targetStart: myProjectClass.target_start_chapter,
            targetEnd: myProjectClass.target_end_chapter,
          }),
        )
      }

      if (profile.class_id) {
        const cls = await getClassById(profile.class_id)
        setClassName(cls?.name ?? '우리 반')
        const progress = await getClassProgress(
          project.id,
          profile.class_id,
          cls?.name ?? '우리 반',
        )
        setRate(progress.achievementRate)
        setProgressMeta({
          studentCount: progress.studentCount,
          todayCheckins: progress.todayCheckins,
          participatedCount: progress.participatedCount,
        })
        try {
          const w = await getClassCommunityWarmth(project.id, profile.class_id)
          setWarmth(w.warmth)
        } catch {
          setWarmth(0)
        }
        const students = await listClassStudents(profile.class_id)
        const logs = await listClassLogs(
          project.id,
          students.map((s) => s.id),
        )
        const mine = logs.filter((l) => l.user_id === profile.id).map((l) => l.reading_date)
        setMyDates(mine)
        setPersonalStreak(calcPersonalStreak(mine))
      } else {
        setClassName('전체')
        setRate(0)
        setProgressMeta({ studentCount: 0, todayCheckins: 0, participatedCount: 0 })
        const logs = await listClassLogs(project.id, [profile.id])
        const mine = logs.map((l) => l.reading_date)
        setMyDates(mine)
        setPersonalStreak(calcPersonalStreak(mine))
      }

      const notices = await listAnnouncements({
        projectId: project.id,
        kind: 'notice',
      })
      setAnnouncement(notices[0]?.content ?? null)
      setCheers(await listTodayCheers(project.id, profile.class_id))
      setFeed(await listFeed({ projectId: project.id, limit: 8 }))
    }
    void run()
  }, [project, profile, myProjectClass])

  const completed = personal.rate >= 100
  const days = project
    ? Math.max(
        1,
        differenceInCalendarDays(parseISO(project.end_date), parseISO(project.start_date)) + 1,
      )
    : 0

  const todayLabel = `${todayBookName} ${todayRange.start}${
    todayRange.end !== todayRange.start ? `–${todayRange.end}` : ''
  }장`
  const greeting = greetingPartsForNow(profile.name)

  const friendAvatars = feed
    .filter((f) => f.user_id !== profile.id)
    .slice(0, 5)
    .map((f) => ({
      id: f.user_id,
      name: f.profiles?.name ?? '?',
      image: f.profiles?.profile_image,
    }))

  return (
    <div className="page pt-4">
      <header>
        <Card className="space-y-5 !shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="caption-caps">with BIBLE</p>
              <p className="truncate text-sm font-medium text-navy">
                {departmentTitleOf(project)}
              </p>
            </div>
            <ChurchLogoHeader className="h-6 max-w-[8.5rem] shrink-0 sm:h-7 sm:max-w-[10rem]" />
          </div>
          <div className="space-y-1.5 border-t border-line/40 pt-5">
            <h1 className="page-title text-[1.45rem] leading-snug sm:text-[1.75rem]">
              <span className="inline-block whitespace-nowrap">{greeting.period},</span>{' '}
              <span className="inline-block max-w-full break-keep">{greeting.name}&nbsp;👋</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              {homeGreetingLine(profile.role)}
            </p>
          </div>
        </Card>
      </header>

      {project ? (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <BookOpen className="h-4 w-4 text-sky-dark" />
              오늘의 말씀
            </div>
            <span className="rounded-full bg-sky-soft px-2.5 py-1 text-xs font-semibold text-sky-dark">
              {getDDayLabel(project.end_date)}
            </span>
          </div>
          <h2 className="font-display text-[1.65rem] text-navy">{todayLabel}</h2>
          <p className="text-xs text-muted">
            {profile.class_id ? `${className} · ` : ''}
            {personal.readUpToLabel} · 목표 {personal.rate}%
          </p>
          <Link to="/checkin" className="block">
            <Button className="w-full" size="lg">
              <Check className="h-4 w-4" />
              오늘 읽었어요
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <p className="text-muted">진행 중인 프로젝트가 없습니다.</p>
        </Card>
      )}

      {project && profile.class_id ? (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Users className="h-4 w-4 text-sky-dark" />
            우리 반 진행률
          </div>
          <p className="stat-number">
            {rate}
            <span className="ml-0.5 text-2xl">%</span>
          </p>
          <ProgressBar value={rate} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              👥 {progressMeta.studentCount}명 중 {progressMeta.participatedCount}명 참여
            </span>
            <span className="text-line">|</span>
            <span>🔥 오늘 {progressMeta.todayCheckins}명 인증</span>
            {warmth > 0 ? (
              <>
                <span className="text-line">|</span>
                <span>💛 응원 온도 {warmth}°</span>
              </>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            나의 목표 진행 {personal.covered}/{personal.target}장 · {personal.rate}%
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <span aria-hidden>🔥</span>
          나의 Streak
        </div>
        <p className="font-semibold text-navy">
          {personalStreak > 0 ? `${personalStreak}일 연속 말씀읽기` : '오늘부터 연속 읽기를 시작해요'}
        </p>
        <WeekStreak readingDates={myDates} />
      </Card>

      {completed && project ? (
        <CompletionBanner
          bookName={personal.goalLabel || todayBookName}
          friendCount={feed.length}
          days={days}
        />
      ) : null}

      {friendAvatars.length > 0 ? (
        <Card className="space-y-3">
          <p className="text-center text-sm font-medium text-navy">친구들이 함께 읽고 있어요</p>
          <div className="flex items-center justify-center">
            <div className="flex -space-x-2">
              {friendAvatars.map((f) =>
                f.image ? (
                  <img
                    key={f.id}
                    src={f.image}
                    alt={f.name}
                    className="h-10 w-10 rounded-full border-2 border-panel object-cover"
                  />
                ) : (
                  <div
                    key={f.id}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-panel bg-sky/30 text-xs font-semibold text-sky-dark"
                  >
                    {f.name.slice(0, 1)}
                  </div>
                ),
              )}
              {feed.length > friendAvatars.length + 1 ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-panel bg-sky text-xs font-semibold text-white">
                  +{Math.min(9, feed.length - friendAvatars.length - 1)}
                </div>
              ) : null}
            </div>
          </div>
          <Link to="/feed" className="block text-center text-sm font-medium text-sky-dark">
            피드 보기
          </Link>
        </Card>
      ) : null}

      {announcement ? (
        <Card>
          <p className="text-sm font-medium text-sky-dark">공지사항</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{announcement}</p>
        </Card>
      ) : null}

      <CheerTodayCard cheers={cheers} />

      {project?.party_date || project?.party_title ? (
        <PartyBanner
          title={project.party_title}
          dateLabel={
            project.party_date
              ? new Date(project.party_date).toLocaleString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : null
          }
          place={project.party_place}
          note={project.party_note}
        />
      ) : null}

      <Button type="button" variant="outline" className="w-full" onClick={() => setFeedbackOpen(true)}>
        버그신고 / 기능제안
      </Button>
      <FeedbackDialog
        userId={profile.id}
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  )
}
