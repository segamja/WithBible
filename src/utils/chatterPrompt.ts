/** KST weekday prompt for 시끌벅적. Not a poll — optional conversation starter. */

const WEEKDAY_PROMPTS = [
  '오늘 학교에서 웃긴 일 하나 있었어?',
  '지금 기분, 한 줄로 말하면?',
  '요즘 제일 빠져 있는 거 있어?',
  '오늘 누구한테 고맙다는 말 하고 싶어?',
  '이번 주말에 하고 싶은 거 있어?',
  '오늘 하루 중에 제일 편한 순간은 언제였어?',
] as const

const SUNDAY_PROMPTS = [
  '오늘 예배에서 마음에 남는 한 장면이 있었어?',
  '오늘 하나님께 감사한 거 하나 있어?',
  '찬양 중에 따라 부르고 싶은 가사가 있었어?',
  '오늘 고등부에서 반가운 얼굴이 있었어?',
] as const

export function kstWeekday(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(date)
  const i = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return i === -1 ? date.getDay() : i
}

export function kstDayOfMonth(date = new Date()): number {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    day: 'numeric',
  }).format(date)
  const n = Number(day)
  return Number.isFinite(n) ? n : date.getDate()
}

/** Sunday: worship / thanks / praise / welcome only. Other days: school & daily. */
export function todayChatterPrompt(date = new Date()): string {
  const weekday = kstWeekday(date)
  if (weekday === 0) {
    return SUNDAY_PROMPTS[kstDayOfMonth(date) % SUNDAY_PROMPTS.length]
  }
  return WEEKDAY_PROMPTS[(weekday - 1) % WEEKDAY_PROMPTS.length]
}
