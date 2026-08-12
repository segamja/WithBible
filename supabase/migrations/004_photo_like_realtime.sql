-- Photo check-in + public default + like type + realtime

alter table public.wb_reading_logs
  add column if not exists image_url text;

alter table public.wb_reading_logs
  alter column visibility set default 'public';

-- Add like to encouragement enum (ignore if already exists)
do $$
begin
  alter type public.wb_encouragement_type add value if not exists 'like';
exception
  when duplicate_object then null;
end $$;

-- Storage bucket for check-in photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wb-checkins',
  'wb-checkins',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "wb_checkins_select" on storage.objects;
drop policy if exists "wb_checkins_insert" on storage.objects;
drop policy if exists "wb_checkins_update" on storage.objects;
drop policy if exists "wb_checkins_delete" on storage.objects;

create policy "wb_checkins_select"
on storage.objects for select
to public
using (bucket_id = 'wb-checkins');

create policy "wb_checkins_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'wb-checkins'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "wb_checkins_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'wb-checkins'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "wb_checkins_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'wb-checkins'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Realtime (ignore errors if already added)
do $$
begin
  alter publication supabase_realtime add table public.wb_reading_logs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.wb_encouragements;
exception when duplicate_object then null;
end $$;
