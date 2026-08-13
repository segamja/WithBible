import type { Profile, UserRole } from '@/types'

const KEY = 'wb_saved_accounts'
const MAX = 8

export type SavedAccount = {
  id: string
  email: string | null
  name: string
  role: UserRole
  profileImage: string | null
  provider: 'email' | 'kakao'
  lastUsedAt: string
}

export function roleLabel(role: UserRole): string {
  if (role === 'ADMIN') return '관리자'
  if (role === 'TEACHER') return '교사'
  return '학생'
}

function readAll(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedAccount[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
  } catch {
    return []
  }
}

function writeAll(list: SavedAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* ignore quota */
  }
}

export function listSavedAccounts(): SavedAccount[] {
  return readAll().sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
}

export function rememberAccount(
  profile: Profile,
  provider: 'email' | 'kakao' = profile.email ? 'email' : 'kakao',
) {
  if (!profile.id) return
  const prev = readAll().filter((a) => a.id !== profile.id)
  const next: SavedAccount = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    profileImage: profile.profile_image,
    provider: provider === 'kakao' || !profile.email ? 'kakao' : 'email',
    lastUsedAt: new Date().toISOString(),
  }
  writeAll([next, ...prev])
}

export function removeSavedAccount(id: string) {
  writeAll(readAll().filter((a) => a.id !== id))
}
