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
import {
  deleteAdminUser,
  generateTempPassword,
  listAdminUsers,
  resetAdminUserPassword,
  type AdminUserRow,
} from '@/services/adminUserService'
import { listStaffCodes, upsertStaffCode, type StaffCode } from '@/services/staffCodeService'
import { useAuthStore } from '@/stores/authStore'
import type { ClassRow, Profile, UserRole } from '@/types'

export function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [staffCodes, setStaffCodes] = useState<StaffCode[]>([])
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [teacherJoinCode, setTeacherJoinCode] = useState('')
  const [staffCodeInput, setStaffCodeInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Pending teacher selection per class (explicit save) */
  const [teacherDraft, setTeacherDraft] = useState<Record<string, string>>({})
  const [savingClassId, setSavingClassId] = useState<string | null>(null)
  const [editingClassId, setEditingClassId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editJoinCode, setEditJoinCode] = useState('')
  const [editTeacherJoinCode, setEditTeacherJoinCode] = useState('')
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
      await createClass({
        name,
        joinCode,
        teacherJoinCode: teacherJoinCode.trim() || undefined,
      })
      setName('')
      setJoinCode('')
      setTeacherJoinCode('')
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
    setEditTeacherJoinCode(cls.teacher_join_code ?? `T-${cls.join_code}`)
    setError(null)
    setMessage(null)
  }

  const cancelEdit = () => {
    setEditingClassId(null)
    setEditName('')
    setEditJoinCode('')
    setEditTeacherJoinCode('')
  }

  const onSaveClassEdit = async (classId: string) => {
    const nextName = editName.trim()
    const nextCode = editJoinCode.trim().toUpperCase()
    const nextTeacherCode = editTeacherJoinCode.trim().toUpperCase()
    if (!nextName || !nextCode || !nextTeacherCode) {
      setError('반 이름, 학생 코드, 교사 코드를 모두 입력해주세요.')
      return
    }
    if (nextCode === nextTeacherCode) {
      setError('학생 코드와 교사 코드는 서로 달라야 합니다.')
      return
    }
    setError(null)
    setMessage(null)
    setSavingEditId(classId)
    try {
      await updateClass(classId, {
        name: nextName,
        join_code: nextCode,
        teacher_join_code: nextTeacherCode,
      })
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
    <div className="page">
      <div>
        <Link to="/admin" className="text-sm font-medium text-sky-dark hover:text-navy">
          ← 현황
        </Link>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="caption-caps">관리자</p>
            <h1 className="page-title mt-1">반 관리</h1>
          </div>
          <Link
            to="/admin/users"
            className="shrink-0 pb-1 text-sm font-medium text-navy underline-offset-2 hover:underline"
          >
            사용자·역할
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted">
        반은 <span className="font-medium text-navy">학생 코드</span>와{' '}
        <span className="font-medium text-navy">교사 코드</span>가 따로 있습니다. 임원은 아래 임원
        코드를 쓰고, 수동 배정은 사용자·역할에서도 가능합니다.
      </p>

      <Card className="space-y-2 border-sage/25 bg-sage-soft text-sm">
        <p className="font-semibold text-navy">코드 종류</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>학생 코드 → 학생으로 그 반 가입</li>
          <li>교사 코드 → 담임 TEACHER + 그 반 (가입과 동시에 권한)</li>
          <li>임원 코드 → 반 없는 TEACHER</li>
        </ul>
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
            onChange={(e) => {
              const v = e.target.value.toUpperCase()
              setJoinCode(v)
              setTeacherJoinCode((prev) =>
                !prev || prev.startsWith('T-') ? (v ? `T-${v}` : '') : prev,
              )
            }}
            placeholder="학생 가입 코드 (예: WB-2-1)"
          />
          <Input
            value={teacherJoinCode}
            onChange={(e) => setTeacherJoinCode(e.target.value.toUpperCase())}
            placeholder="교사 코드 (비우면 T-WB-학년-반)"
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
                      <p className="text-xs text-muted">학생 코드 · {cls.join_code}</p>
                      <p className="text-xs text-muted">
                        교사 코드 · {cls.teacher_join_code ?? `T-${cls.join_code}`}
                      </p>
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
                    <label className="mb-1 block text-xs text-muted">학생 가입 코드</label>
                    <Input
                      required
                      value={editJoinCode}
                      onChange={(e) => setEditJoinCode(e.target.value.toUpperCase())}
                      placeholder="예: WB-2-1"
                      className="font-semibold tracking-wide"
                      autoCapitalize="characters"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">교사 코드</label>
                    <Input
                      required
                      value={editTeacherJoinCode}
                      onChange={(e) => setEditTeacherJoinCode(e.target.value.toUpperCase())}
                      placeholder="예: T-WB-2-1"
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
  const meId = useAuthStore((s) => s.profile?.id)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ghostOnly, setGhostOnly] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [customPw, setCustomPw] = useState<Record<string, string>>({})

  const refresh = async () => {
    const cls = await listClasses()
    setClasses(cls)
    try {
      setUsers(await listAdminUsers())
    } catch {
      // Migration 016 전이면 기본 목록으로 폴백
      const basic = await listUsers()
      setUsers(
        basic.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          class_id: u.class_id,
          created_at: u.created_at,
          has_email_login: Boolean(u.email),
          reading_log_count: 0,
          is_ghost: u.role === 'STUDENT' && !u.class_id,
        })),
      )
    }
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : '로드 실패'))
  }, [])

  const visible = ghostOnly ? users.filter((u) => u.is_ghost) : users
  const ghostCount = users.filter((u) => u.is_ghost).length

  const onDelete = async (user: AdminUserRow) => {
    if (user.id === meId) {
      setError('본인 계정은 삭제할 수 없습니다.')
      return
    }
    const ok = window.confirm(
      `"${user.name}" 계정을 삭제할까요?\n인증 기록·댓글 등 관련 데이터도 함께 삭제됩니다.`,
    )
    if (!ok) return
    setError(null)
    setMessage(null)
    setBusyId(user.id)
    try {
      await deleteAdminUser(user.id)
      setMessage(`「${user.name}」 계정을 삭제했습니다.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setBusyId(null)
    }
  }

  const onResetPassword = async (user: AdminUserRow) => {
    if (!user.email?.trim()) {
      setError(
        `"${user.name}" 계정에 이메일이 없어 비밀번호 로그인을 설정할 수 없습니다. 카카오 전용 계정이면 카카오로 로그인해야 합니다.`,
      )
      return
    }
    const next = customPw[user.id]?.trim() || generateTempPassword()
    const ok = window.confirm(
      `"${user.name}" 비밀번호를 초기화할까요?\n이메일: ${user.email}\n새 비밀번호: ${next}\n\n확인 후 사용자에게 전달해 주세요.\n(이메일+비밀번호로 로그인)`,
    )
    if (!ok) return
    setError(null)
    setMessage(null)
    setBusyId(user.id)
    try {
      await resetAdminUserPassword(user.id, next)
      setMessage(`「${user.name}」 새 비밀번호: ${next} · 로그인 이메일: ${user.email}`)
      setCustomPw((prev) => ({ ...prev, [user.id]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 초기화 실패')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div>
        <Link to="/admin" className="text-sm font-medium text-sky-dark hover:text-navy">
          ← 현황
        </Link>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="caption-caps">관리자</p>
            <h1 className="page-title mt-1">사용자</h1>
          </div>
          <Link
            to="/admin/classes"
            className="shrink-0 pb-1 text-sm font-medium text-navy underline-offset-2 hover:underline"
          >
            반·임원 코드
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted">
        역할·반은 바로 저장됩니다. 유령 계정(반 미배정·인증 없음 학생) 삭제와 비밀번호 초기화도 할 수
        있어요. 비밀번호 초기화는 이메일이 있는 계정만 가능하며, Supabase에 migration 016·018을
        적용해야 새 비밀번호로 로그인이 됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={ghostOnly ? 'primary' : 'outline'}
          onClick={() => setGhostOnly((v) => !v)}
        >
          유령만 보기 {ghostCount > 0 ? `(${ghostCount})` : ''}
        </Button>
        <span className="text-xs text-muted">전체 {users.length}명</span>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-sage-soft px-3 py-2 text-sm font-medium text-navy">{message}</p>
      ) : null}

      <div className="space-y-3">
        {visible.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              {ghostOnly ? '유령 계정이 없습니다.' : '사용자가 없습니다.'}
            </p>
          </Card>
        ) : (
          visible.map((user) => (
            <Card key={user.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy">{user.name}</p>
                    {user.is_ghost ? (
                      <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral">
                        유령
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">{user.email || '이메일 없음'}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    인증 {user.reading_log_count}회
                    {user.has_email_login ? ' · 이메일 로그인' : ' · 소셜 로그인'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={user.role}
                  onChange={(e) =>
                    void updateUserRole(user.id, e.target.value as UserRole)
                      .then(refresh)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : '역할 변경 실패'),
                      )
                  }
                >
                  <option value="STUDENT">STUDENT</option>
                  <option value="TEACHER">TEACHER</option>
                  <option value="ADMIN">ADMIN</option>
                </Select>
                <Select
                  value={user.class_id ?? ''}
                  onChange={(e) =>
                    void assignUserToClass(user.id, e.target.value || null)
                      .then(refresh)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : '반 배정 실패'),
                      )
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

              <div className="space-y-2 border-t border-line/30 pt-3">
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="새 비밀번호 (비우면 자동 생성)"
                    value={customPw[user.id] ?? ''}
                    onChange={(e) =>
                      setCustomPw((prev) => ({ ...prev, [user.id]: e.target.value }))
                    }
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === user.id || !user.email?.trim()}
                    onClick={() => void onResetPassword(user)}
                  >
                    비번 초기화
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full border-coral/40 text-coral hover:bg-coral/10"
                  disabled={busyId === user.id || user.id === meId}
                  onClick={() => void onDelete(user)}
                >
                  {user.is_ghost ? '유령 계정 삭제' : '계정 삭제'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
