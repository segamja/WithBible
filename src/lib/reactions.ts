/** Reaction / quick-comment constants for community feed */

import type { EncouragementType } from '@/types'

export interface ReactionDef {
  type: EncouragementType
  emoji: string
  label: string
  teacherOnly?: boolean
}

export const STUDENT_REACTIONS: ReactionDef[] = [
  { type: 'like', emoji: '👍', label: '좋아요' },
  { type: 'love', emoji: '❤️', label: '공감해' },
  { type: 'prayer', emoji: '🙏', label: '기도할게' },
  { type: 'fire', emoji: '🔥', label: '멋져!' },
  { type: 'cheer', emoji: '💪', label: '힘내!' },
]

export const TEACHER_REACTION: ReactionDef = {
  type: 'teacher_cheer',
  emoji: '💛',
  label: '선생님이 응원해요',
  teacherOnly: true,
}

export const QUICK_COMMENTS = [
  '잘했어! 👏',
  '같이 가자! 🙌',
  '은혜롭다 ❤️',
  '기도할게 🙏',
] as const

export function reactionEmoji(type: EncouragementType): string {
  const all = [...STUDENT_REACTIONS, TEACHER_REACTION]
  return all.find((r) => r.type === type)?.emoji ?? '👍'
}

export function reactionLabel(type: EncouragementType): string {
  const all = [...STUDENT_REACTIONS, TEACHER_REACTION]
  return all.find((r) => r.type === type)?.label ?? type
}

/** Format "이름, 이름 외 N명" — max 2 names shown */
export function formatTogetherLabel(
  names: string[],
  total: number,
): string | null {
  if (total <= 0) return null
  const shown = names.filter(Boolean).slice(0, 2)
  if (shown.length === 0) {
    return total === 1 ? '1명이 함께 읽었어요' : `${total}명이 함께 읽었어요`
  }
  if (total <= shown.length) {
    return `${shown.join(', ')}님이 함께 읽었어요`
  }
  const rest = total - shown.length
  return `${shown.join(', ')} 외 ${rest}명이 함께 읽었어요`
}

/**
 * Simple class warmth (°C-ish 0–100) from today's activity counts.
 * Not a ranking — community vibe only.
 */
export function computeClassWarmth(input: {
  checkins: number
  reactions: number
  comments: number
  readAlongs: number
}): number {
  const raw =
    input.checkins * 8 +
    input.reactions * 2 +
    input.comments * 3 +
    input.readAlongs * 4
  return Math.max(0, Math.min(100, Math.round(raw)))
}
