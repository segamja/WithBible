-- Optional: drop legacy unprefixed With Bible objects if you ran the first schema version.
-- Does NOT touch signal_* tables.
-- Run ONLY if you previously created profiles/classes/projects without wb_ prefix.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists protect_profile_columns on public.profiles;
drop trigger if exists reading_logs_updated_at on public.reading_logs;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.protect_profile_columns() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.current_role() cascade;
drop function if exists public.current_class_id() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_teacher_of(uuid) cascade;

drop table if exists public.announcements cascade;
drop table if exists public.encouragements cascade;
drop table if exists public.reading_logs cascade;
drop table if exists public.project_classes cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;
drop table if exists public.classes cascade;
drop table if exists public.bible_books cascade;

drop type if exists public.encouragement_type cascade;
drop type if exists public.visibility cascade;
drop type if exists public.project_status cascade;
drop type if exists public.user_role cascade;
