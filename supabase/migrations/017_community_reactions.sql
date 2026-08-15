-- Community reactions: multi-type encouragements + "나도 읽었어요" + notifications

-- 1) Expand encouragement enum (PG-safe; ignore if already present)
do $$ begin
  alter type public.wb_encouragement_type add value 'love';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.wb_encouragement_type add value 'prayer';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.wb_encouragement_type add value 'fire';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.wb_encouragement_type add value 'cheer';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.wb_encouragement_type add value 'teacher_cheer';
exception when duplicate_object then null; end $$;

-- 2) Allow multiple reaction types per user per post
alter table public.wb_encouragements
  drop constraint if exists wb_encouragements_reading_log_id_user_id_key;

alter table public.wb_encouragements
  drop constraint if exists wb_encouragements_reading_log_id_user_id_type_key;

alter table public.wb_encouragements
  add constraint wb_encouragements_reading_log_id_user_id_type_key
  unique (reading_log_id, user_id, type);

-- 3) "나도 읽었어요" participants
create table if not exists public.wb_read_alongs (
  id uuid primary key default gen_random_uuid(),
  reading_log_id uuid not null references public.wb_reading_logs (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reading_log_id, user_id)
);

create index if not exists wb_read_alongs_log_idx
  on public.wb_read_alongs (reading_log_id, created_at desc);

alter table public.wb_read_alongs enable row level security;

drop policy if exists "wb_read_alongs_select" on public.wb_read_alongs;
create policy "wb_read_alongs_select"
on public.wb_read_alongs for select
to authenticated
using (true);

drop policy if exists "wb_read_alongs_insert" on public.wb_read_alongs;
create policy "wb_read_alongs_insert"
on public.wb_read_alongs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wb_read_alongs_delete_own" on public.wb_read_alongs;
create policy "wb_read_alongs_delete_own"
on public.wb_read_alongs for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

do $$
begin
  alter publication supabase_realtime add table public.wb_read_alongs;
exception when duplicate_object then null;
end $$;

-- 4) In-app notifications (P1)
create table if not exists public.wb_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  actor_id uuid references public.wb_profiles (id) on delete set null,
  reading_log_id uuid references public.wb_reading_logs (id) on delete cascade,
  kind text not null check (
    kind in ('reaction', 'comment', 'read_along', 'teacher_cheer')
  ),
  reaction_type text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wb_notifications_user_idx
  on public.wb_notifications (user_id, created_at desc);

alter table public.wb_notifications enable row level security;

drop policy if exists "wb_notifications_select_own" on public.wb_notifications;
create policy "wb_notifications_select_own"
on public.wb_notifications for select
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

drop policy if exists "wb_notifications_update_own" on public.wb_notifications;
create policy "wb_notifications_update_own"
on public.wb_notifications for update
to authenticated
using (user_id = auth.uid() or public.wb_is_admin())
with check (user_id = auth.uid() or public.wb_is_admin());

drop policy if exists "wb_notifications_insert_authenticated" on public.wb_notifications;
create policy "wb_notifications_insert_authenticated"
on public.wb_notifications for insert
to authenticated
with check (true);

drop policy if exists "wb_notifications_delete_own" on public.wb_notifications;
create policy "wb_notifications_delete_own"
on public.wb_notifications for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

do $$
begin
  alter publication supabase_realtime add table public.wb_notifications;
exception when duplicate_object then null;
end $$;

-- Helper: notify log owner (skip self)
create or replace function public.wb_notify_log_owner(
  p_log_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_reaction_type text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.wb_reading_logs where id = p_log_id;
  if v_owner is null or v_owner = p_actor_id then
    return;
  end if;
  insert into public.wb_notifications (user_id, actor_id, reading_log_id, kind, reaction_type, message)
  values (v_owner, p_actor_id, p_log_id, p_kind, p_reaction_type, p_message);
end;
$$;

revoke all on function public.wb_notify_log_owner(uuid, uuid, text, text, text) from public;
grant execute on function public.wb_notify_log_owner(uuid, uuid, text, text, text) to authenticated;
