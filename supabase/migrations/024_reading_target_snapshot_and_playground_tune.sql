-- 024: snapshot today's official reading goal on logs; playground word-chain seeds + Sunday RPC.
-- Do not DROP / TRUNCATE / mass-delete. Do not edit 023.

alter table public.wb_reading_logs
  add column if not exists target_start_chapter integer;

alter table public.wb_reading_logs
  add column if not exists target_end_chapter integer;

-- Easy starting words only (no DELETE of history/responses).
-- Last syllable is easy to continue: 과/교/식/도/구.
-- Today's already-picked 「하나님」 is the same content row — UPDATE starting_word, do not drop history.
update public.wb_playground_contents
set
  title = '끝말잇기 · 사과',
  prompt = '오늘 끝말잇기 시작 단어는 「사과」예요. 이어서 한 단어를 남겨주세요.',
  starting_word = '사과'
where participation_type = 'WORD_INPUT'
  and (
    id = 'a0230000-0000-4000-8000-000000000011'
    or starting_word in ('하나님', '여름')
  );

update public.wb_playground_contents
set
  title = '끝말잇기 · 학교',
  prompt = '오늘 끝말잇기 시작 단어는 「학교」예요. 이어서 한 단어를 남겨주세요.',
  starting_word = '학교'
where participation_type = 'WORD_INPUT'
  and (
    id = 'a0230000-0000-4000-8000-000000000012'
    or starting_word = '사랑'
  );

update public.wb_playground_contents
set
  title = '끝말잇기 · 간식',
  prompt = '오늘 끝말잇기 시작 단어는 「간식」이에요. 이어서 한 단어를 남겨주세요.',
  starting_word = '간식'
where participation_type = 'WORD_INPUT'
  and (
    id = 'a0230000-0000-4000-8000-000000000013'
    or starting_word = '교회'
  );

update public.wb_playground_contents
set
  title = '끝말잇기 · 포도',
  prompt = '오늘 끝말잇기 시작 단어는 「포도」예요. 이어서 한 단어를 남겨주세요.',
  starting_word = '포도'
where participation_type = 'WORD_INPUT'
  and (
    id = 'a0230000-0000-4000-8000-000000000014'
    or starting_word in ('은혜', '하늘')
  );

update public.wb_playground_contents
set
  title = '끝말잇기 · 친구',
  prompt = '오늘 끝말잇기 시작 단어는 「친구」예요. 이어서 한 단어를 남겨주세요.',
  starting_word = '친구'
where id = 'a0230000-0000-4000-8000-000000000015';

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

    -- 0) Sunday: prefer THANKS / BIBLE_LIGHT before the general weekday pool
    if v_dow = 'SUN' then
      select c.id into v_id
      from public.wb_playground_contents c
      where c.active
        and c.safety_level = 'SAFE'
        and c.category in ('THANKFUL', 'BIBLE_LIGHT')
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

      if v_id is null then
        select c.id into v_id
        from public.wb_playground_contents c
        where c.active
          and c.safety_level = 'SAFE'
          and c.category in ('THANKFUL', 'BIBLE_LIGHT')
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
    end if;

    -- 1) active SAFE weekday match, exclude last 30 days
    if v_id is null then
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
    end if;

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
