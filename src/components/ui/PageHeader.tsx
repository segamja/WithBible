import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/utils/cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  backTo,
  onBack,
  action,
  className,
  centered,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  backTo?: string
  onBack?: () => void
  action?: ReactNode
  className?: string
  centered?: boolean
}) {
  const back = backTo ? (
    <Link
      to={backTo}
      className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-brand-50"
      aria-label="뒤로"
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  ) : onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-navy hover:bg-brand-50"
      aria-label="뒤로"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  ) : null

  if (centered) {
    return (
      <header className={cn('relative mb-1 flex min-h-10 items-center justify-center', className)}>
        {back}
        <h1 className="page-title text-xl">{title}</h1>
        {action ? <div className="absolute right-0">{action}</div> : null}
      </header>
    )
  }

  return (
    <header className={cn('relative space-y-1.5', className)}>
      {back}
      {eyebrow ? <p className="caption-caps">{eyebrow}</p> : null}
      <div className={cn('flex items-start justify-between gap-3', back && 'pl-12')}>
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? (
            <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>
          ) : null}
        </div>
        {action}
      </div>
    </header>
  )
}
