export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN'

export type ProjectStatus = 'draft' | 'active' | 'completed'

export type Visibility = 'class' | 'public'

export type EncouragementType =
  | 'fighting'
  | 'together'
  | 'word'
  | 'grace'
  | 'well_done'
  | 'like'

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
  /** 마지막 보상/행사 이름 (포트럭 파티, 시상식 등) */
  party_title: string | null
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
  created_at: string
}

export interface FeedComment {
  id: string
  reading_log_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { name: string } | null
}

export interface ReadingLogWithMeta extends ReadingLog {
  profiles?: Pick<Profile, 'id' | 'name' | 'profile_image' | 'class_id'>
  bible_books?: Pick<BibleBook, 'id' | 'name'>
  classes?: Pick<ClassRow, 'id' | 'name'>
  encouragement_count?: number
  my_encouragement?: EncouragementType | null
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
}
