-- Drop yesterday-and-older cheer messages so home only keeps "today" in KST.

create or replace function public.wb_purge_old_cheers()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.wb_announcements
  where kind = 'cheer'
    and created_at < ((timezone('Asia/Seoul', now()))::date)::timestamp at time zone 'Asia/Seoul';
$$;

revoke all on function public.wb_purge_old_cheers() from public;
grant execute on function public.wb_purge_old_cheers() to authenticated;
