-- Fix: "structure of query does not match function result type"
-- Causes: varchar vs text in RETURN QUERY; OUT-param name collisions in RETURNS TABLE.

-- 1) auth.users.email is varchar → cast to text for RETURNS TABLE
create or replace function public.wb_auth_user_display(p_uid uuid)
returns table (display_name text, email text, profile_image text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_name text;
  v_email text;
  v_image text;
begin
  select * into v_user from auth.users where id = p_uid;
  if not found then
    return;
  end if;

  v_name := coalesce(
    nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
    nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(v_user.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(v_user.raw_user_meta_data->'kakao_account'->>'nickname'), ''),
    split_part(coalesce(v_user.email::text, 'friend'), '@', 1),
    '친구'
  );
  v_email := coalesce(v_user.email::text, '');
  v_image := coalesce(
    nullif(trim(v_user.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(v_user.raw_user_meta_data->>'picture'), ''),
    nullif(trim(v_user.raw_user_meta_data->>'profile_image'), ''),
    null
  );

  display_name := v_name;
  email := v_email;
  profile_image := v_image;
  return next;
end;
$$;

-- 2) Ensure teacher_join_code exists (009 may have been skipped)
alter table public.wb_classes
  add column if not exists teacher_join_code text;

update public.wb_classes
set teacher_join_code = 'T-' || upper(join_code)
where teacher_join_code is null
   or trim(teacher_join_code) = '';

create unique index if not exists wb_classes_teacher_join_code_uidx
  on public.wb_classes (upper(teacher_join_code));

alter table public.wb_classes
  alter column teacher_join_code set not null;

-- 3) Recreate join RPC with RETURN NEXT (avoids RETURN QUERY type mismatch)
drop function if exists public.wb_complete_join_onboarding(text);
drop function if exists public.wb_complete_join_onboarding(text, text);

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
  v_profile_found boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_primary := upper(trim(coalesce(p_join_code, '')));
  v_staff_extra := upper(trim(coalesce(p_staff_code, '')));

  if v_primary = '' and v_staff_extra = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

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
    if exists (
      select 1 from public.wb_staff_codes s
      where upper(s.code) = v_primary and s.is_active = true
    ) then
      if not v_has_staff then
        select * into v_staff from public.wb_staff_codes s
        where upper(s.code) = v_primary limit 1;
        v_has_staff := true;
      end if;
      v_primary := '';
    elsif exists (
      select 1 from public.wb_classes c
      where upper(c.teacher_join_code) = v_primary and c.is_active = true
    ) then
      select c.id, c.name::text into v_class_id, v_class_name
      from public.wb_classes c
      where upper(c.teacher_join_code) = v_primary and c.is_active = true
      limit 1;
      v_as_teacher := true;
    elsif exists (
      select 1 from public.wb_classes c
      where upper(c.join_code) = v_primary and c.is_active = true
    ) then
      select c.id, c.name::text into v_class_id, v_class_name
      from public.wb_classes c
      where upper(c.join_code) = v_primary and c.is_active = true
      limit 1;
      if v_has_staff then
        v_as_teacher := true;
      end if;
    else
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;
  end if;

  if v_has_staff and v_class_id is null and not v_as_teacher then
    v_kind := 'staff';
    v_role := 'TEACHER';
    v_display := v_staff.label::text;
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
  v_profile_found := found;

  if v_profile_found then
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

  join_kind := v_kind;
  role := v_role;
  class_id := v_class_id;
  display_name := v_display;
  return next;
end;
$$;

revoke all on function public.wb_complete_join_onboarding(text, text) from public;
grant execute on function public.wb_complete_join_onboarding(text, text) to authenticated;

-- Student-only wrapper
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
  if v_code <> '' and (
    exists (select 1 from public.wb_staff_codes s where upper(s.code) = v_code)
    or exists (select 1 from public.wb_classes c where upper(c.teacher_join_code) = v_code)
  ) then
    raise exception 'JOIN_CODE_NOT_FOUND';
  end if;

  for r in
    select j.class_id as j_class_id, j.display_name as j_display_name, j.join_kind as j_join_kind
    from public.wb_complete_join_onboarding(p_join_code, null) j
  loop
    if r.j_join_kind is distinct from 'class' then
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;
    class_id := r.j_class_id;
    class_name := r.j_display_name::text;
    return next;
  end loop;
end;
$$;
