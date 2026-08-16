export type UserRole = 'MASTER' | 'SUB_MASTER' | 'STAFF' | 'TEACHER' | 'STUDENT'

export type AnnouncementKind = 'notice' | 'cheer'

export type FeedbackKind = 'bug' | 'feature'

export type ProjectStatus = 'draft' | 'active' | 'completed'

export type Visibility = 'class' | 'public'

export type EncouragementType =
  | 'fighting'
  | 'together'
  | 'word'
  | 'grace'
  | 'well_done'
  | 'like'
  | 'love'
  | 'prayer'
  | 'fire'
  | 'cheer'
  | 'teacher_cheer'

export interface Profile {
  id: string
  name: string
  email: string | null
  profile_image: string | null
  role: UserRole
  class_id: string | null
  created_at: string
}

export interface ClassRow {
  id: string
  name: string
  teacher_id: string | null
  join_code: string
  teacher_join_code?: string
  is_active?: boolean
  created_at: string
}

export interface Project {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  status: ProjectStatus
  /** 홈에 표시하는 부서/사역 이름 (예: 주고받고 고등부) */
  department_title: string | null
  /** 마지막 보상/행사 이름 (포트럭 파티, 시상식 등) */
  party_title: string | null
  party_subtitle: string | null
  party_date: string | null
  party_place: string | null
  party_note: string | null
  created_at: string
}

export interface ProjectClass {
  id: string
  project_id: string
  class_id: string
  target_book_id: string
  target_start_chapter: number
  target_end_chapter: number
  created_at: string
}

export interface BibleBook {
  id: string
  name: string
  testament: string
  chapter_count: number
  sort_order?: number
}

/** Project-wide reading goal (one or more books) */
export interface ProjectTarget {
  id: string
  project_id: string
  book_id: string
  start_chapter: number
  end_chapter: number
  sort_order: number
  created_at?: string
  bible_books?: Pick<BibleBook, 'id' | 'name' | 'chapter_count' | 'sort_order' | 'testament'>
}

export interface ReadingLog {
  id: string
  project_id: string
  user_id: string
  book_id: string
  start_chapter: number
  end_chapter: number
  /** Today's official goal at check-in time; null on older rows. */
  target_start_chapter?: number | null
  target_end_chapter?: number | null
  /** Feed together-count frozen at created_at. */
  together_count_snapshot?: number | null
  together_preview_snapshot?: ReadAlongPreview[] | null
  together_goal_label_snapshot?: string | null
  reflection: string
  visibility: Visibility
  image_url: string | null
  reading_date: string
  created_at: string
  updated_at: string
}

export interface Encouragement {
  id: string
  reading_log_id: string
  user_id: string
  type: EncouragementType
  created_at: string
}

export interface Announcement {
  id: string
  project_id: string
  class_id: string | null
  author_id: string
  content: string
  kind: AnnouncementKind
  created_at: string
}

export interface Feedback {
  id: string
  user_id: string
  kind: FeedbackKind
  content: string
  created_at: string
  read_at: string | null
}

export interface FeedComment {
  id: string
  reading_log_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { name: string } | null
}

export interface ReadAlongPreview {
  user_id: string
  name: string
}

export type ReactionCounts = Partial<Record<EncouragementType, number>>

export interface AppNotification {
  id: string
  user_id: string
  actor_id: string | null
  reading_log_id: string | null
  kind: 'reaction' | 'comment' | 'read_along' | 'teacher_cheer'
  reaction_type: string | null
  message: string
  is_read: boolean
  created_at: string
  actor?: Pick<Profile, 'id' | 'name' | 'profile_image'> | null
}

export interface ReadingLogWithMeta extends ReadingLog {
  profiles?: Pick<Profile, 'id' | 'name' | 'profile_image' | 'class_id'>
  bible_books?: Pick<BibleBook, 'id' | 'name'>
  classes?: Pick<ClassRow, 'id' | 'name'>
  encouragement_count?: number
  my_encouragement?: EncouragementType | null
  reaction_counts?: ReactionCounts
  my_reactions?: EncouragementType[]
  has_teacher_cheer?: boolean
  read_along_count?: number
  read_along_preview?: ReadAlongPreview[]
  my_read_along?: boolean
  /** People who completed that day's official goal (partial out, extra in). */
  together_count?: number
  together_preview?: ReadAlongPreview[]
  /** Official goal range for this post's reading date, e.g. 마태복음 1–3장 */
  together_goal_label?: string | null
  comments?: FeedComment[]
}

export interface ClassProgress {
  classId: string
  className: string
  studentCount: number
  participatedCount: number
  participationRate: number
  coveredChapters: number
  targetChapters: number
  achievementRate: number
  todayCheckins: number
  weekCheckins: number
}

export interface StudentStatus {
  userId: string
  name: string
  lastReadingDate: string | null
  totalChapters: number
  status: 'green' | 'yellow' | 'red'
  todayActualLabel: string | null
  todayTargetLabel: string
  todayGoalKind: 'none' | 'partial' | 'done' | 'done_extra'
  todayExtraChapters: number
}

export type ChatterReactionType = 'like' | 'love' | 'prayer' | 'fire' | 'cheer'

export interface ChatterComment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { name: string } | null
}

export interface ChatterPost {
  id: string
  author_id: string
  content: string
  image_url: string | null
  created_at: string
  updated_at: string
  profiles?: { name: string; profile_image: string | null } | null
  reaction_counts?: ReactionCounts
  my_reactions?: ChatterReactionType[]
  comments?: ChatterComment[]
}

export type PlaygroundCategory =
  | 'SCHOOL'
  | 'FOOD'
  | 'GAME'
  | 'EMOTION'
  | 'TEXT'
  | 'THANKFUL'
  | 'BIBLE_LIGHT'
  | 'BALANCE'
  | 'EMOJI'
  | 'CHOICE'
  | 'IMAGINE'
  | 'DAILY'
  | 'MUSIC'
  | 'HOBBY'
  | 'FRIEND'
  | 'CREATIVE'
  | 'FAITH'
  | 'WEEKEND'

export type PlaygroundParticipationType = 'POLL' | 'EMOTION' | 'TEXT' | 'WORD_INPUT'

export interface PlaygroundOption {
  id: string
  emoji?: string
  label: string
}

export interface PlaygroundContent {
  id: string
  category: PlaygroundCategory
  title: string
  prompt: string
  participation_type: PlaygroundParticipationType
  options: PlaygroundOption[]
  starting_word: string | null
  allowed_days_of_week: string[]
  safety_level: string
  active: boolean
  allow_change?: boolean
  played_date: string
}

export interface PlaygroundResponse {
  id: string
  content_id: string
  user_id: string
  option_id: string | null
  response_text: string | null
  created_at: string
  updated_at: string
  profiles?: { name: string } | null
}

export interface CreateReadingInput {
  projectId: string
  bookId: string
  startChapter: number
  endChapter: number
  reflection: string
  visibility: Visibility
  imageUrl?: string | null
  readingDate?: string
  targetStartChapter?: number | null
  targetEndChapter?: number | null
}
