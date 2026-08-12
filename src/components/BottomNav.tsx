import { NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Home,
  LayoutDashboard,
  Megaphone,
  Users,
  UserRound,
  Newspaper,
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

const studentNav: NavItem[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/checkin', label: '인증', icon: BookOpen },
  { to: '/class', label: '우리반', icon: Users },
  { to: '/feed', label: '피드', icon: Newspaper },
  { to: '/me', label: '마이', icon: UserRound },
]

const teacherNav: NavItem[] = [
  { to: '/teacher', label: '홈', icon: LayoutDashboard },
  { to: '/teacher/feed', label: '피드', icon: Newspaper },
  { to: '/teacher/class', label: '우리반', icon: Users },
  { to: '/teacher/announce', label: '공지', icon: Megaphone },
  { to: '/me', label: '마이', icon: UserRound },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: '현황', icon: LayoutDashboard },
  { to: '/admin/settings', label: '설정', icon: SlidersHorizontal },
  { to: '/progress', label: '전체', icon: ChartColumn },
  { to: '/admin/classes', label: '반관리', icon: Users },
  { to: '/me', label: '마이', icon: UserRound },
]

function navForRole(role: UserRole): NavItem[] {
  if (role === 'ADMIN') return adminNav
  if (role === 'TEACHER') return teacherNav
  return studentNav
}

export function BottomNav({ role }: { role: UserRole }) {
  const items = navForRole(role)
  const location = useLocation()
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-panel/95 backdrop-blur">
      <ul className="mx-auto flex max-w-4xl items-stretch justify-between px-2 pt-1">
        {items.map((item) => {
          const Icon = item.icon
          const end =
            item.to === '/' || item.to === '/teacher' || item.to === '/admin'
          const active =
            end
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
