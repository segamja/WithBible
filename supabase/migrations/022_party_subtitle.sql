-- Optional bold subtitle under the reward / party title
alter table public.wb_projects
  add column if not exists party_subtitle text;

comment on column public.wb_projects.party_subtitle is
  '완주 보상 카드 서브타이틀 (홈에 볼드로 표시)';
