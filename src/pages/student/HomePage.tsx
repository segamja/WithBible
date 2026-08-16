import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, ExternalLink, Users } from 'lucide-react'
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
import { NoticeHomeCard } from '@/components/NoticeHomeCard'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { listAnnouncements, listTodayCheers, type AnnouncementRow } from '@/services/announcementService'
import { getPlaygroundTeaser } from '@/services/playgroundService'
import { listClassLogs, listFeed } from '@/services/readingService'
import { getClassById, listClassStudents } from '@/services/classService'
import type { ReadingLogWithMeta } from '@/types'
import { departmentTitleOf } from '@/lib/branding'
import { homeGreetingLine } from '@/lib/roles'
import { getDDayLabel, formatProjectRange } from '@/utils/dday'
import { bibleChapterUrl } from '@/utils/bibleLink'
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
  const [notices, setNotices] = useState<AnnouncementRow[]>([])
  const [cheers, setCheers] = useState<AnnouncementRow[]>([])
  const [feed, setFeed] = useState<ReadingLogWithMeta[]>([])
  const [className, setClassName] = useState('우리 반')
  const [personalStreak, setPersonalStreak] = useState(0)
  const [myDates, setMyDates] = useState<string[]>([])
  const [todayRange, setTodayRange] = useState({ start: 1, end: 1 })
  const [todayBookName, setTodayBookName] = useState('복음서')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [playground, setPlayground] = useState<{
    title: string
    participantCount: number
  } | null>(null)

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    void getPlaygroundTeaser()
      .then(setPlayground)
      .catch(() => setPlayground(null))
  }, [])

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

      setNotices(
        (
          await listAnnouncements({
            projectId: project.id,
            kind: 'notice',
          })
        ).slice(0, 3),
      )
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
  const bibleUrl = bibleChapterUrl(todayBookName, todayRange.start)
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
          <p className="text-xs text-muted">읽는 기간 · {formatProjectRange(project.start_date, project.end_date)}</p>
          <p className="text-xs text-muted">
            {profile.class_id ? `${className} · ` : ''}
            {personal.readUpToLabel} · 목표 {personal.rate}%
          </p>
          {bibleUrl ? (
            <a
              href={bibleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sky-soft text-[15px] font-semibold text-sky-dark transition hover:bg-sky/35 active:scale-[0.98]"
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              성경에서 이 장 열기
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </a>
          ) : null}
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

      {playground ? (
        <Card className="space-y-2">
          <p className="text-xs font-medium text-muted">오늘의 놀이터</p>
          <p className="text-[15px] font-semibold text-navy">{playground.title}</p>
          <p className="text-xs text-muted">
            {playground.participantCount}명 참여 · 매일 새로운 내용으로 바뀌어요
          </p>
          <Link
            to="/feed?tab=playground"
            className="inline-flex min-h-9 items-center text-sm font-medium text-sky-dark hover:text-navy"
          >
            피드에서 참여하기
          </Link>
        </Card>
      ) : null}

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

      {project && feed.length > 0 ? (
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted">말씀인증</p>
            <p className="mt-1 text-lg font-semibold text-navy">친구가 남긴 인증을 보러 가요</p>
          </div>
          {friendAvatars.length > 0 ? (
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
          ) : null}
          <ul className="divide-y divide-line/30">
            {feed.slice(0, 2).map((log) => {
              const name = log.profiles?.name ?? '친구'
              const book = `${log.bible_books?.name ?? '성경'} ${log.start_chapter}${
                log.end_chapter !== log.start_chapter ? `–${log.end_chapter}` : ''
              }장`
              return (
                <li key={log.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  {log.profiles?.profile_image ? (
                    <img
                      src={log.profiles.profile_image}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-soft text-xs font-semibold text-sky-dark">
                      {name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy">{name}</p>
                    <p className="truncate text-xs text-muted">{book}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <Link to="/feed" className="block">
            <Button className="w-full" variant="secondary">
              피드 보기
            </Button>
          </Link>
        </Card>
      ) : null}

      <NoticeHomeCard notices={notices} />

      <CheerTodayCard cheers={cheers} />

      {project?.party_date || project?.party_title || project?.party_subtitle ? (
        <PartyBanner
          title={project.party_title}
          subtitle={project.party_subtitle}
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
