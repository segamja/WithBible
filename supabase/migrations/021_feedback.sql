-- Home bug reports / feature ideas, readable only by MASTER (or legacy ADMIN).

create table if not exists public.wb_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wb_profiles (id) on delete cascade,
  kind text not null check (kind in ('bug', 'feature')),
  content text not null check (char_length(trim(content)) between 5 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists wb_feedback_created_idx
  on public.wb_feedback (created_at desc);

create index if not exists wb_feedback_unread_idx
  on public.wb_feedback (created_at desc)
  where read_at is null;

alter table public.wb_feedback enable row level security;

drop policy if exists "wb_feedback_insert_own" on public.wb_feedback;
create policy "wb_feedback_insert_own"
on public.wb_feedback for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "wb_feedback_master_select" on public.wb_feedback;
create policy "wb_feedback_master_select"
on public.wb_feedback for select
to authenticated
using (
  exists (
    select 1 from public.wb_profiles p
    where p.id = auth.uid()
      and p.role::text in ('MASTER', 'ADMIN')
  )
);

drop policy if exists "wb_feedback_master_update" on public.wb_feedback;
create policy "wb_feedback_master_update"
on public.wb_feedback for update
to authenticated
using (
  exists (
    select 1 from public.wb_profiles p
    where p.id = auth.uid()
      and p.role::text in ('MASTER', 'ADMIN')
  )
)
with check (
  exists (
    select 1 from public.wb_profiles p
    where p.id = auth.uid()
      and p.role::text in ('MASTER', 'ADMIN')
  )
);

drop policy if exists "wb_feedback_master_delete" on public.wb_feedback;
create policy "wb_feedback_master_delete"
on public.wb_feedback for delete
to authenticated
using (
  exists (
    select 1 from public.wb_profiles p
    where p.id = auth.uid()
      and p.role::text in ('MASTER', 'ADMIN')
  )
);

grant select, insert, update, delete on public.wb_feedback to authenticated;
