-- Teacher + class join in one step: staff code + class code → TEACHER with class_id
-- Keeps: staff-only → TEACHER; class-only → STUDENT
-- Admin manual assign on /admin unchanged.

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
  v_class_code text;
  v_staff_code text;
  v_staff public.wb_staff_codes%rowtype;
  v_has_staff boolean := false;
  v_class_id uuid;
  v_class_name text;
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

  v_class_code := upper(trim(coalesce(p_join_code, '')));
  v_staff_code := upper(trim(coalesce(p_staff_code, '')));

  -- Backward compat: single field that is a staff code
  if v_staff_code = '' and v_class_code <> '' and exists (
    select 1 from public.wb_staff_codes s
    where upper(s.code) = v_class_code
  ) then
    v_staff_code := v_class_code;
    v_class_code := '';
  end if;

  if v_class_code = '' and v_staff_code = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

  if v_staff_code <> '' then
    select * into v_staff
    from public.wb_staff_codes s
    where upper(s.code) = v_staff_code
    limit 1;

    if not found then
      raise exception 'STAFF_CODE_NOT_FOUND';
    end if;
    if not v_staff.is_active then
      raise exception 'JOIN_CODE_INACTIVE';
    end if;
    v_has_staff := true;
  end if;

  if v_class_code <> '' then
    select c.id, c.name into v_class_id, v_class_name
    from public.wb_classes c
    where upper(c.join_code) = v_class_code
    limit 1;

    if v_class_id is null then
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;

    if not exists (
      select 1 from public.wb_classes c
      where c.id = v_class_id and c.is_active = true
    ) then
      raise exception 'JOIN_CODE_INACTIVE';
    end if;
  end if;

  select * into v_profile from public.wb_profiles where id = v_uid;

  if v_has_staff and v_class_id is not null then
    v_kind := 'teacher_class';
    v_role := 'TEACHER';
    v_display := v_class_name;
  elsif v_has_staff then
    v_kind := 'staff';
    v_role := 'TEACHER';
    v_display := v_staff.label;
  else
    v_kind := 'class';
    v_role := 'STUDENT';
    v_display := v_class_name;
  end if;

  if found then
    if v_profile.role = 'ADMIN' then
      raise exception 'ALREADY_ADMIN';
    end if;

    -- Already linked to a (different) class
    if v_profile.class_id is not null then
      if v_class_id is null or v_profile.class_id is distinct from v_class_id then
        raise exception 'ALREADY_LINKED';
      end if;
    end if;

    if v_has_staff then
      if v_profile.role = 'TEACHER' and v_profile.class_id is not null and v_class_id is null then
        raise exception 'ALREADY_STAFF';
      end if;
      update public.wb_profiles
      set role = 'TEACHER',
          class_id = coalesce(v_class_id, v_profile.class_id)
      where id = v_uid;
    else
      -- class only → student path
      if v_profile.role is distinct from 'STUDENT' and v_profile.role is distinct from 'TEACHER' then
        raise exception 'NOT_STUDENT';
      end if;
      -- TEACHER without class can attach a class without staff code again
      if v_profile.role = 'TEACHER' then
        update public.wb_profiles
        set class_id = v_class_id
        where id = v_uid;
        v_kind := 'teacher_class';
        v_role := 'TEACHER';
      else
        if v_profile.role is distinct from 'STUDENT' then
          raise exception 'NOT_STUDENT';
        end if;
        update public.wb_profiles
        set class_id = v_class_id
        where id = v_uid;
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

  -- Homeroom: set class.teacher_id when teacher joins with both codes
  if v_has_staff and v_class_id is not null then
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

-- Student-only wrapper unchanged in spirit
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
  if v_code <> '' and exists (
    select 1 from public.wb_staff_codes s where upper(s.code) = v_code
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

-- Signup trigger: optional staff_code + join_code → TEACHER with class
create or replace function public.wb_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role public.wb_user_role;
  v_join_code text;
  v_staff_code text;
  v_class_id uuid;
  v_app text;
  v_role_raw text;
  v_has_staff boolean := false;
begin
  v_app := coalesce(new.raw_user_meta_data->>'app', '');
  if v_app <> 'withbible' then
    return new;
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_role_raw := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  begin
    v_role := coalesce(v_role_raw::public.wb_user_role, 'STUDENT');
  exception when others then
    v_role := 'STUDENT';
  end;

  if v_role = 'ADMIN' then
    v_role := 'STUDENT';
  end if;

  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_staff_code := nullif(trim(coalesce(new.raw_user_meta_data->>'staff_code', '')), '');
  v_class_id := null;

  -- Single join_code that is actually a staff code
  if v_staff_code is null and v_join_code is not null and exists (
    select 1 from public.wb_staff_codes s
    where upper(s.code) = upper(v_join_code) and s.is_active = true
  ) then
    v_staff_code := v_join_code;
    v_join_code := null;
  end if;

  if v_staff_code is not null and exists (
    select 1 from public.wb_staff_codes s
    where upper(s.code) = upper(v_staff_code) and s.is_active = true
  ) then
    v_has_staff := true;
    v_role := 'TEACHER';
  end if;

  if v_join_code is not null then
    select id into v_class_id
    from public.wb_classes
    where upper(join_code) = upper(v_join_code)
      and is_active = true
    limit 1;
    if v_class_id is not null and not v_has_staff then
      v_role := 'STUDENT';
    end if;
  end if;

  if v_has_staff and v_class_id is null then
    v_role := 'TEACHER';
  end if;

  insert into public.wb_profiles (id, name, email, role, class_id)
  values (new.id, v_name, new.email, v_role, v_class_id)
  on conflict (id) do nothing;

  if v_has_staff and v_class_id is not null then
    update public.wb_classes
    set teacher_id = new.id
    where id = v_class_id
      and (teacher_id is null or teacher_id = new.id);
  end if;

  return new;
end;
$$;
