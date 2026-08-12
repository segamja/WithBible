import { ProgressBar } from '@/components/ui/ProgressBar'
import { getDDayLabel } from '@/utils/dday'

interface HeroProgressProps {
  projectTitle: string
  className?: string
  classLabel?: string
  rate: number
  endDate: string
}

export function HeroProgress({
  projectTitle,
  classLabel,
  rate,
  endDate,
}: HeroProgressProps) {
  return (
    <section className="relative overflow-hidden px-5 pb-6 pt-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(42,171,147,0.22),transparent_45%)]" />
      <p className="text-sm font-medium text-brand-700">With Bible</p>
      <h1 className="font-display mt-1 text-3xl leading-tight text-brand-900">{projectTitle}</h1>
      {classLabel ? <p className="mt-2 text-muted">{classLabel}</p> : null}
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">우리 반 진행률</p>
          <p className="font-display text-4xl text-brand-700">{rate}%</p>
        </div>
        <div className="rounded-2xl bg-brand-600 px-4 py-3 text-center text-white shadow-lg shadow-brand-600/20">
          <p className="text-xs opacity-80">완주까지</p>
          <p className="font-display text-xl">{getDDayLabel(endDate)}</p>
        </div>
      </div>
      <ProgressBar value={rate} className="mt-4" />
    </section>
  )
}
