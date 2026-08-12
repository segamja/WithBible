import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  assignUserToClass,
  createClass,
  listClasses,
  listUsers,
  updateClass,
  updateUserRole,
} from '@/services/classService'
import type { ClassRow, Profile, UserRole } from '@/types'

export function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setClasses(await listClasses())
    setUsers(await listUsers())
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

  const teachers = users.filter((u) => u.role === 'TEACHER' || u.role === 'ADMIN')

  return (
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">반 관리</h1>

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
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{cls.name}</p>
                <p className="text-xs text-muted">코드 · {cls.join_code}</p>
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
