-- PRC admin delete migration
-- Fictional RP system only. Run once in Supabase SQL Editor.

-- Admin-only deletion policies.
drop policy if exists admin_delete_arrests on public.arrests;
create policy admin_delete_arrests
on public.arrests for delete
to authenticated
using (public.is_admin());

drop policy if exists admin_delete_bolos on public.bolos;
create policy admin_delete_bolos
on public.bolos for delete
to authenticated
using (public.is_admin());

drop policy if exists admin_delete_alerts on public.alerts;
create policy admin_delete_alerts
on public.alerts for delete
to authenticated
using (public.is_admin());

drop policy if exists admin_delete_radio_messages on public.radio_messages;
create policy admin_delete_radio_messages
on public.radio_messages for delete
to authenticated
using (public.is_admin());

-- The browser already records audit events when actions are taken.
-- Allow an authenticated officer to create an audit row only for themselves.
drop policy if exists audit_insert_self on public.audit_logs;
create policy audit_insert_self
on public.audit_logs for insert
to authenticated
with check (officer_id = auth.uid());
