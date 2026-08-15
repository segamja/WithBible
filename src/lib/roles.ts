import type { UserRole } from '@/types'

export const ALL_ROLES: UserRole[] = [
  'MASTER',
  'SUB_MASTER',
  'STAFF',
  'TEACHER',
  'STUDENT',
]

export function roleLabel(role: UserRole | string): string {
  switch (role) {
    case 'MASTER':
    case 'ADMIN':
      return '최고관리자'
    case 'SUB_MASTER':
      return '강도사님'
    case 'STAFF':
      return '임원선생님'
    case 'TEACHER':
      return '선생님'
    default:
      return '학생'
  }
}

export function isMaster(role: UserRole): boolean {
  return role === 'MASTER'
}

export function isOps(role: UserRole): boolean {
  return role === 'MASTER' || role === 'SUB_MASTER'
}

export function isStaff(role: UserRole): boolean {
  return role === 'STAFF'
}

export function canWriteNotice(role: UserRole): boolean {
  return isOps(role)
}

export function canWriteCheerGlobal(role: UserRole): boolean {
  return role === 'MASTER' || role === 'SUB_MASTER' || role === 'STAFF'
}

export function canWriteCheerClass(role: UserRole): boolean {
  return role === 'TEACHER'
}

export function canGiveTeacherCheer(role: UserRole): boolean {
  return role === 'TEACHER' || role === 'MASTER' || role === 'SUB_MASTER' || role === 'STAFF'
}

export function skipsClassOnboarding(role: UserRole): boolean {
  return role !== 'STUDENT'
}

export function homeGreetingLine(role: UserRole): string {
  if (role === 'TEACHER') return '오늘도 학생들과 함께 말씀을 읽어볼까요?'
  if (role === 'STAFF' || role === 'SUB_MASTER' || role === 'MASTER') {
    return '오늘도 고등부와 함께 말씀을 읽어볼까요?'
  }
  return '오늘도 우리 반과 함께 말씀을 읽어볼까요?'
}
