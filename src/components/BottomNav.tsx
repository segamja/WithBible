import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Home,
  LayoutDashboard,
  Megaphone,
  Users,
  UserRound,
  ChartColumn,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

/** Shared tabs (home differs by role). Feed is reachable from home. */
const studentNav: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: BookOpen },
  { to: '/class', label: '우리반', icon: Users },
  { to: '/progress', label: '현황', icon: ChartColumn },
  { to: '/me', label: '마이', icon: UserRound },
]

const teacherWithClassNav: NavItem[] = [
  { to: '/teacher', label: '홈', icon: LayoutDashboard },
  { to: '/checkin', label: '인증', icon: BookOpen },
  { to: '/class', label: '우리반', icon: Users },
  { to: '/progress', label: '현황', icon: ChartColumn },
  { to: '/me', label: '마이', icon: UserRound },
]

/** 임원 선생님: 반 없음 → 우리반 대신 공지 */
const teacherStaffNav: NavItem[] = [
  { to: '/teacher', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: BookOpen },
  { to: '/progress', label: '현황', icon: ChartColumn },
  { to: '/teacher/announce', label: '공지', icon: Megaphone },
  { to: '/me', label: '마이', icon: UserRound },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: '현황', icon: LayoutDashboard },
  { to: '/checkin', label: '인증', icon: BookOpen },
  { to: '/progress', label: '반현황', icon: ChartColumn },
  { to: '/admin/settings', label: '설정', icon: SlidersHorizontal },
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
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-panel/95 backdrop-blur">
      <ul className="mx-auto flex max-w-4xl items-stretch justify-between px-2 pt-1">
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
                  'flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium transition',
                  active ? 'text-navy' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2.1} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
