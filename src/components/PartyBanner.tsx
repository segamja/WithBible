import { Card } from '@/components/ui/Card'

interface PartyBannerProps {
  title?: string | null
  dateLabel?: string | null
  place?: string | null
  note?: string | null
}

export function PartyBanner({ title, dateLabel, place, note }: PartyBannerProps) {
  const displayTitle = title?.trim() || '완주 행사'

  return (
    <Card className="border-none bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-700/20">
      <p className="text-sm font-medium opacity-90">복음서 완주 보상</p>
      <h2 className="font-display mt-1 text-2xl">{displayTitle}</h2>
      {dateLabel ? <p className="mt-3 text-sm">{dateLabel}</p> : null}
      {place ? <p className="mt-1 text-sm opacity-90">장소 · {place}</p> : null}
      {note ? <p className="mt-3 text-sm leading-relaxed opacity-95">{note}</p> : null}
    </Card>
  )
}
