import { useState } from 'react'
import { X } from 'lucide-react'
import {
  listSavedAccounts,
  removeSavedAccount,
  roleLabel,
  type SavedAccount,
} from '@/lib/savedAccounts'
import { cn } from '@/utils/cn'

export function SavedAccountList({
  onPick,
  filter,
  className,
  title = '이 기기에서 사용한 계정',
  hint,
}: {
  onPick: (account: SavedAccount) => void
  filter?: (account: SavedAccount) => boolean
  className?: string
  title?: string
  hint?: string
}) {
  const [accounts, setAccounts] = useState(() => listSavedAccounts())

  const visible = filter ? accounts.filter(filter) : accounts
  if (visible.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <p className="text-sm font-semibold text-navy">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <ul className="space-y-2">
        {visible.map((account) => (
          <li key={account.id}>
            <div className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => onPick(account)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line/40 bg-panel px-3 py-3 text-left shadow-[0_4px_16px_rgba(23,32,51,0.04)] transition hover:border-sky/50 hover:bg-sky-soft/40 active:scale-[0.99]"
              >
                {account.profileImage ? (
                  <img
                    src={account.profileImage}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-soft text-sm font-semibold text-sky-dark">
                    {account.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-navy">{account.name}</p>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {roleLabel(account.role)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {account.email ||
                      (account.provider === 'kakao' ? '카카오 로그인' : '이메일 없음')}
                  </p>
                </div>
              </button>
              <button
                type="button"
                aria-label={`${account.name} 목록에서 삭제`}
                onClick={() => {
                  removeSavedAccount(account.id)
                  setAccounts(listSavedAccounts())
                }}
                className="flex w-10 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-brand-50 hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
