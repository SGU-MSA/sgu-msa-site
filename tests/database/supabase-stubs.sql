-- Minimal stand-ins for what Supabase provides before our migrations run, so `npm run test:db`
-- can use plain Postgres (compose.test.yaml, PR3 contract D-18). Test database only: never
-- apply this file to a Supabase project, which already has the real roles and schemas.
--
-- Mirrored from Supabase: the API roles (service_role bypasses RLS), auth.uid() reading the
-- request JWT claims the way PostgREST sets them, the auth.users/auth.sessions columns our
-- migrations and tests use, the storage tables with RLS on and the direct-delete guard, and
-- Supabase's default grants of every new public table, function and sequence to the API roles
-- (so a missing revoke fails here as it would on Supabase).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text unique,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
-- Supabase refuses direct object deletes unless the Storage API switches this setting on.
create function storage.protect_delete() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true' then
    raise exception using errcode = '42501', message = 'Direct deletion from storage tables is not allowed.';
  end if;
  return null;
end $$;
create trigger protect_objects_delete before delete on storage.objects
for each statement execute function storage.protect_delete();
