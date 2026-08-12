# With Bible

고등부 반별 복음서 완독 인증·격려 웹앱 (MVP)

함께 읽고, 함께 나누고, 함께 완주합니다.

## 기술 스택

- React + Vite + TypeScript
- Tailwind CSS
- Zustand + React Router
- Supabase (Auth, PostgreSQL, RLS)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 프로젝트 준비

이 앱은 **시그널수사와 동일한 Supabase 프로젝트**를 사용합니다.  
로컬 `.env`는 시그널수사 `js/config.js`의 URL/anon key와 맞춰 두었습니다.

1. 해당 Supabase 프로젝트 SQL Editor에서 아래 파일을 **순서대로** 실행합니다.  
   (시그널수사 `signal_*`와 구분되도록 With Bible은 모두 `wb_` 접두어를 사용합니다.)
   - (이전에 접두어 없는 테이블을 만들었다면) `supabase/migrations/000_drop_legacy_if_needed.sql`
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/seed.sql`
   - (이미 스키마를 적용한 뒤라면) `supabase/migrations/003_fix_signup_trigger.sql`
   - (사진 인증·좋아요·Realtime) `supabase/migrations/004_photo_like_realtime.sql`
   - (한 줄 댓글·관리자 리셋) `supabase/migrations/005_comments_admin_reset.sql`
2. Authentication → Providers에서 Email 로그인이 켜져 있는지 확인합니다.
3. (선택) Authentication → Providers에서 "Confirm email"을 끄면 로컬 테스트가 편합니다.

### 3. 환경 변수

```bash
cp .env.example .env
```

시그널수사와 같은 값을 넣습니다 (`js/config.js` 참고).

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### 4. 실행

```bash
npm run dev
```

### 5. 첫 관리자 / 교사 설정

1. 앱에서 회원가입합니다. (학생은 반 코드 예: `BIBLE26-2`)
2. Supabase SQL Editor에서 관리자 승격:

```sql
update public.wb_profiles
set role = 'ADMIN'
where email = 'your-admin@email.com';
```

교사 배정 예시:

```sql
update public.wb_profiles
set role = 'TEACHER',
    class_id = '22222222-2222-2222-2222-222222222202'
where email = 'your-teacher@email.com';

update public.wb_classes
set teacher_id = (
  select id from public.wb_profiles where email = 'your-teacher@email.com'
)
where id = '22222222-2222-2222-2222-222222222202';
```
시드에 포함된 반 코드:

| 반 | 가입 코드 |
|---|---|
| 1반 | `BIBLE26-1` |
| 2반 | `BIBLE26-2` |
| 3반 | `BIBLE26-3` |

## 역할별 화면

- **학생:** 홈 / 인증 / 우리반 / 피드 / 마이
- **교사:** 대시보드 / 우리반 / 피드 / 공지 / 마이
- **관리자:** 전체현황 / 프로젝트 / 반관리 / 사용자 / 마이

## 진행률 계산

- **참여율:** 인증 경험이 있는 학생 수 / 전체 학생 수
- **목표 달성률:** 목표 장 범위 중 반이 커버한 **고유 장 수** / 목표 장 수

## 배포 (Vercel)

1. GitHub에 푸시
2. Vercel에서 Import
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
4. Build Command: `npm run build` / Output: `dist`

## 폴더 구조

```text
src/
  components/  UI 컴포넌트
  pages/       학생·교사·관리자 화면
  layouts/     셸·권한 가드
  services/    Supabase 호출 계층
  stores/      Zustand
  types/
  utils/
supabase/
  migrations/
  seed.sql
```
