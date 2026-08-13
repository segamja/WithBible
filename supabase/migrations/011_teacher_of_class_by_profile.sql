-- 담임/소속 교사(profile.class_id)도 해당 반 공지 작성 가능
-- 기존: wb_classes.teacher_id 일치 또는 ADMIN만 통과 → teacher_id 미설정 시 RLS 실패

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
        p.role = 'ADMIN'
        or c.teacher_id = auth.uid()
        or (p.role = 'TEACHER' and p.class_id = p_class_id)
      )
  );
$$;

comment on function public.wb_is_teacher_of(uuid) is
  'ADMIN, 반 teacher_id, 또는 해당 반에 소속된 TEACHER(profile.class_id)';
