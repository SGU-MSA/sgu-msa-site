-- SGU MSA website: review fixes P4 (the approved plan of 2026-10-07, "P4. People, payments and seasons" and
-- "Team list on the public site"). Additive: runs after the four baseline files and changes none of them.
-- Applied by a human, on staging first, after the user's OK. Safe to run twice.
--
-- 1. The Executive board is always on the public team list, with a photo when one is uploaded; the other
--    groups list the people marked "Show on public page", by name and role only (no photos).
-- 2. Only Executive board members have a photo: a new photo for anyone else is refused (SGU40). Someone
--    moved out of the Executive board keeps their photo, hidden (never public, never shown as theirs in the
--    dashboard), so it is back if they return to the Executive board (user, 2026-10-07).
-- 3. A new person's "Show on public page" starts ticked in every group.
-- 4. The musallah pin stays within about 1.5 km of the SGU campus.
-- Mirrors: `publicTeamRows`, `photoAllowed` (src/lib/community/people.ts) and `nearCampus`
-- (src/lib/maps/place.ts); tests/team-list-migration.test.ts checks them against this file.

-- 1. The public team list, with each group's kind so the About page can draw the Executive board in tiers.
-- `public_team()` keeps its columns (the storage policy `published_attachment` reads its photos) and now
-- reads this one, so the rule is written once.
create or replace function public.public_team_list()
returns table (section_id uuid, section_name text, section_kind text, section_position integer, person_id uuid,
  full_name text, role_title text, "position" integer, photo_path text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.kind, s.position, p.id, p.full_name, p.role_title, p.position,
    case when s.kind = 'executive' then nullif(p.photo_path, '') end
  from public.people p join public.people_sections s on s.id = p.section_id
  where (p.show_on_public or s.kind = 'executive') and p.archived_at is null and s.archived_at is null
  order by s.position, s.name,
    case when s.kind = 'executive' then coalesce(public.executive_role_rank(p.role_title), 6) end,
    p.position, p.full_name;
$$;
revoke all on function public.public_team_list() from public, anon, authenticated, service_role;
grant execute on function public.public_team_list() to anon, authenticated;

create or replace function public.public_team()
returns table (section_id uuid, section_name text, section_position integer, person_id uuid, full_name text,
  role_title text, "position" integer, photo_path text)
language sql stable security definer set search_path = '' as $$
  select t.section_id, t.section_name, t.section_position, t.person_id, t.full_name, t.role_title, t."position",
    t.photo_path
  from public.public_team_list() t;
$$;
revoke all on function public.public_team() from public, anon, authenticated, service_role;
grant execute on function public.public_team() to anon, authenticated;

-- 2. Photos are for the Executive board only. Choosing a photo for anyone else is refused; a photo that was
-- already there (someone moved out of the Executive board, also by "Make <name> <role> instead?") is kept as it
-- is: `public_team_list()` shows it only while they are in the Executive board, and the file stays because the
-- row still names it.
create or replace function public.people_photo_executive_only() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.photo_path = ''
    or exists (select 1 from public.people_sections where id = new.section_id and kind = 'executive')
    or (tg_op = 'UPDATE' and new.photo_path = old.photo_path) then
    return new;
  end if;
  raise exception using errcode = 'SGU40', message = 'photo_executive_only',
    detail = 'Only Executive board members have a photo on the About page.';
end $$;
revoke all on function public.people_photo_executive_only() from public, anon, authenticated, service_role;
drop trigger if exists photo_executive_only on public.people;
create trigger photo_executive_only before insert or update of section_id, photo_path on public.people
for each row execute function public.people_photo_executive_only();

-- 3. "Show on public page" starts ticked for a new person in every group; the board can still untick it per
-- person, or per group on Edit groups. The Executive board is always listed (1 above).
alter table public.people_sections alter column shown_by_default set default true;
update public.people_sections set shown_by_default = true where not shown_by_default;

-- 4. The musallah pin: within about 1.5 km of the SGU campus (the starting pin, the "MSA Mosque" place,
-- 202610150002_starter_data.sql). Distance on a flat map, which is exact enough at this size.
alter table public.musallah_location drop constraint if exists musallah_location_near_campus;
alter table public.musallah_location add constraint musallah_location_near_campus check (
  power((latitude - 12.0025521) * 111320, 2)
    + power((longitude - (-61.7723834)) * 111320 * cos(radians(12.0025521)), 2) <= power(1500, 2)
);
