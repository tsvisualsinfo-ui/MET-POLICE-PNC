-- PRC AUDIT LOG FIX
-- Run once in Supabase SQL Editor.
-- This allows signed-in PRC officers to create their own audit entries,
-- while keeping audit rows readable to authenticated users.

drop policy if exists audit_insert_self on public.audit_logs;
create policy audit_insert_self
on public.audit_logs
for insert
to authenticated
with check (officer_id = auth.uid());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select
on public.audit_logs
for select
to authenticated
using (true);

-- Enable live audit updates in the dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end $$;

-- Quick test: this should return the latest audit rows.
select id, callsign, action, reference, created_at
from public.audit_logs
order by created_at desc
limit 20;
