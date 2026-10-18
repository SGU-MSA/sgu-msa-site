-- SGU MSA website: Lists, newsletter images (review fixes P3, the approved plan of 2026-10-07). Additive: run
-- after the four baseline files (2026101500*), on staging first and only after the user's OK; applied by a human,
-- never by an app or an AI agent. Safe to run twice.
--
-- 1. Lists: the board's own choices for the event Category and Term boxes and a resource's Category, edited
--    on Dashboard → Lists (add, rename, drag to order). An option is deleted, never archived, and only while
--    nothing uses it: an event (archived or not) by its id, a resource on the Resources page by its slug.
-- 2. Events get an optional category and term from those lists.
-- 3. A newsletter may be an uploaded image (stored as WebP) as well as a PDF or a link.

-- 1. Lists -------------------------------------------------------------------------------------------------------

-- `slug` is made from the name when the option is added and kept when it is renamed: resources and addresses
-- (/resources?category=guide) name it. `archived_at` is always empty; it is there so `save_order` orders the
-- list like every other dragged list.
create table if not exists public.list_options (
  id uuid primary key default gen_random_uuid(),
  list text not null check (list in ('event_categories', 'terms', 'resource_categories')),
  name text not null check (length(trim(name)) between 1 and 60),
  slug text not null check (length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz check (archived_at is null),
  constraint list_options_one_slug unique (list, slug)
);
create unique index if not exists list_options_one_name on public.list_options (list, lower(trim(name)));

alter table public.list_options enable row level security;
revoke all on public.list_options from public, anon, authenticated, service_role;
grant select on public.list_options to anon;
grant select, insert, update, delete on public.list_options to authenticated;

-- Visitors read the lists (the public filters); any board member adds, renames, orders and deletes options.
drop policy if exists public_read on public.list_options;
create policy public_read on public.list_options for select to anon, authenticated using (true);
drop policy if exists admin_insert on public.list_options;
create policy admin_insert on public.list_options for insert to authenticated
with check ((select public.is_admin()));
drop policy if exists admin_update on public.list_options;
create policy admin_update on public.list_options for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists admin_delete on public.list_options;
create policy admin_delete on public.list_options for delete to authenticated
using ((select public.is_admin()));

-- An option keeps its list and its slug for life (only its name and place change), and is deleted only while
-- nothing uses it (23503, the foreign-key code: "Used by 3 events. Move them first.").
create or replace function public.list_options_guard() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.list <> old.list or new.slug <> old.slug then
      raise exception using errcode = '22023', message = 'An option keeps its list and its slug.';
    end if;
    return new;
  end if;
  if exists (select 1 from public.events where category_id = old.id or term_id = old.id)
    or (old.list = 'resource_categories' and exists (
      select 1 from public.page_texts t, jsonb_array_elements(
        case when jsonb_typeof(t.document -> 'items') = 'array' then t.document -> 'items' else '[]'::jsonb end
      ) as item
      where t.key = 'resources' and item ->> 'category' = old.slug)) then
    raise exception using errcode = '23503', message = 'in_use',
      detail = 'Move the events or resources that use this option first.';
  end if;
  return old;
end $$;
revoke all on function public.list_options_guard() from public, anon, authenticated, service_role;

drop trigger if exists guard on public.list_options;
create trigger guard before update or delete on public.list_options
for each row execute function public.list_options_guard();
drop trigger if exists updated_at on public.list_options;
create trigger updated_at before update on public.list_options
for each row execute function public.touch_updated_at();

-- The starter options: the event categories the calendar had and the resource kinds the Resources page had
-- (same slugs, so the starter resources keep theirs). No starter terms: the board adds them ("2026 Fall").
-- Added once, before the board has any option of that list.
insert into public.list_options (list, name, slug, position)
select 'event_categories', v.name, v.slug, v.position
from (values ('MSA', 'msa', 1), ('Academic', 'academic', 2), ('Informational', 'informational', 3),
  ('Faith', 'faith', 4), ('Social', 'social', 5)) as v(name, slug, position)
where not exists (select 1 from public.list_options where list = 'event_categories');
insert into public.list_options (list, name, slug, position)
select 'resource_categories', v.name, v.slug, v.position
from (values ('Newsletter', 'newsletter', 1), ('Infographic', 'infographic', 2), ('Guide', 'guide', 3),
  ('Academic', 'academic', 4), ('Faith', 'faith', 5), ('Ramadan', 'ramadan', 6),
  ('Incoming students', 'incoming-students', 7)) as v(name, slug, position)
where not exists (select 1 from public.list_options where list = 'resource_categories');

-- From here on every change is in Recent changes (after the starter options, so the log starts empty).
drop trigger if exists activity on public.list_options;
create trigger activity after insert or update or delete on public.list_options
for each row execute function public.record_activity('id', 'full');

-- "Save order" for the lists too: the baseline's `save_order` with `list_options` added to the lists it orders
-- (everything else unchanged).
create or replace function public.save_order(list text, ids uuid[], versions timestamptz[])
returns text language plpgsql security invoker set search_path = '' as $$
declare
  total integer := coalesce(cardinality(ids), 0);
  current_position integer;
  found_rows integer;
begin
  if list not in ('people', 'people_sections', 'payment_items', 'handover_steps', 'merch_collections',
    'merch_items', 'list_options') then
    raise exception 'Unknown list %.', list using errcode = '22023';
  end if;
  if total = 0 or total > 500 or total <> coalesce(cardinality(versions), 0)
    or total <> (select count(distinct id) from unnest(ids) as id) then
    raise exception 'Give each row once, with its version.' using errcode = '22023';
  end if;
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

-- 2. An event's category and term ----------------------------------------------------------------------------------

alter table public.events add column if not exists category_id uuid references public.list_options(id);
alter table public.events add column if not exists term_id uuid references public.list_options(id);

-- Each from its own list (22023: the form offers only that list's options).
create or replace function public.events_list_options() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if (new.category_id is not null and not exists (
      select 1 from public.list_options where id = new.category_id and list = 'event_categories'))
    or (new.term_id is not null and not exists (
      select 1 from public.list_options where id = new.term_id and list = 'terms')) then
    raise exception using errcode = '22023', message = 'Choose a category and term from their lists.';
  end if;
  return new;
end $$;
revoke all on function public.events_list_options() from public, anon, authenticated, service_role;
drop trigger if exists list_options on public.events;
create trigger list_options before insert or update of category_id, term_id on public.events
for each row execute function public.events_list_options();

-- 3. Newsletter images ---------------------------------------------------------------------------------------------

alter table public.newsletters drop constraint if exists newsletters_file_path_check;
alter table public.newsletters drop constraint if exists newsletters_file_path_kind;
alter table public.newsletters add constraint newsletters_file_path_kind
  check (file_path = '' or file_path ~ '^[a-f0-9-]{36}\.(pdf|webp)$');
