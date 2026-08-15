import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ClassJourneyPanel } from '@/components/ClassJourneyPanel'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getClassById, listClassStudents } from '@/services/classService'
import {
  getClassProgress,
  getPersonalProgress,
  getClassCommunityWarmth,
} from '@/services/progressService'
import { listClassLogs } from '@/services/readingService'
import { roleHome } from '@/layouts/AppShell'
import { todayISO } from '@/utils/dday'
import { calcClassStreak } from '@/utils/schedule'
import type { Profile } from '@/types'

export function ClassPage() {
  const profile = useAuthStore((s) => s.profile)!
  const { project, loadForUser } = useProjectStore()
  const [className, setClassName] = useState('우리 반')
  const [progress, setProgress] = useState({
    achievementRate: 0,
    studentCount: 0,
    todayCheckins: 0,
    participatedCount: 0,
  })
  const [personal, setPersonal] = useState({
    covered: 0,
    target: 0,
    rate: 0,
    goalLabel: '',
  })
  const [classStreak, setClassStreak] = useState(0)
  const [warmth, setWarmth] = useState({
    warmth: 0,
    checkins: 0,
    reactions: 0,
    comments: 0,
    readAlongs: 0,
  })
  const [todayFriends, setTodayFriends] = useState<Profile[]>([])

  useEffect(() => {
    void loadForUser(profile.class_id)
  }, [profile.class_id, loadForUser])

  useEffect(() => {
    if (!project || !profile.class_id) return
    const run = async () => {
      const cls = await getClassById(profile.class_id!)
      setClassName(cls?.name ?? '우리 반')
      const p = await getClassProgress(project.id, profile.class_id!, cls?.name ?? '우리 반')
      setProgress({
        achievementRate: p.achievementRate,
        studentCount: p.studentCount,
        todayCheckins: p.todayCheckins,
        participatedCount: p.participatedCount,
      })
      const me = await getPersonalProgress(project.id, profile.id, profile.class_id)
      setPersonal({
        covered: me.covered,
        target: me.target,
        rate: me.rate,
        goalLabel: me.goalLabel,
      })

      const students = await listClassStudents(profile.class_id!)
      const logs = await listClassLogs(
        project.id,
        students.map((s) => s.id),
      )
      setClassStreak(calcClassStreak([...new Set(logs.map((l) => l.reading_date))]))
      try {
        setWarmth(await getClassCommunityWarmth(project.id, profile.class_id!))
      } catch {
        setWarmth({ warmth: 0, checkins: 0, reactions: 0, comments: 0, readAlongs: 0 })
      }
      const today = todayISO()
      const todayIds = new Set(
        logs.filter((l) => l.reading_date === today).map((l) => l.user_id),
      )
      setTodayFriends(students.filter((s) => todayIds.has(s.id)))
    }
    void run()
  }, [project, profile])

  if (!profile.class_id) {
    return <Navigate to={roleHome(profile.role)} replace />
  }

  return (
    <div className="page pt-6">
      <ClassJourneyPanel
        className={className}
        progress={progress}
        personalGoalLabel={personal.goalLabel}
        personalCovered={personal.covered}
        personalTarget={personal.target}
        personalRate={personal.rate}
        classStreak={classStreak}
        warmth={warmth}
        projectEndDate={project?.end_date ?? null}
        todayFriends={todayFriends}
        showPersonal
      />

      <Link to="/progress">
        <Button variant="outline" className="w-full">
          전체 반별 현황 보기
        </Button>
      </Link>
    </div>
  )
}
