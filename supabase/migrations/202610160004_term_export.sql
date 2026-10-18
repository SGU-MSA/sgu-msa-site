-- Term export, "Free up space" (review fixes P5, the approved plan of 2026-10-07). Additive: one new function,
-- nothing in the baseline changes. Apply to staging first, after the user's OK.
--
-- After the board downloads a term's zip, a "manage people" holder may remove the photos and PDFs of the
-- ARCHIVED events, news posts and newsletters dated in that term. Only a file nothing else names is removed:
-- one that a current item, another day's item, an announcement, a person, a page's text, a season or a merch
-- item still uses stays, and so does its link on the archived item (the screen says it "stays"). The function
-- clears the freed file names (image_path, file_path); everything else in the row stays, the items stay
-- archived, and the activity log records each change as an ordinary update (History shows the photo or PDF
-- removed). Archived items are never public, so nothing on the public site changes. Announcements are not in
-- the zip, so they are not touched.
--
-- It returns the freed file names; the app then deletes exactly those through the Storage API, where the
-- existing `admin_delete_unreferenced` policy still decides.
--
-- Security invoker: RLS decides (any admin may update these tables), the explicit check below limits it to
-- "manage people" holders, and the activity log names the signed-in board member.
create function public.release_archived_files(from_day date, until_day date)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
  kinds constant text[] := array['events', 'news_posts', 'newsletters'];
  kind text;
  found text[];
  named text[] := '{}';
  freed text[] := '{}';
begin
  if from_day is null or until_day is null or until_day < from_day then
    raise exception 'Give a first day and a last day on or after it.' using errcode = '22023';
  end if;
  if not (select public.can_manage_people()) then
    raise exception 'Only a board member who can manage people can free up space.' using errcode = '42501';
  end if;

  -- 1. Lock the chosen items and collect the files they name.
  foreach kind in array kinds loop
    execute format(
      'select coalesce(array_agg(name), ''{}'')
       from (select image_path, file_path from public.%1$I
             where archived_at is not null and date between $1 and $2 and (image_path <> '''' or file_path <> '''')
             for update) as chosen,
            unnest(array[chosen.image_path, chosen.file_path]) as name
       where name <> ''''', kind)
    into found using from_day, until_day;
    named := named || found;
  end loop;
  if cardinality(named) = 0 then
    return '{}';
  end if;

  -- 2. Which of them nothing names once these items stop naming them. Tried in a block that is always rolled
  -- back (PL/pgSQL keeps the variables; TE001 is used only here and never leaves the block), so the one rule,
  -- `community_file_in_use()`, decides.
  begin
    foreach kind in array kinds loop
      execute format(
        'update public.%1$I set image_path = '''', file_path = ''''
         where archived_at is not null and date between $1 and $2 and (image_path <> '''' or file_path <> '''')',
        kind)
      using from_day, until_day;
    end loop;
    freed := coalesce((
      select array_agg(distinct name order by name)
      from unnest(named) as name
      where not public.community_file_in_use(name)), '{}');
    raise exception 'trial only' using errcode = 'TE001';
  exception when sqlstate 'TE001' then
    null;
  end;
  if cardinality(freed) = 0 then
    return '{}';
  end if;

  -- 3. Clear only the freed names; a file something else still uses keeps its link.
  foreach kind in array kinds loop
    execute format(
      'update public.%1$I set
         image_path = case when image_path = any($3) then '''' else image_path end,
         file_path = case when file_path = any($3) then '''' else file_path end
       where archived_at is not null and date between $1 and $2 and (image_path = any($3) or file_path = any($3))',
      kind)
    using from_day, until_day, freed;
  end loop;
  return freed;
end $$;
revoke all on function public.release_archived_files(date, date) from public, anon, authenticated, service_role;
grant execute on function public.release_archived_files(date, date) to authenticated;
