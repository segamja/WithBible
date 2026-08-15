import { Flag } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CircularProgress } from '@/components/CircularProgress'
import { getDDayLabel } from '@/utils/dday'
import type { Profile } from '@/types'
import { cn } from '@/utils/cn'

export type ClassJourneyStats = {
  achievementRate: number
  studentCount: number
  todayCheckins: number
  participatedCount: number
}

export type ClassWarmthStats = {
  warmth: number
  checkins: number
  reactions: number
  comments: number
  readAlongs: number
}

type Props = {
  className: string
  progress: ClassJourneyStats
  personalGoalLabel: string
  personalCovered: number
  personalTarget: number
  personalRate: number
  classStreak: number
  warmth: ClassWarmthStats
  projectEndDate: string | null
  todayFriends: Profile[]
  /** Hide personal progress for teacher view of the class */
  showPersonal?: boolean
}

export function ClassJourneyPanel({
  className,
  progress,
  personalGoalLabel,
  personalCovered,
  personalTarget,
  personalRate,
  classStreak,
  warmth,
  projectEndDate,
  todayFriends,
  showPersonal = true,
}: Props) {
  return (
    <>
      <header className="space-y-1">
        <p className="caption-caps">Class Journey</p>
        <h1 className="page-title">{className}</h1>
        <p className="text-sm text-muted">우리 반이 함께 걷는 말씀 여정</p>
      </header>

      <Card className="space-y-5">
        <h2 className="text-center text-sm font-semibold text-muted">우리 반 복음서 여행</h2>
        <CircularProgress value={progress.achievementRate} />
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-brand-50 px-2 py-3">
            <p className="text-muted">전체</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{progress.studentCount}명</p>
          </div>
          <div className="rounded-2xl bg-brand-50 px-2 py-3">
            <p className="text-muted">참여</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{progress.participatedCount}명</p>
          </div>
          <div className="rounded-2xl bg-sky-soft px-2 py-3">
            <p className="text-sky-dark">오늘 인증</p>
            <p className="mt-0.5 text-sm font-semibold text-sky-dark">{progress.todayCheckins}명</p>
          </div>
        </div>
        {personalGoalLabel ? (
          <p className="text-center text-xs text-muted">{personalGoalLabel}</p>
        ) : null}
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">🔥 우리 반 공동 Streak</p>
          <p className="mt-1 font-semibold text-navy">
            {classStreak > 0 ? `${classStreak} 일 연속 말씀읽기` : '오늘 함께 시작해 볼까요?'}
          </p>
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm text-muted">💛 오늘 우리 반 응원 온도</p>
        <p className="font-display text-3xl text-navy">
          {warmth.warmth}
          <span className="ml-0.5 text-xl">°</span>
        </p>
        <p className="text-xs leading-relaxed text-muted">
          오늘 {warmth.checkins}명이 말씀을 읽었어요 · 응원 {warmth.reactions} · 댓글{' '}
          {warmth.comments} · 함께 읽기 {warmth.readAlongs}
        </p>
        <p className="text-[11px] text-muted/80">
          다른 반과 비교하는 점수가 아니라, 우리 반이 함께하는 오늘의 분위기예요.
        </p>
      </Card>

      {projectEndDate ? (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">🎯 완주까지</p>
            <p className="mt-1 font-display text-2xl text-navy">{getDDayLabel(projectEndDate)}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/20 text-sage-dark">
            <Flag className="h-5 w-5" />
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="section-title text-base">오늘 함께 읽은 친구들</h3>
          <span className="rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-sage-dark">
            {progress.todayCheckins}/{progress.studentCount}
          </span>
        </div>
        {todayFriends.length === 0 ? (
          <p className="text-sm text-muted">아직 오늘 인증한 친구가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {todayFriends.map((s) => (
              <div key={s.id} className="flex w-16 flex-col items-center gap-1">
                {s.profile_image ? (
                  <img
                    src={s.profile_image}
                    alt={s.name}
                    className={cn('h-12 w-12 rounded-full object-cover ring-2 ring-sage/50')}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage/20 text-sm font-semibold text-sage-dark ring-2 ring-sage/40">
                    {s.name.slice(0, 1)}
                  </div>
                )}
                <p className="w-full truncate text-center text-[11px] text-muted">{s.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPersonal ? (
        <Card>
          <h2 className="font-semibold text-navy">나의 진행률</h2>
          <p className="mt-2 font-display text-2xl text-sage-dark">
            {personalCovered} / {personalTarget}장 · {personalRate}%
          </p>
        </Card>
      ) : null}
    </>
  )
}
