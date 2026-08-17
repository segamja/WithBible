import type { ChatterReactionType } from '@/types'

export interface ChatterReactionDef {
  type: ChatterReactionType
  emoji: string
  label: string
}

/** Picker only — do not reuse 말씀인증 STUDENT_REACTIONS here. */
export const CHATTER_PICKER_REACTIONS: ChatterReactionDef[] = [
  { type: 'love', emoji: '❤️', label: '공감' },
  { type: 'laugh', emoji: '😂', label: '웃겨' },
  { type: 'like', emoji: '👍', label: '좋아' },
  { type: 'fire', emoji: '🔥', label: '멋져' },
  { type: 'clap', emoji: '👏', label: '박수' },
]

const CHATTER_LEGACY_REACTIONS: ChatterReactionDef[] = [
  { type: 'prayer', emoji: '🙏', label: '기도할게' },
  { type: 'cheer', emoji: '💪', label: '힘내' },
]

const CHATTER_ALL_REACTIONS: ChatterReactionDef[] = [
  ...CHATTER_PICKER_REACTIONS,
  ...CHATTER_LEGACY_REACTIONS,
]

export function chatterReactionEmoji(type: ChatterReactionType): string {
  return CHATTER_ALL_REACTIONS.find((r) => r.type === type)?.emoji ?? '❤️'
}

export function chatterCountTypes(counts: Partial<Record<ChatterReactionType, number>> | undefined) {
  const seen = new Set<ChatterReactionType>()
  const ordered: ChatterReactionDef[] = []
  for (const def of CHATTER_ALL_REACTIONS) {
    if ((counts?.[def.type] ?? 0) > 0) {
      ordered.push(def)
      seen.add(def.type)
    }
  }
  if (counts) {
    for (const type of Object.keys(counts) as ChatterReactionType[]) {
      if (!seen.has(type) && (counts[type] ?? 0) > 0) {
        ordered.push({ type, emoji: chatterReactionEmoji(type), label: type })
      }
    }
  }
  return ordered
}
