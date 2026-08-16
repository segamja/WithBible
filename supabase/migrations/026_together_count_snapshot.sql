-- 026: freeze feed "함께 읽었어요" at post time. Do not DROP/TRUNCATE.
-- Do not edit 023/024/025.
--
-- Product split
--   Feed post = snapshot at created_at (never live-recalculated)
--   Home / 인증 = live completers of today's official goal
--
-- Existing rows had no snapshot. Do NOT copy today's live total onto every old post.
-- Recoverable backfill: for each post P, count distinct users who already had a
-- same-project log covering P's goal range with created_at <= P.created_at.
-- Goal range = target_start/end when 024 snapshot exists, else the post's own
-- start_chapter–end_chapter. Split logs are not merged in SQL (typical check-in
-- is one continuous range).

alter table public.wb_reading_logs
  add column if not exists together_count_snapshot integer;

alter table public.wb_reading_logs
  add column if not exists together_preview_snapshot jsonb;

alter table public.wb_reading_logs
  add column if not exists together_goal_label_snapshot text;

update public.wb_reading_logs p
set together_count_snapshot = (
  select count(distinct l.user_id)::integer
  from public.wb_reading_logs l
  where l.project_id = p.project_id
    and l.book_id = p.book_id
    and l.created_at <= p.created_at
    and least(l.start_chapter, l.end_chapter)
      <= coalesce(p.target_start_chapter, p.start_chapter)
    and greatest(l.start_chapter, l.end_chapter)
      >= coalesce(p.target_end_chapter, p.end_chapter)
)
where p.together_count_snapshot is null;

comment on column public.wb_reading_logs.together_count_snapshot is
  'Feed together-count frozen at post created_at. Not updated later.';
