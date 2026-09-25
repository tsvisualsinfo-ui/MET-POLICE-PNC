
# PRC — Supabase setup

This is a fictional ERLC/UKBP roleplay system. Do not put real police records, real suspect information, or sensitive personal data into it.

## 1. Create Supabase project

Create a project in Supabase.

Open:
Dashboard -> SQL Editor

Paste the entire contents of `schema.sql` and run it.

The SQL enables Row Level Security and adds the tables to Supabase Realtime. Supabase documents that RLS should be enabled on exposed tables and that the publishable/anon key is safe for browser use only when the database is correctly protected by RLS. Never put a service-role/secret key in `index.html`.

## 2. Create the first officer

Go to:
Authentication -> Users -> Add user

Create an email/password account for the first administrator.

Copy that user's UUID.

At the bottom of `schema.sql`, replace YOUR-AUTH-USER-UUID and run:

insert into public.officers
(id, full_name, callsign, rank, department, role)
values
('YOUR-AUTH-USER-UUID',
 'Tyler Shemwell',
 'SIERRA-21',
 'Administrator',
 'Command',
 'admin');

## 3. Connect the website

Open `index.html`.

Replace:

PASTE_YOUR_SUPABASE_URL_HERE

with your project's URL.

Replace:

PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE

with the project's publishable key (or legacy anon key if that is what your project shows).

Do NOT put a `service_role` or secret key in the HTML.

## 4. Add more officers

For each RP officer:

1. Create their Auth email/password user in Authentication -> Users.
2. Copy their Auth UUID.
3. Insert their profile:

insert into public.officers
(id, full_name, callsign, rank, department, role)
values
('AUTH-UUID',
 'Officer Name',
 'SIERRA-22',
 'Constable',
 'Response Policing',
 'officer');

Roles:
- officer = normal officer
- supervisor = can close/update appropriate records
- admin = administrator

The callsign is stored against the authenticated user and automatically attached to records/radio messages.

## 5. Test live updates

Open the website in two browser windows and log in with two different officer accounts.

On Window A:
Create a BOLO.

Window B should receive the BOLO automatically after the database change arrives through Supabase Realtime.

The same applies to alerts, arrests and radio messages.

## 6. Hosting

You can host the static `index.html` on GitHub Pages, Cloudflare Pages, Netlify, or another static host.

The Supabase database remains online separately.

## 7. Important security note

This project uses Supabase Auth + Postgres Row Level Security. Do not replace it with hard-coded passwords in JavaScript.

For a real application, you would also want:
- MFA
- stronger administrative workflows
- account recovery
- rate limiting
- server-side audit enforcement
- backups
- retention rules
- monitoring

For this ERLC RP version, the current setup is intended as a small community system.

## Admin officer-profile editing

The website now lets administrators click an officer's name in **Officer Directory** to edit:

- Full name
- Callsign
- Rank
- Department
- System role (`officer`, `supervisor`, `admin`)
- Duty status
- Active/inactive status

Only users whose `public.officers.role` is `admin` can open/save the editor. The database also enforces the admin-only update policy.

Run `officer_profile_admin_migration.sql` once in Supabase SQL Editor. The migration also adds `officers` to Supabase Realtime when needed so other connected PRC clients see profile changes.

This does not change a user's Supabase Auth email or password.
