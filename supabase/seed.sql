-- Seed data for With Bible MVP (wb_* tables)
-- Run after 001_schema.sql and 002_rls.sql

insert into public.wb_bible_books (id, name, testament, chapter_count) values
  ('11111111-1111-1111-1111-111111111101', '마태복음', 'NT', 28),
  ('11111111-1111-1111-1111-111111111102', '마가복음', 'NT', 16),
  ('11111111-1111-1111-1111-111111111103', '누가복음', 'NT', 24),
  ('11111111-1111-1111-1111-111111111104', '요한복음', 'NT', 21)
on conflict (name) do nothing;

insert into public.wb_classes (id, name, join_code) values
  ('22222222-2222-2222-2222-222222222201', '1반', 'BIBLE26-1'),
  ('22222222-2222-2222-2222-222222222202', '2반', 'BIBLE26-2'),
  ('22222222-2222-2222-2222-222222222203', '3반', 'BIBLE26-3')
on conflict (join_code) do nothing;

insert into public.wb_projects (
  id, title, description, start_date, end_date, status,
  party_date, party_place, party_note
) values (
  '33333333-3333-3333-3333-333333333301',
  '우리 반 복음서 완독 프로젝트',
  '함께 읽고, 함께 나누고, 함께 완주한다.',
  current_date,
  current_date + 28,
  'active',
  (current_date + 28) + time '17:00',
  '교회 3층',
  '각자 함께 나눌 음식을 준비해주세요!'
) on conflict (id) do nothing;

insert into public.wb_project_classes (
  id, project_id, class_id, target_book_id, target_start_chapter, target_end_chapter
) values
  (
    '44444444-4444-4444-4444-444444444401',
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111101',
    1, 28
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111101',
    1, 28
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111102',
    1, 16
  )
on conflict (project_id, class_id) do nothing;

-- After first admin signs up from With Bible app, run:
-- update public.wb_profiles set role = 'ADMIN', class_id = null where email = 'admin@example.com';
-- Imparts use staff code STAFF26 (see migration 007). Class teachers:
-- update public.wb_classes set teacher_id = '<teacher-uuid>' where name = '2반';
-- update public.wb_profiles set role = 'TEACHER', class_id = '22222222-2222-2222-2222-222222222202' where email = 'teacher@example.com';
