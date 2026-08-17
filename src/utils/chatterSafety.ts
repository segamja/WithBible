/** Short client-side blocklist. Reports still catch bypasses. */

const BLOCKED = [
  '시발',
  '씨발',
  'ㅅㅂ',
  '병신',
  '좆',
  '존나',
  '좆같',
  '지랄',
  '꺼져',
  '닥쳐',
  '새끼',
  '죽어',
  '자살',
  '성기',
  '자지',
  '보지',
  '섹스',
  '야동',
  '강간',
  '창녀',
  '장애년',
  '장애인아',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'nigger',
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

export function chatterSafetyMessage(text: string): string | null {
  const haystack = normalize(text)
  if (!haystack) return null
  for (const word of BLOCKED) {
    if (haystack.includes(normalize(word))) {
      return '그 표현은 올리지 말아 주세요.'
    }
  }
  return null
}
