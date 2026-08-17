-- 027: 시끌벅적 one-line feed (laugh/clap, hidden_at, reports).
-- Do not DROP/TRUNCATE. Do not edit 023. Keep content 1–500.

alter table public.wb_chatter_posts
  add column if not exists hidden_at timestamptz;

comment on column public.wb_chatter_posts.hidden_at is
  'Set by master to hide a post from the student feed. NULL = visible.';

alter table public.wb_chatter_reactions
  drop constraint if exists wb_chatter_reactions_type_check;

alter table public.wb_chatter_reactions
  add constraint wb_chatter_reactions_type_check
  check (type in ('like', 'love', 'prayer', 'fire', 'cheer', 'laugh', 'clap'));

create table if not exists public.wb_chatter_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wb_chatter_posts (id) on delete cascade,
  reporter_id uuid not null references public.wb_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index if not exists wb_chatter_reports_post_idx
  on public.wb_chatter_reports (post_id);

alter table public.wb_chatter_reports enable row level security;

drop policy if exists "wb_chatter_posts_select" on public.wb_chatter_posts;
create policy "wb_chatter_posts_select"
on public.wb_chatter_posts for select
to authenticated
using (hidden_at is null or public.wb_is_master());

drop policy if exists "wb_chatter_posts_update" on public.wb_chatter_posts;
create policy "wb_chatter_posts_update"
on public.wb_chatter_posts for update
to authenticated
using (author_id = auth.uid() or public.wb_is_master())
with check (author_id = auth.uid() or public.wb_is_master());

drop policy if exists "wb_chatter_reports_select" on public.wb_chatter_reports;
create policy "wb_chatter_reports_select"
on public.wb_chatter_reports for select
to authenticated
using (public.wb_is_master());

drop policy if exists "wb_chatter_reports_insert" on public.wb_chatter_reports;
create policy "wb_chatter_reports_insert"
on public.wb_chatter_reports for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and exists (
    select 1
    from public.wb_chatter_posts p
    where p.id = post_id
      and p.author_id <> auth.uid()
  )
);

grant select, insert on public.wb_chatter_reports to authenticated;
