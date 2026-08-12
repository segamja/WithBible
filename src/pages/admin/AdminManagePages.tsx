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
  const [message, setMessage] = useState<string | null>(null)
  /** Pending teacher selection per class (explicit save) */
  const [teacherDraft, setTeacherDraft] = useState<Record<string, string>>({})
  const [savingClassId, setSavingClassId] = useState<string | null>(null)
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editJoinCode, setEditJoinCode] = useState('')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)

  const refresh = async () => {
    const [cls, us, staff] = await Promise.all([
      listClasses(),
      listUsers(),
      listStaffCodes(),
    ])
    setClasses(cls)
    setUsers(us)
    setStaffCodes(staff)
    const drafts: Record<string, string> = {}
    for (const c of cls) {
      drafts[c.id] = c.teacher_id ?? ''
    }
    setTeacherDraft(drafts)
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
  }, [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await createClass({ name, joinCode })
      setName('')
      setJoinCode('')
      setMessage('반을 만들었습니다.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반 생성 실패')
    }
  }

  const onSaveStaffCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    try {
      await upsertStaffCode(staffCodeInput || staffCodes[0]?.code || 'STAFF26')
      setStaffCodeInput('')
      setMessage('임원 코드를 저장했습니다.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '임원 코드 저장 실패')
    }
  }

  const onSaveTeacher = async (classId: string, className: string) => {
    setError(null)
    setMessage(null)
    setSavingClassId(classId)
    try {
      const teacherId = teacherDraft[classId] || null
      await updateClass(classId, { teacher_id: teacherId })
      // Keep teacher profile class_id in sync when assigning
      if (teacherId) {
        await assignUserToClass(teacherId, classId).catch(() => undefined)
      }
      setMessage(`${className} 담당 교사를 저장했습니다.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '교사 배정 저장 실패')
    } finally {
      setSavingClassId(null)
    }
  }

  const startEdit = (cls: ClassRow) => {
    setEditingClassId(cls.id)
    setEditName(cls.name)
    setEditJoinCode(cls.join_code)
    setError(null)
    setMessage(null)
  }

  const cancelEdit = () => {
    setEditingClassId(null)
    setEditName('')
    setEditJoinCode('')
  }

  const onSaveClassEdit = async (classId: string) => {
    const nextName = editName.trim()
    const nextCode = editJoinCode.trim().toUpperCase()
    if (!nextName || !nextCode) {
      setError('반 이름과 가입 코드를 모두 입력해주세요.')
      return
    }
    setError(null)
    setMessage(null)
    setSavingEditId(classId)
    try {
      await updateClass(classId, { name: nextName, join_code: nextCode })
      setMessage(`「${nextName}」 반 정보를 저장했습니다.`)
      setEditingClassId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '반 수정 실패')
    } finally {
      setSavingEditId(null)
    }
  }

  const teachers = users.filter((u) => u.role === 'TEACHER' || u.role === 'ADMIN')

  return (
    <div className="space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl text-brand-900">반 관리</h1>
      <p className="text-sm text-muted">
        담임 교사는{' '}
        <Link to="/admin/users" className="font-medium text-navy underline-offset-2 hover:underline">
          사용자 관리
        </Link>
        에서 먼저 가입된 계정을 TEACHER로 바꾼 뒤, 아래에서 선택·저장하세요.
      </p>

      <Card className="space-y-2 border-sage/30 bg-sage/5 text-sm">
        <p className="font-semibold text-navy">교사 배정 순서</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>선생님이 앱에 가입 (카카오 + 임원 코드, 또는 이메일)</li>
          <li>사용자 관리에서 역할을 TEACHER로 변경</li>
          <li>이 화면에서 반의 담당 교사를 고른 뒤 「저장」</li>
        </ol>
      </Card>

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
      {message ? <p className="text-sm text-sage-dark">{message}</p> : null}

      <div className="space-y-3">
        {classes.map((cls) => {
          const draft = teacherDraft[cls.id] ?? ''
          const dirty = draft !== (cls.teacher_id ?? '')
          const isEditing = editingClassId === cls.id
          return (
            <Card key={cls.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {!isEditing ? (
                    <>
                      <p className="font-semibold">
                        {cls.name}
                        {cls.is_active === false ? (
                          <span className="ml-2 text-xs font-normal text-muted">(비활성)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">코드 · {cls.join_code}</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-navy">반 정보 수정</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-navy hover:underline"
                      onClick={() => startEdit(cls)}
                    >
                      수정
                    </button>
                  ) : null}
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
                        .then(() => {
                          if (editingClassId === cls.id) cancelEdit()
                          return refresh()
                        })
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : '반 삭제 실패'),
                        )
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2 rounded-xl border border-line bg-brand-50/50 p-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">반 이름</label>
                    <Input
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="예: 2반"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">가입 코드</label>
                    <Input
                      required
                      value={editJoinCode}
                      onChange={(e) => setEditJoinCode(e.target.value.toUpperCase())}
                      placeholder="예: BIBLE26-2"
                      className="font-semibold tracking-wide"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={savingEditId === cls.id}
                      onClick={() => void onSaveClassEdit(cls.id)}
                    >
                      {savingEditId === cls.id ? '저장 중…' : '반 정보 저장'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={savingEditId === cls.id}
                      onClick={cancelEdit}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : null}

              <label className="block text-xs text-muted">담당 교사</label>
              <Select
                value={draft}
                onChange={(e) =>
                  setTeacherDraft((prev) => ({ ...prev, [cls.id]: e.target.value }))
                }
              >
                <option value="">교사 미배정</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.email ? ` · ${t.email}` : ''}
                  </option>
                ))}
              </Select>
              {teachers.length === 0 ? (
                <p className="text-xs text-danger">
                  TEACHER 역할 사용자가 없습니다. 사용자 관리에서 역할을 먼저 바꿔주세요.
                </p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                variant={dirty ? 'primary' : 'outline'}
                disabled={savingClassId === cls.id || !dirty}
                onClick={() => void onSaveTeacher(cls.id, cls.name)}
              >
                {savingClassId === cls.id ? '저장 중…' : dirty ? '담당 교사 저장' : '저장됨'}
              </Button>
            </Card>
          )
        })}
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
      <p className="text-sm text-muted">
        역할·반을 바꾸면 바로 저장됩니다. 담임 배정은{' '}
        <Link to="/admin/classes" className="font-medium text-navy underline-offset-2 hover:underline">
          반 관리
        </Link>
        에서도 「담당 교사 저장」으로 할 수 있어요.
      </p>
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
