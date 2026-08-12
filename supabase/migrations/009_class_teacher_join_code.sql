-- Per-class teacher join code (separate from student join_code and 임원 staff codes)

alter table public.wb_classes
  add column if not exists teacher_join_code text;

-- Backfill distinct teacher codes (do not collide with student join_code)
update public.wb_classes
set teacher_join_code = 'T-' || upper(join_code)
where teacher_join_code is null
   or trim(teacher_join_code) = '';

-- Ensure uniqueness
create unique index if not exists wb_classes_teacher_join_code_uidx
  on public.wb_classes (upper(teacher_join_code));

alter table public.wb_classes
  alter column teacher_join_code set not null;

-- Lookup helper: returns which kind of code matched
create or replace function public.wb_lookup_join_code(p_code text)
returns table (
  kind text,
  class_id uuid,
  class_name text,
  staff_label text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_code = '' then
    return;
  end if;

  return query
  select 'staff'::text, null::uuid, null::text, s.label
  from public.wb_staff_codes s
  where upper(s.code) = v_code and s.is_active = true
  limit 1;

  if found then
    return;
  end if;

  return query
  select 'teacher'::text, c.id, c.name, null::text
  from public.wb_classes c
  where upper(c.teacher_join_code) = v_code and c.is_active = true
  limit 1;

  if found then
    return;
  end if;

  return query
  select 'student'::text, c.id, c.name, null::text
  from public.wb_classes c
  where upper(c.join_code) = v_code and c.is_active = true
  limit 1;
end;
$$;

revoke all on function public.wb_lookup_join_code(text) from public;
grant execute on function public.wb_lookup_join_code(text) to authenticated;

drop function if exists public.wb_complete_join_onboarding(text);
drop function if exists public.wb_complete_join_onboarding(text, text);

-- p_join_code: student / teacher / staff code (auto)
-- p_staff_code: optional 임원 code when also linking a student class code
create or replace function public.wb_complete_join_onboarding(
  p_join_code text,
  p_staff_code text default null
)
returns table (
  join_kind text,
  role public.wb_user_role,
  class_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_primary text;
  v_staff_extra text;
  v_staff public.wb_staff_codes%rowtype;
  v_has_staff boolean := false;
  v_class_id uuid;
  v_class_name text;
  v_as_teacher boolean := false;
  v_profile public.wb_profiles%rowtype;
  v_name text;
  v_email text;
  v_image text;
  v_kind text;
  v_role public.wb_user_role;
  v_display text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_primary := upper(trim(coalesce(p_join_code, '')));
  v_staff_extra := upper(trim(coalesce(p_staff_code, '')));

  if v_primary = '' and v_staff_extra = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

  -- Optional explicit 임원 code in second field
  if v_staff_extra <> '' then
    select * into v_staff
    from public.wb_staff_codes s
    where upper(s.code) = v_staff_extra
    limit 1;
    if not found then
      raise exception 'STAFF_CODE_NOT_FOUND';
    end if;
    if not v_staff.is_active then
      raise exception 'JOIN_CODE_INACTIVE';
    end if;
    v_has_staff := true;
  end if;

  if v_primary <> '' then
    -- 1) Primary is 임원 code
    if exists (
      select 1 from public.wb_staff_codes s
      where upper(s.code) = v_primary and s.is_active = true
    ) then
      if not v_has_staff then
        select * into v_staff from public.wb_staff_codes s
        where upper(s.code) = v_primary limit 1;
        v_has_staff := true;
      end if;
      v_primary := ''; -- no class from staff-only primary
    -- 2) Primary is per-class teacher code
    elsif exists (
      select 1 from public.wb_classes c
      where upper(c.teacher_join_code) = v_primary and c.is_active = true
    ) then
      select c.id, c.name into v_class_id, v_class_name
      from public.wb_classes c
      where upper(c.teacher_join_code) = v_primary and c.is_active = true
      limit 1;
      v_as_teacher := true;
    -- 3) Primary is student class code
    elsif exists (
      select 1 from public.wb_classes c
      where upper(c.join_code) = v_primary and c.is_active = true
    ) then
      select c.id, c.name into v_class_id, v_class_name
      from public.wb_classes c
      where upper(c.join_code) = v_primary and c.is_active = true
      limit 1;
      -- student code + 임원 code → teacher of that class
      if v_has_staff then
        v_as_teacher := true;
      end if;
    else
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;
  end if;

  -- Staff only (no class)
  if v_has_staff and v_class_id is null and not v_as_teacher then
    v_kind := 'staff';
    v_role := 'TEACHER';
    v_display := v_staff.label;
  elsif v_as_teacher and v_class_id is not null then
    v_kind := 'teacher_class';
    v_role := 'TEACHER';
    v_display := v_class_name;
  elsif v_class_id is not null then
    v_kind := 'class';
    v_role := 'STUDENT';
    v_display := v_class_name;
  else
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

  select * into v_profile from public.wb_profiles where id = v_uid;

  if found then
    if v_profile.role = 'ADMIN' then
      raise exception 'ALREADY_ADMIN';
    end if;

    if v_profile.class_id is not null then
      if v_class_id is null or v_profile.class_id is distinct from v_class_id then
        raise exception 'ALREADY_LINKED';
      end if;
    end if;

    if v_role = 'TEACHER' then
      if v_profile.role = 'TEACHER'
         and v_profile.class_id is not null
         and v_class_id is null then
        raise exception 'ALREADY_STAFF';
      end if;
      update public.wb_profiles
      set role = 'TEACHER',
          class_id = coalesce(v_class_id, v_profile.class_id)
      where id = v_uid;
    else
      if v_profile.role = 'TEACHER' and v_profile.class_id is null and v_class_id is not null then
        update public.wb_profiles set class_id = v_class_id where id = v_uid;
        v_kind := 'teacher_class';
        v_role := 'TEACHER';
      elsif v_profile.role is distinct from 'STUDENT' then
        raise exception 'NOT_STUDENT';
      else
        update public.wb_profiles set class_id = v_class_id where id = v_uid;
      end if;
    end if;
  else
    select d.display_name, d.email, d.profile_image
      into v_name, v_email, v_image
    from public.wb_auth_user_display(v_uid) d;
    if v_name is null then
      raise exception 'not authenticated';
    end if;
    insert into public.wb_profiles (id, name, email, profile_image, role, class_id)
    values (v_uid, v_name, v_email, v_image, v_role, v_class_id);
  end if;

  if v_role = 'TEACHER' and v_class_id is not null then
    update public.wb_classes
    set teacher_id = v_uid
    where id = v_class_id
      and (teacher_id is null or teacher_id = v_uid);
  end if;

  return query select v_kind, v_role, v_class_id, v_display;
end;
$$;

revoke all on function public.wb_complete_join_onboarding(text, text) from public;
grant execute on function public.wb_complete_join_onboarding(text, text) to authenticated;

create or replace function public.wb_complete_student_onboarding(p_join_code text)
returns table (class_id uuid, class_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_join_code, '')));
  r record;
begin
  -- Reject staff / teacher codes for student-only RPC
  if v_code <> '' and (
    exists (select 1 from public.wb_staff_codes s where upper(s.code) = v_code)
    or exists (select 1 from public.wb_classes c where upper(c.teacher_join_code) = v_code)
  ) then
    raise exception 'JOIN_CODE_NOT_FOUND';
  end if;

  for r in
    select j.class_id, j.display_name, j.join_kind
    from public.wb_complete_join_onboarding(p_join_code, null) j
  loop
    if r.join_kind is distinct from 'class' then
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;
    class_id := r.class_id;
    class_name := r.display_name;
    return next;
  end loop;
end;
$$;

create or replace function public.wb_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role public.wb_user_role := 'STUDENT';
  v_join_code text;
  v_staff_code text;
  v_class_id uuid;
  v_app text;
  v_as_teacher boolean := false;
begin
  v_app := coalesce(new.raw_user_meta_data->>'app', '');
  if v_app <> 'withbible' then
    return new;
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_staff_code := nullif(trim(coalesce(new.raw_user_meta_data->>'staff_code', '')), '');
  v_class_id := null;

  if v_staff_code is not null and exists (
    select 1 from public.wb_staff_codes s
    where upper(s.code) = upper(v_staff_code) and s.is_active = true
  ) then
    v_role := 'TEACHER';
  end if;

  if v_join_code is not null then
    if exists (
      select 1 from public.wb_staff_codes s
      where upper(s.code) = upper(v_join_code) and s.is_active = true
    ) then
      v_role := 'TEACHER';
      v_join_code := null;
    elsif exists (
      select 1 from public.wb_classes c
      where upper(c.teacher_join_code) = upper(v_join_code) and c.is_active = true
    ) then
      select id into v_class_id from public.wb_classes
      where upper(teacher_join_code) = upper(v_join_code) and is_active = true
      limit 1;
      v_role := 'TEACHER';
      v_as_teacher := true;
    else
      select id into v_class_id from public.wb_classes
      where upper(join_code) = upper(v_join_code) and is_active = true
      limit 1;
      if v_class_id is not null and v_role = 'TEACHER' then
        v_as_teacher := true;
      elsif v_class_id is not null then
        v_role := 'STUDENT';
      end if;
    end if;
  end if;

  insert into public.wb_profiles (id, name, email, role, class_id)
  values (new.id, v_name, new.email, v_role, v_class_id)
  on conflict (id) do nothing;

  if v_as_teacher and v_class_id is not null then
    update public.wb_classes
    set teacher_id = new.id
    where id = v_class_id
      and (teacher_id is null or teacher_id = new.id);
  end if;

  return new;
end;
$$;
