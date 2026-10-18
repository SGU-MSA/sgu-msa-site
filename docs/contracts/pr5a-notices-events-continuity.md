---
status: done
mode: full
---

# PR5a: Notices, event status, board continuity (implementation contract)

**Approved: user answers 2026-10-05** (`.plans/answers-2026-10-05.md`, round 1 Q28–Q45, Q91–Q94 and round 2 "Answer sheet 2"). Every product decision below is answered; nothing in PR5a waits for the user. Source plan: `.plans/pr5-self-serve-content.md` (rev 3), which stays the reference for PR5b and PR5c. Read against `origin/integration` @ b96ffa9 (2026-10-05). Decision numbers (D-n) are the umbrella plan's, so they can be traced; engineering choices made for this contract are E-n.

**Already shipped, not rebuilt here:** phone photos are made smaller in the browser before upload (PR5a-WP3, PR #59, 44627c3: `src/lib/media/photo-limits.ts`, `ImageField` shrinking), and the shrinking became silent with no success or size lines (PR #60, b96ffa9: answers Q92, Q93; D-28). This contract adds only the HEIC line and the real-device photo table (WP3c).

**Delivered as three PRs against `integration`** (one branch each, `git fetch origin && git checkout -b <branch> origin/integration` inside the worker's own worktree):

| PR                                 | Work packages                                                                                                                                                  | What the board and visitors get                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-A** Database and rules        | WP1 database, WP2 rules, ports, adapters, sandbox data                                                                                                         | Nothing visible yet; every rule PR-B and PR-C call, tested                                                                                                                                           |
| **PR-B** Editors and public pages  | WP4 editors with Edit \| Preview tabs, WP5 public urgent band and event status (plus the `/ramadan` eyebrow without a Hijri year), WP6 Jumu'ah notice question | Urgent notices that rotate under the menu on every page; Cancelled / Postponed events everywhere, calendar files included; the Jumu'ah "also show an urgent notice?" question; preview before saving |
| **PR-C** Board continuity and help | WP7 New board term + Recent changes filters + Remove login, WP8 help, tours, pictures, docs, WP3c HEIC line + real-device table                                | The new-term checklist and shared-login list; filtered Recent changes; help cards with pictures; one clear line for HEIC photos a browser can't open                                                 |

## Capability

**Board-managed notices and event states, and board continuity.** A board member marks an announcement Urgent with an exact end time and it shows under the menu on every public page until that minute; several urgent notices rotate in one ink band. An event carries a status (Scheduled, Cancelled with a reason, Postponed with or without a new date) that every public view and calendar file follows. Each content editor shows Edit | Preview tabs. A New board term screen keeps the hand-over checklist and the names of who holds each shared login (never a password). Recent changes can be filtered by person, kind and dates. All of it is stored in Supabase, logged in the add-only activity log, archived instead of deleted, and changed from `/admin` with no developer.

## Requested Behavior

From the D0 inventory (D7, D11, D12, D13, D14), the roadmap PR5 row and the user's answers of 2026-10-03 to 2026-10-05:

- **Announcement priority** Normal / Featured / Urgent (D-1). Urgent shows on every public page under the menu and hides by itself at its own exact end time (D-17). Several urgent notices may be current at once and rotate (D-16): style D (arrows, dots, swipe), newest first, **no pause/play button**; rotation stops for good once the visitor taps an arrow or a dot or swipes, waits while touched, hovered or focused, and never moves by itself with reduced motion (D-30).
- **Jumu'ah change → "Also show an urgent notice?"** required yes/no with an editable prefilled text and an editable end time 30 minutes after that Friday's iqamah (D-3, D-19).
- **Event status** Scheduled / Cancelled (reason) / Postponed (new date or "to be announced"); one record, one address, one calendar UID; calendar files say `STATUS:CANCELLED`; cancelled events stay in public lists, struck through, until their date; overnight events allowed (D-2, D-20; overnight and the known new date superseded by the D-20 amendment: an end date instead). The event page button reads "Sign up →" (D-7).
- **Edit | Preview tabs** on the event, announcement, news and newsletter editors, on every screen size (D-11, D-23); every box shows an example placeholder (D-26).
- **New board term** checklist and shared-login list, names only, logged; any board member runs it; a warning when fewer than two active people can manage people; "Remove login" for a deactivated person, "manage people" only (D-5, D-27 d/e).
- **Recent changes filters** by person, kind and date range; nothing ever removed (D-10).
- **Help** with pictures and "Show me how" tours for every new screen (ADR 0008).
- **HEIC:** one clear line when a browser can't open a HEIC photo; a real-device test table on the release checklist (D-29).
- **Hijri rule:** the `/ramadan` heading line says "Ramadan 2027", not "Ramadan 1448 AH"; the Hijri date stays only in the prayer-times block (D-31).

Non-goals (other items or other plans): page text, sign-up forms list, Google Forms link rule (D-25, moved whole to PR5b, E-6), Qur'an verse picker, `system-text.ts` (PR5b); season pages and merch, including the merch-only photo viewer (D-21, PR5c); funds, tickets and the cancelled-ticket rule in payment code (PR6 WP-9 reads `events.status`); photo-consent features (dropped, D-21); a full-page "preview as a visitor" (D-11); recurring or scheduled events; the "needs attention" list (daily-check plan).

User acceptance: a non-technical board member does each of the above from the dashboard on a phone, sees it before saving, can undo it, and the public site follows without a deploy.

## Existing System Evidence

- `src/lib/community/schema.ts`: `recordObject`/`recordSchema` (shared by the four collections; `featured`, `expires_on` "Hide after", `end_time` "must be after the start time, on the same day", `url` via `httpsUrl`), `recordFromRow`, `duplicateAsDraft`, `localDate`, `isVisible` (mirror of `community_item_visible()`), `isUpcoming`, `TIMEZONE = "America/Grenada"`.
- `supabase/migrations/202609090001_community.sql` (four identical tables, `end_time > start_time` check; `public.admins.user_id references auth.users on delete cascade`), `202610050001_people_access.sql` (`can_manage_people()`, deactivation, SGU01–SGU04, SGU06), `202610050002_activity_log.sql` (`record_activity(key, 'full'|'changes')`, highlight only for `prayer_settings`), `202610050003_archive.sql` (`community_item_visible`, `published_attachment`, `community_file_in_use`), `202610060001_prayer_simplification.sql` (latest file; PR6 `202610070001` and daily-check `202610080001` are drafts, not in the repo).
- `src/lib/community/queries.ts` `getRecords` (request-cached public reads); `src/lib/community/managed.ts` `managedEvents`; `src/lib/calendar/ics.ts` `eventToIcs` (`UID:${event.id}@sgu-msa`, no `STATUS` or `SEQUENCE` yet), `icsFileName`.
- `src/lib/backend/providers/contract.ts`: `ContentEditor`, `PeopleEditor`, `AccountInviter.deleteAccount` (used today only by `people-actions.ts` after a purge), `ActivityLog.list(query)`, `Outcome`, `WriteResult`; adapters `supabase.ts`, `sample.ts`, `supabase-people.ts`, `sample-people.ts`.
- `src/features/admin/actions.ts` (`saveRecordAction`, `savePrayerAction`, `restorePrayerVersionAction`), `fields.ts` (`contentFields`, `issuesOf`, `sessionExpired`, `staleScreen`, `fixBeforeSaving`, `chooseFileAgain`, box-named messages since PR #60), `form-state.ts` (`typedValues`, `recordFromTyped`, `keepTyped`), `ContentEditor.tsx`, `PrayerEditor.tsx`, `ViewTabs.tsx`, `RecordActions.tsx`, `ActivityFeed.tsx`, `AdminHeader.tsx`, `tour/steps.ts`, `help-pictures.ts`.
- `src/app/admin/activity/page.tsx` (25 per page, `?before=`), `src/lib/community/activity.ts` (`activityQuerySchema` = `before`, `limit`, `area`, `recordId`; private `areaNames`; `describeChange`; `actorLabel`).
- `src/lib/community/people.ts` (`accessLocks`, `accessChangeProblem`; no manager count helper).
- `src/app/admin/help/page.tsx` card `id: "term"`, "End of term" (the hand-over steps live there today as text).
- `src/shared/layout/SiteChrome.tsx` (root chrome: `LiveRefresh`, `Navbar`, `main`, `Footer`), `src/app/layout.tsx` (no `dynamic` export), `src/shared/layout/LiveRefresh.tsx` (60 s refresh on `/`, `/prayer`, `/calendar`, `/community`, `/ramadan`, `/resources`); ten routes already `force-dynamic` (`src/app/page.tsx`, `prayer`, `calendar`, `calendar/[eventId]`, `community`, `community/[kind]/[id]`, `about`, `ramadan`, `sitemap.ts`, `admin/layout.tsx`).
- `src/features/community/HomeNotice.tsx` (reads and renders the featured strip in one component), `src/features/calendar/EventCard.tsx`, `src/features/home/WeekSummary.tsx`, `src/features/community/CommunityPost.tsx`, `src/app/calendar/[eventId]/page.tsx` (button text "Register", line 97), `src/features/system/NotFoundSignpost.tsx`.
- `src/lib/prayer/congregation.ts` `jumuahFor(settings, now)`; `src/features/admin/PrayerEditor.tsx` (one-date changes section).
- Photos: `src/lib/media/photo-limits.ts` (`UPLOAD_IMAGE_TYPES`, `keepShrunk`, `shrinkTypeFor`, `newPhotosProblem`; no `isHeic`), `src/features/admin/ImageField.tsx` (`accept={UPLOAD_IMAGE_TYPES.join(",")}`), `tests/photo-limits.test.ts`, `tests/e2e/photos.spec.ts`.
- Hijri: `src/features/ramadan/eyebrow.ts` `ramadanEyebrow` ("Ramadan 1448 AH · Feb–Mar 2027"), its test in `tests/ramadan-tonight.test.ts`, `content/ramadan.yaml` `hero.eyebrow: "Ramadan 1448 AH"`; `TonightPanel` shows `HijriDate` with tonight's times; `docs/contracts/restyle-public.md` D-11 ("Hijri dates appear only with prayer times and Ramadan"); ADR 0018 (Hijri date sits with the prayer times).
- Next 16: `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` (route segment `dynamic` may be exported from a layout; options across a route must be compatible).
- Mockups: `.plans/mockups/pr5/` `urgent-notice(-dark)`, `announcement-editor`, `event-status`, `jumuah-notice`, `handover`, `activity-filters`; `.plans/mockups/urgent-rotation/d-arrows-dots-light.png` / `-dark.png` and `index.html` variant D (redrawn 2026-10-05 without the pause button).
- Searched and not found on `origin/integration` (terms `urgent`, `priority`, `status_note`, `postpone`, `handover`, `shared_login`, `isHeic`, `system-text`, `EditorTabs`): no existing owner for any PR5a concept.

## Owner

- **Announcement priority, urgent end, event status, rotation order, overnight rule:** `src/lib/community/schema.ts` (record shape and visibility mirror) and the community migrations; ICS stays in `src/lib/calendar/ics.ts`.
- **The rotating band:** `src/shared/ui/UrgentNoticeRotator.tsx` (Track B's component; built by PR-B from mockup variant D when Track B's is not in `integration` yet, E-3), fed only by `SiteChrome`.
- **Preview tabs:** `src/features/admin/preview/**` (`EditorTabs`, `useTypedValues`); previews render the public components themselves.
- **Board continuity:** port `HandoverEditor` in `src/lib/backend/providers/contract.ts`, pure rules `src/lib/community/handover.ts`; manager count in `src/lib/community/people.ts` (owner of access rules).
- **Recent changes filters:** `src/lib/community/activity.ts` (`activityKinds`, `activityQuerySchema`) and the `ActivityLog` port.
- **Photo limits and HEIC rule:** `src/lib/media/photo-limits.ts`; the only image input stays `ImageField`.
- **Fixed admin wording added by PR5a:** `src/features/admin/fields.ts` (today's owner; PR5b moves all of it to `src/lib/system-text.ts`, D-22).

## Source of Truth

| Rule or state                                                                         | Authority                                                                                             | Mirrors                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Urgent notice and its end time                                                        | `announcements.urgent_until timestamptz` (null = not urgent) + check `announcement_urgent_alone`      | `announcementPriority(record)` derives Normal / Featured / Urgent; never stored                |
| Which urgent notices show now                                                         | RLS (`community_item_visible(...)` and `urgent_until > now()`)                                        | `isVisible` in `schema.ts`                                                                     |
| Their order                                                                           | `currentUrgentNotices(records, now)` only: newest `date`, then latest `updated_at`, then `id` (D-30)  | the band; "Urgent now: N" in the Announcements list                                            |
| Event status                                                                          | `events.status`, `events.status_note` + checks (`moved_from` removed by the D-20 amendment)           | `eventStatusLine(record)`; `eventToIcs`; PR6 `paymentItemVisible` (PR6's file, reads `status`) |
| ~~Overnight events~~ (superseded: `events.end_date`, end after start; D-20 amendment) | events check `(end_time = '' or (start_time <> '' and end_time <> start_time))`                       | `isUpcoming`, the events form rule, ICS `DTEND` next day                                       |
| Jumu'ah notice end                                                                    | `JUMUAH_NOTICE_MINUTES_AFTER = 30` (prefill only; the saved notice's `urgent_until` is the authority) | the "Hide at" box                                                                              |
| Hand-over steps and ticks                                                             | `public.handover_steps`                                                                               | none                                                                                           |
| Shared-login holders                                                                  | `public.shared_logins` (no column can hold a password)                                                | none                                                                                           |
| "At least two people can manage people"                                               | `MIN_MANAGERS = 2` in `people.ts` (warning only); the database guard against zero managers is PR3's   | dashboard and New board term notice                                                            |
| Who did what                                                                          | `public.activity_log` (add-only, triggers)                                                            | Recent changes filters                                                                         |
| Photo size limits and HEIC                                                            | `normalizeUpload` on the server (3 MB, 1600 px); `UPLOAD_IMAGE_TYPES`                                 | `isHeic`, `shrinkPhoto` in the browser                                                         |
| Fixed admin messages added here                                                       | `src/features/admin/fields.ts`                                                                        | none                                                                                           |

## Reuse and Duplication Analysis

Reused unchanged: `currentAdmin`/`requireAdmin`, `publicClient()`, `Outcome`, `WriteResult`, `issuesOf`, `keepTyped`, `typedValues`, `recordFromTyped`, `FormMessages`, `ViewTabs`, `RecordActions`, `AdminHeader`, `ActivityFeed`, `ArchivedEntry`, `archived_read_only()`, `touch_updated_at()`, `record_activity`, `is_admin()`, `can_manage_people()`, `localDate`, `clock()`, `jumuahFor`, `NotFoundSignpost`, `AccountInviter.deleteAccount`, `accessFailures`, `normalizeUpload`, `shrinkPhoto`/`keepShrunk` (#59), `revalidatePath("/", "layout")`, `getRecords`.

Extended (one owner each): `recordSchema` (+ `urgent_until`, `status`, `status_note`, `moved_from`), `isVisible` (urgent end), `isUpcoming` (overnight), `managedEvents` (extracts `eventEntry(record)` so the public page and the preview build one view), `eventToIcs` (status, prefix, `SEQUENCE`), `activityQuerySchema` (+ `actors`, `areas`, `from`, `to`) and both `ActivityLog` adapters, `areaNames`/field names in `activity.ts`, `ContentEditor.tsx`, `contentFields`, `saveRecordAction`, `savePrayerAction`, `PrayerEditor.tsx`, `HomeNotice.tsx` (split into the reader plus a presentational `NoticeStrip`), `SiteChrome.tsx`, `app/layout.tsx`, `ImageField.tsx`, `photo-limits.ts`, the help page, tours and help pictures.

One model, not two: priority is derived from `featured` and `urgent_until` (no `priority` column); urgent notices are announcements (no banner table or setting); event status is a column on the one event row (no second event when postponed); previews import the public components (no admin copy of public markup); the Recent changes filter is the existing feed with more query fields (no second log screen).

Retired: the step list inside the "End of term" help card (moves to `handover_steps`; the card links to the screen); `src/features/ramadan/eyebrow.ts` and its test cases (E-7); the "Register" button text (now "Sign up →").

## New Abstractions

1. **`EditorTabs` + `useTypedValues`** (`src/features/admin/preview/`, client). Responsibility: "Edit | Preview" tabs on every screen size with the `ViewTabs` look and arrow-key movement; the Preview panel is `inert`, labelled "Preview (not saved)", and rendered from the form's current values read when the tab opens; the form stays mounted (hidden) so typed text and chosen files survive. Consumers: the four content editors now, the PR5b and PR5c editors later. Why shared: one "typed values now" read instead of four copies.
2. **`HandoverEditor`** port (adapters `supabase-handover.ts`, `sample-handover.ts`): list, save, archive and restore steps; `startNewTerm()`; list, save, archive and restore shared logins. Why a port: board writes go through ports (ADR 0012); the sandbox needs the sample adapter.
3. **`src/lib/community/handover.ts`** (pure): `handoverProgress(steps)` (done / total, current only), `nextPosition(steps)`.
4. **`UrgentNoticeRotator`** (`src/shared/ui/`, client; Track B's piece, E-3): props `{ notices: readonly { id: string; title: string; href: string }[] }`; one notice = static; two or more = D-30 behaviour. Private: animation, timers, swipe.
5. **`NoticeStrip`** (`src/features/community/`, presentational): the Featured strip's markup taken out of `HomeNotice` unchanged, so the preview can render it.

No new Context, provider, client store, service layer or dependency.

## Product Decisions Required

All answered; the user's words are in `.plans/answers-2026-10-05.md`.

- [x] Announcement priority Normal / Featured / Urgent; Urgent on every page with an exact end time
      Decision: D-1
- [x] Event status Scheduled / Cancelled / Postponed; page stays up; calendar files marked cancelled
      Decision: D-2
- [x] Jumu'ah change asks "Also show an urgent notice?"
      Decision: D-3
- [x] Browser makes photos smaller before upload (shipped, #59)
      Decision: D-4
- [x] New-term checklist with shared-login names, never passwords
      Decision: D-5
- [x] Recent changes keeps everything; filters by person, kind and dates
      Decision: D-10
- [x] Preview before saving
      Decision: D-11
- [x] Archive instead of delete; Duplicate
      Decision: D-12
- [x] PR5 split into PR5a, PR5b, PR5c (Q28)
      Decision: D-15
- [x] Several urgent notices at once (Q29)
      Decision: D-16
- [x] What hides at the end time; Featured without end; highlight (Q30)
      Decision: D-17
- [x] Ink band under the menu (Q29, Q31)
      Decision: D-18
- [x] When the automatic Jumu'ah notice shows (Q32)
      Decision: D-19
- [x] Event status design and overnight events (Q33, Q34)
      Decision: D-20
- [x] Photo viewer scope and photo consent (Q35, Q36)
      Decision: D-21
- [x] Edit | Preview tabs (Q38)
      Decision: D-23
- [x] Example placeholders in every box (Q41 note)
      Decision: D-26
- [x] Who runs the new-term checklist; Remove login (Q44 and recommendation)
      Decision: D-27
- [x] Wording; no photo success or size messages (Q45, Q92, Q93; shipped in #60)
      Decision: D-28
- [x] HEIC phone photos (Q94)
      Decision: D-29
- [x] Rotating band look and order; no pause/play button (round 2 Q3)
      Decision: D-30
- [x] Hijri dates only with prayer times and on the calendar (round 2 Q4 note)
      Decision: D-31

## Decisions

- D-1: Announcement priority Normal / Featured (homepage strip) / Urgent; Urgent shows on every public page under the menu and ends at an exact time (Grenada wall time, stored as `timestamptz`, never the date-only `expires_on`); no banner setting (user, 2026-10-03, D0 D7; rejected: banner setting).
- D-2: Event status Scheduled / Cancelled (reason) / Postponed (new date); the page stays up; calendar files say `STATUS:CANCELLED` (user, 2026-10-03, D0 D11; rejected: unpublish plus a separate announcement).
- D-3: A Jumu'ah exception asks a required "Also show an urgent notice?" with an editable prefilled message that ends after Jumu'ah (user, 2026-10-03, D0 D14, PR4 D-4 A).
- D-4: The browser shrinks photos before upload (user, 2026-10-03, D0 D13). Shipped in #59.
- D-5: Guided new-term checklist in the dashboard; names of shared-login holders only, never passwords; logged (user, 2026-10-03, D0 D12).
- D-10: Recent changes keeps everything; "Older changes"; filters by person, kind and date range (user, 2026-10-03).
- D-11: Preview before saving on each editor; a full-page "preview as a visitor" only if the board asks later (user, roadmap PR5 row).
- D-12: Archive instead of delete; Duplicate (user, 2026-10-03, ADR 0013).
- D-15: Three items; PR5a first, before or beside PR6 (user, 2026-10-05, Q28 A).
- D-16: Several urgent notices may be current at once, each with its own `urgent_until`; no "one at a time" trigger, lock or "Replace?" question; no cap on how many; band text at most `URGENT_BAND_MAX_CHARS = 80` characters so the band keeps one height (user, 2026-10-05, Q29; amended by D-30).
- D-17: At its end time the whole urgent notice hides from the public site; it stays in the dashboard and in Recent changes. Featured with no "Hide after" date gets a warning, not a refusal. Urgent changes are highlighted in Recent changes (user, 2026-10-05, Q30).
- D-18: The urgent band is a dark ink band under the menu (user, 2026-10-05, Q29/Q31; rejected: paper slip with a red line).
- D-19: The automatic Jumu'ah notice shows from the prayer save until 30 minutes after that Friday's iqamah (the new iqamah if moved, the usual one if cancelled), prefilled in an editable "Hide at" box (user, 2026-10-05, Q32 explained; rejected: from Thursday, until midnight Friday).
- D-20: One event record with `status`, a reason line and an optional `moved_from`; same address and same calendar UID. Postponed with a known date moves the date and shows "Postponed from Sat 10 Oct"; with no date yet it keeps the old date marked "new date to be announced" and the calendar file says `STATUS:TENTATIVE`. Cancelled events stay in public lists, struck through with the reason, until their date passes; the dashboard can always open, edit or reopen any event. Overnight events (10 PM – 3 AM) are allowed (user, 2026-10-05, Q33, Q34).
  - Amendment (user, 2026-10-05, second demo review; `.plans/review2-plan.md` PR-A 1, 2): **event dates** are a **Start date** (required) with an optional **Start time** (empty = all day) and an optional **End date** and **End time** (an empty end date is the start date); the end comes after the start, else the box is refused. A published event no longer needs a start time. The overnight rule ("an end earlier than the start is the next day") and `moved_from` are removed: `events.end_date` is added in `202609090001_community.sql` and `moved_from` with its check leaves `202610070001_notices_events_handover.sql` (edited in place: no hosted data, no backfill). **Status** is Scheduled, Postponed (new date not known yet: "Postponed: new date to be announced", `STATUS:TENTATIVE`) or Cancelled; a known new date is just the event's date ("New date is known" and "Postponed from …" are gone). Saving a **published** event whose date changes, or that is cancelled, asks the required **"Also post an announcement?"** with the text ("… moves to Sat 31 Oct" / "Cancelled: …") and **Hide at** (the end of the event's day, the earlier of the old and new day) prefilled; Yes posts an urgent notice like the Jumu'ah one (`answeredNotice` in `jumuah-notices.ts`, `src/lib/community/event-notice.ts`), No posts nothing. **Add to Calendar** depends on the device (`CalendarTarget`, `src/lib/calendar/targets.ts`): iPhone, iPad and Mac open the event's calendar file (`/calendar/<id>/ics`, `text/calendar`, inline), Android opens Google Calendar with the event filled in, other computers get a menu **Google Calendar** / **Outlook** / **Apple or other (file)**; Google and Outlook links come from the same `calendarTimes`/`calendarDetails` as the file; detected in the browser only, so the server and a browser without JavaScript give the file.
- D-21: The full-size viewer opens merch photos only (PR5c); event and news photos are not wrapped in `ImageViewer`. No photo-consent features on posts, events, news or merch (user, 2026-10-05, Q35 B, Q36).
- D-23: "Edit | Preview" tabs on every screen size (user, 2026-10-05, Q38; rejected: side by side, Preview button).
- D-26 (PR5a part): every box in the PR5a editors shows an example placeholder, never saved (user, 2026-10-05, Q41 note).
- D-27 (PR5a part): (d) any board member runs the new-term checklist and the shared-login list; (e) "Remove login" for a deactivated person, "manage people" only (user, 2026-10-05, Q44 and our recommendation).
- D-28: Mockup wording approved; shrinking is silent; only real photo problems show (user, 2026-10-05, Q45, Q92, Q93 B). Shipped in #60.
- D-29: HEIC (engineering, stated to the user): `accept` stays JPEG, PNG, WebP; a browser that can't open HEIC stops the save with "This photo is in HEIC format, which this browser can't open. Share it from the phone as JPEG (or take a screenshot), then choose it again."; no converter library now (user, 2026-10-05, Q94).
- D-30: The urgent band is **style D** (‹ › arrows, dots, swipe, "1 of N"), **newest first**, with **no pause/play button**. It moves on by itself every 7 s until the visitor taps an arrow or a dot or swipes, then stops for good on that page; it waits while touched, hovered or focused; with reduced motion it never moves by itself (user, 2026-10-05, answer sheet 2 Q3: "why is there a pause/play button? remove that please."; rejected: A slide up, B fade, C ticker; ending-soonest first; board-set order).
- D-31: **HIJRI RULE**: Hijri dates appear only with prayer times and on the calendar. In PR5a: the `/ramadan` heading line reads "Ramadan 2027", not "Ramadan 1448 AH"; the Tonight panel (the prayer-times block) keeps its Hijri date (user's round 2 Q4 note "just write ramadan. keep hijri only on calendar or prayer", resolved by the orchestrator 2026-10-05). Amends `docs/contracts/restyle-public.md` D-11 for Ramadan.
- D-32 (review fixes P1, approved plan of 2026-10-07): the Edit | Preview tabs (D-11, D-23) are replaced by an eye button that opens a full-screen Preview of the real public page with the unsaved values, at Desktop, Tablet or Phone width (`EditorPreview`, `PreviewFrame`). The manager warning (D-27) moves into the dashboard's notifications bell, shown only to people with Manage people (who can fix it; what others should see is an open question in the release checklist). An event's preview is its own page (`EventDetail`, shared with `/calendar/[eventId]`).

Engineering choices (ours, stated in one line each):

- E-1: Every public route renders the band, so the root layout exports `dynamic = "force-dynamic"` (allowed in a layout by the Next 16 guide); an urgent notice then ends at its exact minute. Rejected: `revalidate = 60` (ends up to a minute late; `LiveRefresh` already refreshes six routes every 60 s either way).
- E-2: Band timing is fixed in the component: 7 s per notice, 0.48 s move (`--motion-reveal`), swipe threshold 40 px.
- E-3: `UrgentNoticeRotator` is Track B's component. If Track B's is not in `integration` when PR-B starts, PR-B builds it to mockup variant D with tokens and a Storybook story in light and dark; Track B restyles that same file later (one component either way).
- E-4: The Supabase adapter sends `urgent_until` only for announcements and the three status fields only for events, from one column list per collection beside the existing row mapping.
- E-5: Fixed messages added in PR5a live in `src/features/admin/fields.ts` until PR5b-WP2 moves every fixed message to `src/lib/system-text.ts`.
- E-6: The Google Forms link rule (D-25: `isGoogleFormUrl` and the events `url` SQL check) moves whole into PR5b, so the TypeScript rule and its SQL mirror land in one PR; the umbrella plan's PR5a migration comment is updated to say so.
- E-7: The `/ramadan` heading line becomes the plain text "Ramadan 2027" in `content/ramadan.yaml`; `ramadanEyebrow` and its test cases are deleted; a unit test refuses a Hijri year (1300–1599) in that line. PR5c later moves the line into the season page.
- E-8: `SEQUENCE` in calendar files = the row's `updated_at` in whole seconds since 2026-01-01 (always increasing, fits ICS's integer).
- E-9: Recent changes filters use the URL (`who`, `what`, `from`, `to`, `before`), so "Older changes" and shared links keep them.

Engineering choices made while building PR-A (2026-10-05; no product change):

- E-10: The migration is `supabase/migrations/202610070001_notices_events_handover.sql` (the next free number; PR6's draft, also numbered `202610070001`, takes a later number when it lands, so files apply in merge order).
- E-11: `eventEntry` lives in `src/lib/community/event-entry.ts` (pure, browser-safe) instead of `managed.ts`, which is server-only and so cannot be imported by the client-side Preview; `managedEvents` uses it. It takes an optional `provenance` (default `"live"`) for the sample "pending" label.
- E-12: In TypeScript an empty `urgent_until` or `moved_from` is `""` (null in the database), like `expires_on`; the content forms already post every record field as hidden inputs, so saving with today's editors keeps the new fields.
- E-13: `recordFormSchema(kind, chosen, names, now?)` takes the server clock as an optional fourth argument for "Hide at: choose a time later than now."; PR-B passes `clock().now()`.
- E-14: A copy (Duplicate) is not urgent and is scheduled, like it is not featured.
- E-15: `archived_read_only` on `shared_logins` skips the database's own `on delete set null` update (`when (pg_trigger_depth() < 1)`), so purging a person who held an archived login is not blocked.
- E-16: Recent changes keeps highlighting prayer changes on the dashboard only: `recentPrayerChange` now also checks the area, since urgent notices are highlighted too.
- E-17: "Adapter contract tests for both handover adapters" (WP2) runs the `HandoverEditor` conformance suite on the sample adapter only. The Supabase adapters (`supabase-handover.ts`, and the new `supabaseActivityLog` filters) build their client from Next's request cookies (`adminClient()`), so, like the People adapters, they are not run outside Next; the rules they rely on (version check, `archived_read_only`, no deletes, the log trigger) are covered at the database level by `tests/notices-migration.test.ts` and `npm run test:backend`, and the adapters themselves by How-to-test step 60 on staging and the PR-C New board term and Recent changes steps. Gap to close when a stack-level adapter harness exists (PR-C or later).

Engineering choices made while building PR-B (2026-10-05; no product change):

- E-18: The band reaches `SiteChrome` through `managedUrgentNotices()` in `managed.ts` (shared components never import the runtime); a small client `UrgentBand` hides it on `/admin` and keys `UrgentNoticeRotator` by page, so each page starts at the newest notice and moves by itself again. The exiting slide is `inert` and `aria-hidden` during its 0.48 s move.
- E-19: The priority box posts `priority`, `urgent_on`, `urgent_at`; the status box posts `status`, `status_note`, `postponed_date` and `original_date` (the saved `moved_from`, else the saved date). `recordFromTyped` turns them into record fields for both the save and the Preview: an incomplete "Hide at" is refused as "Hide at: choose a valid date and time."; the reason is kept only while Cancelled; `moved_from` is set only once the Date box differs from `original_date`. `recordFormSchema` no longer adds "later than now" to an unreadable "Hide at".
- E-20: `EventHeader` (the event page's top) and `newsletterIssue` (beside `eventEntry`) are extracted so the Preview draws the public parts; `NewsletterArchive` takes only `issues`. The Preview's "Scheduled" line uses the server's Grenada day, passed by the edit page.
- E-21: The Jumu'ah rules live in `src/lib/prayer/jumuah-notice.ts` (`asksJumuahNotice`, `jumuahNoticeText`, `jumuahNoticeEnd`), used by the form for the prefill and by `savePrayerAction`, which compares against the saved settings it reads before saving, refuses an unanswered question, checks each Yes notice with the announcement rules before writing anything, saves the prayer change, then the notices; a failed notice redirects with `?notice=failed`.
- E-22: The status box sits at the end of the event form; the Location hint is replaced by its placeholder; help pictures were re-taken in PR-B because the content forms changed (PR-C re-takes them again with its screens).

Engineering choices made while building PR-C (2026-10-05; no product change):

- E-23: The New board term is three screens: `/admin/handover` (checklist, "Start a new term…", shared logins), `/admin/handover/steps` ("Edit the steps": reword, Move up / Move down, archive, restore, add) and `/admin/handover/logins/[id]` (add or edit an account; an archived one shows Restore). Archived accounts are listed under "Archived accounts" with Restore. A tick saves at once from the checklist without leaving the page (focus stays on the box); the form is sent from `onSubmit`, not `action`, because React resets a form after its action. A step keeps its "Done on" day when reworded; a new step goes after every step, archived ones included. Move up / Move down swaps the two order numbers (two version-checked saves). A step's link is chosen from a list of dashboard pages (`stepPages`), never typed; Community news is not in it because its address has "_", which the database check refuses.
  - Amendment (user, 2026-10-05; review-fixes PR-2, see the [PR3 contract](pr3-people-permissions-activity.md) amendment of that date): "Edit the steps" reorders by dragging (handle ⠿, or the Move up / Move down arrows) and one **Save order** for the whole list (`OrderedList`, `save_order`); `moveHandoverStepAction` and the per-step Move buttons are removed, and the step headings lose their "7." number.
- E-24: The shared-login list keeps the approved table on wide screens and becomes one card per account in a narrow column (a container query), so it fits beside the checklist; the account name is the edit link (no separate Edit column). The mockup's "Term started …" line and the red "change it" on an old password date are left out: no stored term start and no age rule exist in this contract.
- E-25: Recent changes filters are a plain GET form (`who`, `what`, `from`, `to`, kept with `before`), parsed by `activityFiltersFrom` in `activity.ts`; a value that is not valid is ignored. "Who" lists everyone who has or had a login, by People name, plus "Site owner"; `who` is a People id and the query covers every login that person has or had (`actors`). A removed login is found in the log itself (the access row's delete is logged with its `user_id` under the person's id; `removedLoginsIn`, `ActivityLog.logins()`), so after Remove login the person's past changes keep their name without a new table. The summary line has no total count (the log port returns pages, not counts). A highlighted urgent notice is labelled "Urgent notice" (prayer changes keep "Prayer change").
- E-26: Remove login is shown inside the Dashboard login box for a deactivated login (also of an archived person), to "manage people" holders; `removeLoginAction` re-reads the person, requires the deactivated state and the version on screen, and the typed name (case and outer spaces ignored).
- E-27: HEIC: `ImageField` stops the save with the D-29 line when the chosen file is HEIC (`isHeic`) and the browser could not make a JPEG copy. The e2e fixture is a generated file starting with a HEIC header (no binary committed); Chromium cannot open it, like real HEIC. The test computers cannot make a real HEIC, so "WebKit turns HEIC into JPEG" is a row of the manual device table, not an automatic test (WP3c allows this).
- E-28: Tours: `content` gains "Edit or Preview", "How important is it?" and "Is it still happening?"; `prayer` gains the Jumu'ah notice question; `dashboard` gains "New board term"; new `handover` and `activity` tours. Steps whose element is not on the page are left out, as before.
- Amendment to D-30 (user, 2026-10-05; review fixes PR-1): the urgent band shows no visible "1 of N"; the arrows and dots stay, and each notice keeps its "1 of N" name for screen readers.
- Amendment to E-1 (engineering, review fixes PR-C, 2026-10-05; [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md), [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): the root layout no longer exports `dynamic = "force-dynamic"` (Cache Components are on, which forbid it). The urgent band streams in its own `<Suspense>` in `SiteChrome`; announcement rows are cached for a minute (`cacheLife("minutes")`, tag `announcements`, expired by every board save) and `getRecords` still filters them with `currentUrgentNotices(records, now)` on every visit, so a notice still ends at its exact minute. The rest of the page is sent at once from a shell built ahead of time. `tests/pr5a-editors.test.ts` asserts the band's Suspense, the per-visit filter and that no route segment exports `dynamic`, `revalidate` or `fetchCache`.

- Amendment (user, 2026-10-06; approved final plan `.plans/final-plan.md` A6, the **photo library**): the uploads (photos and PDFs in the `community` bucket) get one board screen and reuse.
  - **Photos** (`/admin/photos`, any admin; dashboard card "Photos"): every stored file, newest first, as a card with its picture (a PDF shows a file icon), the day it was uploaded and its size, and **Used on:** with a link to each place that names it (an event, announcement, community news or newsletter, a person, or a page's text; archived ones marked "(archived)"), from `fileUses` (`src/features/admin/photos/photo-uses.ts`, the same places `community_file_in_use()` checks). On top: "Space used: … of 1 GB (…%)" with a bar; from 80% full a warning line. Every read (files, items and people current and archived, every page text) must succeed, or the screen says it could not load (a file never looks unused because a list failed).
  - **Delete** shows only on a file nothing uses, asks first ("Delete this file?"), and the server asks `community_file_in_use()` again (`ContentEditor.fileInUse`, then `removeFile`; the storage policy `admin_delete_unreferenced` stays the authority). A file in use is refused with "This file is still used somewhere …". Any admin (D-23 unchanged).
  - **"Choose from uploaded photos"** on every photo box (`ImageField`, so content items, People and every Pages photo, list photos included): opens the uploaded photos (`PhotoChooser`, read by `photoChoicesAction` when it opens), each named by its first use; clicking one uses that stored file, nothing is uploaded again. Content items post it as `image_path`; People as `photo_pick` (a `.webp` name, `storedPhotoName`), checked by the server; a Pages box sets its `src` to `/media/<name>`. **Undo** puts the box back; choosing a file instead drops it. A refused People save never deletes a reused photo (only a file uploaded by that save).
  - The board sees any stored file through `/admin/media/<name>` (signed-in admins only, `ContentEditor.readFile`; `/media/<name>` still serves visitors only published files). New port methods: `ContentEditor.listFiles`, `readFile`, `fileInUse`; `ContentProvider.getStorageUse` (`community_storage_bytes()`, edited in place in `202609090001_community.sql`: one number, executable by visitors so the nightly check can read it; the stand-in `storage.objects` gains `metadata`). The space rule is `src/lib/media/storage-space.ts` (`STORAGE_LIMIT_BYTES` = 1,000,000,000, warnings at 80% and 95%), shared with the daily check.
  - Every public picture is changeable from the dashboard except the logo: page photos (Pages), events, announcements and news (their picture), people (People) and, from this change, **Home's "Your first visit" photo** (Pages → Home → Your first visit; see the PR5b amendment of this date). Merch and season-page photos move to the dashboard with PR5c.

## Board Self-Sufficiency Check

| D0 #           | Task                                                                                | Where, from `/admin`                                              | Help                                                    |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| 18, 37, 74, 76 | Urgent site-wide notice (Eid, janazah, late at night from a phone); several at once | Announcements → Priority "Urgent" + "Hide at"                     | card "Urgent notices", tour steps                       |
| 69             | Cancel or move one Friday's Jumu'ah with a notice                                   | Prayer & iqamah → one-date change → "Also show an urgent notice?" | card "Jumu'ah" (extended)                               |
| 70, 11         | Cancel or postpone an event; sign-up as "Sign up →"                                 | Events → "Is it still happening?"                                 | card "Cancel or postpone an event"                      |
| 73             | See it before publishing                                                            | Edit \| Preview tabs on every content editor                      | each editor's tour                                      |
| 55, 56         | New-term checklist; who holds each shared login                                     | New board term (dashboard card)                                   | card "New board term" (replaces the "End of term" list) |
| 57             | See who changed what, filtered                                                      | Recent changes → Who / What / From / Until                        | card "Find a change"                                    |
| 16, 83         | Upload a phone photo                                                                | every photo box (silent shrink; HEIC line only when needed)       | card "Phone photos"                                     |

Any admin can do every row except "Remove login" (manage people, D-27 e). Developer-only by design: the band's timing (E-2), the 80-character limit (D-16), the 30-minute Jumu'ah prefill (D-19, editable per notice), `MIN_MANAGERS` (a warning, not a lock). Nothing in PR5a needs a redeploy to change content.

## Design

### Urgent notices (D-1, D-16, D-17, D-30)

```text
Announcement editor ─► saveRecordAction (+ priority, Hide at) ─► ContentEditor.saveRecord ─► DB checks ─► activity_log (highlight)
SiteChrome (root layout, force-dynamic) ─► getRecords("announcements") ─► currentUrgentNotices(records, now) ─► UrgentNoticeRotator (under Navbar)
```

- **Editor.** "Show in the homepage notice strip" becomes three cards (mockup `announcement-editor.png`): Normal (`featured = false`, `urgent_until = null`); Featured (`featured = true`; no "Hide after" → warning "Featured notices with no Hide after date stay on Home until you change them."); Urgent (`urgent_until` required from "Hide at" date + time in Grenada time, converted with the fixed `-04:00` offset as `isUpcoming` does; `featured = false`, `expires_on` cleared). Refusals: "Hide at: choose a time later than now."; "Title: urgent notices fit 80 characters; put the rest in the details." A future "Show from" date shows "Scheduled: appears on 10 Oct" in the preview. The Announcements list shows "Urgent now: N" above the list.
- **Order and visibility.** `currentUrgentNotices(records, now)` keeps published, visible rows whose `urgent_until > now`, sorted newest `date`, then latest `updated_at`, then `id`. RLS already hides ended rows; the pure filter is the mirror for the sandbox and the preview.
- **Band (D-30, mockup variant D).** Under the `Navbar` on every public page. One notice: label "Urgent", the title and "Details →", nothing moves. Two or more: "‹", one dot per notice, "›", "1 of N", swipe on touch; **no pause/play button**. Auto-advance every 7 s (E-2) until the visitor taps an arrow or a dot or swipes, then it stays where the visitor left it until the next page load; it waits while a pointer is over it, a finger is on it, or keyboard focus is inside it. With `prefers-reduced-motion: reduce` it never advances by itself, and arrow, dot and swipe changes swap with no slide. ARIA: region labelled "Urgent notices", `aria-roledescription="carousel"`, each notice "1 of 3"; `aria-live="off"` while it moves by itself and `polite` once the visitor is in control or it is paused by hover or focus (W3C carousel pattern). Hidden notices are not focusable. Arrow and dot buttons ≥ 32 px. Band height fixed (two lines on phones).
- **Every page.** `SiteChrome` reads `getRecords("announcements")` (request-cached) and renders the band; the root layout is `force-dynamic` (E-1); a test asserts the public routes are dynamic. When announcements are unavailable the band is simply absent.

### Jumu'ah question (D-3, D-19)

In the prayer form's one-date changes, a Friday row whose Jumu'ah is cancelled or moved, and is new or changed in this save, shows (mockup `jumuah-notice.png`): "Also show an urgent notice?" Yes / No (required), the prefilled editable text ("No Jumu'ah at the Musallah this Friday (16 Oct)" or "Jumu'ah this Friday (16 Oct) moves to 2:00 PM") and an editable "Hide at" prefilled with that Friday at iqamah + `JUMUAH_NOTICE_MINUTES_AFTER` (the new iqamah if moved, the usual one if cancelled). On "Yes", after the prayer save succeeds, the action saves one announcement: published, Urgent, title = the text, date = today, `urgent_until` = "Hide at". Nothing is stored on the exception (`valid_prayer_exceptions` unchanged). If the notice save fails: "The Jumu'ah change is saved, but the urgent notice could not be posted. Post it from Announcements." Re-saving an unchanged row asks nothing. Eid on a Friday: both notices rotate.

### Event status (D-2, D-20, D-7)

- Editor box "Is it still happening?" (mockup `event-status.png`): Scheduled / Cancelled (reason required, ≤ 250 characters, placeholder "Speaker's flight was cancelled") / Postponed ("New date known" moves `date` and sets `moved_from` to the old date the first time only; "Not known yet" keeps the date). Any event can be set back to Scheduled. _(Superseded by the D-20 amendment: no `moved_from`, no overnight rule, no "New date known".)_
- `eventStatusLine(record)`: null, "Cancelled: (reason)", "Postponed from Sat 10 Oct", or "Postponed: new date to be announced". _(Superseded by the D-20 amendment: "Postponed from …" is gone.)_
- Public: `EventCard`, the event page header, Home's week (`WeekSummary`) and the calendar list show the line; cancelled titles are struck through (text plus the line, never colour alone) and stay listed until their date passes. Archived or unknown event links render `src/app/calendar/[eventId]/not-found.tsx` with `NotFoundSignpost` ("This event is no longer listed", ways Events and Home). The event page button reads "Sign up →" (D-7).
- Calendar file: `STATUS:CANCELLED` and title prefix "Cancelled: " for cancelled; `STATUS:TENTATIVE` for postponed with no date; `STATUS:CONFIRMED` otherwise; `SEQUENCE` per E-8; same `UID`.
- Overnight (events only): an end time earlier than the start means the next day (`isUpcoming`, ICS `DTEND` next day, card "10:00 PM – 3:00 AM (next day)"); end equal to start is refused: "End time: choose a time different from the start time." _(Superseded by the D-20 amendment: no `moved_from`, no overnight rule, no "New date known".)_

### Edit | Preview tabs (D-11, D-23, D-26)

`EditorTabs` wraps `ContentEditor` for events, announcements, news and newsletters. Preview renders: events → `eventEntry(recordFromTyped(values))` into `EventCard` and the event page header part; announcements → `NoticeStrip` (Featured), `UrgentNoticeRotator` with that one notice (Urgent), and the post body; news → `CommunityPost`; newsletters → the archive row. Preview is `inert` and labelled "Preview (not saved)". Every box has an example placeholder (for example Title "Iftar at the Musallah", Location "Musallah, Charter Hall").

### HEIC (D-29, WP3c)

`isHeic(file)` = type `image/heic` or `image/heif`, or an empty type with a `.heic`/`.heif` name. When `shrinkPhoto` returns null for a HEIC file, `ImageField` shows the D-29 line and the save is stopped (nothing posted; typed text kept). Any other unreadable file keeps today's rule. `accept` stays `UPLOAD_IMAGE_TYPES` (a test pins it).

### `/ramadan` heading line (D-31, E-7)

`content/ramadan.yaml` `hero.eyebrow` becomes "Ramadan 2027"; `src/app/ramadan/page.tsx` renders it as written; `src/features/ramadan/eyebrow.ts` and its three test cases go; `TonightPanel` keeps `HijriDate`. One line is added under D-11 in `docs/contracts/restyle-public.md`: "Amended 2026-10-05 (PR5a D-31): Ramadan's heading line shows no Hijri year; Hijri dates stay with prayer times and the calendar."

### New board term (D-5, D-27 d/e)

`/admin/handover` "New board term" (mockup `handover.png`): the steps with a tick each ("Done on" date), progress "4 of 9 done", "Start a new term…" (confirm; clears every `done_on`, one logged update per step), "Edit the steps" (add, reword, reorder with Move up/down, archive, restore); the shared-login list (service, holder and second-step phone holder chosen from People, last changed date, short note; every box says "Never write passwords or codes here."); the notice "Only 1 active person can manage people. Give a second person Manage people." from `managerContinuity(people)` when fewer than `MIN_MANAGERS`. Starter steps = today's "End of term" card steps plus "Change shared passwords". Dashboard card "New board term". "Remove login" on a deactivated person's page (manage people only, typed name to confirm) calls `AccountInviter.deleteAccount(userId)`; the `public.admins` row goes with the auth user (`on delete cascade`); the person and their history stay.

### Recent changes filters (D-10, E-9)

Who (People names of login holders, plus "Site owner"), What (`activityKinds`: Prayer & iqamah, Events, Announcements, News, Newsletters, People and logins, New board term; each lists its tables; PR5b, PR5c, PR6 and PR7 add their own groups), From / Until (Grenada days). Filters live in the URL with `before=`; "Older changes" keeps them; "Clear filters". Empty result: "No changes match these filters."

## Public Contract

Migration `supabase/migrations/<next free timestamp>_notices_events_handover.sql` (the timestamp is the next one after every file in the folder when WP1 is written; after PR6's `202610070001` if that has landed):

```sql
alter table public.announcements add column urgent_until timestamptz;
alter table public.announcements add constraint announcement_urgent_alone
  check (urgent_until is null or (not featured and expires_on is null
    and (urgent_until at time zone 'America/Grenada')::date >= date));
alter table public.events add column status text not null default 'scheduled'
  check (status in ('scheduled', 'cancelled', 'postponed'));
alter table public.events add column status_note text not null default '' check (length(status_note) <= 250);
alter table public.events add column moved_from date;
alter table public.events add constraint event_cancel_reason check (status <> 'cancelled' or length(trim(status_note)) > 0);
alter table public.events add constraint event_moved_from check (moved_from is null or status = 'postponed');
-- events only: replace the end-after-start check with (end_time = '' or (start_time <> '' and end_time <> start_time))
-- announcements public read policy and published_attachment(): add "and (urgent_until is null or urgent_until > now())"
create table public.handover_steps (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  details text not null default '' check (length(details) <= 500),
  link text not null default '' check (link = '' or link ~ '^/admin(/[a-z0-9-]+)*$'),
  position integer not null, done_on date,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.shared_logins (
  id uuid primary key default gen_random_uuid(),
  service text not null check (length(trim(service)) between 1 and 80),
  holder_person_id uuid references public.people(id) on delete set null,
  second_factor_person_id uuid references public.people(id) on delete set null,
  last_changed_on date,
  note text not null default '' check (length(note) <= 200),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- starter handover_steps rows; RLS on both: select, insert, update for is_admin(); no anon; no delete
-- grants: none to anon; select, insert, update to authenticated
-- triggers on both: touch_updated_at, archived_read_only, record_activity('id', 'full')
create index activity_log_actor on public.activity_log (actor, occurred_at desc, id desc);
-- create or replace record_activity: also highlight an announcements row whose urgent_until is set before or after;
-- keep every highlight rule already in the function at WP time (prayer_settings; PR6's and PR7's if landed)
```

TypeScript (exported):

```ts
// src/lib/community/schema.ts
export type AnnouncementPriority = "normal" | "featured" | "urgent";
export function announcementPriority(
  record: CommunityRecord,
): AnnouncementPriority;
export function currentUrgentNotices(
  records: readonly CommunityRecord[],
  now: Date,
): CommunityRecord[]; // newest first
export const URGENT_BAND_MAX_CHARS = 80;
export type EventStatus = "scheduled" | "cancelled" | "postponed";
export function eventStatusLine(record: CommunityRecord): string | null;
export const JUMUAH_NOTICE_MINUTES_AFTER = 30;
// src/lib/community/managed.ts
export function eventEntry(record: CommunityRecord): SiteEvent;
// src/lib/calendar/ics.ts (signature unchanged; output gains STATUS, SEQUENCE, the prefix, overnight DTEND)
export function eventToIcs(event: SiteEvent, stamp?: Date): string;
// src/lib/community/activity.ts
export const activityKinds: Readonly<
  Record<string, { label: string; areas: readonly string[] }>
>;
export const activityQuerySchema; // + actor?: uuid | "owner"; areas?: string[]; from?: date; to?: date
// src/lib/community/people.ts
export const MIN_MANAGERS = 2;
export function managerContinuity(people: readonly VersionedPerson[]): {
  active: number;
  short: boolean;
};
// src/lib/community/handover.ts
export function handoverProgress(steps: readonly HandoverStep[]): {
  done: number;
  total: number;
};
// src/lib/media/photo-limits.ts
export function isHeic(file: { type: string; name: string }): boolean;
// src/lib/backend/providers/contract.ts
export interface HandoverEditor {
  listSteps(
    view?: ListView,
  ): Promise<{ steps: VersionedStep[]; unavailable: boolean }>;
  saveStep(row: HandoverStep, version: string | null): Promise<WriteResult>;
  archiveStep(id: string, version: string): Promise<WriteResult>;
  restoreStep(id: string, version: string): Promise<WriteResult>;
  startNewTerm(): Promise<WriteResult>;
  listLogins(
    view?: ListView,
  ): Promise<{ logins: VersionedLogin[]; unavailable: boolean }>;
  saveLogin(row: SharedLogin, version: string | null): Promise<WriteResult>;
  archiveLogin(id: string, version: string): Promise<WriteResult>;
  restoreLogin(id: string, version: string): Promise<WriteResult>;
}
// src/shared/ui/UrgentNoticeRotator.tsx
export function UrgentNoticeRotator(props: {
  notices: readonly { id: string; title: string; href: string }[];
}): JSX.Element | null;
// src/features/admin/preview/
export function EditorTabs(props: {
  form: ReactNode;
  preview: (values: Record<string, string>) => ReactNode;
}): JSX.Element;
export function useTypedValues(
  form: RefObject<HTMLFormElement | null>,
): () => Record<string, string>;
```

Routes: `/admin/handover`; `src/app/calendar/[eventId]/not-found.tsx`; `/admin/activity` gains `who`, `what`, `from`, `to`. Wiring: `handover: "supabase" | "sample"` in `src/lib/runtime/wiring.ts`, chosen only in `providers.ts`.

Actions (each: `currentAdmin()`, zod with `issuesOf`, the port, `revalidatePath("/", "layout")`, redirect): `saveRecordAction` (priority, Hide at, status), `savePrayerAction` (Jumu'ah question), `saveHandoverStepAction`, `archiveHandoverStepAction`, `restoreHandoverStepAction`, `startNewTermAction`, `saveSharedLoginAction`, `archiveSharedLoginAction`, `restoreSharedLoginAction`, `removeLoginAction` (manage people only).

## Private Implementation

The implementer decides: how `useTypedValues` reads the form (on tab switch); the band's animation code (CSS or the installed Motion `AnimatePresence`, no new package); swipe detection details within E-2; the step reorder control (Move up/down buttons are enough); component splits inside `src/features/admin/handover/` and `src/features/admin/preview/`; sample fixture contents (seed-relative dates: two urgent notices, one ending later today; one cancelled and one postponed event; one overnight event; six starter steps with two ticked; two shared logins).

## Data and State Flow

- **Public reads:** `SiteChrome` and pages → `getRecords` (request `cache`, `publicClient()`, RLS applies `urgent_until` and status) → `currentUrgentNotices` / `eventEntry` → components. All public routes are dynamic (E-1).
- **Board writes:** server actions only; RLS is the authority; the `updated_at` version check on every row; `revalidatePath("/", "layout")` after each save.
- **Preview:** browser only, from typed values; never saved; same view builders as the public loaders.
- **Activity:** both new tables log full rows; `areaNames` and field names gain `urgent_until`, `status`, `status_note`, `moved_from`, `handover_steps`, `shared_logins`; People names are shown for `holder_person_id` and `second_factor_person_id` when read.
- **Filters:** `/admin/activity?who=&what=&from=&to=&before=` → `activityQuerySchema` → `ActivityLog.list` (Supabase adapter: `actor in (...)` or `is null` for the site owner, `area in (...)`, `occurred_at` between Grenada day bounds; sample adapter: the same filter in memory).

## Failure Modes

| Situation                                                                                          | Expected behaviour                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supabase down on a public page                                                                     | No band; events show the existing "temporarily unavailable" state; pages still render                                   |
| Supabase down when saving                                                                          | "Could not save. Check your connection and try again." Typed values kept; photos chosen again (`chooseFileAgain`)       |
| Two editors on one record, step or login                                                           | Version check: "Someone else changed this; reload before trying again." Typed values kept                               |
| Two or more urgent notices current                                                                 | All rotate newest first; each hides at its own end                                                                      |
| Urgent end time in the past, or a title over 80 characters                                         | Refused with the D-1 lines; typed text kept                                                                             |
| Urgent notice after its end                                                                        | RLS and `isVisible` stop returning it; the band loses it on the next request; `LiveRefresh` pages within 60 s           |
| Visitor with reduced motion                                                                        | Nothing moves by itself; arrows, dots and swipe still work without sliding                                              |
| Jumu'ah saved, notice save fails                                                                   | Prayer change kept; the message names the missing notice and where to post it                                           |
| Re-saving the prayer page unchanged                                                                | No question, no duplicate notice                                                                                        |
| Cancelled without a reason (crafted request)                                                       | Refused by zod, then by `event_cancel_reason`                                                                           |
| Calendar file added before a cancellation                                                          | Re-adding replaces it (same `UID`, higher `SEQUENCE`, `STATUS:CANCELLED`); the help card says to re-add                 |
| Link to an archived or unknown event                                                               | 404 with "This event is no longer listed" and links to Events and Home                                                  |
| HEIC photo on a browser that can't open it                                                         | Save stopped with the D-29 line; nothing uploaded; typed text kept                                                      |
| Session expired mid-edit                                                                           | `sessionExpired`; typed values kept                                                                                     |
| Last-but-one manager deactivated                                                                   | Dashboard and New board term notice; the database still blocks zero managers (PR3)                                      |
| A person holding a shared login is purged                                                          | Holder becomes empty ("holder removed"); the purge is not blocked                                                       |
| Remove login when the login is already gone, or the inviter is `off` (sandbox, developer computer) | Already gone counts as done; `off` shows "Logins can't be removed here." and changes nothing                            |
| Old tab posts an event form without the status box (deployment skew)                               | The action treats a missing status as "scheduled" only for rows already scheduled; otherwise refuses with `staleScreen` |

## Compatibility and Migration

- **One additive migration** (WP1), applied by a human to staging, then production, before the Release PR; never by an agent. The release-checklist entry carries read-only check queries: `select column_name from information_schema.columns where table_name = 'announcements' and column_name = 'urgent_until';` (expect 1 row), `select count(*) from public.handover_steps;` (expect the starter count), `select count(*) from public.events where status <> 'scheduled';` (expect 0 right after applying).
- **Before/after deploy:** old code never sends the new columns (defaults apply); the new RLS clause only narrows announcements by `urgent_until`, which old code never sets. New code against a database without the migration: urgent and status fields are absent, the adapter's reads fail into the existing unavailable states; the release order (migration first) prevents it.
- **Shared SQL objects:** `record_activity`, the announcements read policy and `published_attachment` are re-created with every clause present at WP time (PR3, PR4, and PR6 or PR7 if landed); the migration test asserts the earlier clauses still hold.
- **Rollback:** a script in the PR-A description drops the two tables, the three event columns, `urgent_until`, the index and restores the previous policies and function text.
- **Env:** none new. **ADRs:** none (no cross-feature or hard-to-reverse choice; D-31 amends a contract decision, not an ADR).

## Parallel Work and Merge Order

```yaml
PR-A:
  WP1: { creates: [supabase/migrations/<next>_notices_events_handover.sql, tests/notices-migration.test.ts], extends: [scripts/test-backend.ts], depends_on: [PR4 in integration] }
  WP2: { creates: [src/lib/community/handover.ts, src/lib/backend/providers/{supabase,sample}-handover.ts, tests/notices.test.ts, tests/handover.test.ts], extends: [src/lib/community/{schema,activity,people,managed}.ts, src/lib/calendar/ics.ts, src/lib/backend/providers/{contract,supabase,sample}.ts, src/lib/runtime/{wiring,providers}.ts, src/lib/demo/*, tests/activity.test.ts], depends_on: [WP1] }
PR-B:
  WP4: { creates: [src/features/admin/preview/**, src/features/community/NoticeStrip.tsx], extends: [src/features/admin/{ContentEditor.tsx,fields.ts,actions.ts}, src/features/community/HomeNotice.tsx, src/app/admin/content/**], depends_on: [PR-A] }
  WP5: { creates: [src/app/calendar/[eventId]/not-found.tsx, src/shared/ui/UrgentNoticeRotator.tsx (+ stories) if Track B's is absent], extends: [src/app/layout.tsx, src/shared/layout/SiteChrome.tsx, src/features/calendar/*, src/app/calendar/**, src/features/home/WeekSummary.tsx, src/features/community/CommunityPost.tsx, content/ramadan.yaml, src/app/ramadan/page.tsx, tests/ramadan-tonight.test.ts, docs/contracts/restyle-public.md], deletes: [src/features/ramadan/eyebrow.ts], depends_on: [PR-A] }
  WP6: { extends: [src/features/admin/PrayerEditor.tsx, src/features/admin/actions.ts (savePrayerAction)], depends_on: [PR-A, WP4] }
PR-C:
  WP7: { creates: [src/app/admin/handover/**, src/features/admin/handover/**], extends: [src/app/admin/activity/page.tsx, src/app/admin/dashboard/page.tsx, src/app/admin/people/[id]/page.tsx, src/features/admin/access-actions.ts], depends_on: [PR-A] }
  WP8: { extends: [src/app/admin/help/page.tsx, src/features/admin/help-pictures.ts, src/features/admin/tour/steps.ts, public/admin-help/*, docs/guides/board.md, docs/architecture.md, docs/roadmap.md, docs/release-checklist.md, src/features/privacy/PrivacyLedger.tsx], depends_on: [PR-B, WP7] }
  WP3c: { extends: [src/lib/media/photo-limits.ts, src/features/admin/ImageField.tsx, src/features/admin/fields.ts, tests/photo-limits.test.ts, tests/e2e/photos.spec.ts, docs/release-checklist.md], depends_on: [PR #60 (merged)] }
integration_owner: planner
```

- **Merge order:** PR-A → PR-B → PR-C. Inside PR-B: WP4, then WP5 and WP6 (WP6 needs WP4's form changes in `actions.ts`). Inside PR-C: WP7 and WP3c in any order, WP8 last (its pictures need every screen).
- **Shared files, one owner per PR:** `schema.ts`, `contract.ts` and the migration only in PR-A; `actions.ts` in PR-B (WP4 then WP6) and PR-C (`access-actions.ts` only).
- **Cross-plan conflicts, whichever merges second rebases:** PR6 (only WP-1/WP-2 merged, #58) — PR6 WP-9 also edits `recordSchema` and the event editor (ticket select vs status box) and adds the "event not cancelled" rule to its own `paymentItemVisible`; PR6 WP-3 and PR5a WP1 both re-create `record_activity`. PR7 WP-3/WP-5 and PR5a WP6 all edit `PrayerEditor.tsx` and `savePrayerAction`; `activityKinds` gets PR7's `musallah_location` group in whichever lands second. Track B: `UrgentNoticeRotator` and `EventStatusMark` (E-3).
- **Process:** each PR fills `.github/pull_request_template.md`, updates `docs/release-checklist.md` **Unreleased**, runs `npm run check`, and is reviewed with `reviewing-engineering-changes`; the planner merges into `integration` after checks; nothing goes live before the Release PR.

## Work Packages

### WP1: Database (PR-A)

- Purpose: the PR5a columns, checks, tables, policies, index and the highlight rule.
- Depends on: PR4 in `integration`.
- Expected files: the migration in Public Contract; `tests/notices-migration.test.ts` (PGlite, like `tests/prayer-migration.test.ts`); `scripts/test-backend.ts`.
- Reuse: `community_item_visible`, `touch_updated_at`, `archived_read_only`, `record_activity`, `is_admin`.
- Required changes: exactly the SQL in Public Contract; header comment naming this contract; explicit grants and revokes; starter steps.
- Must not: add delete policies, a `priority` column, any column for passwords or codes, an urgent-notice trigger, lock or cap, any anon grant on the two new tables, the events `url` Google Forms check (E-6); drop an existing highlight rule; touch hosted databases.
- Tests: urgent check combinations (with `featured`, with `expires_on`, end before the date in Grenada time); two overlapping urgent notices both visible to anon; each invisible after its own end; cancelled needs a reason; `moved_from` only when postponed; overnight end allowed for events, equal end refused; new tables invisible to anon and writable by an admin; no delete; log rows written; urgent changes highlighted; earlier storage and highlight clauses still pass.
- Done when: both test sets pass.

### WP2: Rules, ports, adapters, sandbox data (PR-A)

- Purpose: everything PR-B and PR-C call.
- Depends on: WP1.
- Expected files: see the effects block.
- Reuse: `recordFromRow`, `localDate`, `clock()`, `Outcome`, `WriteResult`, the `PeopleEditor` adapter pattern.
- Required changes: `announcementPriority`, `currentUrgentNotices` (D-30 order), `isVisible` urgent end, `eventStatusLine`, overnight `isUpcoming`, `eventEntry` extracted from `managedEvents`, the zod rules (urgent fields, status fields, overnight for events only), `eventToIcs` status, prefix, `SEQUENCE` (E-8) and overnight `DTEND`; `activityKinds`, `activityQuerySchema` filters and both `ActivityLog` adapters; `MIN_MANAGERS`, `managerContinuity`; `HandoverEditor` with both adapters and the wiring; the per-collection column lists (E-4); sample fixtures.
- Must not: read env or the clock in pure modules; add a second visibility rule; store priority; edit PR6 files.
- Tests: urgent end at the exact minute in Grenada time; rotation order stable for equal dates; overnight events at 23:30 and 02:00; ICS lines for each status and `SEQUENCE` growth; filter building (who, kinds, Grenada day bounds); manager count; adapter contract tests for both handover adapters.
- Done when: `npm run check` passes.

### WP4: Editors with Edit | Preview tabs (PR-B)

- Purpose: priority and "Hide at", "Urgent now: N", the event status box, Edit | Preview tabs and placeholders on the four content editors.
- Depends on: PR-A.
- Expected files: `src/features/admin/preview/**`, `ContentEditor.tsx`, `fields.ts`, `actions.ts`, `HomeNotice.tsx` → `NoticeStrip.tsx`, the content list page for "Urgent now: N".
- Reuse: `EventCard`, `CommunityPost`, `NoticeStrip`, `UrgentNoticeRotator`, `recordFromTyped`, `eventEntry`, `ViewTabs` styling.
- Required changes: Design → Urgent notices (editor), Event status (editor), Edit | Preview tabs.
- Must not: re-draw public markup in admin code; let the preview navigate or submit; change public styling; add a photo-consent line or a viewer (D-21).
- Tests: action refusals (missing Hide at, past time, title over 80, cancelled without reason, equal end time); e2e: Preview shows what was typed, and back on Edit the typed text and a chosen photo are kept; saving Urgent shows the band on `/`; axe light and dark on the editor.
- Done when: tests pass.

### WP5: Public band, event status, `/ramadan` heading line (PR-B)

- Purpose: visitors see urgent notices on every page and event states everywhere; no Hijri year in the Ramadan heading.
- Depends on: PR-A; Track B's components or E-3.
- Expected files: see the effects block.
- Reuse: `NotFoundSignpost`, `getRecords`, `eventEntry`, tokens, `--motion-reveal`.
- Required changes: Design → Urgent notices (band, every page), Event status (public, calendar file, "Sign up →", not-found), `/ramadan` heading line (E-7, the restyle-public note). Root layout `dynamic = "force-dynamic"` (E-1). Merch-only viewer: nothing here (PR5c); event and news photos stay unwrapped (D-21).
- Must not: compute visibility in components; fetch the band in the browser; add a pause/play button; move the band by itself under reduced motion; show a Hijri date outside the prayer-times block.
- Tests: e2e: the band on `/`, `/faq`, `/donate`; two notices newest first with "1 of 2" and no pause button; after a tap on "›" the notice does not change for 8 s; hovering stops it, leaving restarts it; with reduced motion nothing changes for 8 s; each notice gone after its own end on the sandbox clock; cancelled and postponed cards; the ICS download contains `STATUS:CANCELLED`; archived event link → signpost; `/ramadan` shows "Ramadan 2027" and no "AH" outside the Tonight panel; a test that public routes are dynamic; unit: the Ramadan line has no Hijri year; axe light, dark and mobile; Storybook story for the band in both themes.
- Done when: tests pass.

### WP6: Jumu'ah urgent-notice question (PR-B)

- Purpose: D-3, D-19.
- Depends on: PR-A, WP4.
- Expected files: `src/features/admin/PrayerEditor.tsx`, `src/features/admin/actions.ts`.
- Reuse: `jumuahFor`, `ContentEditor.saveRecord`, `JUMUAH_NOTICE_MINUTES_AFTER`.
- Required changes: Design → Jumu'ah question.
- Must not: change `valid_prayer_exceptions`; store the answer on the exception; post a notice for unchanged rows.
- Tests: action: Yes creates one urgent announcement with the right end; No creates none; an unchanged re-save creates none; the notice-failure message; e2e from the prayer screen to the band.
- Done when: tests pass.

### WP7: New board term, Recent changes filters, Remove login (PR-C)

- Purpose: D-5, D-10, D-27 d/e.
- Depends on: PR-A.
- Expected files: see the effects block.
- Reuse: `ViewTabs`, `RecordActions`, `ArchivedEntry`, `ActivityFeed`, `AccountInviter.deleteAccount`, `accessFailures`, `managerContinuity`.
- Required changes: Design → New board term, Recent changes filters; dashboard card "New board term"; the manager notice on the dashboard too.
- Must not: add any field that could hold a password; let filters drop entries; delete log rows; let a non-manager remove a login.
- Tests: e2e: tick a step, start a new term, edit, reorder, archive and restore steps; add a shared login with People holders; the manager notice with one manager; filters by person, kind and dates survive "Older changes"; a non-manager cannot Remove login; Remove login on a deactivated person; axe light and dark.
- Done when: tests pass.

### WP8: Help, tours, pictures, docs (PR-C)

- Purpose: the board learns PR5a from pictures.
- Depends on: PR-B, WP7.
- Expected files: see the effects block.
- Reuse: the help card and picture manifest format, `npm run help:pictures`.
- Required changes: cards "Urgent notices" (several rotate, newest first, end time), "Cancel or postpone an event" (re-add calendar files), "Phone photos" (only what to do with the HEIC line), "New board term" (replaces the "End of term" step list with a link), "Find a change"; the Jumu'ah card gains the question; tours for the announcement editor, event status, New board term and Recent changes (≤ 25 words a step); `docs/guides/board.md` "cannot do yet" updated; `docs/architecture.md` (band and status flow); `docs/roadmap.md` (PR5a done); release checklist; one privacy line: "The dashboard records which board member holds each shared account, by name only."
- Must not: copy Google's or Go2Pay's screens; describe a pause button.
- Tests: `tests/help-pictures.test.ts`, `tests/tour.test.ts`, `tests/documentation.test.ts`; `npm run help:pictures`.
- Done when: tests pass and pictures are regenerated.

### WP3c: HEIC line and the real-device table (PR-C)

- Purpose: D-29.
- Depends on: PR #60 (merged).
- Expected files: `src/lib/media/photo-limits.ts` (`isHeic`), `src/features/admin/ImageField.tsx`, `src/features/admin/fields.ts` (the line, E-5), `tests/photo-limits.test.ts`, `tests/e2e/photos.spec.ts`, `docs/release-checklist.md`.
- Reuse: `shrinkPhoto`, `keepShrunk`, `UPLOAD_IMAGE_TYPES`.
- Required changes: Design → HEIC; the device table below on the release checklist.
- Must not: add a dependency or converter; add `image/heic` or `image/*` to `accept`; accept HEIC on the server; raise the 3 MB limit; add a second image input; show any success line.
- Tests: unit `isHeic` by type and by name with an empty type; a test pinning `accept` to `UPLOAD_IMAGE_TYPES`; Playwright Chromium: a small `.heic` fixture shows the D-29 line and nothing is posted; WebKit: the same fixture becomes JPEG (if CI's WebKit can't read HEIC, that row moves to the manual table).
- Done when: tests pass and the checklist carries the table.

## Implementation Constraints

- Do not store priority beside `featured`; do not reuse `expires_on` for an exact time.
- Do not create a banner setting, a second urgent mechanism, or a trigger, lock or cap on how many urgent notices are current.
- Do not add a pause/play button to the band; do not let it move by itself under reduced motion or after the visitor used an arrow, a dot or a swipe.
- Do not change `valid_prayer_exceptions` for the Jumu'ah question.
- Do not write public markup twice: previews import the public components.
- Do not add a dependency (carousel, swipe, image, HEIC); Motion is already installed.
- Must not create a second Supabase client, a service layer, a Context/Provider or a client store; `useTypedValues` is the only shared hook added.
- Do not add any field meant for passwords or codes; do not store member data.
- Do not add delete policies or purge methods beyond PR3's; archive instead.
- Do not compute "today" except as `localDate(clock().now())`; do not read `process.env` outside `src/lib/runtime/config.ts`; do not ask "is this the demo?".
- Do not show a Hijri date outside prayer-times blocks and the calendar (D-31).
- Do not touch PR6, PR5b or PR5c scope (payment files, page text, Google Forms rule, seasons, merch, the photo viewer).
- Must not apply migrations to hosted databases; a human does it, staging first.
- Must not make product or design choices beyond this contract; anything new goes back to the user.

## Worker Escalation Conditions

Emit PLAN MISMATCH (Expected / Observed / Impact / Files) when:

- `dynamic = "force-dynamic"` in the root layout does not make every public route dynamic, or conflicts with a route's own config.
- The repo's current text of `record_activity`, the announcements read policy, `published_attachment` or the events end-time check differs from what the migration expects to replace.
- PR6 or PR7 has landed changes to `recordSchema`, the event editor, `PrayerEditor.tsx` or `savePrayerAction` that this contract's changes can't sit beside without editing their logic.
- Track B's `UrgentNoticeRotator` or `EventStatusMark` landed with props that can't carry D-30 behaviour or the status line.
- `public.admins` no longer cascades from `auth.users`, so Remove login would leave an access row.
- A real-device photo check fails on a phone the board uses (D-29's next step is a user decision).
- Any change needs a new env variable, secret, bucket, table or dependency not listed here.

## Test Strategy

- **Unit (`tests/*.test.ts`):** urgent rules (exact-minute end in Grenada time, order, 80-character limit), event status lines, overnight events, ICS output, activity filters, manager continuity, handover progress, `isHeic`, the `accept` pin, the Ramadan line without a Hijri year.
- **Database:** PGlite `tests/notices-migration.test.ts`; `npm run test:backend` (anon reads, admin writes, no deletes, new tables private, urgent end via the API).
- **E2E (`E2E_DEMO=true`, Playwright):** the flows in each WP, axe in light, dark and mobile on every changed screen and public page.
- **Storybook:** `UrgentNoticeRotator` (one, three, reduced motion), `NoticeStrip`, event status card, light and dark.
- **Manual (staging, sandbox first):** post two urgent notices from a phone, watch them rotate newest first, tap "›" and see it stop, see each end on time; cancel an event and re-add its calendar file; run a new term.
- **Real-device photo table (release checklist; each row: expected → seen):**

  | Device and source                                                                      | Expected                               |
  | -------------------------------------------------------------------------------------- | -------------------------------------- |
  | iPhone Safari, photo from Photos (camera default HEIC)                                 | uploads; arrives as JPEG, made smaller |
  | iPhone Chrome, same photo                                                              | same as Safari                         |
  | iPhone Safari, "Take Photo" from the box                                               | uploads as JPEG                        |
  | iPhone Safari, a `.heic` from the Files app (iOS 17+)                                  | uploads; saved as JPEG                 |
  | Android Chrome, normal camera photo (JPEG)                                             | uploads                                |
  | Android Chrome, a `.heic` (Samsung "High efficiency pictures", or sent from an iPhone) | the D-29 line; nothing uploaded        |
  | Mac Safari, a `.heic`                                                                  | uploads                                |
  | Windows or Mac Chrome, a `.heic`                                                       | the D-29 line                          |

- **Gate:** `npm run check`, `npm run build`, `npm run help:pictures` in PR-C.

## Acceptance Criteria

- A board member posts an urgent notice from a phone; it shows under the menu on every public page and disappears by itself at the chosen minute.
- With two or more current, the band shows them newest first with ‹ ›, dots, swipe and "1 of N" and no pause button; after a visitor taps an arrow or a dot or swipes, it stops moving; it waits while touched, hovered or focused; with reduced motion it never moves by itself.
- Saving a cancelled or moved Jumu'ah with "Yes" posts the notice, which ends 30 minutes after that Friday's iqamah unless the board changed "Hide at".
- A cancelled event stays on its page and in lists, struck through with its reason, until its date; its calendar file says CANCELLED; a postponed event shows "Postponed from (old date)" or "new date to be announced".
- Each of the four content editors has Edit | Preview tabs; Preview shows what was typed, and going back to Edit keeps it.
- The New board term screen lists steps the board can edit and tick, starts a new term, records who holds each shared login without any password, and warns when fewer than two people can manage people.
- Recent changes filters by person, kind and dates, keeps the filters through "Older changes", and nothing is ever removed.
- A HEIC photo on a browser that can't open it gets one clear line saying what to do; iPhone camera photos upload with no message.
- `/ramadan`'s heading line reads "Ramadan 2027"; the Hijri date appears only next to tonight's prayer times.
- The help page explains every new screen with pictures.

## Open Risks or Escalations

- **Dynamic pages (E-1):** every public visit makes one more database read on Vercel Hobby and Supabase free; fine at the club's traffic; revisit only if limits are reached.
- **WCAG 2.2.2 without a pause button (D-30):** met by stop-on-interaction, pause on hover, focus and touch, and no movement under reduced motion; an outside audit could still ask for a visible pause; that would go back to the user.
- **Track B timing (E-3):** if Track B restyles the band later, its file is the same one; no second component.
- **iOS photo handling:** varies by iOS and browser version; the device table is required before the Release PR.
- **Cross-plan rebases:** PR6 WP-3/WP-9 and PR7 WP-3/WP-5 touch the same shared files; whichever merges second rebases, as listed above.
- None of these blocks delegation. Plan is ready for PR-A.
