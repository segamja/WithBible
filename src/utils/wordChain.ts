/** Last Hangul character (끝말잇기 이어가기). Not pronunciation / 두음법칙. */
export function lastHangulChar(word: string): string | null {
  const chars = [...word.trim()]
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (/[가-힣]/.test(chars[i])) return chars[i]
  }
  return null
}

export function firstHangulChar(word: string): string | null {
  for (const ch of [...word.trim()]) {
    if (/[가-힣]/.test(ch)) return ch
  }
  return null
}

const BLOCKLIST = [
  '시발',
  '씨발',
  '병신',
  '지랄',
  '좆',
  '개새끼',
  '꺼져',
  '닥쳐',
  '존나',
  '니미',
]

export function hasBlockedWord(word: string): boolean {
  const compact = word.replace(/\s+/g, '')
  return BLOCKLIST.some((bad) => compact.includes(bad))
}

export function validateWordChain(input: string, previousWord: string): string | null {
  const text = input.trim()
  if (!text) return '단어를 입력해주세요.'
  if (hasBlockedWord(text)) return '다른 단어로 남겨주세요.'
  const expected = lastHangulChar(previousWord)
  const first = firstHangulChar(text)
  if (!expected) return null
  if (!first) return '한글로 된 단어를 입력해주세요.'
  if (first !== expected) {
    return `‘${expected}’으로 시작하는 단어를 입력해주세요.`
  }
  return null
}

export function previousWordForUser(
  startingWord: string | null,
  chain: string[],
  myIndex: number | null,
): string {
  if (myIndex != null && myIndex > 0) return chain[myIndex - 1] ?? startingWord ?? ''
  if (myIndex === 0) return startingWord ?? ''
  if (chain.length > 0) return chain[chain.length - 1] ?? startingWord ?? ''
  return startingWord ?? ''
}
