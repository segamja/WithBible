-- Comments on reading feed + helper for admin activity reset

create table if not exists public.wb_comments (
  id uuid primary key default gen_random_uuid(),
  reading_log_id uuid not null references public.wb_reading_logs (id) on delete cascade,
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 80),
  created_at timestamptz not null default now()
);

create index if not exists wb_comments_log_idx
  on public.wb_comments (reading_log_id, created_at asc);

alter table public.wb_comments enable row level security;

drop policy if exists "wb_comments_select" on public.wb_comments;
drop policy if exists "wb_comments_insert" on public.wb_comments;
drop policy if exists "wb_comments_delete" on public.wb_comments;

create policy "wb_comments_select"
on public.wb_comments for select
to authenticated
using (true);

create policy "wb_comments_insert"
on public.wb_comments for insert
to authenticated
with check (user_id = auth.uid());

create policy "wb_comments_delete"
on public.wb_comments for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

-- Admin RPC: reset activity data for a project (keeps classes/users/project settings)
create or replace function public.wb_admin_reset_project_activity(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wb_is_admin() then
    raise exception 'admin only';
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

revoke all on function public.wb_admin_reset_project_activity(uuid) from public;
grant execute on function public.wb_admin_reset_project_activity(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.wb_comments;
exception when duplicate_object then null;
end $$;
