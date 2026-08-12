import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'

interface CompletionBannerProps {
  bookName: string
  friendCount: number
  days: number
}

export function CompletionBanner({ bookName, friendCount, days }: CompletionBannerProps) {
  return (
    <Card className="space-y-3 border-brand-200 bg-brand-50">
      <p className="text-sm font-medium text-brand-700">우리 반 복음서 완주!</p>
      <h2 className="font-display text-2xl text-brand-900">{bookName} 완독</h2>
      <p className="text-sm text-muted">
        함께 읽은 친구 {friendCount}명 · 프로젝트 기간 {days}일
      </p>
      <Link
        to="/feed"
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-100 font-semibold text-brand-800"
      >
        완주 인증 보기
      </Link>
    </Card>
  )
}
