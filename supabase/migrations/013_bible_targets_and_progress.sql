-- Full Protestant canon (66), sort_order, project multi-book targets, class overview RPC

-- 1) sort_order on books
alter table public.wb_bible_books
  add column if not exists sort_order int;

-- 2) Upsert all 66 books (구약 39 + 신약 27). Existing gospel UUIDs preserved.
insert into public.wb_bible_books (id, name, testament, chapter_count, sort_order) values
  -- OT
  ('11111111-1111-1111-1111-111111111001', '창세기', 'OT', 50, 1),
  ('11111111-1111-1111-1111-111111111002', '출애굽기', 'OT', 40, 2),
  ('11111111-1111-1111-1111-111111111003', '레위기', 'OT', 27, 3),
  ('11111111-1111-1111-1111-111111111004', '민수기', 'OT', 36, 4),
  ('11111111-1111-1111-1111-111111111005', '신명기', 'OT', 34, 5),
  ('11111111-1111-1111-1111-111111111006', '여호수아', 'OT', 24, 6),
  ('11111111-1111-1111-1111-111111111007', '사사기', 'OT', 21, 7),
  ('11111111-1111-1111-1111-111111111008', '룻기', 'OT', 4, 8),
  ('11111111-1111-1111-1111-111111111009', '사무엘상', 'OT', 31, 9),
  ('11111111-1111-1111-1111-111111111010', '사무엘하', 'OT', 24, 10),
  ('11111111-1111-1111-1111-111111111011', '열왕기상', 'OT', 22, 11),
  ('11111111-1111-1111-1111-111111111012', '열왕기하', 'OT', 25, 12),
  ('11111111-1111-1111-1111-111111111013', '역대상', 'OT', 29, 13),
  ('11111111-1111-1111-1111-111111111014', '역대하', 'OT', 36, 14),
  ('11111111-1111-1111-1111-111111111015', '에스라', 'OT', 10, 15),
  ('11111111-1111-1111-1111-111111111016', '느헤미야', 'OT', 13, 16),
  ('11111111-1111-1111-1111-111111111017', '에스더', 'OT', 10, 17),
  ('11111111-1111-1111-1111-111111111018', '욥기', 'OT', 42, 18),
  ('11111111-1111-1111-1111-111111111019', '시편', 'OT', 150, 19),
  ('11111111-1111-1111-1111-111111111020', '잠언', 'OT', 31, 20),
  ('11111111-1111-1111-1111-111111111021', '전도서', 'OT', 12, 21),
  ('11111111-1111-1111-1111-111111111022', '아가', 'OT', 8, 22),
  ('11111111-1111-1111-1111-111111111023', '이사야', 'OT', 66, 23),
  ('11111111-1111-1111-1111-111111111024', '예레미야', 'OT', 52, 24),
  ('11111111-1111-1111-1111-111111111025', '예레미야애가', 'OT', 5, 25),
  ('11111111-1111-1111-1111-111111111026', '에스겔', 'OT', 48, 26),
  ('11111111-1111-1111-1111-111111111027', '다니엘', 'OT', 12, 27),
  ('11111111-1111-1111-1111-111111111028', '호세아', 'OT', 14, 28),
  ('11111111-1111-1111-1111-111111111029', '요엘', 'OT', 3, 29),
  ('11111111-1111-1111-1111-111111111030', '아모스', 'OT', 9, 30),
  ('11111111-1111-1111-1111-111111111031', '오바댜', 'OT', 1, 31),
  ('11111111-1111-1111-1111-111111111032', '요나', 'OT', 4, 32),
  ('11111111-1111-1111-1111-111111111033', '미가', 'OT', 7, 33),
  ('11111111-1111-1111-1111-111111111034', '나훔', 'OT', 3, 34),
  ('11111111-1111-1111-1111-111111111035', '하박국', 'OT', 3, 35),
  ('11111111-1111-1111-1111-111111111036', '스바냐', 'OT', 3, 36),
  ('11111111-1111-1111-1111-111111111037', '학개', 'OT', 2, 37),
  ('11111111-1111-1111-1111-111111111038', '스가랴', 'OT', 14, 38),
  ('11111111-1111-1111-1111-111111111039', '말라기', 'OT', 4, 39),
  -- NT (keep existing gospel ids)
  ('11111111-1111-1111-1111-111111111101', '마태복음', 'NT', 28, 40),
  ('11111111-1111-1111-1111-111111111102', '마가복음', 'NT', 16, 41),
  ('11111111-1111-1111-1111-111111111103', '누가복음', 'NT', 24, 42),
  ('11111111-1111-1111-1111-111111111104', '요한복음', 'NT', 21, 43),
  ('11111111-1111-1111-1111-111111111105', '사도행전', 'NT', 28, 44),
  ('11111111-1111-1111-1111-111111111106', '로마서', 'NT', 16, 45),
  ('11111111-1111-1111-1111-111111111107', '고린도전서', 'NT', 16, 46),
  ('11111111-1111-1111-1111-111111111108', '고린도후서', 'NT', 13, 47),
  ('11111111-1111-1111-1111-111111111109', '갈라디아서', 'NT', 6, 48),
  ('11111111-1111-1111-1111-111111111110', '에베소서', 'NT', 6, 49),
  ('11111111-1111-1111-1111-111111111111', '빌립보서', 'NT', 4, 50),
  ('11111111-1111-1111-1111-111111111112', '골로새서', 'NT', 4, 51),
  ('11111111-1111-1111-1111-111111111113', '데살로니가전서', 'NT', 5, 52),
  ('11111111-1111-1111-1111-111111111114', '데살로니가후서', 'NT', 3, 53),
  ('11111111-1111-1111-1111-111111111115', '디모데전서', 'NT', 6, 54),
  ('11111111-1111-1111-1111-111111111116', '디모데후서', 'NT', 4, 55),
  ('11111111-1111-1111-1111-111111111117', '디도서', 'NT', 3, 56),
  ('11111111-1111-1111-1111-111111111118', '빌레몬서', 'NT', 1, 57),
  ('11111111-1111-1111-1111-111111111119', '히브리서', 'NT', 13, 58),
  ('11111111-1111-1111-1111-111111111120', '야고보서', 'NT', 5, 59),
  ('11111111-1111-1111-1111-111111111121', '베드로전서', 'NT', 5, 60),
  ('11111111-1111-1111-1111-111111111122', '베드로후서', 'NT', 3, 61),
  ('11111111-1111-1111-1111-111111111123', '요한일서', 'NT', 5, 62),
  ('11111111-1111-1111-1111-111111111124', '요한이서', 'NT', 1, 63),
  ('11111111-1111-1111-1111-111111111125', '요한삼서', 'NT', 1, 64),
  ('11111111-1111-1111-1111-111111111126', '유다서', 'NT', 1, 65),
  ('11111111-1111-1111-1111-111111111127', '요한계시록', 'NT', 22, 66)
on conflict (name) do update
set
  testament = excluded.testament,
  chapter_count = excluded.chapter_count,
  sort_order = excluded.sort_order;

update public.wb_bible_books set sort_order = 999 where sort_order is null;

alter table public.wb_bible_books
  alter column sort_order set default 999;

alter table public.wb_bible_books
  alter column sort_order set not null;

create index if not exists wb_bible_books_sort_idx on public.wb_bible_books (sort_order);

-- 3) Project-level multi-book reading targets
create table if not exists public.wb_project_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects (id) on delete cascade,
  book_id uuid not null references public.wb_bible_books (id),
  start_chapter int not null default 1 check (start_chapter > 0),
  end_chapter int not null check (end_chapter >= start_chapter),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, book_id)
);

create index if not exists wb_project_targets_project_idx
  on public.wb_project_targets (project_id, sort_order);

alter table public.wb_project_targets enable row level security;

drop policy if exists "wb_project_targets_select" on public.wb_project_targets;
create policy "wb_project_targets_select"
on public.wb_project_targets for select
to authenticated
using (true);

drop policy if exists "wb_project_targets_admin_write" on public.wb_project_targets;
create policy "wb_project_targets_admin_write"
on public.wb_project_targets for all
to authenticated
using (public.wb_is_admin())
with check (public.wb_is_admin());

-- Backfill from existing per-class targets (distinct books)
insert into public.wb_project_targets (project_id, book_id, start_chapter, end_chapter, sort_order)
select distinct on (pc.project_id, pc.target_book_id)
  pc.project_id,
  pc.target_book_id,
  pc.target_start_chapter,
  pc.target_end_chapter,
  coalesce(b.sort_order, 0)
from public.wb_project_classes pc
join public.wb_bible_books b on b.id = pc.target_book_id
where not exists (
  select 1 from public.wb_project_targets t
  where t.project_id = pc.project_id and t.book_id = pc.target_book_id
)
order by pc.project_id, pc.target_book_id, pc.created_at;

-- Default: if a project has no targets, seed 4 gospels
insert into public.wb_project_targets (project_id, book_id, start_chapter, end_chapter, sort_order)
select p.id, b.id, 1, b.chapter_count, b.sort_order
from public.wb_projects p
cross join public.wb_bible_books b
where b.name in ('마태복음', '마가복음', '누가복음', '요한복음')
  and not exists (
    select 1 from public.wb_project_targets t where t.project_id = p.id
  )
on conflict (project_id, book_id) do nothing;

-- 4) Class overview RPC (aggregates only; bypasses per-log RLS for fair cross-class view)
create or replace function public.wb_get_classes_progress(p_project_id uuid)
returns table (
  class_id uuid,
  class_name text,
  student_count int,
  participated_count int,
  participation_rate int,
  covered_chapters int,
  target_chapters int,
  achievement_rate int,
  today_checkins int,
  week_checkins int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target int := 0;
  v_today date := (timezone('Asia/Seoul', now()))::date;
  v_week date := v_today - 6;
  r record;
  v_covered int;
  v_students int;
  v_part int;
  v_today_n int;
  v_week_n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(sum(t.end_chapter - t.start_chapter + 1), 0)::int
    into v_target
  from public.wb_project_targets t
  where t.project_id = p_project_id;

  -- Fallback: single-book from any project_class
  if v_target = 0 then
    select coalesce(max(pc.target_end_chapter - pc.target_start_chapter + 1), 0)::int
      into v_target
    from public.wb_project_classes pc
    where pc.project_id = p_project_id;
  end if;

  for r in
    select c.id, c.name
    from public.wb_classes c
    where coalesce(c.is_active, true) = true
    order by c.name
  loop
    select count(*)::int into v_students
    from public.wb_profiles p
    where p.class_id = r.id and p.role = 'STUDENT';

    -- Covered unique (book_id, chapter) within targets
    if exists (select 1 from public.wb_project_targets t where t.project_id = p_project_id) then
      select count(*)::int into v_covered
      from (
        select distinct l.book_id, ch
        from public.wb_reading_logs l
        join public.wb_profiles p on p.id = l.user_id
        join public.wb_project_targets t
          on t.project_id = l.project_id and t.book_id = l.book_id
        cross join lateral generate_series(
          greatest(l.start_chapter, t.start_chapter),
          least(l.end_chapter, t.end_chapter)
        ) as ch
        where l.project_id = p_project_id
          and p.class_id = r.id
          and p.role = 'STUDENT'
          and l.end_chapter >= t.start_chapter
          and l.start_chapter <= t.end_chapter
      ) x;
    else
      select count(*)::int into v_covered
      from (
        select distinct ch
        from public.wb_reading_logs l
        join public.wb_profiles p on p.id = l.user_id
        join public.wb_project_classes pc
          on pc.project_id = l.project_id and pc.class_id = p.class_id
        cross join lateral generate_series(
          greatest(l.start_chapter, pc.target_start_chapter),
          least(l.end_chapter, pc.target_end_chapter)
        ) as ch
        where l.project_id = p_project_id
          and p.class_id = r.id
          and p.role = 'STUDENT'
          and l.end_chapter >= pc.target_start_chapter
          and l.start_chapter <= pc.target_end_chapter
      ) x;
    end if;

    select count(distinct l.user_id)::int into v_part
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and p.class_id = r.id
      and p.role = 'STUDENT';

    select count(distinct l.user_id)::int into v_today_n
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and p.class_id = r.id
      and p.role = 'STUDENT'
      and l.reading_date = v_today;

    select count(distinct l.user_id)::int into v_week_n
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and p.class_id = r.id
      and p.role = 'STUDENT'
      and l.reading_date >= v_week;

    class_id := r.id;
    class_name := r.name;
    student_count := v_students;
    participated_count := v_part;
    participation_rate := case when v_students = 0 then 0 else round((v_part::numeric / v_students) * 100)::int end;
    covered_chapters := coalesce(v_covered, 0);
    target_chapters := v_target;
    achievement_rate := case when v_target = 0 then 0 else round((coalesce(v_covered, 0)::numeric / v_target) * 100)::int end;
    today_checkins := v_today_n;
    week_checkins := v_week_n;
    return next;
  end loop;
end;
$$;

revoke all on function public.wb_get_classes_progress(uuid) from public;
grant execute on function public.wb_get_classes_progress(uuid) to authenticated;
