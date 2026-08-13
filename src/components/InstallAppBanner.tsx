import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'wb_pwa_install_dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* ignore */
    }

    if (isIos()) {
      setShowIosHint(true)
      setHidden(false)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setHidden(true)
    setDeferred(null)
    setShowIosHint(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    dismiss()
  }

  if (hidden) return null

  return (
    <div
      className={cn(
        'safe-bottom fixed inset-x-0 bottom-[4.25rem] z-30 mx-auto max-w-lg px-4',
      )}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-line/80 bg-panel/95 p-3 shadow-lg backdrop-blur">
        <div className="mt-0.5 rounded-xl bg-navy p-2 text-white">
          <Download className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">홈 화면에 추가</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {showIosHint
              ? 'Safari 공유 버튼 → 「홈 화면에 추가」로 앱처럼 설치할 수 있어요.'
              : '위드바이블을 앱처럼 설치해 바로 열어보세요.'}
          </p>
          {!showIosHint && deferred ? (
            <Button size="sm" className="mt-2" onClick={() => void install()}>
              설치하기
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="닫기"
          className="rounded-lg p-1 text-muted hover:bg-brand-50 hover:text-ink"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
