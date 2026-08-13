-- Admin: delete users (ghost accounts) + reset email/password login

create or replace function public.wb_admin_list_users()
returns table (
  id uuid,
  name text,
  email text,
  role public.wb_user_role,
  class_id uuid,
  created_at timestamptz,
  has_email_login boolean,
  reading_log_count bigint,
  is_ghost boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.wb_is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    p.id,
    p.name,
    coalesce(nullif(trim(p.email), ''), u.email) as email,
    p.role,
    p.class_id,
    p.created_at,
    exists (
      select 1
      from auth.identities i
      where i.user_id = p.id
        and i.provider = 'email'
    ) as has_email_login,
    (
      select count(*)::bigint
      from public.wb_reading_logs rl
      where rl.user_id = p.id
    ) as reading_log_count,
    (
      p.role = 'STUDENT'
      and p.class_id is null
      and not exists (
        select 1 from public.wb_reading_logs rl where rl.user_id = p.id
      )
    ) as is_ghost
  from public.wb_profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

revoke all on function public.wb_admin_list_users() from public;
grant execute on function public.wb_admin_list_users() to authenticated;

create or replace function public.wb_admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.wb_user_role;
  v_admin_count int;
begin
  if not public.wb_is_admin() then
    raise exception 'admin only';
  end if;

  if p_user_id is null then
    raise exception 'user id required';
  end if;

  if p_user_id = auth.uid() then
    raise exception '본인 계정은 삭제할 수 없습니다';
  end if;

  select role into v_role from public.wb_profiles where id = p_user_id;
  if v_role is null then
    raise exception '사용자를 찾을 수 없습니다';
  end if;

  if v_role = 'ADMIN' then
    select count(*)::int into v_admin_count
    from public.wb_profiles
    where role = 'ADMIN';
    if v_admin_count <= 1 then
      raise exception '마지막 관리자 계정은 삭제할 수 없습니다';
    end if;
  end if;

  -- Clear class teacher refs first (FK to auth.users)
  update public.wb_classes
  set teacher_id = null
  where teacher_id = p_user_id;

  delete from auth.users where id = p_user_id;

  if not found then
    raise exception '인증 사용자를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.wb_admin_delete_user(uuid) from public;
grant execute on function public.wb_admin_delete_user(uuid) to authenticated;

create or replace function public.wb_admin_reset_password(
  p_user_id uuid,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_pw text;
begin
  if not public.wb_is_admin() then
    raise exception 'admin only';
  end if;

  if p_user_id is null then
    raise exception 'user id required';
  end if;

  v_pw := coalesce(p_new_password, '');
  if char_length(v_pw) < 6 then
    raise exception '비밀번호는 6자 이상이어야 합니다';
  end if;

  if not exists (select 1 from public.wb_profiles where id = p_user_id) then
    raise exception '사용자를 찾을 수 없습니다';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception '인증 사용자를 찾을 수 없습니다';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;

  -- Force re-login with the new password (tables vary by GoTrue version)
  begin
    delete from auth.sessions where user_id = p_user_id;
  exception
    when undefined_table then null;
    when undefined_column then null;
  end;

  begin
    delete from auth.refresh_tokens where user_id = p_user_id;
  exception
    when undefined_table then null;
    when undefined_column then null;
  end;
end;
$$;

revoke all on function public.wb_admin_reset_password(uuid, text) from public;
grant execute on function public.wb_admin_reset_password(uuid, text) to authenticated;
