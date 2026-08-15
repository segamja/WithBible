import type { Profile, UserRole } from '@/types'
import { roleLabel as formatRoleLabel } from '@/lib/roles'

const KEY = 'wb_saved_accounts'
const SECRET_KEY = 'wb_saved_account_secrets'
const MAX = 8

export type SavedAccount = {
  id: string
  email: string | null
  name: string
  role: UserRole
  profileImage: string | null
  provider: 'email' | 'kakao'
  lastUsedAt: string
  /** 이 기기에 비밀번호가 저장되어 원탭 로그인 가능 */
  hasPassword?: boolean
}

export function roleLabel(role: UserRole | string): string {
  return formatRoleLabel(role)
}

function encodeSecret(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)))
  } catch {
    return value
  }
}

function decodeSecret(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)))
  } catch {
    return value
  }
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

function readSecrets(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SECRET_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeSecrets(map: Record<string, string>) {
  try {
    localStorage.setItem(SECRET_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function withPasswordFlags(list: SavedAccount[]): SavedAccount[] {
  const secrets = readSecrets()
  return list.map((a) => ({
    ...a,
    hasPassword: Boolean(a.email && secrets[a.id]),
  }))
}

export function listSavedAccounts(): SavedAccount[] {
  return withPasswordFlags(readAll()).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
}

export function getSavedPassword(accountId: string): string | null {
  const encoded = readSecrets()[accountId]
  if (!encoded) return null
  return decodeSecret(encoded)
}

export function setSavedPassword(accountId: string, password: string | null) {
  const secrets = readSecrets()
  if (!password) {
    delete secrets[accountId]
  } else {
    secrets[accountId] = encodeSecret(password)
  }
  writeSecrets(secrets)

  const accounts = readAll().map((a) =>
    a.id === accountId ? { ...a, hasPassword: Boolean(password) } : a,
  )
  writeAll(accounts)
}

/**
 * @param password - string: save/update · null: clear saved password · undefined: keep existing
 */
export function rememberAccount(
  profile: Profile,
  provider: 'email' | 'kakao' = profile.email ? 'email' : 'kakao',
  password?: string | null,
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

  if (password === undefined) {
    // keep existing secret; refresh hasPassword flag via list
    return
  }
  if (next.provider === 'email' && next.email) {
    setSavedPassword(profile.id, password)
  } else {
    setSavedPassword(profile.id, null)
  }
}

export function removeSavedAccount(id: string) {
  writeAll(readAll().filter((a) => a.id !== id))
  setSavedPassword(id, null)
}
