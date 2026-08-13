import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Users,
  UserRound,
  Award,
  Newspaper,
  ChartColumn,
} from 'lucide-react'
import { AppVersionBadge } from '@/components/AppVersionBadge'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

/** 시안: 홈 · 인증 · 우리반 · 피드 · 마이 */
const studentNav: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: Award },
  { to: '/class', label: '우리반', icon: Users },
  { to: '/feed', label: '피드', icon: Newspaper },
  { to: '/me', label: '마이', icon: UserRound },
]

/** 홈은 학생과 동일(`/`), 기존 교사 대시보드는 «교사» 탭 */
const teacherWithClassNav: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: Award },
  { to: '/class', label: '우리반', icon: Users },
  { to: '/teacher', label: '교사', icon: LayoutDashboard },
  { to: '/me', label: '마이', icon: UserRound },
]

const teacherStaffNav: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: Award },
  { to: '/feed', label: '피드', icon: Newspaper },
  { to: '/teacher', label: '교사', icon: LayoutDashboard },
  { to: '/me', label: '마이', icon: UserRound },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: '현황', icon: LayoutDashboard },
  { to: '/checkin', label: '인증', icon: Award },
  { to: '/feed', label: '피드', icon: Newspaper },
  { to: '/progress', label: '반현황', icon: ChartColumn },
  { to: '/me', label: '마이', icon: UserRound },
]

function navForRole(role: UserRole, classId: string | null): NavItem[] {
  if (role === 'ADMIN') return adminNav
  if (role === 'TEACHER') return classId ? teacherWithClassNav : teacherStaffNav
  return studentNav
}

export function BottomNav({
  role,
  classId = null,
}: {
  role: UserRole
  classId?: string | null
}) {
  const items = navForRole(role, classId)
  const location = useLocation()
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/25 bg-panel/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg justify-center px-3 pt-1.5">
        <AppVersionBadge
          align="center"
          className="border-0 bg-transparent px-1 py-0 text-[10px] font-medium text-muted shadow-none"
        />
      </div>
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-2 pb-0.5 pt-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const end =
            item.to === '/' || item.to === '/teacher' || item.to === '/admin'
          const adminHubActive =
            item.to === '/admin' &&
            (location.pathname === '/admin' ||
              location.pathname === '/admin/classes' ||
              location.pathname === '/admin/users' ||
              location.pathname === '/admin/projects')
          const active = adminHubActive
            ? true
            : end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={end}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition',
                  active ? 'bg-sky-soft text-navy' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
