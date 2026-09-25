-- PRC admin officer-profile editing migration
-- Fictional RP system only. Run once in Supabase SQL Editor.

-- Keep officer profile updates administrator-only.
drop policy if exists officers_update_admin on public.officers;
create policy officers_update_admin
on public.officers for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Allow the live officer directory to refresh when an admin edits a profile.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'officers'
  ) then
    alter publication supabase_realtime add table public.officers;
  end if;
end $$;
