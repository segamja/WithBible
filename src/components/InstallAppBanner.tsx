import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'wb_pwa_install_dismissed_at'
/** 닫은 뒤 다시 안내하기까지 (일) */
const DISMISS_DAYS = 14

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true ||
    // Android TWA / some browsers
    document.referrer.startsWith('android-app://')
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isDismissedRecently(): boolean {
  try {
    // 예전 영구 숨김 키는 한 번 지워서, 개선된 안내가 다시 보이도록 함
    if (localStorage.getItem('wb_pwa_install_dismissed') === '1') {
      localStorage.removeItem('wb_pwa_install_dismissed')
    }
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    localStorage.removeItem('wb_pwa_install_dismissed')
  } catch {
    /* ignore */
  }
}

export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(true)
  const ios = isIos()

  useEffect(() => {
    if (isStandalone()) return
    if (isDismissedRecently()) return

    // 설치 가능 여부와 무관하게 안내 배너는 표시 (이벤트는 버튼용)
    setHidden(false)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const onInstalled = () => {
      setHidden(true)
      setDeferred(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setHidden(true)
    setDeferred(null)
    markDismissed()
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    dismiss()
  }

  if (hidden) return null

  const hint = ios
    ? 'Safari 하단(또는 상단) 공유 버튼 → 「홈 화면에 추가」를 눌러 주세요.'
    : deferred
      ? '위드바이블을 앱처럼 설치해 바로 열어보세요.'
      : '브라우저 메뉴(⋮)에서 「앱 설치」또는 「홈 화면에 추가」를 눌러 주세요.'

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
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>
          {deferred ? (
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
