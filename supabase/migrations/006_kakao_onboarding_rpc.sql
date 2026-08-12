-- Kakao onboarding: class is_active, nullable email, join-code RPCs, tighten classes RLS

-- 1) Soft-disable classes without deleting data
alter table public.wb_classes
  add column if not exists is_active boolean not null default true;

-- 2) Kakao users may not share email
alter table public.wb_profiles
  alter column email drop not null;

alter table public.wb_profiles
  alter column email set default '';

update public.wb_profiles set email = '' where email is null;

-- 3) Lookup class by join code (minimal fields; no full class list)
create or replace function public.wb_lookup_class_by_join_code(p_join_code text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_code := upper(trim(coalesce(p_join_code, '')));
  if v_code = '' then
    return;
  end if;

  return query
  select c.id, c.name
  from public.wb_classes c
  where upper(c.join_code) = v_code
    and c.is_active = true
  limit 1;
end;
$$;

revoke all on function public.wb_lookup_class_by_join_code(text) from public;
grant execute on function public.wb_lookup_class_by_join_code(text) to authenticated;

-- 4) Complete student onboarding: create/link profile + class_id via join code
create or replace function public.wb_complete_student_onboarding(p_join_code text)
returns table (class_id uuid, class_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_class_id uuid;
  v_class_name text;
  v_profile public.wb_profiles%rowtype;
  v_user auth.users%rowtype;
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
    select * into v_user from auth.users where id = v_uid;
    if not found then
      raise exception 'not authenticated';
    end if;

    v_name := coalesce(
      nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(v_user.raw_user_meta_data->'kakao_account'->>'nickname'), ''),
      split_part(coalesce(v_user.email, 'friend'), '@', 1),
      '친구'
    );
    v_email := coalesce(v_user.email, '');
    v_image := coalesce(
      nullif(trim(v_user.raw_user_meta_data->>'avatar_url'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'picture'), ''),
      nullif(trim(v_user.raw_user_meta_data->>'profile_image'), ''),
      null
    );

    insert into public.wb_profiles (id, name, email, profile_image, role, class_id)
    values (v_uid, v_name, v_email, v_image, 'STUDENT', v_class_id);
  end if;

  return query select v_class_id, v_class_name;
end;
$$;

revoke all on function public.wb_complete_student_onboarding(text) from public;
grant execute on function public.wb_complete_student_onboarding(text) to authenticated;

-- Allow first-time class link (null → value) for students; still block switching classes
create or replace function public.wb_protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wb_is_admin() then
    new.role := old.role;
    if public.wb_current_role() = 'STUDENT' then
      -- First-time onboarding may set class_id once; switching is blocked
      if old.class_id is not null then
        new.class_id := old.class_id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 5) Tighten classes SELECT: no join_code harvesting for students
drop policy if exists "wb_classes_select" on public.wb_classes;

create policy "wb_classes_select"
on public.wb_classes for select
to authenticated
using (
  public.wb_is_admin()
  or teacher_id = auth.uid()
  or id = public.wb_current_class_id()
);
