-- 025: 고등부 놀이터 고도화. DROP/TRUNCATE 없음. 끝말잇기는 비활성만.
-- 기존 응답·히스토리는 유지. 오늘 끝말잇기가 잡혀 있으면 같은 날짜 히스토리만 다른 질문으로 UPDATE.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.wb_playground_contents'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.wb_playground_contents drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.wb_playground_contents
  add constraint wb_playground_contents_category_check check (
    category in (
      'SCHOOL', 'FOOD', 'GAME', 'EMOTION', 'TEXT', 'THANKFUL', 'BIBLE_LIGHT',
      'BALANCE', 'EMOJI', 'CHOICE', 'IMAGINE', 'DAILY', 'MUSIC', 'HOBBY',
      'FRIEND', 'CREATIVE', 'FAITH', 'WEEKEND'
    )
  );

alter table public.wb_playground_contents
  add column if not exists allow_change boolean not null default false;

alter table public.wb_playground_contents
  add column if not exists priority integer not null default 0;

alter table public.wb_playground_contents
  add column if not exists cooldown_days integer not null default 30;

-- 끝말잇기·유치한 게임은 삭제하지 않고 기본 로테이션에서만 뺌
update public.wb_playground_contents
set active = false
where participation_type = 'WORD_INPUT'
   or id in (
     'a0230000-0000-4000-8000-000000000016',
     'a0230000-0000-4000-8000-000000000017'
   );

update public.wb_playground_contents
set allow_change = true
where participation_type = 'TEXT';

drop policy if exists "wb_playground_contents_master_write" on public.wb_playground_contents;
create policy "wb_playground_contents_master_write"
on public.wb_playground_contents for insert
to authenticated
with check (public.wb_is_master());

drop policy if exists "wb_playground_contents_master_update" on public.wb_playground_contents;
create policy "wb_playground_contents_master_update"
on public.wb_playground_contents for update
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_playground_responses_update" on public.wb_playground_responses;
create policy "wb_playground_responses_update"
on public.wb_playground_responses for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.wb_playground_contents c
    where c.id = content_id
      and c.allow_change
  )
)
with check (auth.uid() = user_id);

drop policy if exists "wb_playground_responses_master_delete" on public.wb_playground_responses;
create policy "wb_playground_responses_master_delete"
on public.wb_playground_responses for delete
using (public.wb_is_master());

grant insert, update on public.wb_playground_contents to authenticated;
grant delete on public.wb_playground_responses to authenticated;

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
  v_replace boolean := false;
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

  if v_id is not null then
    select * into v_row
    from public.wb_playground_contents
    where id = v_id;
    if not found
       or not v_row.active
       or v_row.participation_type = 'WORD_INPUT'
       or v_row.safety_level is distinct from 'SAFE'
    then
      v_replace := true;
      v_id := null;
    end if;
  end if;

  if v_id is null then
    select h.content_id into v_yesterday
    from public.wb_playground_history h
    where h.played_date = v_date - 1;

    -- 0) Sunday: faith / thanks / weekend first
    if v_dow = 'SUN' then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.participation_type <> 'WORD_INPUT'
        and c.category in ('THANKFUL', 'BIBLE_LIGHT', 'FAITH', 'WEEKEND')
        and v_dow = any (c.allowed_days_of_week)
        and not exists (
          select 1
          from public.wb_playground_history h
          where h.content_id = c.id
            and h.played_date >= v_date - coalesce(c.cooldown_days, 30)
            and h.played_date < v_date
        )
      order by c.priority desc, md5(v_date::text || c.id::text), c.id
      limit 1;

      if v_id is null then
        select c.id into v_id
        from public.wb_playground_contents c
        where c.active
          and c.safety_level = 'SAFE'
          and c.participation_type <> 'WORD_INPUT'
          and c.category in ('THANKFUL', 'BIBLE_LIGHT', 'FAITH', 'WEEKEND')
          and v_dow = any (c.allowed_days_of_week)
          and (v_yesterday is null or c.id is distinct from v_yesterday)
        order by c.priority desc, md5(v_date::text || c.id::text), c.id
        limit 1;
      end if;
    end if;

    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.participation_type <> 'WORD_INPUT'
        and v_dow = any (c.allowed_days_of_week)
        and not exists (
          select 1
          from public.wb_playground_history h
          where h.content_id = c.id
            and h.played_date >= v_date - coalesce(c.cooldown_days, 30)
            and h.played_date < v_date
        )
      order by c.priority desc, md5(v_date::text || c.id::text), c.id
      limit 1;
    end if;

    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.participation_type <> 'WORD_INPUT'
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
          (select min(h.played_date) from public.wb_playground_history h where h.content_id = c.id),
          '1900-01-01'::date
        ),
        c.priority desc,
        md5(v_date::text || c.id::text),
        c.id
      limit 1;
    end if;

    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.participation_type <> 'WORD_INPUT'
        and v_dow = any (c.allowed_days_of_week)
        and (v_yesterday is null or c.id is distinct from v_yesterday)
      order by
        coalesce(
          (select min(h.played_date) from public.wb_playground_history h where h.content_id = c.id),
          '1900-01-01'::date
        ),
        c.priority desc,
        md5(v_date::text || c.id::text),
        c.id
      limit 1;
    end if;

    if v_id is null then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.participation_type <> 'WORD_INPUT'
        and v_dow = any (c.allowed_days_of_week)
      order by md5(v_date::text || c.id::text), c.id
      limit 1;
    end if;

    if v_id is null then
      return null;
    end if;

    if v_replace then
      update public.wb_playground_history
      set content_id = v_id
      where played_date = v_date;
    else
      insert into public.wb_playground_history (content_id, played_date)
      values (v_id, v_date)
      on conflict (played_date) do nothing;
    end if;

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
    'allow_change', v_row.allow_change,
    'played_date', v_date
  );
end;
$$;

revoke all on function public.wb_get_today_playground() from public;
grant execute on function public.wb_get_today_playground() to authenticated;

-- auto seed (76 questions)
insert into public.wb_playground_contents (
  id, category, title, prompt, participation_type, options, starting_word,
  allowed_days_of_week, safety_level, active, allow_change, priority, cooldown_days
) values
('a0250000-0000-4000-8000-000000000001','BALANCE','하나만 고른다면','하나만 선택해야 한다면?','POLL','[{"id":"chicken","emoji":"🍗","label":"치킨 평생 무료"},{"id":"pizza","emoji":"🍕","label":"피자 평생 무료"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000002','BALANCE','시험 끝난 날','시험 끝난 날 하나만 할 수 있다면?','POLL','[{"id":"sleep","emoji":"😴","label":"하루 종일 자기"},{"id":"play","emoji":"🎮","label":"하루 종일 놀기"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000003','BALANCE','계절','하나만 고른다면?','POLL','[{"id":"summer","emoji":"☀️","label":"여름"},{"id":"winter","emoji":"❄️","label":"겨울"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000004','BALANCE','아침 vs 밤','나는 어떤 쪽에 더 가까울까?','POLL','[{"id":"morning","emoji":"🌅","label":"아침형"},{"id":"night","emoji":"🌙","label":"저녁형"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000005','BALANCE','집 vs 카페','쉬고 싶을 때 나는?','POLL','[{"id":"home","emoji":"🏠","label":"집"},{"id":"cafe","emoji":"☕","label":"카페"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000006','BALANCE','산 vs 바다','하루 놀러 간다면?','POLL','[{"id":"mountain","emoji":"⛰️","label":"산"},{"id":"sea","emoji":"🌊","label":"바다"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000007','BALANCE','치킨 vs 떡볶이','지금 하나만?','POLL','[{"id":"chicken","emoji":"🍗","label":"치킨"},{"id":"tteok","emoji":"🌶️","label":"떡볶이"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000008','BALANCE','영상','요즘 더 많이 보는 건?','POLL','[{"id":"youtube","emoji":"📺","label":"유튜브"},{"id":"short","emoji":"📱","label":"숏폼"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000009','BALANCE','비 오는 날','비 오는 날 나는?','POLL','[{"id":"out","emoji":"🚶","label":"그래도 나간다"},{"id":"in","emoji":"🛌","label":"집에서 쉰다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000010','BALANCE','시간여행','하루만 시간여행한다면?','POLL','[{"id":"past","emoji":"⏪","label":"과거"},{"id":"future","emoji":"⏩","label":"미래"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000011','BALANCE','이어폰','이동할 때 나는?','POLL','[{"id":"music","emoji":"🎧","label":"무조건 음악"},{"id":"quiet","emoji":"🤫","label":"아무 것도 안 듣는다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000012','EMOJI','지금 내 기분','지금 내 기분은?','EMOTION','[{"id":"sleep","emoji":"😴","label":"졸려"},{"id":"cool","emoji":"😎","label":"괜찮음"},{"id":"wow","emoji":"🤩","label":"설렘"},{"id":"dizzy","emoji":"😵","label":"정신없음"},{"id":"fire","emoji":"🔥","label":"에너지 있음"},{"id":"meh","emoji":"😐","label":"그냥 그럼"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000013','EMOJI','오늘 나','오늘 나를 표현하는 이모지 하나!','EMOTION','[{"id":"smile","emoji":"😊","label":"무난"},{"id":"flex","emoji":"💪","label":"할 수 있음"},{"id":"tired","emoji":"😮‍💨","label":"지침"},{"id":"fun","emoji":"😆","label":"신남"},{"id":"calm","emoji":"😌","label":"평온"},{"id":"busy","emoji":"🏃","label":"바쁨"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000014','EMOJI','지금 에너지','지금 내 배터리는?','EMOTION','[{"id":"100","emoji":"🔋","label":"100%"},{"id":"70","emoji":"🙂","label":"70%"},{"id":"40","emoji":"😮‍💨","label":"40%"},{"id":"10","emoji":"🪫","label":"10%"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000015','SCHOOL','수업 들을 때','지금 수업 들을 때 나는?','EMOTION','[{"id":"focus","emoji":"🧐","label":"집중"},{"id":"sleep","emoji":"😴","label":"졸림"},{"id":"ok","emoji":"🙂","label":"그럭저럭"},{"id":"clock","emoji":"⏰","label":"종소리 기다림"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000016','WEEKEND','주말 시작','주말 시작! 기분은?','EMOTION','[{"id":"yes","emoji":"🤩","label":"최고"},{"id":"rest","emoji":"😴","label":"일단 잠"},{"id":"plan","emoji":"📝","label":"할 거 있음"},{"id":"meh","emoji":"😐","label":"그냥 주말"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000017','FAITH','예배 전','오늘 예배 오기 전 마음은?','EMOTION','[{"id":"joy","emoji":"🙌","label":"기대됨"},{"id":"calm","emoji":"😌","label":"편함"},{"id":"tired","emoji":"😮‍💨","label":"좀 지침"},{"id":"friend","emoji":"👋","label":"친구 보고 싶음"}]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000018','FOOD','지금 먹고 싶은 것','지금 당장 먹고 싶은 것은?','POLL','[{"id":"chicken","emoji":"🍗","label":"치킨"},{"id":"ramen","emoji":"🍜","label":"라면"},{"id":"pizza","emoji":"🍕","label":"피자"},{"id":"burger","emoji":"🍔","label":"햄버거"},{"id":"dessert","emoji":"🍰","label":"디저트"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000019','FOOD','야식','야식 고른다면?','POLL','[{"id":"chicken","emoji":"🍗","label":"치킨"},{"id":"tteok","emoji":"🌶️","label":"떡볶이"},{"id":"ramen","emoji":"🍜","label":"라면"},{"id":"fruit","emoji":"🍎","label":"과일"},{"id":"skip","emoji":"💧","label":"안 먹음"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000020','DAILY','쉬는 시간이 생긴다면','오늘 하루 쉬는 시간이 생긴다면?','POLL','[{"id":"game","emoji":"🎮","label":"게임"},{"id":"music","emoji":"🎵","label":"음악"},{"id":"nap","emoji":"😴","label":"낮잠"},{"id":"youtube","emoji":"📱","label":"유튜브"},{"id":"walk","emoji":"🚶","label":"산책"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000021','DAILY','시험 끝 후','시험 끝나고 제일 먼저 하고 싶은 것은?','POLL','[{"id":"sleep","emoji":"😴","label":"잠자기"},{"id":"eat","emoji":"🍗","label":"맛있는 거 먹기"},{"id":"game","emoji":"🎮","label":"게임하기"},{"id":"nothing","emoji":"🛌","label":"아무것도 안 하기"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,10,30),
('a0250000-0000-4000-8000-000000000022','DAILY','오늘의 한 끗','지금 딱 하나만 바꿀 수 있다면?','POLL','[{"id":"sleep","emoji":"😴","label":"수면시간"},{"id":"study","emoji":"📚","label":"공부량"},{"id":"money","emoji":"💰","label":"용돈"},{"id":"phone","emoji":"📱","label":"휴대폰"},{"id":"school","emoji":"⏰","label":"등교시간"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000023','MUSIC','지금 듣고 싶은 분위기','지금 듣고 싶은 음악은?','POLL','[{"id":"up","emoji":"🔥","label":"신나는 거"},{"id":"chill","emoji":"🌊","label":"잔잔한 거"},{"id":"ost","emoji":"🎬","label":"OST"},{"id":"worship","emoji":"🙏","label":"찬양"},{"id":"off","emoji":"🔇","label":"아무 것도 안 들음"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000024','HOBBY','주말에 하고 싶은 것','주말에 하고 싶은 것은?','POLL','[{"id":"rest","emoji":"😴","label":"푹 쉬기"},{"id":"sport","emoji":"⚽","label":"운동"},{"id":"friend","emoji":"🤝","label":"친구 만나기"},{"id":"hobby","emoji":"🎨","label":"취미"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000025','FRIEND','친구랑 약속','친구랑 약속이면 나는?','POLL','[{"id":"food","emoji":"🍟","label":"맛집"},{"id":"walk","emoji":"🚶","label":"그냥 산책"},{"id":"home","emoji":"🏠","label":"집에서 놀기"},{"id":"cafe","emoji":"☕","label":"카페"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000026','DAILY','휴대폰으로 제일 많이','휴대폰으로 제일 많이 하는 건?','POLL','[{"id":"sns","emoji":"💬","label":"메시지"},{"id":"video","emoji":"📺","label":"영상"},{"id":"music","emoji":"🎵","label":"음악"},{"id":"game","emoji":"🎮","label":"게임"},{"id":"web","emoji":"🌐","label":"검색"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000027','DAILY','오늘 필요한 것','오늘 나한테 제일 필요한 건?','POLL','[{"id":"sleep","emoji":"😴","label":"잠"},{"id":"food","emoji":"🍚","label":"밥"},{"id":"rest","emoji":"🛋️","label":"쉼"},{"id":"laugh","emoji":"😂","label":"웃음"},{"id":"friend","emoji":"👋","label":"친구"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000028','FOOD','카페 메뉴','카페 가면 나는?','POLL','[{"id":"ice","emoji":"🧊","label":"아이스 음료"},{"id":"hot","emoji":"☕","label":"따뜻한 거"},{"id":"ade","emoji":"🍋","label":"에이드"},{"id":"dessert","emoji":"🧁","label":"디저트부터"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000029','HOBBY','몸 움직이기','잠깐 시간이 나면?','POLL','[{"id":"sport","emoji":"⚽","label":"운동"},{"id":"walk","emoji":"🚶","label":"산책"},{"id":"home","emoji":"🏠","label":"집에서 쉬기"},{"id":"game","emoji":"🎮","label":"게임"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000030','DAILY','버스에서','버스·지하철에서 나는?','POLL','[{"id":"music","emoji":"🎧","label":"음악"},{"id":"sleep","emoji":"😴","label":"졸기"},{"id":"phone","emoji":"📱","label":"폰"},{"id":"window","emoji":"🪟","label":"창밖"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000031','MUSIC','과제할 때','과제할 때 배경음은?','POLL','[{"id":"song","emoji":"🎵","label":"노래"},{"id":"lofi","emoji":"🌙","label":"잔잔한 비트"},{"id":"silence","emoji":"🤫","label":"무음"},{"id":"video","emoji":"📺","label":"영상 틀어놓고"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000032','SCHOOL','하교하고 제일 먼저','하교하고 제일 먼저 하는 건?','POLL','[{"id":"eat","emoji":"🍚","label":"밥"},{"id":"phone","emoji":"📱","label":"폰"},{"id":"sleep","emoji":"😴","label":"눕기"},{"id":"shower","emoji":"🚿","label":"씻기"},{"id":"homework","emoji":"📝","label":"숙제"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000033','SCHOOL','오늘 기대되는 수업','오늘 가장 기대되는 시간은?','POLL','[{"id":"class","emoji":"📚","label":"수업"},{"id":"break","emoji":"🏃","label":"쉬는 시간"},{"id":"lunch","emoji":"🍱","label":"급식"},{"id":"home","emoji":"🏠","label":"하교"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000034','FRIEND','친구 생일이면','친구 생일이면 나는?','POLL','[{"id":"message","emoji":"💬","label":"먼저 연락"},{"id":"gift","emoji":"🎁","label":"작은 선물"},{"id":"food","emoji":"🎂","label":"같이 먹기"},{"id":"together","emoji":"🙌","label":"그냥 같이 있기"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000035','FAITH','오늘 감사','오늘 하나님께 감사한 한 가지는?','POLL','[{"id":"family","emoji":"🙏","label":"가족"},{"id":"friend","emoji":"😊","label":"친구"},{"id":"food","emoji":"🍚","label":"맛있는 음식"},{"id":"weather","emoji":"☀️","label":"좋은 날씨"},{"id":"health","emoji":"❤️","label":"건강"}]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,8,30),
('a0250000-0000-4000-8000-000000000036','FAITH','오늘 교회에서','오늘 교회에서 가장 기대되는 것은?','POLL','[{"id":"praise","emoji":"🎵","label":"찬양"},{"id":"word","emoji":"📖","label":"말씀"},{"id":"friends","emoji":"👥","label":"친구들"},{"id":"snack","emoji":"🍱","label":"맛있는 간식"},{"id":"worship","emoji":"🙌","label":"예배"}]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,8,30),
('a0250000-0000-4000-8000-000000000037','FAITH','주일 오후','주일 오후에 떠오르는 건?','POLL','[{"id":"rest","emoji":"☕","label":"천천히 쉬기"},{"id":"walk","emoji":"🚶","label":"산책"},{"id":"snack","emoji":"🍩","label":"간식"},{"id":"friend","emoji":"💬","label":"친구 만나기"}]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000038','WEEKEND','토요일 아침','토요일 아침 나는?','POLL','[{"id":"late","emoji":"😴","label":"늦잠"},{"id":"brunch","emoji":"🥪","label":"브런치"},{"id":"plan","emoji":"📝","label":"할 일 처리"},{"id":"out","emoji":"🚪","label":"바로 나감"}]'::jsonb,null,array['SAT']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000039','IMAGINE','100만원이 생긴다면','갑자기 100만원이 생긴다면?','POLL','[{"id":"save","emoji":"💰","label":"저축"},{"id":"eat","emoji":"🍗","label":"먹기"},{"id":"shop","emoji":"🛍️","label":"쇼핑"},{"id":"hobby","emoji":"🎮","label":"취미"},{"id":"family","emoji":"🎁","label":"가족에게"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000040','IMAGINE','초능력 하나','하루 동안 초능력 하나를 가질 수 있다면?','POLL','[{"id":"time","emoji":"🕐","label":"시간 멈추기"},{"id":"tele","emoji":"🪽","label":"순간이동"},{"id":"invis","emoji":"👻","label":"투명인간"},{"id":"read","emoji":"🧠","label":"마음 읽기"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000041','IMAGINE','순간이동','지금 순간이동한다면 어디?','POLL','[{"id":"bed","emoji":"🛏️","label":"내 침대"},{"id":"food","emoji":"🍕","label":"맛집"},{"id":"sea","emoji":"🌊","label":"바다"},{"id":"friend","emoji":"🏠","label":"친구 집"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000042','IMAGINE','무인도','무인도에 하나만 가져간다면?','POLL','[{"id":"food","emoji":"🍗","label":"먹을 것"},{"id":"phone","emoji":"📱","label":"휴대폰"},{"id":"friend","emoji":"🙌","label":"친구"},{"id":"book","emoji":"📖","label":"책"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000043','IMAGINE','방학이 일주일','갑자기 방학이 일주일이면?','POLL','[{"id":"sleep","emoji":"😴","label":"잠"},{"id":"trip","emoji":"🧳","label":"놀러가기"},{"id":"friend","emoji":"🤝","label":"친구"},{"id":"hobby","emoji":"🎨","label":"밀린 취미"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000044','IMAGINE','유튜버 하루','하루만 유튜버라면?','POLL','[{"id":"eat","emoji":"🍽️","label":"먹방"},{"id":"vlog","emoji":"📹","label":"브이로그"},{"id":"game","emoji":"🎮","label":"게임"},{"id":"talk","emoji":"🎙️","label":"수다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000045','CHOICE','몇 명일까 늦잠','우리 반에서 오늘 아침에 늦잠 잔 사람은 몇 명일까?','POLL','[{"id":"a","emoji":"①","label":"0~2명"},{"id":"b","emoji":"②","label":"3~5명"},{"id":"c","emoji":"③","label":"6~10명"},{"id":"d","emoji":"④","label":"10명 이상"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000046','CHOICE','몇 명일까 배고픔','지금 배고픈 사람은 몇 명일까?','POLL','[{"id":"a","emoji":"①","label":"거의 없음"},{"id":"b","emoji":"②","label":"조금"},{"id":"c","emoji":"③","label":"반 정도"},{"id":"d","emoji":"④","label":"거의 다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000047','CHOICE','몇 명일까 늦게 잠','어제 12시 넘어서 잔 사람은 몇 명일까?','POLL','[{"id":"a","emoji":"①","label":"소수"},{"id":"b","emoji":"②","label":"꽤 있음"},{"id":"c","emoji":"③","label":"절반"},{"id":"d","emoji":"④","label":"거의 다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000048','CHOICE','몇 명일까 카페인','오늘 커피·카페인 마신 사람은 몇 명일까?','POLL','[{"id":"a","emoji":"①","label":"0~2명"},{"id":"b","emoji":"②","label":"3~5명"},{"id":"c","emoji":"③","label":"꽤 많음"},{"id":"d","emoji":"④","label":"거의 다"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000049','WEEKEND','몇 명일까 늦잠 주말','주말에 10시 넘어서 일어난 사람은 몇 명일까?','POLL','[{"id":"a","emoji":"①","label":"소수"},{"id":"b","emoji":"②","label":"절반"},{"id":"c","emoji":"③","label":"대부분"},{"id":"d","emoji":"④","label":"거의 전부"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000050','TEXT','오늘 필요한 한마디','오늘 나에게 필요한 한마디는?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000051','SCHOOL','오늘 학교에서','오늘 학교에서 가장 기억나는 순간은?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000052','MUSIC','지금 듣고 싶은 노래','지금 듣고 싶은 노래는?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000053','WEEKEND','주말에 할 것','주말에 하고 싶은 걸 한 줄로!','TEXT','[]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000054','FAITH','감사 한 줄','오늘 하나님께 감사한 한 가지는?','TEXT','[]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000055','FRIEND','친구에게','친구에게 지금 보내고 싶은 말은?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000056','DAILY','오늘 날씨 한 단어','오늘을 날씨로 말하면?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000057','DAILY','지금 기분 한 줄','지금 기분을 한 줄로!','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000058','SCHOOL','웃긴 일','오늘 학교에서 가장 웃겼던 일은?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000059','FRIEND','시험 끝나고','시험 끝나고 제일 먼저 하고 싶은 것은?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000060','FOOD','생각나는 음식','지금 가장 생각나는 음식은?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000061','HOBBY','요즘 빠져있는 것','요즘 빠져 있는 건?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000062','DAILY','오늘 나는','오늘을 한 단어로 말하면?','TEXT','[]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000063','FOOD','비 오는 날 음식','비 오는 날 생각나는 음식은?','POLL','[{"id":"kal","emoji":"🍲","label":"칼국수"},{"id":"pancake","emoji":"🥞","label":"부침개"},{"id":"ramen","emoji":"🍜","label":"라면"},{"id":"chicken","emoji":"🍗","label":"치킨"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000064','DAILY','알람','알람은 몇 번에 일어나는 편?','POLL','[{"id":"one","emoji":"1️⃣","label":"한 번에"},{"id":"two","emoji":"2️⃣","label":"두세 번"},{"id":"many","emoji":"🔁","label":"많이"},{"id":"human","emoji":"🗣️","label":"누가 깨워줌"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000065','HOBBY','비 오는 주말','비 오는 주말엔?','POLL','[{"id":"movie","emoji":"🎬","label":"영상"},{"id":"sleep","emoji":"😴","label":"잠"},{"id":"food","emoji":"🍕","label":"배달"},{"id":"game","emoji":"🎮","label":"게임"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000066','FRIEND','단톡','단톡이 울리면 나는?','POLL','[{"id":"now","emoji":"⚡","label":"바로 봄"},{"id":"later","emoji":"🕓","label":"나중에"},{"id":"mute","emoji":"🔇","label":"무음이라 모름"},{"id":"check","emoji":"👀","label":"읽고 생각"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000067','DAILY','물','오늘 물 얼마나 마셨을까?','POLL','[{"id":"little","emoji":"💧","label":"거의 안 마심"},{"id":"some","emoji":"🥤","label":"조금"},{"id":"ok","emoji":"✅","label":"괜찮음"},{"id":"lot","emoji":"🌊","label":"많이"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000068','CREATIVE','색깔로 오늘','오늘을 색깔로 고르면?','POLL','[{"id":"yellow","emoji":"💛","label":"노랑"},{"id":"blue","emoji":"💙","label":"파랑"},{"id":"green","emoji":"💚","label":"초록"},{"id":"gray","emoji":"🤍","label":"회색"},{"id":"orange","emoji":"🧡","label":"주황"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000069','FAITH','오늘 마음에 남는 단어','오늘 마음에 남는 한 단어는?','POLL','[{"id":"love","emoji":"💛","label":"사랑"},{"id":"grace","emoji":"🌿","label":"은혜"},{"id":"peace","emoji":"🕊️","label":"평안"},{"id":"hope","emoji":"✨","label":"소망"},{"id":"joy","emoji":"😊","label":"기쁨"}]'::jsonb,null,array['SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000070','SCHOOL','급식 vs 매점','배고프면 나는?','POLL','[{"id":"lunch","emoji":"🍱","label":"급식 기다리기"},{"id":"store","emoji":"🍪","label":"매점"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000071','DAILY','숙제 스타일','숙제는 언제 하는 편?','POLL','[{"id":"now","emoji":"⚡","label":"빨리"},{"id":"after","emoji":"🍚","label":"밥 먹고"},{"id":"night","emoji":"🌙","label":"밤에"},{"id":"later","emoji":"😅","label":"미루다 함"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000072','MUSIC','찬양 vs 팝','지금 플레이리스트는?','POLL','[{"id":"worship","emoji":"🙏","label":"찬양"},{"id":"pop","emoji":"🎤","label":"팝"},{"id":"kpop","emoji":"💫","label":"케이팝"},{"id":"mix","emoji":"🎧","label":"섞어서"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000073','IMAGINE','하루 직업','하루만 직업 체험한다면?','POLL','[{"id":"chef","emoji":"👨‍🍳","label":"요리사"},{"id":"creator","emoji":"🎬","label":"크리에이터"},{"id":"athlete","emoji":"🏅","label":"선수"},{"id":"travel","emoji":"✈️","label":"여행 가이드"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000074','WEEKEND','저녁 약속','주말 저녁이면?','POLL','[{"id":"home","emoji":"🏠","label":"집"},{"id":"friend","emoji":"🤝","label":"친구"},{"id":"church","emoji":"⛪","label":"교회 모임"},{"id":"hobby","emoji":"🎮","label":"혼자 취미"}]'::jsonb,null,array['SAT','SUN']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000075','CHOICE','집중이 잘 되는 곳','공부가 제일 잘 되는 곳은?','POLL','[{"id":"home","emoji":"🏠","label":"집"},{"id":"cafe","emoji":"☕","label":"카페"},{"id":"library","emoji":"📚","label":"도서관"},{"id":"school","emoji":"🏫","label":"학교"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI']::text[],'SAFE',true,false,0,30),
('a0250000-0000-4000-8000-000000000076','DAILY','간식 타임','간식은 언제?','POLL','[{"id":"after","emoji":"🕓","label":"오후"},{"id":"night","emoji":"🌙","label":"밤"},{"id":"anytime","emoji":"🍿","label":"생각날 때"},{"id":"no","emoji":"🚫","label":"잘 안 먹음"}]'::jsonb,null,array['MON','TUE','WED','THU','FRI','SAT','SUN']::text[],'SAFE',true,false,0,30)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  prompt = excluded.prompt,
  participation_type = excluded.participation_type,
  options = excluded.options,
  allowed_days_of_week = excluded.allowed_days_of_week,
  safety_level = excluded.safety_level,
  active = excluded.active,
  allow_change = excluded.allow_change,
  priority = excluded.priority,
  cooldown_days = excluded.cooldown_days;

update public.wb_playground_contents
set allow_change = true
where participation_type = 'TEXT';
