import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  assignUserToClass,
  createClass,
  deleteClass,
  listClasses,
  listUsers,
  updateClass,
  updateUserRole,
} from '@/services/classService'
import { listStaffCodes, upsertStaffCode, type StaffCode } from '@/services/staffCodeService'
import type { ClassRow, Profile, UserRole } from '@/types'

export function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [staffCodes, setStaffCodes] = useState<StaffCode[]>([])
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [staffCodeInput, setStaffCodeInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const [cls, us, staff] = await Promise.all([
      listClasses(),
      listUsers(),
      listStaffCodes(),
    ])
    setClasses(cls)
    setUsers(us)
    setStaffCodes(staff)
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
  }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await createClass({ name, joinCode })
      setName('')
      setJoinCode('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반 생성 실패')
    }
  }

  const onSaveStaffCode = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await upsertStaffCode(staffCodeInput || staffCodes[0]?.code || 'STAFF26')
      setStaffCodeInput('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '임원 코드 저장 실패')
    }
  }

  const teachers = users.filter((u) => u.role === 'TEACHER' || u.role === 'ADMIN')

  return (
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">반 관리</h1>
      <p className="text-sm text-muted">
        <Link to="/admin/users" className="font-medium text-navy underline-offset-2 hover:underline">
          사용자 관리
        </Link>
        에서 역할을 바꿀 수 있어요.
      </p>

      <Card className="space-y-3">
        <h2 className="font-semibold text-navy">임원 선생님 코드</h2>
        <p className="text-sm text-muted">
          반이 없는 임원 선생님이 카카오/가입 시 입력하는 코드입니다. (운영자 ADMIN은 SQL로만 승격)
        </p>
        {staffCodes.map((s) => (
          <p key={s.id} className="rounded-xl bg-brand-50 px-3 py-2 font-semibold tracking-wide text-navy">
            {s.code}
            <span className="ml-2 text-xs font-normal text-muted">· {s.label}</span>
          </p>
        ))}
        <form onSubmit={onSaveStaffCode} className="flex gap-2">
          <Input
            value={staffCodeInput}
            onChange={(e) => setStaffCodeInput(e.target.value.toUpperCase())}
            placeholder="새 코드 (예: STAFF26)"
            className="flex-1"
          />
          <Button type="submit" variant="secondary">
            추가/갱신
          </Button>
        </form>
      </Card>

      <form onSubmit={onCreate}>
        <Card className="space-y-3">
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="반 이름 (예: 2반)"
          />
          <Input
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="가입 코드 (예: BIBLE26-2)"
          />
          <Button type="submit" className="w-full">
            반 생성
          </Button>
        </Card>
      </form>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-3">
        {classes.map((cls) => (
          <Card key={cls.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {cls.name}
                  {cls.is_active === false ? (
                    <span className="ml-2 text-xs font-normal text-muted">(비활성)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted">코드 · {cls.join_code}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="text-xs text-muted hover:text-navy"
                  onClick={() =>
                    void updateClass(cls.id, { is_active: cls.is_active === false })
                      .then(refresh)
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : '반 상태 변경 실패'),
                      )
                  }
                >
                  {cls.is_active === false ? '활성화' : '비활성'}
                </button>
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => {
                    const ok = window.confirm(
                      `"${cls.name}" 반을 삭제할까요?\n소속 학생은 반 미배정이 되고, 이 반의 프로젝트 연결·공지는 함께 삭제됩니다.`,
                    )
                    if (!ok) return
                    void deleteClass(cls.id)
                      .then(refresh)
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : '반 삭제 실패'),
                      )
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
            <Select
              value={cls.teacher_id ?? ''}
              onChange={(e) =>
                void updateClass(cls.id, {
                  teacher_id: e.target.value || null,
                }).then(refresh)
              }
            >
              <option value="">교사 미배정</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setUsers(await listUsers())
    setClasses(await listClasses())
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
  }, [])

  return (
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">사용자</h1>
      <p className="text-sm text-muted">역할과 반을 배정하세요. 첫 관리자는 SQL로 승격합니다.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="space-y-2">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={user.role}
                onChange={(e) =>
                  void updateUserRole(user.id, e.target.value as UserRole).then(refresh)
                }
              >
                <option value="STUDENT">STUDENT</option>
                <option value="TEACHER">TEACHER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
              <Select
                value={user.class_id ?? ''}
                onChange={(e) =>
                  void assignUserToClass(user.id, e.target.value || null).then(refresh)
                }
              >
                <option value="">반 미배정</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
