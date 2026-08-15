import { Card } from '@/components/ui/Card'

interface PartyBannerProps {
  title?: string | null
  subtitle?: string | null
  dateLabel?: string | null
  place?: string | null
  note?: string | null
}

export function PartyBanner({ title, subtitle, dateLabel, place, note }: PartyBannerProps) {
  const displayTitle = title?.trim() || '완주 행사'
  const displaySubtitle = subtitle?.trim() || null

  return (
    <Card className="bg-gradient-to-br from-sage-soft/70 via-panel to-streak/15">
      <div className="rounded-[1.15rem] border border-dashed border-streak/70 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="caption-caps text-sage-dark">복음서 완주 보상</p>
          <span aria-hidden className="text-lg leading-none">
            🎁
          </span>
        </div>
        <h2 className="font-display mt-2 whitespace-nowrap text-[clamp(1.05rem,4.6vw,1.55rem)] tracking-tight text-navy">
          {displayTitle}
        </h2>
        {displaySubtitle ? (
          <p className="mt-2 text-[15px] font-bold leading-snug text-navy">{displaySubtitle}</p>
        ) : null}
        {dateLabel ? (
          <p className="mt-3 inline-flex rounded-full bg-streak/35 px-3 py-1 text-sm font-semibold text-navy">
            {dateLabel}
          </p>
        ) : null}
        {place ? <p className="mt-3 text-sm font-medium text-sage-dark">장소 · {place}</p> : null}
        {note ? <p className="mt-2 text-sm leading-relaxed text-muted">{note}</p> : null}
      </div>
    </Card>
  )
}
