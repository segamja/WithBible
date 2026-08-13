export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

export const APP_BUILT_AT: string =
  typeof __APP_BUILT_AT__ !== 'undefined' ? __APP_BUILT_AT__ : ''

export function formatAppVersionLabel(): string {
  if (!APP_BUILT_AT) return `v${APP_VERSION}`
  try {
    const d = new Date(APP_BUILT_AT)
    if (Number.isNaN(d.getTime())) return `v${APP_VERSION}`
    const local = d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `v${APP_VERSION} · ${local}`
  } catch {
    return `v${APP_VERSION}`
  }
}

export interface RemoteVersionInfo {
  version: string
  builtAt?: string
}

/** Fetch deployed version.json (no-store). Returns null on failure / offline. */
export async function fetchRemoteVersion(): Promise<RemoteVersionInfo | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as RemoteVersionInfo
    if (!data?.version || typeof data.version !== 'string') return null
    return data
  } catch {
    return null
  }
}

export function isNewerRemote(remote: RemoteVersionInfo | null): boolean {
  if (!remote?.version) return false
  return remote.version !== APP_VERSION
}

/**
 * Wipe browser caches from older builds.
 * Keeps auth (localStorage) so the user stays logged in.
 */
export async function clearStaleAppCaches(): Promise<void> {
  const tasks: Promise<unknown>[] = []

  if (typeof caches !== 'undefined') {
    tasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    )
  }

  // Keep service worker registration so the installed PWA stays available.
  // Workbox autoUpdate picks up the new shell after reload.

  // In-memory / tab session leftovers (not auth tokens)
  try {
    sessionStorage.clear()
  } catch {
    /* private mode */
  }

  await Promise.allSettled(tasks)
}

/** Clear caches then hard-navigate to a cache-busted URL. */
export async function reloadToLatest(): Promise<void> {
  try {
    await clearStaleAppCaches()
  } catch {
    /* still reload */
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('_v')
  url.searchParams.set('_v', String(Date.now()))
  // Replace so back button does not reopen the stale shell
  window.location.replace(url.toString())
}
