-- Feed community: chatter board + playground daily content (KST, one per day).

-- ---------------------------------------------------------------------------
-- 왁자지껄
-- ---------------------------------------------------------------------------
create table if not exists public.wb_chatter_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.wb_profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wb_chatter_posts_created_idx
  on public.wb_chatter_posts (created_at desc);

drop trigger if exists wb_chatter_posts_updated on public.wb_chatter_posts;
create trigger wb_chatter_posts_updated
before update on public.wb_chatter_posts
for each row execute function public.wb_set_updated_at();

create table if not exists public.wb_chatter_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wb_chatter_posts (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists wb_chatter_comments_post_idx
  on public.wb_chatter_comments (post_id, created_at);

create table if not exists public.wb_chatter_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wb_chatter_posts (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  type text not null check (type in ('like', 'love', 'prayer', 'fire', 'cheer')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, type)
);

create index if not exists wb_chatter_reactions_post_idx
  on public.wb_chatter_reactions (post_id);

alter table public.wb_chatter_posts enable row level security;
alter table public.wb_chatter_comments enable row level security;
alter table public.wb_chatter_reactions enable row level security;

drop policy if exists "wb_chatter_posts_select" on public.wb_chatter_posts;
create policy "wb_chatter_posts_select"
on public.wb_chatter_posts for select
to authenticated
using (true);

drop policy if exists "wb_chatter_posts_insert" on public.wb_chatter_posts;
create policy "wb_chatter_posts_insert"
on public.wb_chatter_posts for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "wb_chatter_posts_update" on public.wb_chatter_posts;
create policy "wb_chatter_posts_update"
on public.wb_chatter_posts for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "wb_chatter_posts_delete" on public.wb_chatter_posts;
create policy "wb_chatter_posts_delete"
on public.wb_chatter_posts for delete
to authenticated
using (author_id = auth.uid() or public.wb_is_master());

drop policy if exists "wb_chatter_comments_select" on public.wb_chatter_comments;
create policy "wb_chatter_comments_select"
on public.wb_chatter_comments for select
to authenticated
using (true);

drop policy if exists "wb_chatter_comments_insert" on public.wb_chatter_comments;
create policy "wb_chatter_comments_insert"
on public.wb_chatter_comments for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wb_chatter_comments_update" on public.wb_chatter_comments;
create policy "wb_chatter_comments_update"
on public.wb_chatter_comments for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "wb_chatter_comments_delete" on public.wb_chatter_comments;
create policy "wb_chatter_comments_delete"
on public.wb_chatter_comments for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_master());

drop policy if exists "wb_chatter_reactions_select" on public.wb_chatter_reactions;
create policy "wb_chatter_reactions_select"
on public.wb_chatter_reactions for select
to authenticated
using (true);

drop policy if exists "wb_chatter_reactions_insert" on public.wb_chatter_reactions;
create policy "wb_chatter_reactions_insert"
on public.wb_chatter_reactions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wb_chatter_reactions_delete" on public.wb_chatter_reactions;
create policy "wb_chatter_reactions_delete"
on public.wb_chatter_reactions for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.wb_chatter_posts to authenticated;
grant select, insert, update, delete on public.wb_chatter_comments to authenticated;
grant select, insert, delete on public.wb_chatter_reactions to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.wb_chatter_posts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.wb_chatter_comments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.wb_chatter_reactions;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 놀이터
-- ---------------------------------------------------------------------------
create table if not exists public.wb_playground_contents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'SCHOOL', 'FOOD', 'GAME', 'EMOTION', 'TEXT', 'THANKFUL', 'BIBLE_LIGHT'
    )
  ),
  title text not null,
  prompt text not null,
  participation_type text not null check (
    participation_type in ('POLL', 'EMOTION', 'TEXT', 'WORD_INPUT')
  ),
  options jsonb not null default '[]'::jsonb,
  starting_word text,
  allowed_days_of_week text[] not null default array[
    'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'
  ]::text[],
  safety_level text not null default 'SAFE' check (
    safety_level in ('SAFE', 'REVIEW', 'BLOCK')
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint wb_playground_contents_days_ok check (
    allowed_days_of_week <@ array['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']::text[]
    and cardinality(allowed_days_of_week) > 0
  )
);

create table if not exists public.wb_playground_history (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.wb_playground_contents (id) on delete restrict,
  played_date date not null,
  unique (played_date)
);

create index if not exists wb_playground_history_content_idx
  on public.wb_playground_history (content_id, played_date desc);

create table if not exists public.wb_playground_responses (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.wb_playground_contents (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  option_id text,
  response_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_id, user_id),
  constraint wb_playground_responses_value_ok check (
    (
      option_id is not null
      and char_length(trim(option_id)) between 1 and 40
    )
    or (
      response_text is not null
      and char_length(trim(response_text)) between 1 and 80
    )
  )
);

drop trigger if exists wb_playground_responses_updated on public.wb_playground_responses;
create trigger wb_playground_responses_updated
before update on public.wb_playground_responses
for each row execute function public.wb_set_updated_at();

create index if not exists wb_playground_responses_content_idx
  on public.wb_playground_responses (content_id);

alter table public.wb_playground_contents enable row level security;
alter table public.wb_playground_history enable row level security;
alter table public.wb_playground_responses enable row level security;

drop policy if exists "wb_playground_contents_select" on public.wb_playground_contents;
create policy "wb_playground_contents_select"
on public.wb_playground_contents for select
to authenticated
using (true);

drop policy if exists "wb_playground_history_select" on public.wb_playground_history;
create policy "wb_playground_history_select"
on public.wb_playground_history for select
to authenticated
using (true);

drop policy if exists "wb_playground_responses_select" on public.wb_playground_responses;
create policy "wb_playground_responses_select"
on public.wb_playground_responses for select
to authenticated
using (true);

drop policy if exists "wb_playground_responses_insert" on public.wb_playground_responses;
create policy "wb_playground_responses_insert"
on public.wb_playground_responses for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wb_playground_responses_update" on public.wb_playground_responses;
create policy "wb_playground_responses_update"
on public.wb_playground_responses for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.wb_playground_contents to authenticated;
grant select on public.wb_playground_history to authenticated;
grant select, insert, update on public.wb_playground_responses to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.wb_playground_responses;
exception
  when duplicate_object then null;
end $$;

create or replace function public.wb_get_today_playground()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ts timestamp;
  v_date date;
  v_dow text;
  v_yesterday uuid;
  v_id uuid;
  v_row public.wb_playground_contents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_ts := timezone('Asia/Seoul', now());
  v_date := v_ts::date;
  v_dow := case extract(dow from v_ts)::int
    when 0 then 'SUN'
    when 1 then 'MON'
    when 2 then 'TUE'
    when 3 then 'WED'
    when 4 then 'THU'
    when 5 then 'FRI'
    when 6 then 'SAT'
  end;

  select h.content_id into v_id
  from public.wb_playground_history h
  where h.played_date = v_date;

  if v_id is null then
    select h.content_id into v_yesterday
    from public.wb_playground_history h
    where h.played_date = v_date - 1;

    -- 1) active SAFE weekday match, exclude last 30 days
    select c.id into v_id
    from public.wb_playground_contents c
    where c.active
      and c.safety_level = 'SAFE'
      and v_dow = any (c.allowed_days_of_week)
      and not exists (
        select 1
        from public.wb_playground_history h
        where h.content_id = c.id
          and h.played_date >= v_date - 30
          and h.played_date < v_date
      )
    order by md5(v_date::text || c.id::text), c.id
    limit 1;

    -- 2) reuse oldest, not yesterday, prefer exclude last 7 days
    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and v_dow = any (c.allowed_days_of_week)
        and (v_yesterday is null or c.id is distinct from v_yesterday)
        and not exists (
          select 1
          from public.wb_playground_history h
          where h.content_id = c.id
            and h.played_date >= v_date - 7
            and h.played_date < v_date
        )
      order by
        coalesce(
          (
            select min(h.played_date)
            from public.wb_playground_history h
            where h.content_id = c.id
          ),
          '1900-01-01'::date
        ),
        md5(v_date::text || c.id::text),
        c.id
      limit 1;
    end if;

    -- 3) any matching weekday except yesterday (oldest first)
    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and v_dow = any (c.allowed_days_of_week)
        and (v_yesterday is null or c.id is distinct from v_yesterday)
      order by
        coalesce(
          (
            select min(h.played_date)
            from public.wb_playground_history h
            where h.content_id = c.id
          ),
          '1900-01-01'::date
        ),
        md5(v_date::text || c.id::text),
        c.id
      limit 1;
    end if;

    -- 4) last resort: any matching weekday
    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and v_dow = any (c.allowed_days_of_week)
      order by md5(v_date::text || c.id::text), c.id
      limit 1;
    end if;

    if v_id is null then
      return null;
    end if;

    insert into public.wb_playground_history (content_id, played_date)
    values (v_id, v_date)
    on conflict (played_date) do nothing;

    select h.content_id into v_id
    from public.wb_playground_history h
    where h.played_date = v_date;
  end if;

  select * into v_row
  from public.wb_playground_contents
  where id = v_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'category', v_row.category,
    'title', v_row.title,
    'prompt', v_row.prompt,
    'participation_type', v_row.participation_type,
    'options', v_row.options,
    'starting_word', v_row.starting_word,
    'allowed_days_of_week', to_jsonb(v_row.allowed_days_of_week),
    'safety_level', v_row.safety_level,
    'active', v_row.active,
    'played_date', v_date
  );
end;
$$;

revoke all on function public.wb_get_today_playground() from public;
grant execute on function public.wb_get_today_playground() to authenticated;

-- ---------------------------------------------------------------------------
-- SAFE seed (36). Re-run safe.
-- ---------------------------------------------------------------------------
insert into public.wb_playground_contents (
  id, category, title, prompt, participation_type, options, starting_word, allowed_days_of_week, safety_level, active
) values
(
  'a0230000-0000-4000-8000-000000000001',
  'SCHOOL',
  '오늘 기대되는 시간',
  '오늘 학교에서 가장 기대되는 시간은?',
  'POLL',
  '[{"id":"class","emoji":"📚","label":"수업"},{"id":"break","emoji":"🏃","label":"쉬는 시간"},{"id":"lunch","emoji":"🍱","label":"급식"},{"id":"home","emoji":"🏠","label":"하교"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000002',
  'SCHOOL',
  '학교에 가면 제일 먼저',
  '오늘 학교에 가면 제일 먼저 하고 싶은 건?',
  'POLL',
  '[{"id":"hello","emoji":"👋","label":"친구 인사"},{"id":"ready","emoji":"✏️","label":"수업 준비"},{"id":"lunch","emoji":"🍚","label":"급식 생각"},{"id":"home","emoji":"🎒","label":"하교 생각"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000003',
  'SCHOOL',
  '오늘 급식 기분',
  '오늘 급식, 기분이 어때요?',
  'POLL',
  '[{"id":"yes","emoji":"😋","label":"완전 기대"},{"id":"ok","emoji":"🙂","label":"보통"},{"id":"hmm","emoji":"🤔","label":"글쎄"},{"id":"home","emoji":"🥪","label":"도시락"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000004',
  'SCHOOL',
  '기억하고 싶은 한 단어',
  '오늘 수업에서 기억하고 싶은 한 단어를 남겨주세요.',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000005',
  'SCHOOL',
  '지금 학교 모드',
  '지금 내 학교 모드는?',
  'EMOTION',
  '[{"id":"focus","emoji":"📖","label":"집중"},{"id":"excited","emoji":"✨","label":"설렘"},{"id":"tired","emoji":"😴","label":"피곤"},{"id":"heal","emoji":"🌿","label":"힐링"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000006',
  'FOOD',
  '지금 먹고 싶은 것',
  '지금 딱 먹고 싶은 건?',
  'POLL',
  '[{"id":"chicken","emoji":"🍗","label":"치킨"},{"id":"pizza","emoji":"🍕","label":"피자"},{"id":"ramen","emoji":"🍜","label":"라면"},{"id":"burger","emoji":"🍔","label":"햄버거"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000007',
  'FOOD',
  '오늘 땡기는 음료',
  '오늘 땡기는 음료는?',
  'POLL',
  '[{"id":"water","emoji":"💧","label":"물"},{"id":"tea","emoji":"🍋","label":"아이스티"},{"id":"milk","emoji":"🧋","label":"밀크티"},{"id":"smoothie","emoji":"🥤","label":"스무디"},{"id":"coffee","emoji":"☕","label":"아메리카노"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000008',
  'FOOD',
  '디저트 고르기',
  '디저트라면 뭐가 좋을까요?',
  'POLL',
  '[{"id":"ice","emoji":"🍦","label":"아이스크림"},{"id":"snack","emoji":"🍪","label":"과자"},{"id":"fruit","emoji":"🍎","label":"과일"},{"id":"cake","emoji":"🍰","label":"케이크"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000009',
  'FOOD',
  '분식 메뉴',
  '분식이면 뭘 고를까요?',
  'POLL',
  '[{"id":"tteok","emoji":"🌶️","label":"떡볶이"},{"id":"gimbap","emoji":"🍙","label":"김밥"},{"id":"sundae","emoji":"🥢","label":"순대"},{"id":"ramen","emoji":"🍜","label":"라면"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000010',
  'FOOD',
  '비 오는 날 음식',
  '비 오는 날 생각나는 음식은?',
  'POLL',
  '[{"id":"kal","emoji":"🍲","label":"칼국수"},{"id":"pancake","emoji":"🥞","label":"부침개"},{"id":"ramen","emoji":"🍜","label":"라면"},{"id":"chicken","emoji":"🍗","label":"치킨"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000011',
  'GAME',
  '끝말잇기 · 하나님',
  '오늘 끝말잇기 시작 단어는 「하나님」이에요. 이어서 한 단어를 남겨주세요.',
  'WORD_INPUT',
  '[]'::jsonb,
  '하나님',
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000012',
  'GAME',
  '끝말잇기 · 사랑',
  '오늘 끝말잇기 시작 단어는 「사랑」이에요. 이어서 한 단어를 남겨주세요.',
  'WORD_INPUT',
  '[]'::jsonb,
  '사랑',
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000013',
  'GAME',
  '끝말잇기 · 교회',
  '오늘 끝말잇기 시작 단어는 「교회」예요. 이어서 한 단어를 남겨주세요.',
  'WORD_INPUT',
  '[]'::jsonb,
  '교회',
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000014',
  'GAME',
  '끝말잇기 · 은혜',
  '오늘 끝말잇기 시작 단어는 「은혜」예요. 이어서 한 단어를 남겨주세요.',
  'WORD_INPUT',
  '[]'::jsonb,
  '은혜',
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000015',
  'GAME',
  '끝말잇기 · 친구',
  '오늘 끝말잇기 시작 단어는 「친구」예요. 이어서 한 단어를 남겨주세요.',
  'WORD_INPUT',
  '[]'::jsonb,
  '친구',
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000016',
  'GAME',
  '마음으로 가위바위보',
  '오늘 마음으로 가위바위보!',
  'POLL',
  '[{"id":"scissors","emoji":"✌️","label":"가위"},{"id":"rock","emoji":"✊","label":"바위"},{"id":"paper","emoji":"🖐️","label":"보"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000017',
  'GAME',
  '초성 힌트',
  '초성 ㄱㄷ · 힌트: 주일마다 가는 곳. 생각나는 단어를 적어주세요. (정답 맞히기 아님)',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000018',
  'EMOTION',
  '오늘 기분은',
  '오늘 기분을 이모지로 고르면?',
  'EMOTION',
  '[{"id":"smile","emoji":"😊","label":"좋아요"},{"id":"calm","emoji":"😌","label":"편안해요"},{"id":"sleepy","emoji":"😴","label":"졸려요"},{"id":"wow","emoji":"🤩","label":"설레요"},{"id":"warm","emoji":"🥹","label":"뭉클해요"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000019',
  'EMOTION',
  '에너지 배터리',
  '지금 내 에너지 배터리는?',
  'POLL',
  '[{"id":"100","emoji":"🔋","label":"100%"},{"id":"70","emoji":"🙂","label":"70%"},{"id":"40","emoji":"😮‍💨","label":"40%"},{"id":"10","emoji":"🪫","label":"10%"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000020',
  'EMOTION',
  '날씨 같은 기분',
  '오늘의 기분을 날씨로 말하면?',
  'POLL',
  '[{"id":"sun","emoji":"☀️","label":"맑음"},{"id":"cloud","emoji":"☁️","label":"구름"},{"id":"rain","emoji":"🌧️","label":"비"},{"id":"rainbow","emoji":"🌈","label":"무지개"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000021',
  'EMOTION',
  '지금 표정',
  '지금 내 표정은?',
  'POLL',
  '[{"id":"hh","emoji":"ㅎㅎ","label":"ㅎㅎ"},{"id":"kk","emoji":"ㅋㅋ","label":"ㅋㅋ"},{"id":"heal","emoji":"🌿","label":"힐링"},{"id":"focus","emoji":"🎯","label":"집중"},{"id":"tired","emoji":"😮‍💨","label":"피곤"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000022',
  'TEXT',
  '오늘의 TMI',
  '오늘의 TMI 한마디!',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000023',
  'TEXT',
  '오늘 웃겼던 일',
  '오늘 웃겼던 일을 한마디로 남겨주세요.',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000024',
  'TEXT',
  '친구에게 한마디',
  '오늘 친구에게 전하고 싶은 한마디는?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000025',
  'TEXT',
  '지금 가고 싶은 곳',
  '지금 떠나고 싶은 곳은 어디인가요?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000026',
  'TEXT',
  '내일의 나에게',
  '내일의 나에게 한마디를 남겨주세요.',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000027',
  'THANKFUL',
  '오늘 감사한 것',
  '오늘 감사한 것 하나만 남겨주세요.',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000028',
  'THANKFUL',
  '나를 웃게 한 것',
  '이번 주 나를 웃게 한 것은?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000029',
  'THANKFUL',
  '마음을 따뜻하게 하는 것',
  '요즘 마음을 따뜻하게 하는 것은?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000030',
  'THANKFUL',
  '감사한 순간',
  '오늘 감사한 순간은 언제였나요?',
  'POLL',
  '[{"id":"morning","emoji":"🌅","label":"아침"},{"id":"lunch","emoji":"🌤️","label":"점심"},{"id":"afternoon","emoji":"🍃","label":"오후"},{"id":"night","emoji":"🌙","label":"밤"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000031',
  'BIBLE_LIGHT',
  '기억에 남은 단어',
  '오늘 말씀에서 기억에 남은 단어 하나를 남겨주세요.',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000032',
  'BIBLE_LIGHT',
  '말씀에서 생각난 것',
  '오늘 읽은 말씀에서 생각난 것은?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000033',
  'BIBLE_LIGHT',
  '마음에 남는 한 단어',
  '오늘 마음에 남는 한 단어는?',
  'POLL',
  '[{"id":"love","emoji":"💛","label":"사랑"},{"id":"grace","emoji":"🌿","label":"은혜"},{"id":"peace","emoji":"🕊️","label":"평안"},{"id":"hope","emoji":"✨","label":"소망"}]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000034',
  'BIBLE_LIGHT',
  '응원 한마디',
  '오늘 누군가에게 전하고 싶은 응원 한마디는?',
  'TEXT',
  '[]'::jsonb,
  null,
  array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000035',
  'GAME',
  '주말에 하고 싶은 것',
  '주말에 하고 싶은 것은?',
  'POLL',
  '[{"id":"rest","emoji":"😴","label":"쉼"},{"id":"sport","emoji":"⚽","label":"운동"},{"id":"friend","emoji":"🤝","label":"친구"},{"id":"hobby","emoji":"🎨","label":"취미"}]'::jsonb,
  null,
  array['SAT','SUN']::text[],
  'SAFE', true
),
(
  'a0230000-0000-4000-8000-000000000036',
  'FOOD',
  '주일 오후의 간식',
  '주일 오후에 떠오르는 건?',
  'POLL',
  '[{"id":"rest","emoji":"☕","label":"천천히 쉬기"},{"id":"walk","emoji":"🚶","label":"산책"},{"id":"snack","emoji":"🍩","label":"간식"},{"id":"friend","emoji":"💬","label":"친구 만나기"}]'::jsonb,
  null,
  array['SAT','SUN']::text[],
  'SAFE', true
)
on conflict (id) do nothing;
