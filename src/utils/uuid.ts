const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Convert empty/whitespace strings to null (avoids Postgres uuid "" errors). */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value))
}

export function requireUuid(value: string | null | undefined, label = 'id'): string {
  if (!isUuid(value)) {
    throw new Error(`${label}가 올바르지 않습니다.`)
  }
  return value
}
