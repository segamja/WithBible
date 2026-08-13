import { cn } from '@/utils/cn'

/** 송내사랑의교회 로고 — 투명 배경 + 어두운 글자, 앱 톤에 맞는 흰 카드 */
export function ChurchLogoHeader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-line/25 bg-panel px-4 py-3 shadow-[0_4px_16px_rgba(23,32,51,0.04)]',
        className,
      )}
    >
      <img
        src="/brand/snsarang-logo.png"
        alt="송내사랑의교회 SongNae SaRang Community Church"
        width={672}
        height={180}
        decoding="async"
        className="mx-auto h-10 w-auto max-w-full object-contain object-center sm:h-11"
      />
    </div>
  )
}
