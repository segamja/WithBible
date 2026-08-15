-- Fix admin password reset so email/password login works after reset.
-- Also: announcements are class-scoped (no school-wide from teachers).

-- 1) Password reset: sync email, confirm email, ensure email identity, hash password
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
  v_email text;
  v_providers jsonb;
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

  select lower(trim(coalesce(nullif(u.email, ''), nullif(p.email, ''))))
  into v_email
  from public.wb_profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_email is null or v_email = '' then
    raise exception '이메일이 없어 비밀번호 로그인을 설정할 수 없습니다';
  end if;

  select coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb)
  into v_providers
  from auth.users u
  where u.id = p_user_id;

  if not (v_providers ? 'email') then
    v_providers := v_providers || '["email"]'::jsonb;
  end if;

  update auth.users
  set
    email = v_email,
    encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('provider', coalesce(raw_app_meta_data->>'provider', 'email'))
      || jsonb_build_object('providers', v_providers),
    updated_at = now()
  where id = p_user_id;

  -- Keep profile email in sync for admin list / login hints
  update public.wb_profiles
  set email = v_email
  where id = p_user_id
    and (email is null or trim(email) = '' or lower(trim(email)) is distinct from v_email);

  -- Email/password sign-in requires an email identity row
  if not exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and i.provider = 'email'
  ) then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      p_user_id,
      jsonb_build_object(
        'sub', p_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      p_user_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set
      identity_data =
        coalesce(identity_data, '{}'::jsonb)
        || jsonb_build_object(
          'email', v_email,
          'email_verified', true,
          'sub', p_user_id::text
        ),
      updated_at = now()
    where user_id = p_user_id
      and provider = 'email';
  end if;

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

-- 2) Announcements: teachers may only post to their class (not school-wide)
drop policy if exists "wb_announcements_insert" on public.wb_announcements;
create policy "wb_announcements_insert"
on public.wb_announcements for insert
to authenticated
with check (
  public.wb_is_admin()
  or (
    author_id = auth.uid()
    and public.wb_current_role() = 'TEACHER'
    and class_id is not null
    and public.wb_is_teacher_of(class_id)
  )
);

-- Hide legacy school-wide (class_id null) from non-admins
drop policy if exists "wb_announcements_select" on public.wb_announcements;
create policy "wb_announcements_select"
on public.wb_announcements for select
to authenticated
using (
  public.wb_is_admin()
  or class_id = public.wb_current_class_id()
  or public.wb_is_teacher_of(class_id)
);
