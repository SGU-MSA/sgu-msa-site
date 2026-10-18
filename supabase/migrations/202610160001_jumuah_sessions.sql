-- SGU MSA website: several Jumu'ah prayers each Friday (review fixes P2, 2026-10-07). Additive, after the four
-- baseline files (202610150001–4, never edited); applied by a human, staging first, after the user's OK. Safe to
-- run twice.
--
-- The weekly Jumu'ah becomes an ordered list `prayer_settings.jumuah_sessions`:
--   [{"khutbah":"HH:MM","iqamah":"HH:MM"}, …]   at most 4, each iqamah after its khutbah, in the order visitors
--   see them (mirrors jumuahSessionList in src/lib/prayer/adjustments.ts).
-- A changed Friday in `exceptions` holds that Friday's own prayers: {"change":"changed","sessions":[…]} with 1–4
-- (a weekly prayer left out is cancelled on that Friday only). "none" and "cancelled" are unchanged.
-- The single `khutbah` and `jummah_iqamah` columns are retired: copied into the list once, emptied, and no longer
-- read or written (an older History version that holds them is read as a list of one). They are dropped later,
-- in their own file, after the user confirms.
-- Also (step 7): the stored Hijri date correction is set to 0, because Prayer & iqamah no longer sets it.

-- 1. A list of Jumu'ah prayers: at least `min_count`, at most 4.
create or replace function public.valid_jumuah_sessions(value jsonb, min_count integer)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if value is null or jsonb_typeof(value) <> 'array'
    or jsonb_array_length(value) < min_count or jsonb_array_length(value) > 4 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(item) as key where not (key = any(array['khutbah','iqamah']))) then
      return false;
    end if;
    if jsonb_typeof(item->'khutbah') is distinct from 'string' or (item->>'khutbah') !~ '^([01]\d|2[0-3]):[0-5]\d$' then
      return false;
    end if;
    if jsonb_typeof(item->'iqamah') is distinct from 'string' or (item->>'iqamah') !~ '^([01]\d|2[0-3]):[0-5]\d$' then
      return false;
    end if;
    if (item->>'iqamah') <= (item->>'khutbah') then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

-- 2. The weekly list, with the same date rule as the fixed iqamah times.
alter table public.prayer_settings add column if not exists jumuah_sessions jsonb not null default '[]';
alter table public.prayer_settings drop constraint if exists jumuah_sessions_valid;
alter table public.prayer_settings add constraint jumuah_sessions_valid
  check (public.valid_jumuah_sessions(jumuah_sessions, 0));
alter table public.prayer_settings drop constraint if exists jumuah_sessions_need_dates;
alter table public.prayer_settings add constraint jumuah_sessions_need_dates
  check (jumuah_sessions = '[]'::jsonb or (valid_from <> '' and valid_until >= valid_from));

-- 3. A weekly Jumu'ah set before this file becomes the list's first prayer; the retired columns are emptied.
-- Runs before the one-date rule changes (step 4), so a stored one-date change is still accepted here (step 5
-- rewrites the old one-Friday shape).
update public.prayer_settings
set jumuah_sessions = jsonb_build_array(jsonb_build_object('khutbah', khutbah, 'iqamah', jummah_iqamah))
where jumuah_sessions = '[]'::jsonb and khutbah <> '' and jummah_iqamah > khutbah;
update public.prayer_settings set khutbah = '', jummah_iqamah = '' where khutbah <> '' or jummah_iqamah <> '';

-- 4. The one-date changes: as in 202610150001_schema.sql, except that a changed Friday holds its own prayers.
create or replace function public.valid_prayer_exceptions(value jsonb)
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
        if exists (select 1 from jsonb_object_keys(jumuah) as key where not (key = any(array['change','sessions']))) then return false; end if;
        if not public.valid_jumuah_sessions(jumuah->'sessions', 1) then return false; end if;
      else
        return false;
      end if;
      if change in ('cancelled','changed') and extract(isodow from checked_date) <> 5 then return false; end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end $$;

-- 5. A changed Friday saved in the old one-prayer shape {"change":"changed","khutbah","iqamah"} becomes
-- {"change":"changed","sessions":[{"khutbah","iqamah"}]}, so the row passes step 4's rule when it is next
-- changed outside the app too (a "site owner" SQL fix, or the later file that drops the retired columns).
-- Runs after step 4, which accepts the new shape; skipped when the result would still be refused (such as an
-- old iqamah at or before its khutbah), so the file never stops on old data. Already-new rows are left alone.
with rewritten as (
  select settings.id, (
    select jsonb_agg(
      case when item->'jumuah'->>'change' = 'changed' and not (item->'jumuah' ? 'sessions') then
        jsonb_set(item, '{jumuah}', jsonb_build_object('change', 'changed', 'sessions', jsonb_build_array(
          jsonb_build_object('khutbah', item->'jumuah'->'khutbah', 'iqamah', item->'jumuah'->'iqamah'))))
      else item end
      order by position)
    from jsonb_array_elements(settings.exceptions) with ordinality as rows(item, position)
  ) as exceptions
  from public.prayer_settings as settings
  where jsonb_typeof(settings.exceptions) = 'array' and exists (
    select 1 from jsonb_array_elements(settings.exceptions) as item
    where item->'jumuah'->>'change' = 'changed' and not (item->'jumuah' ? 'sessions'))
)
update public.prayer_settings as settings
set exceptions = rewritten.exceptions
from rewritten
where settings.id = rewritten.id and public.valid_prayer_exceptions(rewritten.exceptions);

-- 6. The starter hand-over step no longer points at the Hijri date setting (Prayer & iqamah no longer has it).
-- Only the unedited starter wording changes; a board's own wording is kept.
update public.handover_steps
set details = 'Upcoming events, iqamah end date, old notices.'
where details = 'Upcoming events, iqamah end date, Hijri date setting, old notices.';

-- 7. The Hijri date is always as calculated (the user removed the Hijri setting from Prayer & iqamah, review
-- fixes P2): a stored one-day correction is cleared, so the Prayer page, Home and the seasons follow the
-- calculation at once instead of after the next prayer save.
update public.prayer_settings set hijri_adjustment = 0 where hijri_adjustment <> 0;
