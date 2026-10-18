-- SGU MSA website: the database, part 4 of 4 (Recent changes). Run last: from here on every change to these
-- tables is written to the add-only activity log (public.activity_log, public.record_activity in
-- 202610150001_schema.sql), which the dashboard shows as Recent changes. The starter rows of parts 2 and 3
-- are not listed. Arguments: the key column, then 'full' (the whole row before and after) or 'changes' (only
-- the changed columns, with the personal ones named after it stored as "[private]").
create trigger activity after insert or update or delete on public.events
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.announcements
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.news_posts
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.newsletters
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.prayer_settings
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.musallah_location
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.people_sections
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.people
for each row execute function public.record_activity('id', 'changes', 'full_name', 'photo_path');
create trigger activity after insert or update or delete on public.admins
for each row execute function public.record_activity('person_id', 'changes');
create trigger activity after insert or update or delete on public.handover_steps
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.shared_logins
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.seasons
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.merch_collections
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.merch_items
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.payment_items
for each row execute function public.record_activity('id', 'full');
create trigger activity after insert or update or delete on public.payment_item_links
for each row execute function public.record_activity('go2pay_product_id', 'full');
create trigger activity after insert or update or delete on public.page_texts
for each row execute function public.record_activity('key', 'full');
