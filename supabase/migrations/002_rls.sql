-- With Bible RLS (wb_*)

alter table public.wb_profiles enable row level security;
alter table public.wb_classes enable row level security;
alter table public.wb_projects enable row level security;
alter table public.wb_project_classes enable row level security;
alter table public.wb_bible_books enable row level security;
alter table public.wb_reading_logs enable row level security;
alter table public.wb_encouragements enable row level security;
alter table public.wb_announcements enable row level security;

create policy "wb_profiles_select_authenticated"
on public.wb_profiles for select
to authenticated
using (true);

create policy "wb_profiles_update_own"
on public.wb_profiles for update
to authenticated
using (id = auth.uid() or public.wb_is_admin())
with check (id = auth.uid() or public.wb_is_admin());

create policy "wb_profiles_admin_insert"
on public.wb_profiles for insert
to authenticated
with check (public.wb_is_admin() or id = auth.uid());

create policy "wb_bible_books_select"
on public.wb_bible_books for select
to authenticated
using (true);

create policy "wb_bible_books_admin_write"
on public.wb_bible_books for all
to authenticated
using (public.wb_is_admin())
with check (public.wb_is_admin());

create policy "wb_classes_select"
on public.wb_classes for select
to authenticated
using (true);

create policy "wb_classes_admin_write"
on public.wb_classes for insert
to authenticated
with check (public.wb_is_admin());

create policy "wb_classes_admin_update"
on public.wb_classes for update
to authenticated
using (public.wb_is_admin() or teacher_id = auth.uid())
with check (public.wb_is_admin() or teacher_id = auth.uid());

create policy "wb_classes_admin_delete"
on public.wb_classes for delete
to authenticated
using (public.wb_is_admin());

create policy "wb_projects_select"
on public.wb_projects for select
to authenticated
using (true);

create policy "wb_projects_admin_write"
on public.wb_projects for all
to authenticated
using (public.wb_is_admin())
with check (public.wb_is_admin());

create policy "wb_project_classes_select"
on public.wb_project_classes for select
to authenticated
using (true);

create policy "wb_project_classes_admin_write"
on public.wb_project_classes for all
to authenticated
using (public.wb_is_admin())
with check (public.wb_is_admin());

create policy "wb_reading_logs_select"
on public.wb_reading_logs for select
to authenticated
using (
  public.wb_is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.wb_profiles author
    where author.id = wb_reading_logs.user_id
      and (
        author.class_id = public.wb_current_class_id()
        or public.wb_is_teacher_of(author.class_id)
        or wb_reading_logs.visibility = 'public'
      )
  )
);

create policy "wb_reading_logs_insert_own"
on public.wb_reading_logs for insert
to authenticated
with check (user_id = auth.uid() or public.wb_is_admin());

create policy "wb_reading_logs_update_own"
on public.wb_reading_logs for update
to authenticated
using (user_id = auth.uid() or public.wb_is_admin())
with check (user_id = auth.uid() or public.wb_is_admin());

create policy "wb_reading_logs_delete_own"
on public.wb_reading_logs for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

create policy "wb_encouragements_select"
on public.wb_encouragements for select
to authenticated
using (true);

create policy "wb_encouragements_insert"
on public.wb_encouragements for insert
to authenticated
with check (user_id = auth.uid());

create policy "wb_encouragements_delete_own"
on public.wb_encouragements for delete
to authenticated
using (user_id = auth.uid() or public.wb_is_admin());

create policy "wb_announcements_select"
on public.wb_announcements for select
to authenticated
using (
  public.wb_is_admin()
  or class_id is null
  or class_id = public.wb_current_class_id()
  or public.wb_is_teacher_of(class_id)
);

create policy "wb_announcements_insert"
on public.wb_announcements for insert
to authenticated
with check (
  public.wb_is_admin()
  or (
    author_id = auth.uid()
    and (
      public.wb_current_role() = 'TEACHER'
      and (class_id is null or public.wb_is_teacher_of(class_id))
    )
  )
);

create policy "wb_announcements_update"
on public.wb_announcements for update
to authenticated
using (public.wb_is_admin() or author_id = auth.uid())
with check (public.wb_is_admin() or author_id = auth.uid());

create policy "wb_announcements_delete"
on public.wb_announcements for delete
to authenticated
using (public.wb_is_admin() or author_id = auth.uid());

create or replace function public.wb_protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wb_is_admin() then
    new.role := old.role;
    if public.wb_current_role() = 'STUDENT' then
      new.class_id := old.class_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wb_protect_profile_columns on public.wb_profiles;
create trigger wb_protect_profile_columns
before update on public.wb_profiles
for each row execute function public.wb_protect_profile_columns();
