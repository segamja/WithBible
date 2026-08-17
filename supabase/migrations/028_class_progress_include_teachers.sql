-- 028: class cumulative progress includes homeroom / class teachers.
-- Do not DROP/TRUNCATE. Do not edit 014/023.
-- Members = STUDENT or TEACHER with class_id, plus wb_classes.teacher_id.

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
  v_covered_avg numeric;
  v_rate_avg numeric;
  v_students int;
  v_part int;
  v_today_n int;
  v_week_n int;
  v_use_targets boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select exists (
    select 1 from public.wb_project_targets t where t.project_id = p_project_id
  ) into v_use_targets;

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
    where (
      (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
      or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
    );

    -- Per-member unique covered chapters, then average rate / covered
    if v_students = 0 then
      v_covered_avg := 0;
      v_rate_avg := 0;
    elsif v_use_targets then
      select
        coalesce(avg(s.covered), 0),
        coalesce(avg(
          case
            when v_target = 0 then 0
            else round((s.covered::numeric / v_target) * 100)
          end
        ), 0)
      into v_covered_avg, v_rate_avg
      from (
        select
          p.id as student_id,
          coalesce((
            select count(*)::int
            from (
              select distinct l.book_id, ch
              from public.wb_reading_logs l
              join public.wb_project_targets t
                on t.project_id = l.project_id and t.book_id = l.book_id
              cross join lateral generate_series(
                greatest(l.start_chapter, t.start_chapter),
                least(l.end_chapter, t.end_chapter)
              ) as ch
              where l.project_id = p_project_id
                and l.user_id = p.id
                and l.end_chapter >= t.start_chapter
                and l.start_chapter <= t.end_chapter
            ) x
          ), 0) as covered
        from public.wb_profiles p
        where (
          (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
          or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
        )
      ) s;
    else
      select
        coalesce(avg(s.covered), 0),
        coalesce(avg(
          case
            when v_target = 0 then 0
            else round((s.covered::numeric / v_target) * 100)
          end
        ), 0)
      into v_covered_avg, v_rate_avg
      from (
        select
          p.id as student_id,
          coalesce((
            select count(*)::int
            from (
              select distinct ch
              from public.wb_reading_logs l
              join public.wb_project_classes pc
                on pc.project_id = l.project_id and pc.class_id = r.id
              cross join lateral generate_series(
                greatest(l.start_chapter, pc.target_start_chapter),
                least(l.end_chapter, pc.target_end_chapter)
              ) as ch
              where l.project_id = p_project_id
                and l.user_id = p.id
                and l.end_chapter >= pc.target_start_chapter
                and l.start_chapter <= pc.target_end_chapter
            ) x
          ), 0) as covered
        from public.wb_profiles p
        where (
          (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
          or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
        )
      ) s;
    end if;

    select count(distinct l.user_id)::int into v_part
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and (
        (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
        or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
      );

    select count(distinct l.user_id)::int into v_today_n
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and (
        (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
        or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
      )
      and l.reading_date = v_today;

    select count(distinct l.user_id)::int into v_week_n
    from public.wb_reading_logs l
    join public.wb_profiles p on p.id = l.user_id
    where l.project_id = p_project_id
      and (
        (p.class_id = r.id and p.role in ('STUDENT', 'TEACHER'))
        or p.id = (select c.teacher_id from public.wb_classes c where c.id = r.id)
      )
      and l.reading_date >= v_week;

    class_id := r.id;
    class_name := r.name;
    student_count := v_students;
    participated_count := v_part;
    participation_rate := case when v_students = 0 then 0 else round((v_part::numeric / v_students) * 100)::int end;
    covered_chapters := round(coalesce(v_covered_avg, 0))::int;
    target_chapters := v_target;
    achievement_rate := round(coalesce(v_rate_avg, 0))::int;
    today_checkins := v_today_n;
    week_checkins := v_week_n;
    return next;
  end loop;
end;
$$;

revoke all on function public.wb_get_classes_progress(uuid) from public;
grant execute on function public.wb_get_classes_progress(uuid) to authenticated;
