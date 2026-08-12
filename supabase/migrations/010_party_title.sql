-- 마지막 보상 이름 설정 가능 (포트럭 / 시상식 / 파티 등)
alter table public.wb_projects
  add column if not exists party_title text;

comment on column public.wb_projects.party_title is
  '마지막 보상/행사 이름 (예: 포트럭 파티, 시상식). null이면 UI 기본 문구 사용';
