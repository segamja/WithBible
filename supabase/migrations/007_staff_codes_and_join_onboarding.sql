-- Staff (임원 선생님) join codes + unified onboarding RPC
-- ADMIN is never granted via public code (promote in SQL / admin UI only).

create table if not exists public.wb_staff_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null default '임원 선생님',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.wb_staff_codes enable row level security;

drop policy if exists "wb_staff_codes_admin_all" on public.wb_staff_codes;
create policy "wb_staff_codes_admin_all"
on public.wb_staff_codes for all
to authenticated
using (public.wb_is_admin())
with check (public.wb_is_admin());

insert into public.wb_staff_codes (code, label)
values ('STAFF26', '임원 선생님')
on conflict (code) do nothing;

-- Helper: pull display fields from auth.users
create or replace function public.wb_auth_user_display(p_uid uuid)
returns table (display_name text, email text, profile_image text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id = p_uid;
  if not found then
    return;
  end if;

  return query select
    coalesce(
      nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(v_user.raw_user_meta_data->'kakao_account'->>'nickname'), ''),
      split_part(coalesce(v_user.email, 'friend'), '@', 1),
      '친구'
    ),
    coalesce(v_user.email, ''),
    coalesce(
      nullif(trim(v_user.raw_user_meta_data->>'avatar_url'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'picture'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'profile_image'), ''),
      null
    );
end;
$$;

-- Unified join: staff code → TEACHER (no class) | class code → STUDENT + class
create or replace function public.wb_complete_join_onboarding(p_join_code text)
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
  v_code text;
  v_staff public.wb_staff_codes%rowtype;
  v_class_id uuid;
  v_class_name text;
  v_profile public.wb_profiles%rowtype;
  v_name text;
  v_email text;
  v_image text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_code := upper(trim(coalesce(p_join_code, '')));
  if v_code = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

  select * into v_staff
  from public.wb_staff_codes s
  where upper(s.code) = v_code
  limit 1;

  if found then
    if not v_staff.is_active then
      raise exception 'JOIN_CODE_INACTIVE';
    end if;

    select * into v_profile from public.wb_profiles where id = v_uid;

    if found then
      if v_profile.role = 'ADMIN' then
        raise exception 'ALREADY_ADMIN';
      end if;
      if v_profile.role = 'TEACHER' then
        raise exception 'ALREADY_STAFF';
      end if;
      if v_profile.class_id is not null then
        raise exception 'ALREADY_LINKED';
      end if;
      -- STUDENT with no class → promote to 임원 TEACHER
      update public.wb_profiles
      set role = 'TEACHER', class_id = null
      where id = v_uid;
    else
      select d.display_name, d.email, d.profile_image
        into v_name, v_email, v_image
      from public.wb_auth_user_display(v_uid) d;

      if v_name is null then
        raise exception 'not authenticated';
      end if;

      insert into public.wb_profiles (id, name, email, profile_image, role, class_id)
      values (v_uid, v_name, v_email, v_image, 'TEACHER', null);
    end if;

    return query select
      'staff'::text,
      'TEACHER'::public.wb_user_role,
      null::uuid,
      v_staff.label;
    return;
  end if;

  -- Class join code → STUDENT
  select c.id, c.name into v_class_id, v_class_name
  from public.wb_classes c
  where upper(c.join_code) = v_code
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

  select * into v_profile from public.wb_profiles where id = v_uid;

  if found then
    if v_profile.class_id is not null then
      raise exception 'ALREADY_LINKED';
    end if;
    if v_profile.role is distinct from 'STUDENT' then
      raise exception 'NOT_STUDENT';
    end if;

    update public.wb_profiles
    set class_id = v_class_id
    where id = v_uid;
  else
    select d.display_name, d.email, d.profile_image
      into v_name, v_email, v_image
    from public.wb_auth_user_display(v_uid) d;

    if v_name is null then
      raise exception 'not authenticated';
    end if;

    insert into public.wb_profiles (id, name, email, profile_image, role, class_id)
    values (v_uid, v_name, v_email, v_image, 'STUDENT', v_class_id);
  end if;

  return query select
    'class'::text,
    'STUDENT'::public.wb_user_role,
    v_class_id,
    v_class_name;
end;
$$;

revoke all on function public.wb_complete_join_onboarding(text) from public;
grant execute on function public.wb_complete_join_onboarding(text) to authenticated;

-- Keep old RPC name for class-only callers (never applies staff codes)
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
    from public.wb_complete_join_onboarding(p_join_code) j
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

-- Signup trigger: staff code → TEACHER; class code → STUDENT + class; blank → STUDENT no class
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
  v_class_id uuid;
  v_app text;
  v_role_raw text;
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

  -- Never create ADMIN from client metadata
  if v_role = 'ADMIN' then
    v_role := 'STUDENT';
  end if;

  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_class_id := null;

  if v_join_code is not null then
    if exists (
      select 1 from public.wb_staff_codes s
      where upper(s.code) = upper(v_join_code) and s.is_active = true
    ) then
      v_role := 'TEACHER';
      v_class_id := null;
    else
      select id into v_class_id
      from public.wb_classes
      where upper(join_code) = upper(v_join_code)
        and is_active = true
      limit 1;
      if v_class_id is not null then
        v_role := 'STUDENT';
      end if;
    end if;
  end if;

  insert into public.wb_profiles (id, name, email, role, class_id)
  values (new.id, v_name, new.email, v_role, v_class_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Admin helpers to manage staff code
create or replace function public.wb_list_staff_codes()
returns setof public.wb_staff_codes
language sql
stable
security definer
set search_path = public
as $$
  select * from public.wb_staff_codes
  where public.wb_is_admin()
  order by created_at;
$$;

create or replace function public.wb_upsert_staff_code(p_code text, p_label text default '임원 선생님')
returns public.wb_staff_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.wb_staff_codes;
begin
  if not public.wb_is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;

  insert into public.wb_staff_codes (code, label, is_active)
  values (v_code, coalesce(nullif(trim(p_label), ''), '임원 선생님'), true)
  on conflict (code) do update
    set label = excluded.label,
        is_active = true
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.wb_list_staff_codes() from public;
revoke all on function public.wb_upsert_staff_code(text, text) from public;
grant execute on function public.wb_list_staff_codes() to authenticated;
grant execute on function public.wb_upsert_staff_code(text, text) to authenticated;
