import { cn } from '@/utils/cn'

/** 송내사랑의교회 로고 — 검정 배경 원본을 작은 헤더 바에 맞춰 선명하게 표시 */
export function ChurchLogoHeader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-black px-3 py-2.5 shadow-[0_4px_16px_rgba(23,32,51,0.08)]',
        className,
      )}
    >
      <img
        src="/brand/snsarang-logo.png"
        alt="송내사랑의교회 SongNae SaRang Community Church"
        width={448}
        height={120}
        decoding="async"
        className="mx-auto h-9 w-auto max-w-full object-contain object-center sm:h-10"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  )
}
