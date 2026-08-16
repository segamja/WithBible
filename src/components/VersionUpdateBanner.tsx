import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  APP_VERSION,
  fetchRemoteVersion,
  isNewerRemote,
  reloadToLatest,
} from '@/lib/version'

const CHECK_INTERVAL_MS = 5 * 60 * 1000
const AUTO_RELOAD_MS = 2500

/**
 * Polls /version.json on mount, interval, and tab focus.
 * When deploy differs from this bundle, shows a banner and auto-reloads.
 */
export function VersionUpdateBanner() {
  const [pending, setPending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_RELOAD_MS / 1000))
  const checking = useRef(false)
  const armed = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const check = async () => {
      if (checking.current || armed.current) return
      checking.current = true
      try {
        const remote = await fetchRemoteVersion()
        if (isNewerRemote(remote)) {
          armed.current = true
          setPending(true)
        }
      } finally {
        checking.current = false
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV || !pending) return
    const started = Date.now()
    const tick = window.setInterval(() => {
      const left = Math.max(0, AUTO_RELOAD_MS - (Date.now() - started))
      setSecondsLeft(Math.ceil(left / 1000))
      if (left <= 0) {
        window.clearInterval(tick)
        void reloadToLatest()
      }
    }, 200)
    return () => window.clearInterval(tick)
  }, [pending])

  if (import.meta.env.DEV || !pending) return null

  return (
    <div
      role="alert"
      className="safe-top fixed inset-x-0 top-0 z-[60] border-b border-sage/40 bg-navy px-4 py-3 text-white shadow-lg"
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">새 버전이 있어요</p>
          <p className="text-xs text-white/70">
            {secondsLeft > 0
              ? `${secondsLeft}초 후 이전 캐시를 지우고 새로고침합니다.`
              : '캐시 삭제 후 새로고침 중…'}
          </p>
        </div>
        <Button
          type="button"
          variant="sage"
          size="sm"
          className="shrink-0"
          onClick={() => void reloadToLatest()}
        >
          지금 새로고침
        </Button>
      </div>
      <p className="mx-auto mt-1 max-w-lg text-[10px] text-white/40">현재 {APP_VERSION}</p>
    </div>
  )
}
