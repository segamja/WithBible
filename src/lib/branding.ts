/** 홈·헤더에 쓰는 부서 타이틀 기본값 */
export const DEFAULT_DEPARTMENT_TITLE = '주고받고 고등부'

export function departmentTitleOf(project: { department_title?: string | null } | null | undefined) {
  const raw = project?.department_title?.trim()
  return raw || DEFAULT_DEPARTMENT_TITLE
}
