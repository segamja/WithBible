-- 5-role system: MASTER / SUB_MASTER / STAFF / TEACHER / STUDENT
-- Migrates ADMIN → MASTER, TEACHER+null class → STAFF
-- Announcements: kind notice|cheer

-- ---------------------------------------------------------------------------
-- 1) Rebuild enum without ADMIN (Postgres forbids using ADD VALUE in the
--    same transaction — Supabase SQL Editor wraps the whole script).
-- ---------------------------------------------------------------------------

-- Policies still call these during the type swap — keep them text-safe
create or replace function public.wb_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wb_profiles
    where id = auth.uid() and role::text in ('MASTER', 'ADMIN')
  );
$$;

create or replace function public.wb_is_teacher_of(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wb_profiles p
    left join public.wb_classes c on c.id = p_class_id
    where p.id = auth.uid()
      and p_class_id is not null
      and (
        p.role::text in ('MASTER', 'ADMIN')
        or c.teacher_id = auth.uid()
        or (p.role::text = 'TEACHER' and p.class_id = p_class_id)
      )
  );
$$;

drop trigger if exists wb_protect_profile_columns on public.wb_profiles;
drop trigger if exists wb_on_auth_user_created on auth.users;

drop function if exists public.wb_current_role();
drop function if exists public.wb_admin_list_users();
drop function if exists public.wb_complete_join_onboarding(text, text);
drop function if exists public.wb_complete_join_onboarding(text);
drop function if exists public.wb_handle_new_user();
drop function if exists public.wb_protect_profile_columns();
drop function if exists public.wb_admin_delete_user(uuid);
drop function if exists public.wb_upsert_staff_code(text, text);

alter table public.wb_profiles alter column role drop default;
alter table public.wb_profiles
  alter column role type text using role::text;

update public.wb_profiles
set role = 'MASTER'
where role = 'ADMIN';

update public.wb_profiles
set role = 'STAFF'
where role = 'TEACHER'
  and class_id is null;

drop type public.wb_user_role cascade;

create type public.wb_user_role as enum (
  'MASTER',
  'SUB_MASTER',
  'STAFF',
  'TEACHER',
  'STUDENT'
);

alter table public.wb_profiles
  alter column role type public.wb_user_role
  using role::public.wb_user_role;

alter table public.wb_profiles
  alter column role set default 'STUDENT'::public.wb_user_role;

-- ---------------------------------------------------------------------------
-- 2) Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.wb_current_role()
returns public.wb_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.wb_profiles where id = auth.uid();
$$;

create or replace function public.wb_is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wb_profiles
    where id = auth.uid() and role = 'MASTER'
  );
$$;

create or replace function public.wb_is_sub_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wb_profiles
    where id = auth.uid() and role = 'SUB_MASTER'
  );
$$;

create or replace function public.wb_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wb_profiles
    where id = auth.uid() and role = 'STAFF'
  );
$$;

-- MASTER or 강도사님 (ops / 전체 현황·공지)
create or replace function public.wb_is_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.wb_is_master() or public.wb_is_sub_master();
$$;

-- Legacy alias: dangerous ops → MASTER only
create or replace function public.wb_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.wb_is_master();
$$;

create or replace function public.wb_is_teacher_of(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.wb_profiles p
    left join public.wb_classes c on c.id = p_class_id
    where p.id = auth.uid()
      and p_class_id is not null
      and (
        p.role = 'MASTER'
        or c.teacher_id = auth.uid()
        or (p.role = 'TEACHER' and p.class_id = p_class_id)
      )
  );
$$;

comment on function public.wb_is_teacher_of(uuid) is
  'MASTER, 반 teacher_id, 또는 해당 반 TEACHER(profile.class_id)';

create or replace function public.wb_protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wb_is_master() then
    new.role := old.role;
    if public.wb_current_role() = 'STUDENT' then
      new.class_id := old.class_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger wb_protect_profile_columns
before update on public.wb_profiles
for each row execute function public.wb_protect_profile_columns();

-- ---------------------------------------------------------------------------
-- 3) Announcements kind + staff code target_role
-- ---------------------------------------------------------------------------
alter table public.wb_announcements
  add column if not exists kind text not null default 'cheer';

update public.wb_announcements
set kind = case when class_id is null then 'notice' else 'cheer' end
where kind is null or kind not in ('notice', 'cheer');

alter table public.wb_announcements
  drop constraint if exists wb_announcements_kind_chk;

alter table public.wb_announcements
  add constraint wb_announcements_kind_chk
  check (kind in ('notice', 'cheer'));

create index if not exists wb_announcements_kind_idx
  on public.wb_announcements (project_id, kind, created_at desc);

alter table public.wb_staff_codes
  add column if not exists target_role public.wb_user_role not null default 'STAFF';

update public.wb_staff_codes
set target_role = 'STAFF'
where target_role is distinct from 'STAFF'
  and target_role is distinct from 'SUB_MASTER';

alter table public.wb_staff_codes
  drop constraint if exists wb_staff_codes_target_role_chk;

alter table public.wb_staff_codes
  add constraint wb_staff_codes_target_role_chk
  check (target_role in ('STAFF', 'SUB_MASTER'));

-- ---------------------------------------------------------------------------
-- 4) RLS policy updates
-- ---------------------------------------------------------------------------
drop policy if exists "wb_classes_select" on public.wb_classes;
create policy "wb_classes_select"
on public.wb_classes for select
to authenticated
using (
  public.wb_is_ops()
  or teacher_id = auth.uid()
  or id = public.wb_current_class_id()
);

drop policy if exists "wb_classes_admin_write" on public.wb_classes;
create policy "wb_classes_admin_write"
on public.wb_classes for insert
to authenticated
with check (public.wb_is_master());

drop policy if exists "wb_classes_admin_update" on public.wb_classes;
create policy "wb_classes_admin_update"
on public.wb_classes for update
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_classes_admin_delete" on public.wb_classes;
create policy "wb_classes_admin_delete"
on public.wb_classes for delete
to authenticated
using (public.wb_is_master());

drop policy if exists "wb_projects_admin_write" on public.wb_projects;
create policy "wb_projects_admin_write"
on public.wb_projects for all
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_project_classes_admin_write" on public.wb_project_classes;
create policy "wb_project_classes_admin_write"
on public.wb_project_classes for all
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_project_targets_admin_write" on public.wb_project_targets;
create policy "wb_project_targets_admin_write"
on public.wb_project_targets for all
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_bible_books_admin_write" on public.wb_bible_books;
create policy "wb_bible_books_admin_write"
on public.wb_bible_books for all
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_profiles_update_own" on public.wb_profiles;
create policy "wb_profiles_update_own"
on public.wb_profiles for update
to authenticated
using (id = auth.uid() or public.wb_is_master())
with check (id = auth.uid() or public.wb_is_master());

drop policy if exists "wb_profiles_admin_insert" on public.wb_profiles;
create policy "wb_profiles_admin_insert"
on public.wb_profiles for insert
to authenticated
with check (public.wb_is_master() or id = auth.uid());

drop policy if exists "wb_reading_logs_select" on public.wb_reading_logs;
create policy "wb_reading_logs_select"
on public.wb_reading_logs for select
to authenticated
using (
  public.wb_is_ops()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.wb_profiles author
    where author.id = wb_reading_logs.user_id
      and (
        author.class_id = public.wb_current_class_id()
        or public.wb_is_teacher_of(author.class_id)
        or wb_reading_logs.visibility = 'public'
      )
  )
);

drop policy if exists "wb_staff_codes_admin_all" on public.wb_staff_codes;
create policy "wb_staff_codes_admin_all"
on public.wb_staff_codes for all
to authenticated
using (public.wb_is_master())
with check (public.wb_is_master());

drop policy if exists "wb_announcements_select" on public.wb_announcements;
create policy "wb_announcements_select"
on public.wb_announcements for select
to authenticated
using (
  public.wb_is_ops()
  or kind = 'notice'
  or (kind = 'cheer' and class_id is null)
  or (kind = 'cheer' and class_id = public.wb_current_class_id())
  or (kind = 'cheer' and public.wb_is_teacher_of(class_id))
);

drop policy if exists "wb_announcements_insert" on public.wb_announcements;
create policy "wb_announcements_insert"
on public.wb_announcements for insert
to authenticated
with check (
  author_id = auth.uid()
  and (
    (
      kind = 'notice'
      and class_id is null
      and public.wb_is_ops()
    )
    or (
      kind = 'cheer'
      and class_id is null
      and (public.wb_is_ops() or public.wb_is_staff())
    )
    or (
      kind = 'cheer'
      and class_id is not null
      and public.wb_current_role() = 'TEACHER'
      and public.wb_is_teacher_of(class_id)
    )
  )
);

drop policy if exists "wb_announcements_update" on public.wb_announcements;
create policy "wb_announcements_update"
on public.wb_announcements for update
to authenticated
using (
  public.wb_is_master()
  or author_id = auth.uid()
  or (
    public.wb_is_ops()
    and (kind = 'notice' or (kind = 'cheer' and class_id is null))
  )
)
with check (
  public.wb_is_master()
  or author_id = auth.uid()
  or (
    public.wb_is_ops()
    and (kind = 'notice' or (kind = 'cheer' and class_id is null))
  )
);

drop policy if exists "wb_announcements_delete" on public.wb_announcements;
create policy "wb_announcements_delete"
on public.wb_announcements for delete
to authenticated
using (
  public.wb_is_master()
  or author_id = auth.uid()
  or (
    public.wb_is_ops()
    and (kind = 'notice' or (kind = 'cheer' and class_id is null))
  )
);

-- ---------------------------------------------------------------------------
-- 5) Join onboarding + signup trigger
-- ---------------------------------------------------------------------------
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
    else
      raise exception 'JOIN_CODE_NOT_FOUND';
    end if;
  end if;

  -- Staff / 강도사 코드는 반에 묶지 않음 (STAFF or SUB_MASTER)
  if v_has_staff then
    v_kind := 'staff';
    v_role := coalesce(v_staff.target_role, 'STAFF'::public.wb_user_role);
    if v_role not in ('STAFF', 'SUB_MASTER') then
      v_role := 'STAFF';
    end if;
    v_display := v_staff.label::text;
    v_class_id := null;
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
    if v_profile.role in ('MASTER', 'SUB_MASTER') then
      raise exception 'ALREADY_MASTER';
    end if;

    if v_profile.class_id is not null then
      if v_class_id is null or v_profile.class_id is distinct from v_class_id then
        raise exception 'ALREADY_LINKED';
      end if;
    end if;

    if v_role in ('STAFF', 'SUB_MASTER', 'TEACHER') then
      if v_profile.role in ('STAFF', 'SUB_MASTER', 'TEACHER')
         and v_profile.class_id is not null
         and v_class_id is null then
        raise exception 'ALREADY_STAFF';
      end if;
      update public.wb_profiles
      set role = v_role,
          class_id = v_class_id
      where id = v_uid;
    else
      if v_profile.role is distinct from 'STUDENT' then
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
  v_staff public.wb_staff_codes%rowtype;
begin
  v_app := coalesce(new.raw_user_meta_data->>'app', '');
  if v_app <> 'withbible' then
    return new;
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_staff_code := nullif(trim(coalesce(new.raw_user_meta_data->>'staff_code', '')), '');
  v_class_id := null;

  -- Never create MASTER from client metadata
  if v_staff_code is not null then
    select * into v_staff
    from public.wb_staff_codes s
    where upper(s.code) = upper(v_staff_code) and s.is_active = true
    limit 1;
    if found then
      v_role := coalesce(v_staff.target_role, 'STAFF'::public.wb_user_role);
      if v_role not in ('STAFF', 'SUB_MASTER') then
        v_role := 'STAFF';
      end if;
      v_join_code := null;
      v_class_id := null;
    end if;
  end if;

  if v_join_code is not null then
    if exists (
      select 1 from public.wb_staff_codes s
      where upper(s.code) = upper(v_join_code) and s.is_active = true
    ) then
      select * into v_staff from public.wb_staff_codes s
      where upper(s.code) = upper(v_join_code) and s.is_active = true
      limit 1;
      v_role := coalesce(v_staff.target_role, 'STAFF'::public.wb_user_role);
      if v_role not in ('STAFF', 'SUB_MASTER') then
        v_role := 'STAFF';
      end if;
      v_join_code := null;
      v_class_id := null;
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
      if v_class_id is not null then
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

drop trigger if exists wb_on_auth_user_created on auth.users;
create trigger wb_on_auth_user_created
after insert on auth.users
for each row execute function public.wb_handle_new_user();

-- ---------------------------------------------------------------------------
-- 6) MASTER-only RPCs
-- ---------------------------------------------------------------------------
create or replace function public.wb_list_staff_codes()
returns setof public.wb_staff_codes
language sql
stable
security definer
set search_path = public
as $$
  select * from public.wb_staff_codes
  where public.wb_is_master()
  order by created_at;
$$;

create or replace function public.wb_upsert_staff_code(
  p_code text,
  p_label text default '임원선생님',
  p_target_role text default 'STAFF'
)
returns public.wb_staff_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_role public.wb_user_role;
  v_row public.wb_staff_codes;
begin
  if not public.wb_is_master() then
    raise exception 'master only';
  end if;
  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' then
    raise exception 'JOIN_CODE_REQUIRED';
  end if;
  v_role := case
    when upper(trim(coalesce(p_target_role, 'STAFF'))) = 'SUB_MASTER' then 'SUB_MASTER'::public.wb_user_role
    else 'STAFF'::public.wb_user_role
  end;

  insert into public.wb_staff_codes (code, label, is_active, target_role)
  values (
    v_code,
    coalesce(nullif(trim(p_label), ''), case when v_role = 'SUB_MASTER' then '강도사님' else '임원선생님' end),
    true,
    v_role
  )
  on conflict (code) do update
    set label = excluded.label,
        is_active = true,
        target_role = excluded.target_role
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.wb_list_staff_codes() from public;
revoke all on function public.wb_upsert_staff_code(text, text, text) from public;
grant execute on function public.wb_list_staff_codes() to authenticated;
grant execute on function public.wb_upsert_staff_code(text, text, text) to authenticated;

create or replace function public.wb_admin_reset_project_activity(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wb_is_master() then
    raise exception 'master only';
  end if;

  delete from public.wb_comments
  where reading_log_id in (
    select id from public.wb_reading_logs where project_id = p_project_id
  );

  delete from public.wb_encouragements
  where reading_log_id in (
    select id from public.wb_reading_logs where project_id = p_project_id
  );

  delete from public.wb_reading_logs where project_id = p_project_id;
  delete from public.wb_announcements where project_id = p_project_id;
end;
$$;

create or replace function public.wb_admin_list_users()
returns table (
  id uuid,
  name text,
  email text,
  role public.wb_user_role,
  class_id uuid,
  created_at timestamptz,
  has_email_login boolean,
  reading_log_count bigint,
  is_ghost boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.wb_is_ops() then
    raise exception 'ops only';
  end if;

  return query
  select
    p.id,
    p.name,
    coalesce(nullif(trim(p.email), ''), u.email) as email,
    p.role,
    p.class_id,
    p.created_at,
    exists (
      select 1
      from auth.identities i
      where i.user_id = p.id
        and i.provider = 'email'
    ) as has_email_login,
    (
      select count(*)::bigint
      from public.wb_reading_logs rl
      where rl.user_id = p.id
    ) as reading_log_count,
    (
      p.role = 'STUDENT'
      and p.class_id is null
      and not exists (
        select 1 from public.wb_reading_logs rl where rl.user_id = p.id
      )
    ) as is_ghost
  from public.wb_profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.wb_admin_list_users() from public;
grant execute on function public.wb_admin_list_users() to authenticated;

create or replace function public.wb_admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.wb_user_role;
  v_master_count int;
begin
  if not public.wb_is_master() then
    raise exception 'master only';
  end if;

  if p_user_id is null then
    raise exception 'user id required';
  end if;

  if p_user_id = auth.uid() then
    raise exception '본인 계정은 삭제할 수 없습니다';
  end if;

  select role into v_role from public.wb_profiles where id = p_user_id;
  if v_role is null then
    raise exception '사용자를 찾을 수 없습니다';
  end if;

  if v_role = 'MASTER' then
    select count(*)::int into v_master_count
    from public.wb_profiles
    where role = 'MASTER';
    if v_master_count <= 1 then
      raise exception '마지막 최고관리자 계정은 삭제할 수 없습니다';
    end if;
  end if;

  update public.wb_classes
  set teacher_id = null
  where teacher_id = p_user_id;

  delete from auth.users where id = p_user_id;

  if not found then
    raise exception '인증 사용자를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.wb_admin_delete_user(uuid) from public;
grant execute on function public.wb_admin_delete_user(uuid) to authenticated;

create or replace function public.wb_admin_reset_password(
  p_user_id uuid,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_pw text;
  v_email text;
  v_providers jsonb;
begin
  if not public.wb_is_master() then
    raise exception 'master only';
  end if;

  if p_user_id is null then
    raise exception 'user id required';
  end if;

  v_pw := coalesce(p_new_password, '');
  if char_length(v_pw) < 6 then
    raise exception '비밀번호는 6자 이상이어야 합니다';
  end if;

  if not exists (select 1 from public.wb_profiles where id = p_user_id) then
    raise exception '사용자를 찾을 수 없습니다';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception '인증 사용자를 찾을 수 없습니다';
  end if;

  select lower(trim(coalesce(nullif(u.email, ''), nullif(p.email, ''))))
  into v_email
  from public.wb_profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_email is null or v_email = '' then
    raise exception '이메일이 없어 비밀번호 로그인을 설정할 수 없습니다';
  end if;

  select coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb)
  into v_providers
  from auth.users u
  where u.id = p_user_id;

  if not (v_providers ? 'email') then
    v_providers := v_providers || '["email"]'::jsonb;
  end if;

  update auth.users
  set
    email = v_email,
    encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('provider', coalesce(raw_app_meta_data->>'provider', 'email'))
      || jsonb_build_object('providers', v_providers),
    updated_at = now()
  where id = p_user_id;

  update public.wb_profiles
  set email = v_email
  where id = p_user_id
    and (email is null or trim(email) = '' or lower(trim(email)) is distinct from v_email);

  if not exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and i.provider = 'email'
  ) then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      p_user_id,
      jsonb_build_object(
        'sub', p_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      p_user_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set
      identity_data =
        coalesce(identity_data, '{}'::jsonb)
        || jsonb_build_object(
          'email', v_email,
          'email_verified', true,
          'sub', p_user_id::text
        ),
      updated_at = now()
    where user_id = p_user_id
      and provider = 'email';
  end if;

  begin
    delete from auth.sessions where user_id = p_user_id;
  exception
    when undefined_table then null;
    when undefined_column then null;
  end;

  begin
    delete from auth.refresh_tokens where user_id = p_user_id;
  exception
    when undefined_table then null;
    when undefined_column then null;
  end;
end;
$$;

revoke all on function public.wb_admin_reset_password(uuid, text) from public;
grant execute on function public.wb_admin_reset_password(uuid, text) to authenticated;
