import { cn } from '@/utils/cn'

/** 송내사랑의교회 로고 — 투명 PNG, 우측 상단용 작은 마크 */
export function ChurchLogoHeader({ className }: { className?: string }) {
  return (
    <img
      src="/brand/snsarang-logo.png"
      alt="송내사랑의교회"
      width={672}
      height={180}
      decoding="async"
      className={cn(
        'h-7 w-auto max-w-[9.5rem] object-contain object-right sm:h-8 sm:max-w-[11rem]',
        className,
      )}
    />
  )
}
