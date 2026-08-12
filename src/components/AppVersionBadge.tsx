import { APP_VERSION, formatAppVersionLabel } from '@/lib/version'
import { cn } from '@/utils/cn'

/** Always-visible build badge so deploy updates are easy to confirm. */
export function AppVersionBadge({
  className,
  align = 'start',
}: {
  className?: string
  align?: 'start' | 'center'
}) {
  return (
    <p
      className={cn(
        'inline-flex max-w-full items-center rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] font-medium tracking-wide text-navy',
        align === 'center' && 'mx-auto',
        className,
      )}
      title={`빌드 ${APP_VERSION}`}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sage" aria-hidden />
      {formatAppVersionLabel()}
    </p>
  )
}
