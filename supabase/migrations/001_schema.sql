-- With Bible schema (wb_ prefix — shared Supabase with 시그널수사)
create extension if not exists "pgcrypto";

create type public.wb_user_role as enum ('STUDENT', 'TEACHER', 'ADMIN');
create type public.wb_project_status as enum ('draft', 'active', 'completed');
create type public.wb_visibility as enum ('class', 'public');
create type public.wb_encouragement_type as enum (
  'fighting',
  'together',
  'word',
  'grace',
  'well_done',
  'like'
);

create table public.wb_bible_books (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  testament text not null default 'NT',
  chapter_count int not null check (chapter_count > 0)
);

create table public.wb_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  teacher_id uuid references auth.users (id) on delete set null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.wb_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  profile_image text,
  role public.wb_user_role not null default 'STUDENT',
  class_id uuid references public.wb_classes (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.wb_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status public.wb_project_status not null default 'draft',
  party_date timestamptz,
  party_place text,
  party_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.wb_project_classes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects (id) on delete cascade,
  class_id uuid not null references public.wb_classes (id) on delete cascade,
  target_book_id uuid not null references public.wb_bible_books (id),
  target_start_chapter int not null check (target_start_chapter >= 1),
  target_end_chapter int not null check (target_end_chapter >= target_start_chapter),
  created_at timestamptz not null default now(),
  unique (project_id, class_id)
);

create table public.wb_reading_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  book_id uuid not null references public.wb_bible_books (id),
  start_chapter int not null check (start_chapter >= 1),
  end_chapter int not null check (end_chapter >= start_chapter),
  reflection text not null default '',
  visibility public.wb_visibility not null default 'public',
  reading_date date not null default (timezone('Asia/Seoul', now()))::date,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id, book_id, reading_date, start_chapter, end_chapter)
);

create table public.wb_encouragements (
  id uuid primary key default gen_random_uuid(),
  reading_log_id uuid not null references public.wb_reading_logs (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  type public.wb_encouragement_type not null,
  created_at timestamptz not null default now(),
  unique (reading_log_id, user_id)
);

create table public.wb_announcements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wb_projects (id) on delete cascade,
  class_id uuid references public.wb_classes (id) on delete cascade,
  author_id uuid not null references public.wb_profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index wb_reading_logs_project_user_idx on public.wb_reading_logs (project_id, user_id);
create index wb_reading_logs_date_idx on public.wb_reading_logs (reading_date desc);
create index wb_encouragements_log_idx on public.wb_encouragements (reading_log_id);
create index wb_announcements_class_idx on public.wb_announcements (class_id, created_at desc);

create or replace function public.wb_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wb_reading_logs_updated_at
before update on public.wb_reading_logs
for each row execute function public.wb_set_updated_at();

-- Only create With Bible profile when signup comes from the With Bible app
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

  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_class_id := null;

  if v_join_code is not null then
    select id into v_class_id
    from public.wb_classes
    where upper(join_code) = upper(v_join_code)
    limit 1;
  end if;

  insert into public.wb_profiles (id, name, email, role, class_id)
  values (new.id, v_name, new.email, v_role, v_class_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists wb_on_auth_user_created on auth.users;
create trigger wb_on_auth_user_created
after insert on auth.users
for each row execute function public.wb_handle_new_user();

create or replace function public.wb_current_role()
returns public.wb_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.wb_profiles where id = auth.uid();
$$;

create or replace function public.wb_current_class_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select class_id from public.wb_profiles where id = auth.uid();
$$;

create or replace function public.wb_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wb_profiles
    where id = auth.uid() and role = 'ADMIN'
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
    select 1 from public.wb_classes c
    join public.wb_profiles p on p.id = auth.uid()
    where c.id = p_class_id
      and (c.teacher_id = auth.uid() or p.role = 'ADMIN')
  );
$$;
