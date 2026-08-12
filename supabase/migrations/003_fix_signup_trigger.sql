-- Fix signup trigger: never cast empty strings to uuid; ignore blank join_code
create or replace function public.wb_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role public.wb_user_role;
  v_join_code text;
  v_class_id uuid;
  v_app text;
  v_role_raw text;
begin
  v_app := coalesce(new.raw_user_meta_data->>'app', '');
  if v_app <> 'withbible' then
    return new;
  end if;

  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_role_raw := nullif(trim(coalesce(new.raw_user_meta_data->>'role', '')), '');
  begin
    v_role := coalesce(v_role_raw::public.wb_user_role, 'STUDENT');
  exception when others then
    v_role := 'STUDENT';
  end;

  v_join_code := nullif(trim(coalesce(new.raw_user_meta_data->>'join_code', '')), '');
  v_class_id := null;

  if v_join_code is not null then
    select id into v_class_id
    from public.wb_classes
    where upper(join_code) = upper(v_join_code)
    limit 1;
  end if;

  insert into public.wb_profiles (id, name, email, role, class_id)
  values (new.id, v_name, new.email, v_role, v_class_id)
  on conflict (id) do nothing;

  return new;
end;
$$;
