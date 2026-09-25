
-- PRC / ERLC ROLEPLAY DATABASE
-- Fictional RP use only. Do not store real police or sensitive personal data.
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.officers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  callsign text not null unique,
  rank text not null default 'Constable'
    check (rank in ('Constable','Sergeant','Inspector','Chief Inspector','Superintendent','Administrator')),
  department text not null default 'Response Policing',
  role text not null default 'officer'
    check (role in ('officer','supervisor','admin')),
  duty_status text not null default 'OFF DUTY'
    check (duty_status in ('AVAILABLE','BUSY','OFF DUTY')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.arrests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  subject text not null,
  case_reference text,
  offence text not null,
  location text not null,
  custody_status text not null default 'In Custody',
  notes text,
  officer_id uuid not null references public.officers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bolos (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  bolo_type text not null,
  priority text not null check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  subject text not null,
  identifier text,
  location text not null,
  incident_reference text,
  description text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','CLOSED')),
  officer_id uuid not null references public.officers(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  alert_type text not null,
  priority text not null check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  message text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','CLOSED')),
  officer_id uuid not null references public.officers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.radio_messages (
  id uuid primary key default gen_random_uuid(),
  message_type text not null,
  message text not null,
  callsign text not null,
  officer_id uuid references public.officers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  officer_id uuid references public.officers(id),
  callsign text,
  action text not null,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists arrests_created_at_idx on public.arrests(created_at desc);
create index if not exists bolos_created_at_idx on public.bolos(created_at desc);
create index if not exists alerts_created_at_idx on public.alerts(created_at desc);
create index if not exists radio_created_at_idx on public.radio_messages(created_at desc);
create index if not exists audit_created_at_idx on public.audit_logs(created_at desc);

-- Helper functions used by RLS.
create or replace function public.current_officer()
returns public.officers
language sql
stable
security definer
set search_path = public
as $$
  select * from public.officers where id = auth.uid() and active = true limit 1;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.officers where id = auth.uid() and active = true limit 1;
$$;

create or replace function public.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('supervisor','admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

grant execute on function public.current_officer() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.can_manage() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- RLS
alter table public.officers enable row level security;
alter table public.arrests enable row level security;
alter table public.bolos enable row level security;
alter table public.alerts enable row level security;
alter table public.radio_messages enable row level security;
alter table public.audit_logs enable row level security;

-- Officers: signed-in users can see the directory.
drop policy if exists officers_select on public.officers;
create policy officers_select
on public.officers for select
to authenticated
using (true);

-- Only admins can create/update/deactivate officer profiles.
drop policy if exists officers_insert_admin on public.officers;
create policy officers_insert_admin
on public.officers for insert
to authenticated
with check (public.is_admin());

drop policy if exists officers_update_admin on public.officers;
create policy officers_update_admin
on public.officers for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Arrests: authenticated officers can read/create; supervisors/admins can update.
drop policy if exists arrests_select on public.arrests;
create policy arrests_select
on public.arrests for select
to authenticated
using (true);

drop policy if exists arrests_insert on public.arrests;
create policy arrests_insert
on public.arrests for insert
to authenticated
with check (auth.uid() = officer_id);

drop policy if exists arrests_update on public.arrests;
create policy arrests_update
on public.arrests for update
to authenticated
using (public.can_manage())
with check (public.can_manage());

-- BOLOs: all signed-in officers read; all signed-in officers create; supervisors/admins close/update.
drop policy if exists bolos_select on public.bolos;
create policy bolos_select
on public.bolos for select
to authenticated
using (true);

drop policy if exists bolos_insert on public.bolos;
create policy bolos_insert
on public.bolos for insert
to authenticated
with check (auth.uid() = officer_id);

drop policy if exists bolos_update on public.bolos;
create policy bolos_update
on public.bolos for update
to authenticated
using (public.can_manage() or auth.uid() = officer_id)
with check (public.can_manage() or auth.uid() = officer_id);

-- Alerts: all signed-in officers can read/create; supervisors/admins can close.
drop policy if exists alerts_select on public.alerts;
create policy alerts_select
on public.alerts for select
to authenticated
using (true);

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert
on public.alerts for insert
to authenticated
with check (auth.uid() = officer_id);

drop policy if exists alerts_update on public.alerts;
create policy alerts_update
on public.alerts for update
to authenticated
using (public.can_manage() or auth.uid() = officer_id)
with check (public.can_manage() or auth.uid() = officer_id);

-- Radio: all signed-in officers can read/create.
drop policy if exists radio_select on public.radio_messages;
create policy radio_select
on public.radio_messages for select
to authenticated
using (true);

drop policy if exists radio_insert on public.radio_messages;
create policy radio_insert
on public.radio_messages for insert
to authenticated
with check (auth.uid() = officer_id);

-- Audit: officers can read, but cannot write directly from the browser.
drop policy if exists audit_select on public.audit_logs;
create policy audit_select
on public.audit_logs for select
to authenticated
using (true);

-- Realtime publication for live dashboard/radio updates.
alter publication supabase_realtime add table public.bolos;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.radio_messages;
alter publication supabase_realtime add table public.arrests;

-- Create the first administrator profile AFTER creating the matching Auth user.
-- Replace UUID below with the user's Auth user id.
-- insert into public.officers (id, full_name, callsign, rank, department, role)
-- values ('YOUR-AUTH-USER-UUID', 'Tyler Shemwell', 'SIERRA-21',
--         'Administrator', 'Command', 'admin');
