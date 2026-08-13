-- 홈에 표시할 부서/사역 타이틀 (예: 주고받고 고등부)
alter table public.wb_projects
  add column if not exists department_title text;

comment on column public.wb_projects.department_title is
  '홈 화면 부서 타이틀. null/빈값이면 앱 기본값(주고받고 고등부) 사용';

update public.wb_projects
set department_title = '주고받고 고등부'
where department_title is null or btrim(department_title) = '';
