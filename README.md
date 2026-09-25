
# PRC Supabase Edition

Files:
- index.html — PRC web application
- schema.sql — Supabase database + RLS + Realtime setup
- SETUP.md — setup instructions

This is a fictional ERLC/UKBP roleplay system and is not an official police database.


## Admin deletion
The website now shows Delete buttons only to officers whose `public.officers.role` is `admin`. Run `admin_delete_migration.sql` once in Supabase SQL Editor to enforce the same restriction at the database level.
