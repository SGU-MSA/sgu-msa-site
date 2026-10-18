-- SGU MSA website: the database, part 1 of 4 (schema). One clean baseline for a new, empty Supabase project
-- (final plan A5, 2026-10-06): run the four files in order in the SQL Editor (release checklist, Settings):
--   1. 202610150001_schema.sql         tables, rules (RLS), functions, triggers and file storage
--   2. 202610150002_starter_data.sql   the starter rows: groups, prayer settings, seasons, merch, page text…
--   3. 202610150003_quran_verses.sql   the fixed Qur'an verse library
--   4. 202610150004_recent_changes.sql the Recent changes log triggers (after the starter rows, so the log
--                                      starts empty)
-- Applied by a human, staging first, then production; never by an app or an AI agent. The decisions behind
-- each part are in docs/contracts/ and docs/adr/ (named in the comments below).
-- Error codes raised by this schema (meanings in src/lib/system-text.ts): SGU01 self, SGU02 last_manager,
-- SGU03 forbidden, SGU04 section_in_use, SGU05 the activity log is add-only, SGU06 archived, SGU08 in_use
-- (season), SGU09 self_money, SGU10 fund_locked, SGU12 executive_role, SGU13 permanent_group,
-- SGU14 not_executive, SGU15 executive_move, SGU16 in_use (merch item), SGU17 role_taken.

-- 1. Shared helpers ---------------------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- Archived rows are read-only until restored (ADR 0013, PR3 D-20): the only changes allowed to an archived row,
-- for every role, are Restore (archived_at back to null, nothing else) and, for a person, removing the photo
-- (ADR 0014, D-26): photo_path cleared, nothing else changed, the row staying archived. RLS policies cannot
-- compare a row with its earlier version, so this trigger decides.
create function public.archived_read_only() returns trigger language plpgsql
set search_path = '' as $$
begin
  if old.archived_at is null then
    return new;
  end if;
  if new.archived_at is null
    and (to_jsonb(new) - 'archived_at' - 'updated_at') = (to_jsonb(old) - 'archived_at' - 'updated_at') then
    return new;
  end if;
  if tg_table_name = 'people' and new.archived_at = old.archived_at
    and (to_jsonb(new) - 'photo_path' - 'updated_at') = (to_jsonb(old) - 'photo_path' - 'updated_at')
    and to_jsonb(new) @> '{"photo_path": ""}' then
    return new;
  end if;
  raise exception using errcode = 'SGU06', message = 'archived',
    detail = 'Archived entries are read-only. Restore it first.';
end $$;
revoke all on function public.archived_read_only() from public, anon, authenticated, service_role;

-- Prayer settings rules: a map of whole numbers within a range, and the list of changes for one date (PR4,
-- review fixes PR-3: one musallah room, so a changed Jumu'ah holds exactly {"change","khutbah","iqamah"},
-- mirrors jumuahChangeSchema in src/lib/prayer/adjustments.ts; `adjustments`, start corrections retired by
-- ADR 0017, is optional and, when present, still a valid map).
create function public.valid_prayer_map(value jsonb, names text[], low integer, high integer, nullable boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item record;
begin
  if value is null or jsonb_typeof(value) <> 'object' then return false; end if;
  for item in select * from jsonb_each(value) loop
    if not (item.key = any(names)) then return false; end if;
    if nullable and item.value = 'null'::jsonb then continue; end if;
    if jsonb_typeof(item.value) <> 'number' then return false; end if;
    if (item.value::text)::numeric <> trunc((item.value::text)::numeric) or (item.value::text)::numeric < low or (item.value::text)::numeric > high then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create function public.valid_prayer_exceptions(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; clock record; checked_date date; seen text[] := '{}'; jumuah jsonb; change text;
begin
  if value is null or jsonb_typeof(value) <> 'array' or jsonb_array_length(value)>20 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'object' or item->>'date' is null or (item->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    checked_date := (item->>'date')::date;
    if item->>'date' = any(seen) then return false; end if;
    seen := array_append(seen,item->>'date');
    if jsonb_typeof(item->'reason') is distinct from 'string' or length(trim(item->>'reason')) not between 1 and 250 then return false; end if;
    if item ? 'adjustments' and not public.valid_prayer_map(item->'adjustments',array['fajr','sunrise','dhuhr','asr','maghrib','isha'],-60,60,false) then return false; end if;
    if jsonb_typeof(item->'iqamah') is distinct from 'object' then return false; end if;
    for clock in select * from jsonb_each_text(item->'iqamah') loop
      if not(clock.key=any(array['fajr','dhuhr','asr','maghrib','isha'])) or clock.value is null or (clock.value <> '' and clock.value !~ '^([01]\d|2[0-3]):[0-5]\d$') then return false; end if;
    end loop;
    if item ? 'jumuah' then
      jumuah := item->'jumuah';
      if jsonb_typeof(jumuah) is distinct from 'object' or jsonb_typeof(jumuah->'change') is distinct from 'string' then return false; end if;
      change := jumuah->>'change';
      if change in ('none','cancelled') then
        if exists (select 1 from jsonb_object_keys(jumuah) as key where key <> 'change') then return false; end if;
      elsif change = 'changed' then
        if exists (select 1 from jsonb_object_keys(jumuah) as key where not (key = any(array['change','khutbah','iqamah']))) then return false; end if;
        if jsonb_typeof(jumuah->'khutbah') is distinct from 'string' or (jumuah->>'khutbah') !~ '^([01]\d|2[0-3]):[0-5]\d$' then return false; end if;
        if jsonb_typeof(jumuah->'iqamah') is distinct from 'string' or (jumuah->>'iqamah') !~ '^([01]\d|2[0-3]):[0-5]\d$' then return false; end if;
      else
        return false;
      end if;
      if change in ('cancelled','changed') and extract(isodow from checked_date) <> 5 then return false; end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end $$;

-- A list of photos (PR5c): at most `max_photos` objects, each a starter image or an upload
-- (`photoSourcePattern` in src/lib/content/page-fields.ts) with a description; the first is the cover.
create function public.valid_photo_list(list jsonb, max_photos integer) returns boolean language sql immutable
set search_path = '' as $$
  select case when jsonb_typeof(list) <> 'array' then false
    else jsonb_array_length(list) <= max_photos and not exists (
      select 1 from jsonb_array_elements(list) photo
      where jsonb_typeof(photo) <> 'object'
        or coalesce(photo ->> 'src', '') !~ '^(/images/[A-Za-z0-9/._-]+|/media/[a-f0-9-]{36}\.webp)$'
        or length(trim(coalesce(photo ->> 'alt', ''))) not between 1 and 250)
  end;
$$;
revoke all on function public.valid_photo_list(jsonb, integer) from public, anon, authenticated, service_role;
grant execute on function public.valid_photo_list(jsonb, integer) to anon, authenticated, service_role;

-- A season page's schedule (PR5c, D-26): at most 40 rows of What, When and Where.
create function public.valid_season_schedule(list jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select case when jsonb_typeof(list) <> 'array' then false
    else jsonb_array_length(list) <= 40 and not exists (
      select 1 from jsonb_array_elements(list) entry
      where jsonb_typeof(entry) <> 'object'
        or length(trim(coalesce(entry ->> 'what', ''))) not between 1 and 120
        or length(trim(coalesce(entry ->> 'when', ''))) not between 1 and 120
        or length(coalesce(entry ->> 'where', '')) > 120)
  end;
$$;
revoke all on function public.valid_season_schedule(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.valid_season_schedule(jsonb) to anon, authenticated, service_role;

-- The Google Forms rule (PR5b D-25): the mirror of `isGoogleFormUrl` in src/lib/integrations/google-forms.ts
-- (`googleFormSqlPattern`, and `googleFormSqlRefused` for a backslash or a "." / ".." path part, which a
-- browser resolves to another address).
create function public.is_google_form_url(url text) returns boolean language sql immutable
set search_path = '' as $$
  select url ~ '^https://(docs\.google\.com/forms/|forms\.gle/)\S+$' and url !~* '[\\]|/(\.|%2e){1,2}([/?#]|$)';
$$;
revoke all on function public.is_google_form_url(text) from public, anon, authenticated, service_role;
grant execute on function public.is_google_form_url(text) to anon, authenticated, service_role;

-- Every link in the sign-up forms list is a Google Forms link (an entry without a link is closed).
create function public.page_text_forms_are_google_forms(doc jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(bool_and(public.is_google_form_url(entry.value ->> 'url')), true)
  from jsonb_each(case when jsonb_typeof(doc -> 'forms') = 'object' then doc -> 'forms' else '{}'::jsonb end) entry
  where coalesce(entry.value ->> 'url', '') <> '';
$$;
revoke all on function public.page_text_forms_are_google_forms(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.page_text_forms_are_google_forms(jsonb) to anon, authenticated, service_role;

-- Whether a document names an uploaded photo: any "src" equal to /media/<file>, at any depth.
create function public.page_text_names_file(doc jsonb, file text) returns boolean language sql immutable
set search_path = '' as $$
  select jsonb_path_exists(doc, 'lax $.**.src ? (@ == $file)', jsonb_build_object('file', '/media/' || file));
$$;
revoke all on function public.page_text_names_file(jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.page_text_names_file(jsonb, text) to anon, authenticated;

-- The one "currently visible" rule (PR3 D-24; mirrored by `isVisible` in src/lib/community/schema.ts): not
-- archived, published, shown from `shown_from` (events pass null: they show before their date) and not past
-- `expires_on`, in Grenada's date. Its `set search_path` clause (kept for Supabase's security lint) stops
-- Postgres inlining it, so policies call it per row; it reads only its arguments, so that stays cheap.
create function public.community_item_visible(archived_at timestamptz, published boolean, shown_from date,
  expires_on date)
returns boolean language sql stable set search_path = '' as $$
  select archived_at is null and published
    and (shown_from is null or shown_from <= (now() at time zone 'America/Grenada')::date)
    and (expires_on is null or expires_on >= (now() at time zone 'America/Grenada')::date);
$$;
revoke all on function public.community_item_visible(timestamptz, boolean, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.community_item_visible(timestamptz, boolean, date, date) to anon, authenticated;

-- 2. People, groups and access (PR3 contract, ADR 0007; review 2, 2026-10-05; hand-in plan, 2026-10-06) -------

-- Team groups (D-7: any admin may edit; D-11: manual order, lower first). `kind` marks the two groups that
-- always exist (review 2): the Executive board and the General board cannot be renamed, archived or deleted
-- (`people_sections_permanent` below); the board's own groups have no kind. `shown_by_default` is what "Show
-- on public page?" starts as for a new person in the group (review fixes PR-2; board-editable on Edit groups).
create table public.people_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  position integer not null,
  kind text unique check (kind in ('executive', 'general')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shown_by_default boolean not null default false
);
create unique index people_sections_current_name on public.people_sections (lower(name)) where archived_at is null;
create trigger updated_at before update on public.people_sections for each row execute function public.touch_updated_at();

-- People: the single list behind dashboard access and the public team list. "Show on public page?" has
-- no default (the board must answer); a listed person's photo shows whenever one is uploaded (review 2).
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role_title text not null default '' check (length(role_title) <= 120),
  section_id uuid not null references public.people_sections(id),
  position integer not null,
  show_on_public boolean not null,
  photo_path text not null default '' check (photo_path = '' or photo_path ~ '^[a-f0-9-]{36}\.webp$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_section on public.people (section_id, position);
create trigger updated_at before update on public.people for each row execute function public.touch_updated_at();

-- The Executive board's roles, in the order its people are listed (review 2); null for any other title.
-- Repeated in `EXECUTIVE_ROLES` (src/lib/community/people.ts), which a test compares.
create function public.executive_roles() returns text[] language sql immutable
set search_path = '' as $$
  select array['President', 'Vice President (Brothers)', 'Vice President (Sisters)', 'Treasurer', 'Secretary'];
$$;
revoke all on function public.executive_roles() from public, anon, authenticated, service_role;
create function public.executive_role_rank(role text) returns integer language sql immutable
set search_path = '' as $$
  select array_position(public.executive_roles(), role);
$$;
revoke all on function public.executive_role_rank(text) from public, anon, authenticated, service_role;

-- Everyone in the Executive board holds one of its roles; the dashboard offers only those.
create function public.people_executive_role() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if public.executive_role_rank(new.role_title) is null
    and exists (select 1 from public.people_sections where id = new.section_id and kind = 'executive') then
    raise exception using errcode = 'SGU12', message = 'executive_role',
      detail = 'Choose one of the Executive board roles.';
  end if;
  return new;
end $$;
revoke all on function public.people_executive_role() from public, anon, authenticated, service_role;
create trigger executive_role before insert or update of section_id, role_title on public.people
for each row execute function public.people_executive_role();

-- Each Executive board role is held by one current person at a time (user, 2026-10-06): a second
-- current (not archived) person in the Executive board with the same role is refused, also on Restore.
-- Every such write takes one transaction lock first, so two saves of the same role run one after another
-- and the second sees the first (as the access guard does). The dashboard hands a role over with
-- `save_person_taking_role` below. Mirrored by `roleHolder` (src/lib/community/people.ts).
create function public.people_one_role_holder() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  holder text;
begin
  if new.archived_at is not null or public.executive_role_rank(new.role_title) is null
    or not exists (select 1 from public.people_sections where id = new.section_id and kind = 'executive') then
    return new;
  end if;
  perform pg_advisory_xact_lock(7401200302);
  select p.full_name into holder from public.people p
  where p.id <> new.id and p.archived_at is null and p.section_id = new.section_id
    and p.role_title = new.role_title;
  if found then
    raise exception using errcode = 'SGU17', message = 'role_taken',
      detail = format('%s is %s. Each Executive board role has one person at a time.', holder, new.role_title);
  end if;
  return new;
end $$;
revoke all on function public.people_one_role_holder() from public, anon, authenticated, service_role;
-- Named to run after `executive_role` (Postgres runs triggers by name), so a role outside the five is
-- refused as such first.
create trigger one_role_holder before insert or update of section_id, role_title, archived_at on public.people
for each row execute function public.people_one_role_holder();

-- The first Executive board role nobody current holds, in role order, or null when all five are held: the
-- role `owner_add_admin` gives a new manager.
create function public.first_free_executive_role() returns text language sql stable
set search_path = '' as $$
  select r.role from unnest(public.executive_roles()) with ordinality as r(role, rank)
  where not exists (select 1 from public.people p join public.people_sections s on s.id = p.section_id
    where s.kind = 'executive' and p.archived_at is null and p.role_title = r.role)
  order by r.rank limit 1;
$$;
revoke all on function public.first_free_executive_role() from public, anon, authenticated, service_role;

-- The Executive board and the General board always exist under their own names (review 2). A group's kind
-- never changes: new groups are the board's own (RLS below), and no group becomes permanent later.
create function public.people_sections_permanent() returns trigger language plpgsql
set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.kind is not null then
      raise exception using errcode = 'SGU13', message = 'permanent_group',
        detail = 'The Executive board and the General board cannot be renamed, archived or deleted.';
    end if;
    return old;
  end if;
  if new.kind is distinct from old.kind
    or (old.kind is not null and (new.name <> old.name or new.archived_at is not null)) then
    raise exception using errcode = 'SGU13', message = 'permanent_group',
      detail = 'The Executive board and the General board cannot be renamed, archived or deleted.';
  end if;
  return new;
end $$;
revoke all on function public.people_sections_permanent() from public, anon, authenticated, service_role;
-- Named to run before the other update triggers (Postgres runs them by name), so this refusal is the one shown.
create trigger always_kept before update or delete on public.people_sections
for each row execute function public.people_sections_permanent();

-- Dashboard access: one row per login, linked to its People entry, with the two permissions. Removing a
-- person (permanent delete, only from Archived) removes their access row with them.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  person_id uuid not null unique references public.people(id) on delete cascade,
  can_manage_people boolean not null default false,
  can_manage_money boolean not null default false,
  deactivated_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger updated_at before update on public.admins for each row execute function public.touch_updated_at();

-- Membership and permissions. A deactivated login is no longer an admin.
create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admins where user_id = (select auth.uid()) and deactivated_at is null);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create function public.can_manage_people() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admins
    where user_id = (select auth.uid()) and deactivated_at is null and can_manage_people);
$$;
create function public.can_manage_money() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admins
    where user_id = (select auth.uid()) and deactivated_at is null and can_manage_money);
$$;
revoke all on function public.can_manage_people() from public, anon, authenticated, service_role;
revoke all on function public.can_manage_money() from public, anon, authenticated, service_role;
grant execute on function public.can_manage_people() to anon, authenticated;
grant execute on function public.can_manage_money() to anon, authenticated;

-- The next order number at the end of a group (owner_add_admin; D-11 order is manual).
create function public.next_person_position(section uuid) returns integer language sql stable
set search_path = '' as $$
  select coalesce(max(position), 0) + 1 from public.people where section_id = section;
$$;
revoke all on function public.next_person_position(uuid) from public, anon, authenticated, service_role;

-- "Make <name> President instead?" (user, 2026-10-06): saves a People entry into an Executive board role
-- that `holder` holds now, and moves the holder to the end of the General board with no role title, in
-- one step: both or neither, each change logged by the activity trigger. Nobody is deleted. Only "manage
-- people" holders may (the form asks only them). `holder_version` is the holder's updated_at as the screen
-- showed it, and `version` the entry's (null: a new person); a changed row means someone else saved in
-- the meantime ('conflict'). Security invoker: RLS and the People triggers apply as for any save.
create function public.save_person_taking_role(person jsonb, version timestamptz, holder uuid,
  holder_version timestamptz)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  entry public.people := jsonb_populate_record(null::public.people, save_person_taking_role.person);
  general uuid;
begin
  if not (select public.can_manage_people()) then
    return 'forbidden';
  end if;
  select id into general from public.people_sections where kind = 'general';
  begin
    update public.people p
    set section_id = general, role_title = '',
      position = (select coalesce(max(o.position), 0) + 1 from public.people o where o.section_id = general)
    where p.id = save_person_taking_role.holder and p.id <> entry.id
      and p.updated_at = save_person_taking_role.holder_version and p.archived_at is null
      and p.section_id = entry.section_id and p.role_title = entry.role_title
      and exists (select 1 from public.people_sections s where s.id = p.section_id and s.kind = 'executive');
    if not found then
      raise exception using errcode = 'no_data_found';
    end if;
    if save_person_taking_role.version is null then
      insert into public.people (id, full_name, role_title, section_id, position, show_on_public, photo_path)
      values (entry.id, entry.full_name, entry.role_title, entry.section_id, entry.position,
        entry.show_on_public, coalesce(entry.photo_path, ''));
    else
      update public.people p
      set full_name = entry.full_name, role_title = entry.role_title, section_id = entry.section_id,
        position = entry.position, show_on_public = entry.show_on_public,
        photo_path = coalesce(entry.photo_path, '')
      where p.id = entry.id and p.updated_at = save_person_taking_role.version;
      if not found then
        raise exception using errcode = 'no_data_found';
      end if;
    end if;
  exception
    when no_data_found or unique_violation or sqlstate 'SGU06' then return 'conflict';
    when not_null_violation or check_violation or foreign_key_violation or sqlstate 'SGU12' then
      return 'invalid';
    when sqlstate 'SGU17' then return 'role_taken';
    -- Moving the holder out of the Executive board may change their access (the access guard).
    when sqlstate 'SGU01' then return 'self';
    when sqlstate 'SGU02' then return 'last_manager';
  end;
  return 'ok';
end $$;
revoke all on function public.save_person_taking_role(jsonb, timestamptz, uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.save_person_taking_role(jsonb, timestamptz, uuid, timestamptz) to authenticated;

-- "Manage people" and "manage money" are held only by Executive board members (user, 2026-10-06). The
-- dashboard offers the two permissions only there (`accessLocks`), and moving someone out of the
-- Executive board turns both off (`people_leave_executive` below).
create function public.in_executive_board(person uuid) returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.people p join public.people_sections s on s.id = p.section_id
    where p.id = person and s.kind = 'executive');
$$;
revoke all on function public.in_executive_board(uuid) from public, anon, authenticated, service_role;

create function public.admins_executive_only() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if (new.can_manage_people or new.can_manage_money) and not public.in_executive_board(new.person_id) then
    raise exception using errcode = 'SGU14', message = 'not_executive',
      detail = 'Only Executive board members can have "manage people" or "manage money".';
  end if;
  return new;
end $$;
revoke all on function public.admins_executive_only() from public, anon, authenticated, service_role;
create trigger executive_only before insert or update on public.admins
for each row execute function public.admins_executive_only();

-- Moving someone into or out of the Executive board, or changing an executive's role, needs "manage
-- people" (user, 2026-10-06): it gives or takes Pages (`can_edit_pages`) and the two permissions. The
-- site owner in the SQL editor (no signed-in user) is not asked.
create function public.people_executive_moves() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  executive uuid := (select id from public.people_sections where kind = 'executive');
begin
  if (select auth.uid()) is null or (select public.can_manage_people()) then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.section_id = executive)
    or (tg_op = 'UPDATE' and ((old.section_id = executive) <> (new.section_id = executive)
      or (new.section_id = executive and new.role_title is distinct from old.role_title))) then
    raise exception using errcode = 'SGU15', message = 'executive_move',
      detail = 'Only a board member who can manage people can move someone into or out of the Executive board or change an executive''s role.';
  end if;
  return new;
end $$;
revoke all on function public.people_executive_moves() from public, anon, authenticated, service_role;
create trigger executive_moves before insert or update of section_id, role_title on public.people
for each row execute function public.people_executive_moves();

-- Moving someone out of the Executive board turns off their "manage people" and "manage money" in the
-- same step, under the access guard: nobody moves themselves out while they hold "manage people", and
-- the last active holder stays (SGU01, SGU02).
create function public.people_leave_executive() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if old.section_id is distinct from new.section_id
    and exists (select 1 from public.people_sections where id = old.section_id and kind = 'executive') then
    update public.admins set can_manage_people = false, can_manage_money = false
    where person_id = new.id and (can_manage_people or can_manage_money);
  end if;
  return null;
end $$;
revoke all on function public.people_leave_executive() from public, anon, authenticated, service_role;
create trigger leave_executive after update of section_id on public.people
for each row execute function public.people_leave_executive();

-- The access guard. Every write to admins (dashboard functions, SQL editor, secret key, the auth.users
-- cascade) takes one transaction-scoped lock first, so concurrent permission changes run one after
-- another, then refuses self-removal (SGU01) and turning on one's own "manage money" (SGU09, PR6 D-18:
-- another person who can manage people gives it), and re-counts the other active managers with a fresh
-- snapshot (SGU02). Deactivation also deletes the person's Supabase sessions, which revokes their refresh
-- tokens (D-15).
create function public.admins_guard() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  was_manager boolean;
  stays_manager boolean := false;
  loses_access boolean;
begin
  perform pg_advisory_xact_lock(7401200301);
  was_manager := old.can_manage_people and old.deactivated_at is null;
  if tg_op = 'UPDATE' then
    stays_manager := new.can_manage_people and new.deactivated_at is null;
    loses_access := old.deactivated_at is null and new.deactivated_at is not null;
    if old.user_id = actor and (loses_access or (old.can_manage_people and not new.can_manage_people)) then
      raise exception using errcode = 'SGU01', message = 'self',
        detail = 'Nobody can remove their own access or their own "manage people" permission.';
    end if;
    if old.user_id = actor and new.can_manage_money and not old.can_manage_money then
      raise exception using errcode = 'SGU09', message = 'self_money',
        detail = 'Nobody can turn on their own "manage money" permission.';
    end if;
  else
    loses_access := old.deactivated_at is null;
    if old.user_id = actor then
      raise exception using errcode = 'SGU01', message = 'self',
        detail = 'Nobody can remove their own access.';
    end if;
  end if;
  if was_manager and not stays_manager and not exists (
    select 1 from public.admins
    where can_manage_people and deactivated_at is null and user_id <> old.user_id
  ) then
    raise exception using errcode = 'SGU02', message = 'last_manager',
      detail = 'At least one active person must keep "manage people".';
  end if;
  if tg_op = 'UPDATE' and loses_access then
    delete from auth.sessions where user_id = old.user_id;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
revoke all on function public.admins_guard() from public, anon, authenticated, service_role;
create trigger admins_guard before update or delete on public.admins
for each row execute function public.admins_guard();

-- D-12: archiving a person also deactivates their login in the same step (the guard applies). Changing
-- access needs "manage people" (D-8), so other admins cannot archive someone who has an active login.
create function public.people_archive_access() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and exists (select 1 from public.admins where person_id = new.id and deactivated_at is null) then
    if (select auth.uid()) is not null and not (select public.can_manage_people()) then
      raise exception using errcode = 'SGU03', message = 'forbidden',
        detail = 'Only a person with "manage people" can archive someone who has an active login.';
    end if;
    update public.admins set deactivated_at = now() where person_id = new.id and deactivated_at is null;
  end if;
  return null;
end $$;
revoke all on function public.people_archive_access() from public, anon, authenticated, service_role;
create trigger archive_access after update of archived_at on public.people
for each row execute function public.people_archive_access();

create trigger archived_read_only before update on public.people
for each row execute function public.archived_read_only();
create trigger archived_read_only before update on public.people_sections
for each row execute function public.archived_read_only();

-- A group is archived only when it holds no current people.
create function public.people_sections_archive_check() returns trigger language plpgsql
set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and exists (select 1 from public.people where section_id = new.id and archived_at is null) then
    raise exception using errcode = 'SGU04', message = 'section_in_use',
      detail = 'Move or archive the people in this group first.';
  end if;
  return new;
end $$;
revoke all on function public.people_sections_archive_check() from public, anon, authenticated, service_role;
create trigger archive_check before update of archived_at on public.people_sections
for each row execute function public.people_sections_archive_check();

-- Logins of all People entries, for admins only (emails live in Supabase Auth, not in public tables).
create function public.admin_accounts()
returns table (person_id uuid, user_id uuid, email text, can_manage_people boolean, can_manage_money boolean,
  deactivated_at timestamptz, last_sign_in_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.person_id, a.user_id, u.email::text, a.can_manage_people, a.can_manage_money,
    a.deactivated_at, u.last_sign_in_at, a.updated_at
  from public.admins a join auth.users u on u.id = a.user_id
  where (select public.is_admin());
$$;
revoke all on function public.admin_accounts() from public, anon, authenticated, service_role;
grant execute on function public.admin_accounts() to authenticated;

-- Link an existing Supabase Auth account (created by the invite) to a People entry. Retrying the same
-- link returns ok without a second row.
create function public.grant_access(person uuid, email text, manage_people boolean, manage_money boolean)
returns text language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  account uuid;
  target_id uuid;
  target_archived_at timestamptz;
  violated text;
begin
  if not (select public.can_manage_people()) then
    return 'forbidden';
  end if;
  select id into account from auth.users where lower(email) = lower(trim(grant_access.email));
  if account is null then
    return 'no_account';
  end if;
  select p.id, p.archived_at into target_id, target_archived_at
  from public.people p where p.id = grant_access.person for update;
  -- A person that no longer exists was permanently deleted from Archived.
  if target_id is null or target_archived_at is not null then
    return 'person_archived';
  end if;
  if exists (select 1 from public.admins where person_id = grant_access.person and user_id = account) then
    return 'ok';
  end if;
  if exists (select 1 from public.admins where person_id = grant_access.person) then
    return 'person_has_login';
  end if;
  if exists (select 1 from public.admins where user_id = account) then
    return 'already_linked';
  end if;
  if (grant_access.manage_people or grant_access.manage_money)
    and not public.in_executive_board(grant_access.person) then
    return 'not_executive';
  end if;
  insert into public.admins (user_id, person_id, can_manage_people, can_manage_money)
  values (account, grant_access.person, grant_access.manage_people, grant_access.manage_money);
  return 'ok';
exception when unique_violation then
  -- A concurrent invite won the race; report which side is already taken.
  get stacked diagnostics violated = constraint_name;
  return case when violated = 'admins_pkey' then 'already_linked' else 'person_has_login' end;
end $$;
revoke all on function public.grant_access(uuid, text, boolean, boolean) from public, anon, authenticated, service_role;
grant execute on function public.grant_access(uuid, text, boolean, boolean) to authenticated;

-- Change permissions or (de)activate a login. `version` is the access row's updated_at as last read;
-- a changed row means someone else changed it in the meantime. An archived person's login stays off
-- until the person is restored (D-12, D-19); the row lock keeps a concurrent archive out.
create function public.set_access(person uuid, manage_people boolean, manage_money boolean,
  active boolean, version timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare
  person_archived_at timestamptz;
begin
  if not (select public.can_manage_people()) then
    return 'forbidden';
  end if;
  select p.archived_at into person_archived_at from public.people p where p.id = set_access.person for share;
  if set_access.active and person_archived_at is not null then
    return 'person_archived';
  end if;
  update public.admins a
  set can_manage_people = set_access.manage_people,
    can_manage_money = set_access.manage_money,
    deactivated_at = case when set_access.active then null else coalesce(a.deactivated_at, now()) end
  where a.person_id = set_access.person and a.updated_at = set_access.version;
  if not found then
    return 'conflict';
  end if;
  return 'ok';
exception
  when sqlstate 'SGU01' then return 'self';
  when sqlstate 'SGU02' then return 'last_manager';
  when sqlstate 'SGU09' then return 'self_money';
  when sqlstate 'SGU14' then return 'not_executive';
end $$;
revoke all on function public.set_access(uuid, boolean, boolean, boolean, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.set_access(uuid, boolean, boolean, boolean, timestamptz) to authenticated;

-- Site owner only, from the Supabase SQL editor: add an admin whose Auth user already exists (until
-- invite emails work), or create the first manager of a new database, also when the club is locked
-- out. "Manage people" is for the Executive board only (2026-10-06): with it, the new People entry goes in
-- the Executive board with `executive_role`, or the first free one of its roles (President first).
-- One person per role: a named role someone holds is handed over as the dashboard's "Make … instead?"
-- does (its holder moves to the end of the General board with no role title), so the owner can always add
-- a manager, even when every role is held by people who cannot manage people. Without it, the General
-- board. Hidden either way; the board fills in the details in the dashboard.
create function public.owner_add_admin(email text, full_name text, manage_people boolean,
  executive_role text default null)
returns void language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  account uuid;
  board uuid;
  person uuid;
begin
  select id into account from auth.users where lower(email) = lower(trim(owner_add_admin.email));
  if account is null then
    raise exception 'No Supabase Auth user has the email %. Create it first: Authentication, Users, Add user.',
      owner_add_admin.email;
  end if;
  if exists (select 1 from public.admins where user_id = account) then
    raise exception 'The user % is already an admin. Change their access in the dashboard People list.',
      owner_add_admin.email;
  end if;
  select id into board from public.people_sections
  where kind = case when owner_add_admin.manage_people then 'executive' else 'general' end;
  if owner_add_admin.manage_people and owner_add_admin.executive_role is null then
    executive_role := public.first_free_executive_role();
    if executive_role is null then
      raise exception 'All five Executive board roles are held. Name the role to give %, for example: select public.owner_add_admin(''email'', ''Full name'', true, ''President''); its holder moves to the General board.',
        owner_add_admin.email;
    end if;
  elsif owner_add_admin.manage_people then
    update public.people p
    set section_id = general.id, role_title = '', position = public.next_person_position(general.id)
    from public.people_sections general
    where general.kind = 'general' and p.section_id = board and p.archived_at is null
      and p.role_title = owner_add_admin.executive_role;
  end if;
  insert into public.people (full_name, role_title, section_id, position, show_on_public)
  values (owner_add_admin.full_name,
    case when owner_add_admin.manage_people then owner_add_admin.executive_role else '' end, board,
    public.next_person_position(board), false)
  returning id into person;
  insert into public.admins (user_id, person_id, can_manage_people, can_manage_money)
  values (account, person, owner_add_admin.manage_people, false);
end $$;
revoke all on function public.owner_add_admin(text, text, boolean, text) from public, anon, authenticated, service_role;

-- The public team list (D-10, D-11): only people marked "Yes", in current groups, no account columns; a
-- photo whenever one is uploaded (review 2). The Executive board is listed by role, the other groups in the
-- board's order.
create function public.public_team()
returns table (section_id uuid, section_name text, section_position integer, person_id uuid, full_name text,
  role_title text, "position" integer, photo_path text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.position, p.id, p.full_name, p.role_title, p.position,
    nullif(p.photo_path, '')
  from public.people p join public.people_sections s on s.id = p.section_id
  where p.show_on_public and p.archived_at is null and s.archived_at is null
  order by s.position, s.name,
    case when s.kind = 'executive' then coalesce(public.executive_role_rank(p.role_title), 6) end,
    p.position, p.full_name;
$$;
revoke all on function public.public_team() from public, anon, authenticated, service_role;
grant execute on function public.public_team() to anon, authenticated;

-- Row level security. People data is read publicly only through public_team(). Any admin may add and
-- edit People entries and groups (D-7, D-8), and adds only the board's own groups (no kind); only "manage
-- people" holders may permanently delete, and only archived rows (D-6): a group only once nobody, archived
-- or not, is in it (the people foreign key). Access rows change only through the functions above.
alter table public.people_sections enable row level security;
alter table public.people enable row level security;
revoke all on public.people_sections, public.people from anon, authenticated, service_role;
grant select, insert, update, delete on public.people_sections, public.people to authenticated;

create policy admin_read on public.people_sections for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.people_sections for insert to authenticated
with check ((select public.is_admin()) and kind is null);
create policy admin_update on public.people_sections for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy manager_delete on public.people_sections for delete to authenticated
using (archived_at is not null and (select public.can_manage_people()));

create policy admin_read on public.people for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.people for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.people for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy manager_delete on public.people for delete to authenticated
using (archived_at is not null and (select public.can_manage_people()));

-- No public user can grant admin membership: a login reads its own row, admins read all of them.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated, service_role;
grant select on public.admins to authenticated;
create policy own_membership on public.admins for select to authenticated using (user_id = (select auth.uid()));
create policy admin_read on public.admins for select to authenticated using ((select public.is_admin()));

-- 3. Recent changes: the add-only activity log (PR3, ADR 0013, D-4, D-5) ---------------------------------------
--
-- What an entry holds (D-5):
-- - actor: the account id from the request (auth.uid()); null means the site owner (SQL editor) or the
--   database itself. Names are looked up in People when the log is read, never stored here.
-- - content tables, prayer_settings and people_sections: the full row before and after, so a prayer
--   version can be restored.
-- - a History restore (page text, prayer settings; review 3 D) is an update whose row gets a new
--   restored_from (the time of the version put back): the app labels it "Restored to the version of …".
-- - people and admins: only the columns that changed (every set column on create or delete). Personal
--   values (name, photo file name) are stored as the string "[private]", so the entry says which fields
--   changed without keeping the values, and a later permanent delete leaves no names behind. On create,
--   personal columns left empty (null or '') are not listed (D-27); on delete, neither are personal columns
--   that were empty (D-29). Saves that change nothing but updated_at are not logged.
-- - highlighted: prayer settings, an announcement that is urgent before or after the change (PR5a D-17), a new
--   Go2Pay link, the moment a fund's category locks, and a change to a season's anchor or days (PR6 D-18).
-- The triggers that write it are in 202610150004_recent_changes.sql.
create table public.activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor uuid,
  area text not null,
  record_id text not null,
  action text not null check (action in ('created', 'updated', 'archived', 'restored', 'deleted',
    'access_granted', 'access_changed')),
  before jsonb,
  after jsonb,
  highlight boolean not null default false
);
create index activity_log_recent on public.activity_log (occurred_at desc, id desc);
create index activity_log_record on public.activity_log (area, record_id, occurred_at desc);
-- Recent changes filtered by person (PR5a D-10).
create index activity_log_actor on public.activity_log (actor, occurred_at desc, id desc);

alter table public.activity_log enable row level security;
create policy admin_read on public.activity_log for select to authenticated using ((select public.is_admin()));
revoke all on public.activity_log from public, anon, authenticated, service_role;
revoke all on sequence public.activity_log_id_seq from public, anon, authenticated, service_role;
grant select on public.activity_log to authenticated;

-- No role, the table owner included, can change or remove entries.
create function public.activity_log_add_only() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'SGU05',
    message = 'The activity log is add-only: entries cannot be changed or removed.';
end $$;
revoke all on function public.activity_log_add_only() from public, anon, authenticated, service_role;
create trigger add_only before update or delete or truncate on public.activity_log
for each statement execute function public.activity_log_add_only();

-- Trigger arguments: the key column, then 'full' or 'changes', then (for 'changes') the personal columns.
create function public.record_activity() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  key_column text := tg_argv[0];
  changes_only boolean := tg_argv[1] = 'changes';
  private_columns text[] := coalesce(tg_argv[2:], '{}');
  old_row jsonb;
  new_row jsonb;
  entry_action text;
  before_value jsonb;
  after_value jsonb;
begin
  if tg_op <> 'INSERT' then
    old_row := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_row := to_jsonb(new);
  end if;
  if tg_op = 'UPDATE' and (old_row - 'updated_at') = (new_row - 'updated_at') then
    return null;
  end if;

  entry_action := case
    when tg_op = 'INSERT' and tg_table_name = 'admins' then 'access_granted'
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'DELETE' then 'deleted'
    when tg_table_name = 'admins' then 'access_changed'
    when old_row ->> 'archived_at' is null and new_row ->> 'archived_at' is not null then 'archived'
    when old_row ->> 'archived_at' is not null and new_row ->> 'archived_at' is null then 'restored'
    else 'updated'
  end;

  if changes_only then
    select jsonb_object_agg(key, case when key = any(private_columns) then to_jsonb('[private]'::text) else value end)
    into before_value
    from jsonb_each(old_row)
    where key <> 'updated_at' and (new_row is null or new_row -> key is distinct from value)
      and not (new_row is null and key = any(private_columns) and value in ('null'::jsonb, '""'::jsonb));
    select jsonb_object_agg(key, case when key = any(private_columns) then to_jsonb('[private]'::text) else value end)
    into after_value
    from jsonb_each(new_row)
    where key <> 'updated_at' and (old_row is null or old_row -> key is distinct from value)
      and not (old_row is null and key = any(private_columns) and value in ('null'::jsonb, '""'::jsonb));
  else
    before_value := old_row;
    after_value := new_row;
  end if;

  insert into public.activity_log (actor, area, record_id, action, before, after, highlight)
  values ((select auth.uid()), tg_table_name, coalesce(new_row, old_row) ->> key_column, entry_action,
    before_value, after_value,
    tg_table_name = 'prayer_settings'
      or (tg_table_name = 'announcements'
        and (old_row ->> 'urgent_until' is not null or new_row ->> 'urgent_until' is not null))
      or (tg_table_name = 'payment_item_links' and tg_op = 'INSERT')
      or (tg_table_name = 'payment_items'
        and (old_row ->> 'first_shown_at') is distinct from (new_row ->> 'first_shown_at'))
      or (tg_table_name = 'seasons' and exists (
        select 1 from unnest(array['hijri_month', 'hijri_first_day', 'hijri_last_day', 'board_starts_on',
          'board_ends_on']) as c(name)
        where (old_row ->> c.name) is distinct from (new_row ->> c.name))));
  return null;
end $$;
revoke all on function public.record_activity() from public, anon, authenticated, service_role;

-- 4. Seasons, merch and Go2Pay (PR6 contract, ADR 0019–0021; PR5c) -------------------------------------------
-- Funds and priced items link to Go2Pay products the board makes by hand. Nothing here stores a Go2Pay
-- order, a giver's details, a price or stock (D-2, D-9, D-66).

-- Seasons (D-6, D-12, D-13, D-15): an Islamic-calendar anchor (month, from day, until day; null until =
-- the month's last day) or typed calendar days. The board's confirmed or typed days are the only dates
-- stored; expected days are worked out by the app (season-policy.ts).
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  -- The page's address, /seasons/<slug> (Ramadan's is /ramadan): made once from the name by
  -- `season_slug`, never reused, never changed (PR5c, Q-10a).
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  -- The season's public page (PR5c, D-8, D-26): shown all year while ticked.
  has_page boolean not null default false,
  intro text not null default '' check (length(intro) <= 2000),
  schedule jsonb not null default '[]' check (public.valid_season_schedule(schedule)),
  -- A key of the sign-up forms list (page text `forms`), or '' for none.
  sign_up_form text not null default '' check (sign_up_form ~ '^([a-z0-9_]{1,40})?$'),
  photos jsonb not null default '[]' check (public.valid_photo_list(photos, 12)),
  hijri_month smallint check (hijri_month between 1 and 12),
  hijri_first_day smallint check (hijri_first_day between 1 and 30),
  hijri_last_day smallint check (hijri_last_day between 1 and 30),
  board_starts_on date,
  board_ends_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((hijri_month is null) = (hijri_first_day is null)),
  check (hijri_last_day is null or (hijri_month is not null and hijri_last_day >= hijri_first_day)),
  check (hijri_month is not null or (board_starts_on is not null and board_ends_on is not null)),
  check (board_starts_on is null or board_ends_on is null or board_ends_on >= board_starts_on)
);
create unique index seasons_current_name on public.seasons (lower(name)) where archived_at is null;
-- Every row, archived ones too: a season page's address is never reused.
create unique index seasons_slug on public.seasons (slug);

-- The address is made once from the name ("Islamic Awareness Week" → islamic-awareness-week; "-2",
-- "-3" … when taken) and kept as it is on every update, whatever is sent.
create function public.season_slug() returns trigger language plpgsql security definer
set search_path = '' as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  if tg_op = 'UPDATE' then
    new.slug := old.slug;
    return new;
  end if;
  base := left(trim(both '-' from regexp_replace(lower(coalesce(nullif(new.slug, ''), new.name)),
    '[^a-z0-9]+', '-', 'g')), 50);
  base := coalesce(nullif(trim(both '-' from base), ''), 'season');
  candidate := base;
  while exists (select 1 from public.seasons where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end $$;
revoke all on function public.season_slug() from public, anon, authenticated, service_role;
create trigger season_slug before insert or update on public.seasons
for each row execute function public.season_slug();

-- Merch (PR5c, D-9, D-27): collections (the current one leads the page; past ones show "Not for
-- sale"), items with ordered photos (the first is the cover), in the order the board drags them. A
-- size is a priced item below (`payment_items.merch_item_id`), with its own Go2Pay product: price,
-- stock and Sold out live only in Go2Pay (P-72 B). Any board member edits all of it (D-27 b).
create table public.merch_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  arabic text not null default '' check (length(arabic) <= 80),
  quote text not null default '' check (length(quote) <= 200),
  year text not null default '' check (length(year) <= 20),
  description text not null default '' check (length(description) <= 1000),
  era text not null check (era in ('current', 'past')),
  position integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.merch_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.merch_collections(id),
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 1000),
  garment text not null default '' check (length(garment) <= 60),
  colorway text not null default '' check (length(colorway) <= 60),
  photos jsonb not null default '[]' check (public.valid_photo_list(photos, 12)),
  position integer not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merch_items_collection on public.merch_items (collection_id, position);

-- Funds and priced items (D-58, D-59, D-77): one fixed category each; price, stock and the donation box
-- live in Go2Pay. A ticket or merch item is always General and has no heading.
create table public.payment_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('fund', 'priced')),
  category text not null check (category in ('zakat_al_fitr', 'zakat_al_mal', 'sadaqah', 'general')),
  about text not null default '' check (length(about) <= 300),
  heading text not null default '' check (length(heading) <= 40),
  listed boolean not null default false,
  position integer not null,
  season_id uuid references public.seasons(id),
  season_year smallint check (season_year between 1400 and 1600),
  shows_from date,
  shows_until date,
  first_shown_at timestamptz,
  -- A merch size (PR5c, D-27 a): the item it is a size of and its label ("M"); a priced item.
  merch_item_id uuid references public.merch_items(id),
  size_label text check (size_label is null or length(trim(size_label)) between 1 and 20),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'fund' or category = 'general'),
  check (kind = 'fund' or heading = ''),
  check (shows_from is null or shows_until is null or shows_until >= shows_from),
  check ((merch_item_id is null) = (size_label is null)),
  check (merch_item_id is null or (kind = 'priced' and season_id is null))
);
-- Every row, archived ones too: a Give address is never reused.
create unique index payment_items_slug on public.payment_items (slug);
-- One current size per label on an item.
create unique index payment_items_one_size on public.payment_items (merch_item_id, lower(size_label))
  where merch_item_id is not null and archived_at is null;

-- Which Go2Pay product each item links to (D-17, D-58): add-only; an item's newest row is its current
-- link; a product id belongs to one item, ever. The site never edits Go2Pay.
create table public.payment_item_links (
  go2pay_product_id bigint primary key check (go2pay_product_id > 0),
  payment_item_id uuid not null references public.payment_items(id),
  added_at timestamptz not null default now()
);
create index payment_item_links_item on public.payment_item_links (payment_item_id, added_at desc);

-- The category lock (D-61, SGU10): the first save of a fund with "Show on the Donate page" ticked stamps
-- `first_shown_at`; from then on its category and kind never change. No row's slug ever changes. A
-- client-sent `first_shown_at` is ignored. There is no unlock path.
create function public.fund_category_lock() returns trigger language plpgsql
set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.first_shown_at := null;
  else
    if new.slug is distinct from old.slug then
      raise exception using errcode = 'SGU10', message = 'fund_locked',
        detail = 'A Give address never changes.';
    end if;
    new.first_shown_at := old.first_shown_at;
    if old.first_shown_at is not null
      and (new.category is distinct from old.category or new.kind is distinct from old.kind) then
      raise exception using errcode = 'SGU10', message = 'fund_locked',
        detail = 'Givers have already seen this fund''s category. Make a new fund instead.';
    end if;
  end if;
  if new.kind = 'fund' and new.listed and new.first_shown_at is null then
    new.first_shown_at := now();
  end if;
  return new;
end $$;
revoke all on function public.fund_category_lock() from public, anon, authenticated, service_role;

-- A season a current item uses cannot be archived (SGU08).
create function public.seasons_archive_check() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and exists (select 1 from public.payment_items where season_id = new.id and archived_at is null) then
    raise exception using errcode = 'SGU08', message = 'in_use',
      detail = 'Move or archive the funds and items that use this season first.';
  end if;
  return new;
end $$;
revoke all on function public.seasons_archive_check() from public, anon, authenticated, service_role;

-- A merch item with current sizes cannot be archived (PR5c, SGU16, as SGU08): its sizes would stay
-- listed for visitors and out of the board's reach.
create function public.merch_items_archive_check() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if old.archived_at is null and new.archived_at is not null
    and exists (select 1 from public.payment_items where merch_item_id = new.id and archived_at is null) then
    raise exception using errcode = 'SGU16', message = 'in_use',
      detail = 'Archive this item''s sizes first.';
  end if;
  return new;
end $$;
revoke all on function public.merch_items_archive_check() from public, anon, authenticated, service_role;

-- Visitors read current seasons, current listed items and their links (an unlisted draft and its
-- Go2Pay product id stay private until the board shows it); board members read everything. Any board
-- member adds and edits items, links and seasons (D-65); "manage money" gates only the Payments screen,
-- which reads Go2Pay, not these tables. Links are never updated; nothing is deleted.
alter table public.seasons enable row level security;
alter table public.merch_collections enable row level security;
alter table public.merch_items enable row level security;
alter table public.payment_items enable row level security;
alter table public.payment_item_links enable row level security;
revoke all on public.seasons, public.merch_collections, public.merch_items, public.payment_items,
  public.payment_item_links from public, anon, authenticated, service_role;
grant select on public.seasons, public.merch_collections, public.merch_items, public.payment_items,
  public.payment_item_links to anon;
grant select, insert, update on public.seasons, public.merch_collections, public.merch_items,
  public.payment_items to authenticated;
grant select, insert on public.payment_item_links to authenticated;

create policy public_read on public.seasons for select to anon, authenticated using (archived_at is null);
create policy admin_read on public.seasons for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.seasons for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.seasons for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Merch (PR5c): visitors read current collections and the current items of current collections.
create policy public_read on public.merch_collections for select to anon, authenticated
using (archived_at is null);
create policy admin_read on public.merch_collections for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.merch_collections for insert to authenticated
with check ((select public.is_admin()));
create policy admin_update on public.merch_collections for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy public_read on public.merch_items for select to anon, authenticated
using (archived_at is null and exists (select 1 from public.merch_collections c
  where c.id = collection_id and c.archived_at is null));
create policy admin_read on public.merch_items for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.merch_items for insert to authenticated
with check ((select public.is_admin()));
create policy admin_update on public.merch_items for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy public_read on public.payment_items for select to anon, authenticated
using (archived_at is null and listed);
create policy admin_read on public.payment_items for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.payment_items for insert to authenticated
with check ((select public.is_admin()));
create policy admin_update on public.payment_items for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy public_read on public.payment_item_links for select to anon, authenticated
using (exists (select 1 from public.payment_items i
  where i.id = payment_item_id and i.archived_at is null and i.listed));
create policy admin_read on public.payment_item_links for select to authenticated
using ((select public.is_admin()));
create policy admin_insert on public.payment_item_links for insert to authenticated
with check ((select public.is_admin()));

create trigger updated_at before update on public.seasons
for each row execute function public.touch_updated_at();
create trigger updated_at before update on public.payment_items
for each row execute function public.touch_updated_at();
create trigger updated_at before update on public.merch_collections
for each row execute function public.touch_updated_at();
create trigger updated_at before update on public.merch_items
for each row execute function public.touch_updated_at();
create trigger archived_read_only before update on public.seasons
for each row execute function public.archived_read_only();
create trigger archived_read_only before update on public.payment_items
for each row execute function public.archived_read_only();
create trigger archived_read_only before update on public.merch_collections
for each row execute function public.archived_read_only();
create trigger archived_read_only before update on public.merch_items
for each row execute function public.archived_read_only();
create trigger archive_check before update of archived_at on public.seasons
for each row execute function public.seasons_archive_check();
create trigger archive_check before update of archived_at on public.merch_items
for each row execute function public.merch_items_archive_check();
create trigger fund_category_lock before insert or update on public.payment_items
for each row execute function public.fund_category_lock();

-- 5. Events, announcements, community news and newsletters ----------------------------------------------------

-- Events. The end comes after the start (review 2, 2026-10-05; mirrored by `recordSchema`): an empty start
-- time is all day, an empty end date is the start date, and an end time needs a start time. Status (PR5a D-2;
-- review 2): scheduled, postponed (new date not known yet) or cancelled, with a reason; a known new date is
-- just the event's date. An event may belong to a season (PR5c: listed on its page) and have one ticket
-- (PR6 D-5: a priced item; the action checks it is priced). Its sign-up link is a Google Forms link
-- (PR5b D-25).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null default '' check (length(summary) <= 500),
  body text not null default '' check (length(body) <= 20000),
  date date not null,
  expires_on date,
  start_time text not null default '' check (start_time = '' or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_date date,
  end_time text not null default '' check (end_time = '' or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text not null default '' check (length(location) <= 250),
  url text not null default '' check (url = '' or url ~ '^https://'),
  image_path text not null default '' check (image_path = '' or image_path ~ '^[a-f0-9-]{36}\.webp$'),
  image_alt text not null default '' check (length(image_alt) <= 250),
  file_path text not null default '' check (file_path = '' or file_path ~ '^[a-f0-9-]{36}\.pdf$'),
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'postponed')),
  status_note text not null default '' check (length(status_note) <= 250),
  season_id uuid references public.seasons(id),
  ticket_payment_item_id uuid references public.payment_items(id),
  check (expires_on is null or expires_on >= date),
  check (end_date is null or end_date >= date),
  check (end_time = '' or start_time <> ''),
  check (end_time = '' or coalesce(end_date, date) > date or end_time > start_time),
  check (image_path = '' or length(trim(image_alt)) > 0),
  constraint event_cancel_reason check (status <> 'cancelled' or length(trim(status_note)) > 0),
  constraint events_url_google_forms check (url = '' or public.is_google_form_url(url))
);
create index events_publication on public.events(published, date);
create unique index events_one_per_ticket_item on public.events (ticket_payment_item_id)
  where ticket_payment_item_id is not null;
create trigger updated_at before update on public.events for each row execute function public.touch_updated_at();

-- Announcements. One is urgent while `urgent_until` is set (PR5a D-1, D-16, D-17): it shows on every public
-- page until that exact time, then hides by itself. Priority is derived (never stored): urgent is never also
-- featured, has no date-only "Hide after", and ends on or after its own date (Grenada time). Several may be
-- current at once: no trigger, lock or cap.
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null default '' check (length(summary) <= 500),
  body text not null default '' check (length(body) <= 20000),
  date date not null,
  expires_on date,
  start_time text not null default '' check (start_time = '' or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null default '' check (end_time = '' or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text not null default '' check (length(location) <= 250),
  url text not null default '' check (url = '' or url ~ '^https://'),
  image_path text not null default '' check (image_path = '' or image_path ~ '^[a-f0-9-]{36}\.webp$'),
  image_alt text not null default '' check (length(image_alt) <= 250),
  file_path text not null default '' check (file_path = '' or file_path ~ '^[a-f0-9-]{36}\.pdf$'),
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  urgent_until timestamptz,
  check (expires_on is null or expires_on >= date),
  check (end_time = '' or (start_time <> '' and end_time > start_time)),
  check (image_path = '' or length(trim(image_alt)) > 0),
  constraint announcement_urgent_alone
    check (urgent_until is null or (not featured and expires_on is null
      and (urgent_until at time zone 'America/Grenada')::date >= date))
);
create index announcements_publication on public.announcements(published, date);
create trigger updated_at before update on public.announcements for each row execute function public.touch_updated_at();

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null default '' check (length(summary) <= 500),
  body text not null default '' check (length(body) <= 20000),
  date date not null,
  expires_on date,
  start_time text not null default '' check (start_time = '' or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null default '' check (end_time = '' or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text not null default '' check (length(location) <= 250),
  url text not null default '' check (url = '' or url ~ '^https://'),
  image_path text not null default '' check (image_path = '' or image_path ~ '^[a-f0-9-]{36}\.webp$'),
  image_alt text not null default '' check (length(image_alt) <= 250),
  file_path text not null default '' check (file_path = '' or file_path ~ '^[a-f0-9-]{36}\.pdf$'),
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expires_on is null or expires_on >= date),
  check (end_time = '' or (start_time <> '' and end_time > start_time)),
  check (image_path = '' or length(trim(image_alt)) > 0)
);
create index news_posts_publication on public.news_posts(published, date);
create trigger updated_at before update on public.news_posts for each row execute function public.touch_updated_at();

create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  summary text not null default '' check (length(summary) <= 500),
  body text not null default '' check (length(body) <= 20000),
  date date not null,
  expires_on date,
  start_time text not null default '' check (start_time = '' or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null default '' check (end_time = '' or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location text not null default '' check (length(location) <= 250),
  url text not null default '' check (url = '' or url ~ '^https://'),
  image_path text not null default '' check (image_path = '' or image_path ~ '^[a-f0-9-]{36}\.webp$'),
  image_alt text not null default '' check (length(image_alt) <= 250),
  file_path text not null default '' check (file_path = '' or file_path ~ '^[a-f0-9-]{36}\.pdf$'),
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expires_on is null or expires_on >= date),
  check (end_time = '' or (start_time <> '' and end_time > start_time)),
  check (image_path = '' or length(trim(image_alt)) > 0)
);
create index newsletters_publication on public.newsletters(published, date);
create trigger updated_at before update on public.newsletters for each row execute function public.touch_updated_at();

-- Visitors read what is currently visible (an urgent announcement disappears at its own end time); any
-- admin reads, adds and edits; removing archives, and only a "manage people" holder permanently deletes,
-- and only archived items (PR3 D-6, from the Archived tab).
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.news_posts enable row level security;
alter table public.newsletters enable row level security;
grant select on public.events, public.announcements, public.news_posts, public.newsletters to anon;
grant select, insert, update, delete on public.events, public.announcements, public.news_posts, public.newsletters
  to authenticated;

create policy public_read on public.events for select to anon, authenticated
using (public.community_item_visible(archived_at, published, null, expires_on));
create policy public_read on public.announcements for select to anon, authenticated
using (public.community_item_visible(archived_at, published, date, expires_on)
  and (urgent_until is null or urgent_until > now()));
create policy public_read on public.news_posts for select to anon, authenticated
using (public.community_item_visible(archived_at, published, date, expires_on));
create policy public_read on public.newsletters for select to anon, authenticated
using (public.community_item_visible(archived_at, published, date, expires_on));

create policy admin_read on public.events for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.events for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.events for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.events for delete to authenticated
using ((select public.is_admin()) and (select public.can_manage_people()) and archived_at is not null);

create policy admin_read on public.announcements for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.announcements for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.announcements for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.announcements for delete to authenticated
using ((select public.is_admin()) and (select public.can_manage_people()) and archived_at is not null);

create policy admin_read on public.news_posts for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.news_posts for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.news_posts for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.news_posts for delete to authenticated
using ((select public.is_admin()) and (select public.can_manage_people()) and archived_at is not null);

create policy admin_read on public.newsletters for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.newsletters for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.newsletters for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.newsletters for delete to authenticated
using ((select public.is_admin()) and (select public.can_manage_people()) and archived_at is not null);

-- 6. Prayer times and the musallah -----------------------------------------------------------------------------

-- One row (id = 1): the iqamah schedule, the weekly Jumu'ah, the changes for one date, the Hijri date
-- adjustment (-1, 0 or +1 day on top of the calculated Umm al-Qura date; PR4) and the iqamah offsets.
-- `confirmed`, `latitude`, `longitude`, `method`, `madhab` and `adjustments` are retired (ADR 0017; PR7: the
-- pin is `musallah_location`) and no longer read; a later change may drop them. `restored_from` is the
-- version a History restore put back (review 3 D: that version's time); null after any other save.
create table public.prayer_settings (
 id integer primary key default 1 check (id = 1),
 confirmed boolean not null default false,
 latitude double precision check (latitude between -90 and 90),
 longitude double precision check (longitude between -180 and 180),
 method text check (method in ('MuslimWorldLeague','Egyptian','Karachi','UmmAlQura','Dubai','MoonsightingCommittee','NorthAmerica','Kuwait','Qatar','Singapore','Tehran','Turkey')),
 madhab text check (madhab in ('Shafi','Hanafi')),
 valid_from text not null default '' check (valid_from = '' or valid_from ~ '^\d{4}-\d{2}-\d{2}$'),
 valid_until text not null default '' check (valid_until = '' or valid_until ~ '^\d{4}-\d{2}-\d{2}$'),
 fajr text not null default '' check (fajr = '' or fajr ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 dhuhr text not null default '' check (dhuhr = '' or dhuhr ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 asr text not null default '' check (asr = '' or asr ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 maghrib text not null default '' check (maghrib = '' or maghrib ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 isha text not null default '' check (isha = '' or isha ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 khutbah text not null default '' check (khutbah = '' or khutbah ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 jummah_iqamah text not null default '' check (jummah_iqamah = '' or jummah_iqamah ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 notice text not null default '' check (length(notice) <= 1000),
 restored_from timestamptz,
 updated_at timestamptz not null default now(),
 adjustments jsonb not null default '{"fajr":0,"sunrise":0,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}',
 iqamah_offsets jsonb not null default '{"fajr":null,"dhuhr":null,"asr":null,"maghrib":null,"isha":null}',
 exceptions jsonb not null default '[]',
 hijri_adjustment smallint not null default 0 check (hijri_adjustment between -1 and 1),
 check (not confirmed or (latitude is not null and longitude is not null and method is not null and madhab is not null)),
 check ((fajr = '' and dhuhr = '' and asr = '' and maghrib = '' and isha = '' and khutbah = '' and jummah_iqamah = '') or (valid_from <> '' and valid_until >= valid_from)),
 constraint prayer_adjustments_valid check(public.valid_prayer_map(adjustments,array['fajr','sunrise','dhuhr','asr','maghrib','isha'],-60,60,false)),
 constraint iqamah_offsets_valid check(public.valid_prayer_map(iqamah_offsets,array['fajr','dhuhr','asr','maghrib','isha'],0,120,true)),
 constraint prayer_exceptions_valid check(public.valid_prayer_exceptions(exceptions))
);
alter table public.prayer_settings enable row level security;
create policy public_read on public.prayer_settings for select to anon, authenticated using (true);
create policy admin_manage on public.prayer_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.prayer_settings to anon;
grant select, insert, update on public.prayer_settings to authenticated;
create trigger updated_at before update on public.prayer_settings for each row execute function public.touch_updated_at();

-- The one board-managed musallah location (PR7, D-1, D-3, D-8, D-9, E-1, E-2): one row (id = 1) that feeds
-- the public map, the Apple Maps and Google Maps directions, and the prayer start times. Board members move
-- it by dragging the dot in Prayer & iqamah → Musallah location. No delete and no "confirmed" switch (E-2).
create table public.musallah_location (
  id integer primary key default 1 check (id = 1),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now(),
  -- Grenada, Carriacou and Petite Martinique; not Petit St. Vincent or Union Island (D-9). Mirror of
  -- GRENADA_BOUNDS in src/lib/maps/place.ts (a test checks the two agree).
  constraint musallah_location_in_grenada
    check (latitude between 11.95 and 12.531 and longitude between -61.85 and -61.37)
);

-- Visitors read it; any admin moves it; nobody deletes it (E-3: the board drags the dot back instead).
alter table public.musallah_location enable row level security;
revoke all on public.musallah_location from public, anon, authenticated, service_role;
grant select on public.musallah_location to anon;
grant select, insert, update on public.musallah_location to authenticated;
create policy public_read on public.musallah_location for select to anon, authenticated using (true);
create policy admin_insert on public.musallah_location for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.musallah_location for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger updated_at before update on public.musallah_location
for each row execute function public.touch_updated_at();

-- 7. New board term (PR5a D-5, D-27 d) -------------------------------------------------------------------------

-- The hand-over steps the board ticks, edits, reorders and archives. `link` is a dashboard address only.
-- Ticks are `done_on`; "Start a new term" clears them.
create table public.handover_steps (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  details text not null default '' check (length(details) <= 500),
  link text not null default '' check (link = '' or link ~ '^/admin(/[a-z0-9-]+)*$'),
  position integer not null,
  done_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who holds each shared login: names come from People; no column can hold a password or a code.
-- A purged person leaves the holder empty; the purge is not blocked.
create table public.shared_logins (
  id uuid primary key default gen_random_uuid(),
  service text not null check (length(trim(service)) between 1 and 80),
  holder_person_id uuid references public.people(id) on delete set null,
  second_factor_person_id uuid references public.people(id) on delete set null,
  last_changed_on date,
  note text not null default '' check (length(note) <= 200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Any admin reads, adds and edits (D-27 d); nobody deletes (archive instead); visitors see nothing.
alter table public.handover_steps enable row level security;
alter table public.shared_logins enable row level security;
revoke all on public.handover_steps, public.shared_logins from public, anon, authenticated, service_role;
grant select, insert, update on public.handover_steps, public.shared_logins to authenticated;

create policy admin_read on public.handover_steps for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.handover_steps for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.handover_steps for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy admin_read on public.shared_logins for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.shared_logins for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.shared_logins for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger updated_at before update on public.handover_steps
for each row execute function public.touch_updated_at();
create trigger updated_at before update on public.shared_logins
for each row execute function public.touch_updated_at();
-- Archived rows are read-only until restored. On shared_logins the rule skips the database's own "holder
-- removed" update when a person is purged (`on delete set null` runs inside a trigger).
create trigger archived_read_only before update on public.handover_steps
for each row execute function public.archived_read_only();
create trigger archived_read_only before update on public.shared_logins
for each row when (pg_trigger_depth() < 1) execute function public.archived_read_only();

-- 8. Page text and the Qur'an verse library (PR5b contract, D-6, D-22, D-24, D-25; ADR 0026, 0027) --------------

-- One row per page-text document (the keys of `pageTextKeys` in src/lib/content/documents.ts). The
-- document's shape and the board's save rules live in the app (zod schemas, page-fields.ts); the database
-- keeps a JSON object per key, readable by everyone, written only by the Executive board (review 3 B). A
-- page's `sections` (its sections' order and which are shown; src/lib/content/page-layouts.ts) is part of
-- its document. `restored_from` is the version a History restore put back (review 3 D); null after any
-- other save.
create table public.page_texts (
  key text primary key check (key in ('site', 'prayer', 'jumuah', 'musallah', 'events', 'faq', 'resources',
    'newsletters', 'support', 'forms', 'home', 'about', 'get-involved', 'integrations', 'donate', 'contact',
    'community', 'reminder-places', 'merch')),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  restored_from timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_texts_forms_google_forms
    check (key <> 'forms' or public.page_text_forms_are_google_forms(document))
);

-- Who edits Pages (review 3 B, user 2026-10-05): the people in the Executive board group with a
-- login that is not turned off. No tick-box: moving someone in or out of the Executive board in People
-- gives or takes it at once. Mirrored by `editsPages` (src/lib/community/people.ts) for the sandbox
-- and the dashboard; this function is the authority.
create function public.can_edit_pages() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(
    select 1 from public.admins a
    join public.people p on p.id = a.person_id
    join public.people_sections s on s.id = p.section_id
    where a.user_id = (select auth.uid()) and a.deactivated_at is null
      and p.archived_at is null and s.kind = 'executive');
$$;
revoke all on function public.can_edit_pages() from public, anon, authenticated, service_role;
grant execute on function public.can_edit_pages() to authenticated;

alter table public.page_texts enable row level security;
revoke all on public.page_texts from public, anon, authenticated, service_role;
grant select on public.page_texts to anon;
grant select, insert, update on public.page_texts to authenticated;
create policy public_read on public.page_texts for select to anon, authenticated using (true);
create policy executive_insert on public.page_texts for insert to authenticated
with check ((select public.can_edit_pages()));
create policy executive_update on public.page_texts for update to authenticated
using ((select public.can_edit_pages())) with check ((select public.can_edit_pages()));
-- No delete policy: a page's text is replaced or restored from History, never removed.

create trigger updated_at before update on public.page_texts
for each row execute function public.touch_updated_at();

-- Save page with the sections of other page texts the page shows (dashboard polish, 2026-10-06): Prayer &
-- Musallah saves its own text, Jumu'ah's and Musallah directions' in one step, or none. Each text must still
-- have the version the screen read, or nothing changes and the result is 'conflict' (someone else saved
-- first). The rows are locked first, in one fixed order, so two saves at the same moment never overwrite
-- each other. Security invoker: RLS decides (the Executive board, above), each text is logged as its own
-- change by its trigger, and a History restore (one text, `restored_from`) stays a plain update.
create function public.save_page_texts(keys text[], documents jsonb[], versions timestamptz[])
returns text language plpgsql security invoker set search_path = '' as $$
declare
  total integer := coalesce(cardinality(keys), 0);
  found_rows integer;
begin
  if total = 0 or total > 10 or total <> coalesce(cardinality(documents), 0)
    or total <> coalesce(cardinality(versions), 0)
    or total <> (select count(distinct key) from unnest(keys) as key) then
    raise exception 'Give each page text once, with its document and version.' using errcode = '22023';
  end if;
  perform 1 from public.page_texts where key = any(keys) order by key for update;
  begin
    for i in 1 .. total loop
      update public.page_texts set document = documents[i], restored_from = null
      where key = keys[i] and updated_at = versions[i];
      get diagnostics found_rows = row_count;
      if found_rows = 0 then
        raise exception using errcode = 'no_data_found';
      end if;
    end loop;
  exception
    when no_data_found then return 'conflict';
  end;
  return 'ok';
end $$;
revoke all on function public.save_page_texts(text[], jsonb[], timestamptz[]) from public, anon, authenticated, service_role;
grant execute on function public.save_page_texts(text[], jsonb[], timestamptz[]) to authenticated;

-- The Qur'an verse library (PR5b D-24 as amended by review 3 E; ADR 0026): every whole verse short enough
-- for one line, the Uthmani Arabic with the Saheeh International meaning exactly as api.alquran.cloud gave
-- them. Filled once by 202610150003_quran_verses.sql (from src/lib/quran/verse-library.json) and fixed:
-- nobody (visitors, board members, the app's secret key) can add, change or remove a verse, so there is no
-- write grant, no history and no archive. The board only chooses which verse shows in each place (page
-- text `reminder-places`). Public pages read only this table, never the Qur'an service.
create table public.quran_verses (
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  reference text generated always as (surah::text || ':' || ayah::text) stored unique,
  surah_name text not null check (length(trim(surah_name)) between 1 and 60),
  arabic text not null check (length(trim(arabic)) between 1 and 300),
  meaning text not null check (length(trim(meaning)) between 1 and 1000),
  primary key (surah, ayah)
);

alter table public.quran_verses enable row level security;
revoke all on public.quran_verses from public, anon, authenticated, service_role;
grant select on public.quran_verses to anon, authenticated;
create policy public_read on public.quran_verses for select to anon, authenticated using (true);

-- 9. The daily check (daily-check contract, D-12, D-13; ADR 0022) ---------------------------------------------

-- What the nightly check already emailed to the MSA Gmail, so each problem gets at most two emails. No
-- personal data: a warning name such as `iqamah:2026-10-15`, the step and the day it was sent.
-- RLS on, no policies: only the server's secret key reads or writes.
create table public.warning_emails_sent (
  warning_key text not null check (length(warning_key) between 1 and 200),
  step text not null check (step in ('first', 'last_call')),
  emailed_on date not null,
  primary key (warning_key, step)
);
alter table public.warning_emails_sent enable row level security;
revoke all on public.warning_emails_sent from anon, authenticated;

-- 10. "Save order" after dragging (review fixes PR-2; PR5c) -----------------------------------------------------

-- People in a group, groups, funds, tickets, hand-over steps, merch collections and items: the rows get order
-- numbers 1, 2, 3 … in the order given, all in one step or none. Each row must still have the version the
-- screen showed and be current (not archived), or nothing changes and the result is 'conflict' (someone else
-- changed the list). Rows whose number is already right are not touched, so their version and the log stay
-- as they are. Security invoker: RLS decides who may change each table (any board member, PR3 D-7, D-8;
-- PR5a D-5; PR6 D-65), and every moved row is logged by its trigger.
create function public.save_order(list text, ids uuid[], versions timestamptz[])
returns text language plpgsql security invoker set search_path = '' as $$
declare
  total integer := coalesce(cardinality(ids), 0);
  current_position integer;
  found_rows integer;
begin
  if list not in ('people', 'people_sections', 'payment_items', 'handover_steps', 'merch_collections',
    'merch_items') then
    raise exception 'Unknown list %.', list using errcode = '22023';
  end if;
  if total = 0 or total > 500 or total <> coalesce(cardinality(versions), 0)
    or total <> (select count(distinct id) from unnest(ids) as id) then
    raise exception 'Give each row once, with its version.' using errcode = '22023';
  end if;
  -- Lock the rows first, in one fixed order, so a second board member saving the same list at the same
  -- moment waits here and then finds the newer versions ('conflict') instead of overwriting the first save.
  execute format('select 1 from public.%I where id = any($1) order by id for update', list) using ids;
  begin
    for i in 1 .. total loop
      execute format('select position from public.%I where id = $1 and updated_at = $2 and archived_at is null',
        list) into current_position using ids[i], versions[i];
      get diagnostics found_rows = row_count;
      if found_rows = 0 then
        raise exception using errcode = 'no_data_found';
      end if;
      if current_position <> i then
        execute format('update public.%I set position = $1 where id = $2', list) using i, ids[i];
      end if;
    end loop;
  exception
    when no_data_found then return 'conflict';
  end;
  return 'ok';
end $$;
revoke all on function public.save_order(text, uuid[], timestamptz[]) from public, anon, authenticated, service_role;
grant execute on function public.save_order(text, uuid[], timestamptz[]) to authenticated;

-- 11. Uploaded files: the private `community` bucket -----------------------------------------------------------

-- Private storage: draft attachments must not be accessible to anonymous users.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 3145728, array['image/webp','application/pdf']);
create policy admin_upload on storage.objects for insert to authenticated
with check (bucket_id = 'community' and (select public.is_admin()) and name ~ '^[a-f0-9-]{36}\.(webp|pdf)$');
create policy admin_read on storage.objects for select to authenticated
using (bucket_id = 'community' and (select public.is_admin()));

-- Public files: those of currently visible items (as their tables' public_read), the photos public_team()
-- shows (listed people with a photo), a photo a page's text names, and (PR5c) a photo of a season that has a
-- page, or of a current merch item in a current collection.
create policy published_attachment on storage.objects for select to anon, authenticated
using (bucket_id = 'community' and (
 exists(select 1 from public.events
   where public.community_item_visible(archived_at, published, null, expires_on) and (image_path = name or file_path = name)) or
 exists(select 1 from public.announcements
   where public.community_item_visible(archived_at, published, date, expires_on)
     and (urgent_until is null or urgent_until > now()) and (image_path = name or file_path = name)) or
 exists(select 1 from public.news_posts
   where public.community_item_visible(archived_at, published, date, expires_on) and (image_path = name or file_path = name)) or
 exists(select 1 from public.newsletters
   where public.community_item_visible(archived_at, published, date, expires_on) and (image_path = name or file_path = name)) or
 exists(select 1 from public.public_team() team where team.photo_path = name) or
 exists(select 1 from public.page_texts where public.page_text_names_file(document, name)) or
 -- `objects.name`: seasons and merch rows have a `name` of their own.
 exists(select 1 from public.seasons s
   where s.archived_at is null and s.has_page and public.page_text_names_file(s.photos, objects.name)) or
 exists(select 1 from public.merch_items i join public.merch_collections c on c.id = i.collection_id
   where i.archived_at is null and c.archived_at is null and public.page_text_names_file(i.photos, objects.name))
));

-- A stored file is in use while any row, archived or not, or any page's text names it.
create function public.community_file_in_use(file_name text) returns boolean language sql stable
security definer set search_path = '' as $$
  select exists(select 1 from public.events where image_path = file_name or file_path = file_name)
    or exists(select 1 from public.announcements where image_path = file_name or file_path = file_name)
    or exists(select 1 from public.news_posts where image_path = file_name or file_path = file_name)
    or exists(select 1 from public.newsletters where image_path = file_name or file_path = file_name)
    or exists(select 1 from public.people where photo_path = file_name)
    or exists(select 1 from public.page_texts where public.page_text_names_file(document, file_name))
    or exists(select 1 from public.seasons where public.page_text_names_file(photos, file_name))
    or exists(select 1 from public.merch_items where public.page_text_names_file(photos, file_name));
$$;
revoke all on function public.community_file_in_use(text) from public, anon, authenticated, service_role;
grant execute on function public.community_file_in_use(text) to authenticated;

-- Any admin may remove a stored file once no row uses it (after a permanent delete, a photo removal or
-- replacement, or an upload whose save was refused; PR3 D-23). Files still in use cannot be deleted or
-- replaced: there is no overwrite policy, which also protects a published file.
create policy admin_delete_unreferenced on storage.objects for delete to authenticated
using (bucket_id = 'community' and (select public.is_admin()) and not public.community_file_in_use(name));

-- The space the uploaded files take, in bytes (photo library and daily check, 2026-10-06): one number,
-- no names, so the nightly check can read it without a session. Supabase's free plan has 1 GB of Storage.
create function public.community_storage_bytes() returns bigint language sql stable
security definer set search_path = '' as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects where bucket_id = 'community';
$$;
revoke all on function public.community_storage_bytes() from public, anon, authenticated, service_role;
grant execute on function public.community_storage_bytes() to anon, authenticated;
