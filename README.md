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
   - (카카오 온보딩 RPC·가입코드 RLS) `supabase/migrations/006_kakao_onboarding_rpc.sql`
   - (임원 선생님 코드·통합 온보딩) `supabase/migrations/007_staff_codes_and_join_onboarding.sql`
2. Authentication → Providers에서 Email 로그인이 켜져 있는지 확인합니다.
3. (선택) Authentication → Providers에서 "Confirm email"을 끄면 로컬 테스트가 편합니다.
4. (카카오 로그인) 아래 **카카오 / Supabase OAuth 설정**을 완료합니다.

### 3. 환경 변수

```bash
cp .env.example .env
```

시그널수사와 같은 값을 넣습니다 (`js/config.js` 참고).

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_APP_URL=http://localhost:5173
```

프로덕션(Vercel)에서는 `VITE_APP_URL=https://with-bible.vercel.app` 로 설정합니다.

### 4. 실행

```bash
npm run dev
```

### 5. 카카오 / Supabase OAuth 설정 (직접 설정 필요)

코드만으로는 카카오 로그인이 완성되지 않습니다. 아래를 **콘솔에서** 설정하세요.

#### Kakao Developers

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션 생성
2. 플랫폼 / Redirect URI에 Supabase 콜백 등록:  
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. 동의항목 최소화: 닉네임(필수 수준), 프로필 이미지(선택). 이메일은 선택
4. REST API 키 / Client Secret 확인

#### Supabase Dashboard

1. Authentication → Providers → **Kakao** 활성화 후 Client ID/Secret 입력
2. Authentication → URL Configuration → Redirect URLs에 추가:
   - `http://localhost:5173/auth/callback`
   - `https://with-bible.vercel.app/auth/callback`
3. SQL Editor에서 `006_kakao_onboarding_rpc.sql` 실행 (아직 안 했다면)

#### Vercel

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` 저장 후 재배포

### 6. 첫 관리자 / 임원·교사 설정

1. **학생:** 반 코드(예: `BIBLE26-2`)로 가입·카카오 온보딩  
2. **임원 선생님(반 없음):** 임원 코드(시드 기본 `STAFF26`)로 가입 → `TEACHER`, 반 미배정. 인증·피드는 학생과 동일.  
3. **운영자(ADMIN 1명):** 이메일 가입 후 SQL로만 승격 (공개 코드로 ADMIN 부여 안 함)

```sql
update public.wb_profiles
set role = 'ADMIN', class_id = null
where email = 'your-admin@email.com';
```

담임 교사 배정 예시:

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

시드 가입 코드:

| 구분 | 코드 |
|---|---|
| 1반 | `BIBLE26-1` |
| 2반 | `BIBLE26-2` |
| 3반 | `BIBLE26-3` |
| 임원 선생님 | `STAFF26` |

임원 코드는 `/admin/classes`에서 추가·갱신할 수 있습니다. (`007` 마이그레이션 적용 후)

## 역할별 화면

- **학생:** 홈 / 인증 / 우리반 / 피드 / 마이
- **임원 선생님(반 없음):** 홈 / 인증 / 피드 / 공지 / 마이 (반 현황 없음)
- **담임 교사:** 홈(반 현황) / 인증 / 우리반 / 피드 / 마이
- **운영자:** 현황 / 인증 / 피드 / 설정 / 마이 (+ 반·사용자 관리)
## 진행률 계산

- **참여율:** 인증 경험이 있는 학생 수 / 전체 학생 수
- **목표 달성률:** 목표 장 범위 중 반이 커버한 **고유 장 수** / 목표 장 수

## 배포 (Vercel)

1. GitHub에 푸시
2. Vercel에서 Import
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` 설정
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
