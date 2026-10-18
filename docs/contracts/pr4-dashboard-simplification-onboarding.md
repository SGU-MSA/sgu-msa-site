---
status: done
mode: full
---

# PR4: Dashboard simplification and onboarding

Roadmap item PR4 ([roadmap](../roadmap.md)). Binding: ADR 0002, 0008, 0012, 0013, 0016, 0017, 0018. Base: `origin/integration` at `3a070ad` (PR3 WP-H). Mockups: the `*.png` pictures named below were shown to the user in the planning session (not kept in the repo; quick sketches in today's admin look, not designs).

Workflow checklist: [x] 1 scope · [x] 2 inspect · [x] 3 capability/owner · [x] 4 duplication · [x] 5 sources of truth · [x] 6 reuse/extend/create · [x] 7 beyond happy path · [x] 8 product decisions answered (D-1..D-13, D-12 amended 2026-10-04; D-14, D-15 planner amendments; D-14 amended 2026-10-05) · [x] 9 parallel work · [x] 10 contract · [x] 11 validate (structure).

## Capability

1. **Board-managed congregation schedule on a fixed calculation.** Prayer starts are calculated with one fixed method (Muslim World League + Standard Asr, ADR 0017) owned by code; the board manages only iqamah (fixed clock or minutes after the start, per prayer), the weekly Jumu'ah, per-date changes (daily iqamah and, new, a Friday's Jumu'ah: cancelled or different time/room), and a +1 / 0 / −1 day Hijri date adjustment (ADR 0018).
2. **Plain-language board editing.** The four content editors (events, announcements, community news, newsletters) show only fields that change something on the public site, with plain labels and hints, and every refusal lists all problems and keeps what was typed.
3. **Layered onboarding (ADR 0008).** A first-login dashboard tour and a per-page "Show me how" replay (react-joyride), and picture help on `/admin/help` whose pictures are captured by the Playwright suite from the sandbox.

## Requested Behavior

Requested by the user (task brief, 2026-10-03):

- Prayer dashboard keeps only iqamah times, Jumu'ah and per-date exceptions. Method, madhab, permanent adjustments, per-date start corrections and "Leadership has confirmed calculation settings" leave the dashboard. Calculation fixed per ADR 0017; stored coordinates stay in use until PR7's pin.
- Per-date Jumu'ah exceptions: cancel, or change time or room. The required yes/no "Also show an urgent notice?" with a prefilled editable message expiring after Jumu'ah (D0 D14) depends on Urgent announcement priority planned in PR5: ordering is decision P-4.
- Hijri date ±1 day adjustment with the prayer settings (release checklist "Needs your confirmation" promises it in PR4).
- Plain-language simplification of the events, announcements, news and newsletters forms: labels, hints, field order, remove fields that do nothing for a kind, show all errors (not only the first).
- Onboarding: first-login tour, per-page "Show me how", tour-seen state, picture-based `/admin/help` with screenshots re-captured automatically from the sandbox.
- Visual styling stays as today (PR8 restyles); layout changes only where simplicity needs them.

Non-goals:

- No change to how prayer starts are calculated beyond fixing the method (no API, no new library).
- No board-editable method, madhab or start correction (ADR 0017 exception to ADR 0002).
- No map pin and no removal of `latitude`/`longitude` (PR7). No dropping of retired columns in PR4 (PR7 contract migration, see Compatibility and Migration).
- No announcement priority Normal/Featured/Urgent, event status, live editor preview or photo shrinking (PR5), unless decision P-4 chooses option B.
- No restyle of the dashboard or public pages (PR8). Public pages change only in data and copy: the calculation line, the Hijri date (adjusted), and the Jumu'ah card/line showing a one-Friday change.
- No second Jumu'ah slot (D0 #5, after launch).
- D0 rows tagged PR4 but absent from the roadmap row (#67 expiry warning, #68 next schedule, #72 scheduled events, #85 needs-attention list) are out unless decision P-12 adds them.

User acceptance criteria are restated in Acceptance Criteria.

## Existing System Evidence

- `src/lib/prayer/calculate.ts` `calculatePrayers(settings, now)`: returns [] unless `settings.confirmed`, coordinates, `method` and `madhab` are set; applies `settings.adjustments` plus `exception.adjustments` per date. The only adhan call site.
- `src/lib/prayer/adjustments.ts`: `adjustmentSchema` (start corrections, −60..60), `iqamahOffsetSchema` (minutes after start, 0..120, nullable), `exceptionSchema` (date, reason, adjustments, iqamah clocks for 5 prayers).
- `src/lib/prayer/congregation.ts`: `isScheduleCurrent`, `congregationTimes` (precedence: date clock > relative interval > current fixed clock), `prayerExtensionsFromForm` (form parsing for adjustments, offsets, 20 exception rows).
- `src/lib/community/schema.ts` `prayerSettingsSchema`, `emptyPrayer`, `methods` (12 methods), `recordSchema` (one schema for all four collections, `featured` boolean on all), `duplicateAsDraft`.
- `src/lib/time/hijri.ts` `hijriDate(now, maghribIso)`: Umm al-Qura via `Intl`, advances at Maghrib; its comment names the PR4 ±1 adjustment. Call sites: `src/app/page.tsx:57`, `src/app/prayer/page.tsx:79`.
- `src/lib/community/managed.ts` `managedPrayer()`: builds `prayer.times`, `last_updated_label`, notice and `jumuah.gatherings` (one gathering from `khutbah`, `jummah_iqamah`, `jummah_location` while the schedule is current). `managedEvents()` maps `row.featured` to `SiteEvent.featured`, which no component reads.
- `src/app/page.tsx:91-95` and `src/app/prayer/page.tsx:82`: public calculation label from `settings.method`/`settings.madhab` ("Awaiting confirmation" fallback). `src/features/prayer/PrayerToday.tsx:49` "Calculation settings are awaiting confirmation from MSA leadership." when there are no starts; `:100` "Begins: calculated for the Musallah (…)".
- `src/features/prayer/JumuahCard.tsx`, `src/features/home/HomeHero.tsx:50,131`: render `jumuah.gatherings[0]` and its optional `note`.
- `src/features/admin/PrayerEditor.tsx` (schedule, Jumu'ah, coordinates, method, madhab, confirmed) and `PrayerAdjustmentsEditor.tsx` (permanent corrections, intervals, exceptions with start corrections). `src/app/admin/prayer-times/page.tsx` composes `PrayerEditor` + `PrayerHistory`.
- `src/features/admin/actions.ts` `savePrayerAction` (returns `parsed.error.issues[0].message`), `calculationProblem` (gated on `confirmed`), `restorePrayerVersionAction` (parses `entry.before` with `prayerSettingsSchema`), `saveRecordAction` (returns `issues[0]` only; claims "Your entered text is still here").
- React 19 resets uncontrolled forms on every `<form action>` submit: `node_modules/react-dom/cjs/react-dom-client.development.js` `startHostTransition` calls `requestFormReset` before the action. So `ContentEditor` and `PrayerEditor` lose typed values on a refused save, contradicting their message. PR3 solved this for People: `src/features/admin/people-actions.ts` `PeopleFormState` (`values`, `attempt`), `typedValues`, `refusal`; `PersonEditor.tsx` re-mounts with `values`.
- `src/features/admin/fields.ts`: board copy (`sessionExpired`, `staleScreen`, `refuse`, `unavailableMessage`, `collectionLabels`); `FormMessages.tsx` renders one error string.
- `src/features/admin/ContentEditor.tsx`: one form for all kinds; field audit below.
- Public field use (audit, `grep featured|summary|body|expires_on`): `HomeNotice.tsx` shows the first featured announcement; `CommunityFeed.tsx` sorts featured announcements and news first and shows `summary || body`; `app/community/[kind]/[id]/page.tsx` serves only announcements and news (summary as hero, image, url); `managed.ts` events use `body || summary`; `NewsletterArchive.tsx` uses title, date, summary and file/link only; `isVisible` applies `expires_on` to all kinds (newsletters disappear from the archive).
- `src/app/admin/help/page.tsx`: text cards (`HelpCard` with intro, steps, notes, screen link); comment says picture help and tours are PR4. `src/features/admin/AdminHeader.tsx`: title, dashboard link, sign out (server component).
- `supabase/migrations/202609090001_community.sql` `prayer_settings` (singleton, `confirmed`, `latitude`, `longitude`, `method`, `madhab`, schedule columns, check `not confirmed or (...)`, RLS `public_read` + `admin_manage`); `202609110001_prayer_adjustments.sql` adds `adjustments`, `iqamah_offsets`, `exceptions` with `valid_prayer_map` and `valid_prayer_exceptions` (requires an `adjustments` map in each exception; ignores unknown top-level keys); `202610050002_activity_log.sql` logs full prayer rows (before/after) used by History.
- `src/lib/backend/providers/supabase.ts` `readPrayer` (`select *`, `prayerSettingsSchema.parse`) and `savePrayerSettings` (`.update(settings)` with the `updated_at` check): unknown columns are stripped on read; only schema keys are written. `src/lib/backend/providers/sample.ts` and `src/lib/demo/store.ts`/`fixtures.ts` `demoPrayer` (confirmed, MWL, Shafi, 12.05/−61.75).
- `src/lib/community/activity.ts` `fieldNames`: labels for prayer columns including retired ones (old log entries keep them).
- `tests/prayer-migration.test.ts` (PGlite), `tests/prayer-today.test.ts`, `tests/e2e/editor.spec.ts:119` (prayer save; expects "Calculation settings are awaiting confirmation"), `tests/e2e/demo.spec.ts` (sandbox flows incl. prayer History restore, help walkthrough with axe), `.github/workflows/validate.yml` (CI: `npm run check`, `validate:content`, Storybook build, `npm run test:db`; no e2e in CI), `playwright.config.ts` (no web server; `E2E_BASE_URL`).
- react-joyride: `npm view react-joyride` (2026-10-03) → 3.2.0, MIT, peer `react`/`react-dom` "16.8 - 19" (React 19.2.8 supported), released 2026-07-09; v3 API differs from v2.
- `.plans/d0-board-task-inventory.md` rows #1-#6, #38, #67-#69, #84 and D14/D18/D20; open question 4 "Prayer coordinates between PR4 and PR7".
- Staging/production row contents (`confirmed`, `adjustments`, coordinates) were not inspected (no read-only Supabase MCP in this session); WP-1 has a human check.

## Owner

- Prayer calculation and congregation rules: `src/lib/prayer/**` (calculation constant, `calculatePrayers`, `congregationTimes`, new `jumuahFor`), with the data shape in `src/lib/community/schema.ts` + `supabase/migrations/`.
- Hijri date: `src/lib/time/hijri.ts` (`hijriDate`), fed the stored adjustment.
- Board screens and copy: `src/features/admin/**` (`PrayerEditor`, `ContentEditor`, `fields.ts`, `actions.ts`), routes in `src/app/admin/**`.
- Tours and picture help: `src/features/admin/tour/**` and `src/features/admin/help-pictures.ts`, rendered by `src/app/admin/help/page.tsx`; capture by `tests/e2e/help-pictures.spec.ts`.

## Source of Truth

| Rule or state                                                | Authority                                                                                                                                                                                                    | Mirrors (same commit)                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Calculation method and Asr school                            | `prayerCalculation` constant in `src/lib/prayer/calculate.ts` (ADR 0017)                                                                                                                                     | Public label text derives from it; prayer guide            |
| Coordinates (until PR7)                                      | `prayer_settings.latitude/longitude`                                                                                                                                                                         | none                                                       |
| Iqamah fixed clocks, offsets, validity dates, Jumu'ah weekly | `prayer_settings` columns + existing checks                                                                                                                                                                  | `prayerSettingsSchema`                                     |
| Per-date changes incl. Friday Jumu'ah change                 | `prayer_settings.exceptions` + new `valid_prayer_exceptions` body                                                                                                                                            | `exceptionSchema` (zod)                                    |
| Hijri adjustment                                             | `prayer_settings.hijri_adjustment smallint check between -1 and 1`                                                                                                                                           | zod `z.union([z.literal(-1), z.literal(0), z.literal(1)])` |
| Fixed vs after-adhan per prayer (exclusive)                  | on save only (D-14): zod superRefine in `prayerSaveSchema` (a prayer has a fixed clock or an offset, never both); reads stay tolerant (`prayerSettingsSchema`, minutes-after wins); DB keeps today's columns | form switch (UX)                                           |
| Which Jumu'ah applies this week                              | `jumuahFor(settings, now)` in `src/lib/prayer/congregation.ts` (pure)                                                                                                                                        | none                                                       |
| Which fields each content kind shows                         | `contentFields` map in `src/features/admin/fields.ts` (UX only; `recordSchema` and columns unchanged)                                                                                                        | help cards                                                 |
| Board-facing error text                                      | messages in `recordSchema`/`prayerSettingsSchema` (`src/lib/community/schema.ts`, `src/lib/prayer/adjustments.ts`) and copy in `src/features/admin/fields.ts`                                                | none                                                       |
| Tour steps and help pictures                                 | `src/features/admin/tour/steps.ts`; `src/features/admin/help-pictures.ts` (manifest read by the help page, the capture spec and the unit test)                                                               | committed images in `public/admin-help/`                   |
| Tour seen                                                    | browser `localStorage` (if P-9 = A)                                                                                                                                                                          | none                                                       |
| Authorization                                                | unchanged: RLS `admin_manage` via `is_admin()`; actions call `currentAdmin()`                                                                                                                                | none                                                       |

## Reuse and Duplication Analysis

Reused unchanged: `currentAdmin()`/`requireAdmin()`, `contentEditor().savePrayerSettings` and `saveRecord` (no port change), the `updated_at` version check, `activityLog` and prayer History, `clock()`, `revalidatePath("/", "layout")`, `isVisible`, `normalizeUpload`, `ActionForm`, `ViewTabs`, the sandbox store, `expectAccessible`/`submit` e2e helpers, `sharp` (already a dependency) for WebP pictures.

Extended: `prayerSettingsSchema`, `exceptionSchema`, `calculatePrayers`, `congregationTimes`/`prayerExtensionsFromForm`, `managedPrayer`, `hijriDate`, `savePrayerAction`, `restorePrayerVersionAction`, `saveRecordAction`, `ContentEditor`, `PrayerEditor`, `FormMessages`, `AdminHeader`, `fields.ts`, `activity.ts` labels, `demoPrayer`, help page cards.

Extracted to its proper owner: the "refused form keeps typed values" state (`PeopleFormState`, `typedValues`, `refusal` from `people-actions.ts`) moves to `src/features/admin/form-state.ts` and is used by people, content and prayer forms (three real consumers).

Removed: `PrayerAdjustmentsEditor.tsx`, `methods` enum and the method/madhab/confirmed/adjustments fields from zod and forms.

Searched and not found (terms: `tour`, `joyride`, `onboarding`, `screenshot`, `help-pictures`, `hijri_adjust`, `jumuah exception`, `priority`, `urgent`): no existing tour, picture capture, Hijri adjustment, Jumu'ah exception or announcement priority. `content/jumuah.yaml` `gatherings[].note` exists and is reused for display shape only.

Semantic duplication avoided: no second Jumu'ah table or YAML list; no second banner mechanism (P-4); no per-route admin check; no second form-state pattern; no copy of the calculation method in env.

## New Abstractions

- **`prayerCalculation` constant** (`src/lib/prayer/calculate.ts`). Responsibility: the ADR 0017 method and Asr school plus the public label. Why here: the only consumer is the calculation and its label; an env variable would add a required owner setting (ADR 0012 D-4 forbids defaults) for a value that never changes and a developer must change by ADR. Public API: `prayerCalculation.method`, `.madhab`, `.label`.
- **`jumuahFor(settings, now)`** (`src/lib/prayer/congregation.ts`). Responsibility: the Jumu'ah state for the coming Friday (`regular | changed | cancelled | none`). Consumers: `managedPrayer` (Prayer page and Home). Pure, unit-tested.
- **`form-state.ts`** (`src/features/admin/`). Extracted, not new (see Reuse). Public API: `type KeptFormState = EditorState & { values: Record<string, string> | null; attempt: number }`, `typedValues(form)`, `keepTyped(previous, values)(error, issues?)`.
- **`issuesOf(error: z.ZodError, fields: readonly string[]): string[]`** in `fields.ts`: every issue message once, in form order (`fields`; recorded in WP-3). `EditorState` gains optional `issues?: string[]`.
- **Tour module** `src/features/admin/tour/` (`AdminTour.tsx` client component wrapping react-joyride, `ShowMeHow.tsx` button, `steps.ts` step lists keyed by `TourId`). Owner: admin feature only; no Context/Provider, no global store.
- **Help picture manifest** `src/features/admin/help-pictures.ts`: `{ id, path, target, alt, card }[]`, one source for page, capture spec and test. Pattern: none.

No new port, adapter, table, bucket, env variable, Supabase client or auth helper.

## Product Decisions Required

All answered (see Decisions). Plain language; the pictures were shown to the user in the planning session.

- [x] P-1. How should the new Prayer & iqamah screen be laid out?
      Options: A) one page with four short numbered sections (Daily iqamah, Jumu'ah, Changes for one date, Hijri date) and one Save button (`prayer-option-a.png`); B) the same content split into three tabs on one screen with one Save button (`prayer-option-b.png`). Today's screen for comparison: `prayer-today.png`.
      Recommendation: A. Everything is visible before saving; a change on a hidden tab (B) is easy to miss, and A is closest to today's pattern.
      Decision: D-1
- [x] P-2. How does the board type each prayer's iqamah?
      Options: A) a "Fixed time / After adhan" switch per prayer with one box; B) two columns per prayer, fill in only one; C) fixed clock times only (drop "minutes after adhan") (`iqamah-entry.png`).
      Recommendation: A. Both kinds already exist in the database; the switch makes "both filled in" impossible, and Fajr/Maghrib can follow the adhan without weekly retyping.
      Decision: D-2
- [x] P-3. Until the map pin arrives (PR7), can the board still change the Musallah coordinates used for prayer starts?
      Options: A) keep two boxes (latitude, longitude) in a closed "Musallah location for prayer times (until the map pin)" section; B) remove them now; the stored coordinates keep working and only a developer can change them until PR7.
      Recommendation: A. If the stored coordinates are empty or wrong, B leaves no way to fix prayer starts without a developer (board self-sufficiency); PR7 removes the boxes anyway.
      Decision: D-3
- [x] P-4. When should "Also show an urgent notice?" for a Jumu'ah change be built?
      Options: A) Jumu'ah changes in PR4; the required yes/no notice question comes in PR5 together with the Urgent announcement priority (one banner system); B) build a minimal Urgent priority for announcements in PR4 now (new announcement field, a banner under the menu on every page, exact expiry time) and the Jumu'ah question creates it; C) interim: the question creates today's homepage notice-strip announcement, hidden after that Friday (end of day, not right after Jumu'ah), upgraded in PR5 (`jumuah-exception.png`, green box = B or C).
      Recommendation: A. Everything ships before launch anyway; B pulls a PR5 feature forward and C builds a stopgap PR5 must redo. Until PR5 the help card says to post an announcement for a Jumu'ah change.
      Decision: D-4
- [x] P-5. Is the reason typed for a one-date change shown to visitors?
      Options: A) yes, for Jumu'ah changes and daily iqamah changes (one short line under the times, for example "Mid-term break"); B) only for Jumu'ah changes; C) never (board-only note, as today).
      Recommendation: A. Visitors otherwise see a different time with no explanation; the label says "(shown to visitors)" so nobody types private notes there.
      Decision: D-5
- [x] P-6. After the board moves the Hijri date by one day, how long does it stay moved?
      Options: A) until someone changes it back; the prayer screen always shows the date the site displays today; B) it resets to "As calculated" automatically when the next Hijri month starts.
      Recommendation: A. Simplest and predictable; the screen shows all three dates side by side (`prayer-option-a.png`, section 4), and the "End of term" help card gets a line to check it.
      Decision: D-6
- [x] P-7. Approve the simplified content forms (field removals, order and wording)?
      Options: A) approve as in `event-form.png` and `content-forms.png`: events lose "Short summary" (merged into the description), "Expiration date" and "Feature on the homepage"; newsletters lose "Full description", "Feature on the homepage" and "Expiration date"; news keeps "Pin to the top of Community updates" (and "Hide after" under More options); announcements keep "Show in the homepage notice strip"; "Published" becomes "Who can see it? Only the board (draft) / Everyone on the website"; all problems listed at once; B) approve the removals and error list but keep today's labels and the Published checkbox; C) mark changes on the pictures.
      Recommendation: A. Every removed field does nothing for that kind today (audit in Design); stored values are kept, so nothing is lost.
      Decision: D-7
- [x] P-8. How does the tour start for a new board member?
      Options: A) by itself on their first visit to the dashboard, with "Skip tour"; B) a "New here? Start the tour / Not now" card on the dashboard (`tour.png`).
      Recommendation: A. ADR 0008 says "first-login tour"; Skip makes it harmless, and "Show me how" replays it.
      Decision: D-8
- [x] P-9. Where is "this person has seen the tour" remembered?
      Options: A) in the browser (it may show again on a new phone or after clearing the browser); B) on the board member's account in the database (follows them everywhere; needs a new database field and migration).
      Recommendation: A. Free, no database change; seeing a skippable tour again on a new device is harmless.
      Decision: D-9
- [x] P-10. Which pages get a "Show me how" tour, with these steps?
      Options: A) four tours: Dashboard (5 steps: the content cards, Prayer & iqamah, People, Recent changes, Help); Prayer & iqamah (6: automatic starts note, daily iqamah switch, Jumu'ah, Changes for one date, Hijri date, Save and History); Edit an item (5: title, date/time, Who can see it, Save, Archive/Duplicate); People (4: Add a person, Show on public page?, Dashboard login, Edit sections); B) Dashboard tour only; C) A plus Recent changes and Help.
      Recommendation: A. Covers the weekly tasks; each tour stays under a minute. Step texts are drafted in WP-6 and shown to you before merge.
      Decision: D-10
- [x] P-11. How many pictures on the help page?
      Options: A) one picture per numbered step, with the button to press circled (`help-pictures.png`); B) one overview picture per help topic.
      Recommendation: A for the eight most common tasks (create and publish, events, announcements, prayer iqamah, one Friday's Jumu'ah, Hijri date, archive/restore, invite a person); B for the rest. Pictures are re-taken by one command, so more pictures cost little.
      Decision: D-11
- [x] P-12. Add any of the D0 inventory items tagged "PR4" that are not in the roadmap's PR4 row?
      Options: A) none; keep PR4 as the roadmap describes and list them on the roadmap for later; B) add only #67: a dashboard line "Iqamah times end on 15 Dec — update them" from 7 days before "Times end on"; C) add #67, #68 (prepare the next schedule) and #85 (needs-attention list).
      Recommendation: A, or B if you want one cheap safety net (the schedule silently disappearing over breaks is a known risk).
      Decision: D-12
- [x] P-13. Approve the public wording that changes on Home and Prayer?
      Options: A) calculation line "Begins: calculated for the Musallah (Muslim World League · Standard Asr · America/Grenada)"; no-starts line "Prayer start times will appear once the Musallah location is set."; Jumu'ah card "Changed this Friday, 17 October" + "Usually: …" and "No Jumu'ah this Friday, 10 October." + reason (`jumuah-exception.png`); B) give your own wording.
      Recommendation: A. Same format as today's line; plain words.
      Decision: D-13

## Decisions

- D-1: one page with 4 sections and one Save (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-2: a "Fixed time / After adhan" switch per prayer (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-3: keep two coordinate boxes in a closed section until PR7 (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-4: add the urgent notice in PR5 together with the Urgent announcement priority (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-5: show the reason to visitors for Jumu'ah and daily changes (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-6: the Hijri adjustment lasts until someone changes it, with all three dates shown (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-7: approve the simplified forms: removals, field order, plain labels, "Who can see it?" radio, full error list (option A) (user, 2026-10-03; accepted the planner recommendation).
  - Amendment (user, 2026-10-05, second demo review; `.plans/review2-plan.md` PR-A 3, 4): the "full error list" is replaced by **problems on their boxes**. Every board form (content, prayer, pin, people and groups, funds, tickets, seasons, pages, New board term steps and logins) is a `CheckedForm` (`src/features/admin/form-check/`): its pure rules (`contentForm`, `prayerForm`, `itemFromForm`, `seasonFromForm`, `personFromForm`, `sectionFromForm`, `stepFromForm`, `loginFromForm`, `pageTextForm`) run in the browser as you type (once a box is started on) and when you leave it, and on the server as the final check. A wrong box gets a red outline (`--status-danger`, light and dark) and one line under it (`FieldError`, `aria-invalid`, `aria-describedby`); Save with a red box shows one line at the top, **"Some boxes need fixing."** (no list), moves to the first red box and posts nothing. A server-only refusal ("someone else saved first", a Go2Pay page already used) shows in the same top slot or on its box. `EditorState.issues` and `issuesOf` are replaced by `fields` and `problemsOf`. **Unsaved changes**: closing or reloading the tab gets the browser's warning; a click on a dashboard link opens **Leave without saving?** with **Save** / **Discard** / **Keep editing** (`UnsavedChangesGuard`); Save is refused while a box is red and, once saved, opens the clicked page.
- D-8: the tour starts by itself on the first dashboard visit, with Skip (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-9: "tour seen" is remembered in the browser (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-10: tours on Dashboard, Prayer, Edit item and People (option A) (user, 2026-10-03; accepted the planner recommendation). The drafted step texts (20 steps) and the tour behaviour were shown to the user and approved before WP-6 merged (user, 2026-10-03).
  - Amendment (user, 2026-10-05, second demo review; `.plans/review2-plan.md` PR-A 5): **Show me how** shows only while at least one step of the page's tour is on the page (`ShowMeHow` checks the step targets in the browser), never on a page it cannot explain. The Edit item tour gains the step "Also post an announcement?" (shown only when the question is on screen).
- D-11: one picture per step for the 8 most common tasks, one per topic for the rest (user, 2026-10-03; accepted the planner recommendation).
- D-12: add only the #67 dashboard warning 7 days before the iqamah times end (option B) (user, 2026-10-03; accepted the planner recommendation).
  - Amendment (user, 2026-10-04; asked whether the warning should keep showing after the end date, the user answered "show the warning"): after "Times end on" has passed, the dashboard keeps the warning, worded "Iqamah times ended on 8 Oct — update them" (with that date, in the same day-and-short-month format as "Iqamah times end on 8 Oct — update them"), until a board member sets a later end date. One helper owns the rule: `scheduleEndStatus(settings, today)` in `src/lib/prayer/congregation.ts` (renamed from WP-7's `scheduleEndingSoon`) returns `none | ending_soon | ended` with the end date; any later reminder about the end date reuses it. Implemented in the WP-8 PR.
- D-13: approve the public wording as drafted (option A) (user, 2026-10-03; accepted the planner recommendation).
- D-14: the "not both a fixed iqamah time and minutes after the start" rule is enforced only when saving (`savePrayerAction` and the WP-4 form values, through `prayerSaveSchema`); reading stored prayer settings stays tolerant (`prayerSettingsSchema`) and applies the existing precedence (minutes after the start wins), so old live rows never break the public prayer block or the admin screen. A History restore reads the old version the same way, then runs the save check. The release checklist's read-only SQL check for such rows stays as an extra safety net but no longer blocks the release (planner amendment, 2026-10-03; WP-2 review finding 1, option a; rejected: keep the rule on reads and rely on a pre-release SQL check).
  - Amendment (user, 2026-10-05, answer to Q58: "show error if both fixed and minutes after. cant have both it doesnt make sense"): reading stays tolerant but no longer collapses the row: `prayerSettingsSchema` keeps both values as stored, and the public precedence (minutes after the start wins, `congregationTimes`) is unchanged. The Prayer & iqamah screen shows such a prayer with both boxes, neither switch side picked, and the row error from `iqamahBothMessage` ("Fajr iqamah: pick Fixed time or After adhan, not both."); `prayerFormText` marks it with the form mode `both`, which posts both boxes so `prayerSaveSchema` refuses the save with the same message until the board picks one. A History restore of a version with both is refused with that message (no silent conversion). Rejected: keep showing only the minutes and drop the fixed time on the next save (the 2026-10-03 behaviour). Tests: `tests/community.test.ts`, `tests/review.test.ts`, `tests/editor.test.ts`.
- D-15: an event or newsletter saved from the new forms clears any old "Hide after" date (`expires_on`), the box D-7 removed from those two forms, so a hidden date can no longer hide the item or refuse its save ("Hide after: choose the item's date or a later one."). The form posts it empty, like the event short summary: `contentFormRecord` in `fields.ts` empties `expires_on` for every kind whose `contentFields` do not show it; announcements and community news keep their box and value (planner amendment, 2026-10-03, implementing the user decision D-7 that removed the field; WP-5 review finding 1, option a; rejected: show "Hide after" again only when a date is stored). Implemented in the WP-6 PR.
- D-16 (amendment, user, 2026-10-05, demo review, `.plans/review-fixes-plan.md` PR-3): **the musallah is one room**, so Jumu'ah has no room anywhere. The weekly "Room" (`prayer_settings.jummah_location`) and the per-Friday "Room" are removed; the per-Friday choice "Different time or room" becomes **"Different time"** (khutbah and iqamah only); the public Jumu'ah card, the home Jumu'ah line and "Usually: …" show no place; the prefilled urgent notice reads "Jumu’ah this Friday (16 Oct) moves to 1:15 PM". This replaces the room in D-5/D-13's wording, WP-1's `{"change","khutbah","iqamah","location"}` form (now `{"change","khutbah","iqamah"}`), the B. Prayer screen's "2 Jumu'ah (Khutbah, Iqamah, Room)" and the room refusals. Migration `supabase/migrations/202610130001_one_room_verse_excerpts.sql` drops the column, removes `location` from saved Friday changes (not logged as a board change) and replaces `valid_prayer_exceptions`; zod drops a room on read, so older rows and History versions stay readable and restorable. Engineering, stated: apply it on production right after the Release PR that ships it is live, because the site live before it still reads the column.

Recorded engineering choices (not product decisions; say if you disagree): the calculation is a code constant, not an env variable (New Abstractions); retired prayer columns are dropped in PR7's contract migration, not in PR4 (Compatibility and Migration); react-joyride is the tour library as ADR 0008 already approved (3.2.0 supports React 19); help pictures are committed WebP files checked in CI for presence and size, not pixel-compared (Design).

## Board Self-Sufficiency Check

- Iqamah times (fixed or after adhan), validity dates, weekly Jumu'ah, one-date daily changes, one-Friday Jumu'ah changes, the visitor note and the Hijri adjustment: Dashboard → **Prayer & iqamah**; help cards "Prayer & iqamah", "Change one Friday's Jumu'ah", "Hijri date"; tour "Prayer & iqamah". No developer, no redeploy (`revalidatePath`).
- Method and Asr school: not board-editable, by ADR 0017 (recorded exception to ADR 0002); the prayer guide tells the founders who to ask.
- Coordinates until PR7: board-editable only if P-3 = A; with B a developer changes them until PR7 (gap recorded on the roadmap by WP-8).
- Content forms: unchanged powers, simpler screens; nothing the board could do before is lost (removed fields did nothing for that kind).
- Tours and help: tour steps and help pictures are developer-maintained by design (ADR 0008: they change with the UI in the same PR); the board does not edit help text.
- Urgent notice for a Jumu'ah change: until PR5 (if P-4 = A) the board posts a featured announcement by hand, as today; help card says so.

## Design

### A. Prayer calculation and data

```text
prayer_settings row ──read──> prayerSettingsSchema (zod) ──> calculatePrayers(settings, now)
                                     │                         uses prayerCalculation (MWL + Shafi), lat/lng only
                                     ├──> congregationTimes(settings, now)   fixed | after-adhan | date clock
                                     ├──> jumuahFor(settings, now)          regular | changed | cancelled | none
                                     └──> hijri_adjustment ──> hijriDate(now, maghribIso, adjustment)
board form ─> savePrayerAction ─> zod (all issues) ─> calculationProblem ─> contentEditor().savePrayerSettings(version)
```

- `prayerCalculation = { method: "MuslimWorldLeague", madhab: "Shafi", label: "Muslim World League · Standard Asr" } as const` with a comment citing ADR 0017. `calculatePrayers` returns [] when `latitude` or `longitude` is null; otherwise `CalculationMethod.MuslimWorldLeague()` with `Madhab.Shafi` and no adjustments. The ordering/finite check stays.
- `prayerSettingsSchema` drops `confirmed`, `method`, `madhab`, `adjustments` (zod strips them on read; the update never writes them). Adds required `hijri_adjustment` (−1, 0, 1). `exceptionSchema` drops `adjustments`, adds `jumuah: { change: "none" } | { change: "cancelled" } | { change: "changed", khutbah, iqamah, location }` defaulting to `{ change: "none" }`; superRefine: a Jumu'ah change needs a Friday date (Grenada calendar), `changed` needs all three values; existing validity-date rule unchanged. A prayer may not have both a fixed clock and an offset, checked only when saving (`prayerSaveSchema`, D-14); the reader `prayerSettingsSchema` keeps a stored row with both as stored (D-14 amendment, 2026-10-05; `congregationTimes` shows the offset), so an old live row never breaks the public prayer block or the admin screen.
- `congregationTimes`: unchanged precedence; with the exclusive switch only one of fixed/offset exists per prayer.
- `jumuahFor(settings, now)`: the coming Friday = today if Friday, else the next Friday (Grenada dates). If an exception on that date has `cancelled` → `{ state: "cancelled", date, reason }`; `changed` → `{ state: "changed", date, gathering, reason, usual }`; else the weekly gathering when the schedule is current → `regular`; else `none`. Shown from the Saturday before until that Friday ends (date-based, simple). `managedPrayer` maps it into the existing `jumuah` shape (`gatherings` + `note`) plus a small `change` field; `JumuahCard` and `HomeHero` render the P-13 wording with today's classes (no restyle).
- Daily one-date reasons are shown to visitors only if P-5 = A/B (one line under the times, via `managedPrayer` `prayer.notice` composition).
- `hijriDate(now, maghribIso, adjustment)`: adjustment is required (no default). Shift = (after Maghrib ? 1 : 0) + adjustment days. Home and Prayer pass `settings.hijri_adjustment`; the admin page calls it three times (−1, 0, +1) to label the radio options.
- `calculationProblem(settings)`: runs whenever coordinates are set (not gated on `confirmed`): today and every exception date must give 12 ordered starts; message "Prayer start times cannot be calculated for these coordinates. Check the Musallah location."
- `restorePrayerVersionAction`: an older version without `hijri_adjustment` (saved before PR4) keeps the current value: parse `{ hijri_adjustment: current.hijri_adjustment, ...entry.before }`; retired keys are stripped by zod; exception start corrections in old versions are dropped (ADR 0017).

### B. Prayer screen (P-1, P-2, P-3, P-5, P-6)

Recommended layout `prayer-option-a.png`: note about automatic starts; 1 Daily iqamah table (per-prayer switch `mode_<prayer>` = `fixed|after`, one input, "Today" column computed server-side from `congregationTimes` on the saved settings); "Times start on / Times end on"; 2 Jumu'ah (Khutbah, Iqamah, Room); 3 Changes for one date (rows: date, reason, daily iqamah clocks in a closed details, Jumu'ah radios shown when the date is a Friday; "Remove this date" clears the row; "+ Add a date"; max 20 as today); 4 Hijri date radios with the three dates; Note for visitors; P-3 coordinates details (if A); Save; History unchanged below. Small client state only (`useState` for row count, switch and Friday detection); no new hooks or context.

### C. Content forms (P-7)

Field audit of `ContentEditor.tsx` against public use:

| Field                      | Events                                                    | Announcements                                         | Community news                                               | Newsletters                                        |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Short summary              | only if body empty → merge into description               | homepage strip, lists, page hero → keep               | lists, page hero → keep                                      | archive list → keep                                |
| Full description / message | keep                                                      | keep                                                  | keep                                                         | never shown → remove                               |
| Expiration date            | hides even the past-event entry → remove                  | keep ("Hide after")                                   | rarely used → "More options"                                 | silently drops the issue from the archive → remove |
| Feature on the homepage    | does nothing (no reader of `SiteEvent.featured`) → remove | homepage notice strip + first in feed → keep, relabel | first in Community updates → keep, relabel "Pin to the top…" | does nothing → remove                              |
| Cover image + description  | event page → keep                                         | feed + page → keep                                    | feed + page → keep                                           | already hidden                                     |
| Link                       | registration → "Sign-up link"                             | page button → keep                                    | page button → keep                                           | PDF or link → one "The newsletter" choice          |

- `contentFields: Record<Collection, ...>` in `fields.ts` drives which fields, labels, hints and order each kind shows (UX only). Hidden fields keep their stored value via hidden inputs, except: events save `summary = ""` after merging (`body` prefilled with `body || summary`), so the public description is unchanged. Events and newsletters also save `expires_on = ""` (D-15).
- "Who can see it?" radio posts `published=on|off` (server keeps the same boolean).
- Errors: `saveRecordAction` and `savePrayerAction` return `issues: issuesOf(parsed.error)` plus the extra business checks (event location/time when published, newsletter file/link, image description) collected into the same list instead of returning early. `FormMessages` renders "Please fix N things before saving:" and the list in one `role="alert"` region. Schema messages are rewritten to name the field in plain words ("Start time: …").
- Refused saves keep typed values: content and prayer forms adopt `KeptFormState` (`values`, `attempt` as `key`), as People already do. File inputs must be chosen again (browser limit; message says so).

### D. Tours (P-8, P-9, P-10)

- `AdminTour` ("use client") renders react-joyride v3 with steps from `steps.ts`; targets are `data-tour="<id>"` attributes added to existing elements. Buttons: Back, Next, Skip tour, Done; "Step N of M"; styles via current admin CSS variables; respects `prefers-reduced-motion`. Verify the v3 API and SSR behaviour in the package README and `node_modules/next/dist/docs/` before coding (do not copy v2 examples).
- `ShowMeHow` button in `AdminHeader` (new optional prop `tour?: TourId`). `?tour=1` on a URL also starts the page's tour (used by help links "Show me on the real page").
- First-login (P-8 = A): the dashboard tour starts when `localStorage["sgu-admin-tour:v1:dashboard"]` is absent; finishing or skipping sets it. Every read/write is in try/catch; with storage unavailable the tour simply does not auto-start.

### E. Picture help (P-11)

- `help-pictures.ts` manifest: each entry names the admin path, any sandbox setup (for example open the first event), the `data-tour`/role target to circle, alt text and its help card/step.
- `tests/e2e/help-pictures.spec.ts`: signs into the sandbox (`admin`/`admin`), visits each entry at viewport 1100×750, reduced motion, light theme. Check mode (default, part of `npm run test:e2e` with `E2E_DEMO=true`): the target is visible, so a renamed or moved button fails the suite. Write mode (`HELP_PICTURES=write`): outlines the target, takes the screenshot, converts to WebP with `sharp` (quality 80) and writes `public/admin-help/<id>.webp`.
- `npm run help:pictures` → `scripts/help-pictures.mjs`: starts the sandbox on a free port with `SITE_DEMO_DATE=2026-10-08T14:00:00Z` (a Thursday, so a Friday change is visible), runs the spec in write mode against it, stops the server. Refuses `VERCEL_ENV=production` like `scripts/demo.mjs`.
- `tests/help-pictures.test.ts` (in `npm test`, so CI): every manifest file exists, is ≤ 120 KB, has non-empty alt text, and every help step picture id is in the manifest. No pixel comparison in CI (font rendering differs between machines; would be flaky).
- Help page: each step renders its picture (`next/image` with width/height, lazy, opens full size in a new tab) under the step text; cards updated for the new screens; new cards "Change one Friday's Jumu'ah" and "Hijri date".

## Public Contract

- Migration `supabase/migrations/202610060001_prayer_simplification.sql` (Compatibility and Migration).
- `src/lib/prayer/calculate.ts`: `export const prayerCalculation`; `calculatePrayers(settings: PrayerSettings, now: Date)` (same signature).
- `src/lib/prayer/adjustments.ts`: `exceptionSchema` (no `adjustments`, new `jumuah`); `adjustmentSchema` and `startIds` deleted if no consumer remains.
- `src/lib/community/schema.ts`: `prayerSettingsSchema` (fields above; the tolerant reader, D-14), `prayerSaveSchema` (the same fields plus the save-only fixed-or-offset rule, D-14), `PrayerSettings`, `emptyPrayer` (`hijri_adjustment: 0`); `methods` deleted.
- `src/lib/prayer/congregation.ts`: `congregationTimes`, `isScheduleCurrent` (unchanged), `jumuahFor(settings, now): JumuahState`, `prayerFormValues(form)` (renamed from `prayerExtensionsFromForm`; parses switch, offsets, exceptions with Jumu'ah, Hijri, coordinates if P-3 = A).
- `src/lib/time/hijri.ts`: `hijriDate(now: Date, maghribIso: string | null, adjustment: -1 | 0 | 1): HijriDate`.
- `src/lib/community/managed.ts` `managedPrayer()`: adds `jumuah.change` (`JumuahState` minus internals); existing fields unchanged.
- `src/features/admin/actions.ts`: `savePrayerAction(previous: KeptFormState, form)` and `saveRecordAction(previous: KeptFormState, form)` return `KeptFormState` with `issues`; other actions unchanged. `EditorState` gains `issues?: string[]`.
- `src/features/admin/form-state.ts`: `KeptFormState`, `typedValues`, `keepTyped`, `recordFromTyped(values)` (recorded in WP-3: the one place that reads the posted `published`/`featured` checkboxes, for the save and the kept form).
- `src/features/admin/fields.ts`: `issuesOf(error, fields)` (recorded in WP-3: `fields` is required, the form's field names top to bottom, so every caller sets the order), `contentFields`.
- `src/lib/community/schema.ts` (recorded in WP-3): `recordFormSchema(kind, chosen: { image: boolean; file: boolean })`, the record rules plus the kind and chosen-file rules in one schema; WP-5 reuses it.
- `src/features/admin/AdminHeader.tsx`: `{ title: string; tour?: TourId }`.
- `src/features/admin/tour/steps.ts`: `type TourId = "dashboard" | "prayer" | "content" | "people"` (per P-10), `tourSteps: Record<TourId, Step[]>`.
- `src/features/admin/help-pictures.ts`: `helpPictures` manifest.
- `package.json`: dependency `react-joyride@^3.2.0`; script `help:pictures`; `format`/`format:check` include `scripts/help-pictures.mjs`.
- No new route, RLS policy, port, env variable or bucket.

## Private Implementation

Implementer decides: component splitting inside `PrayerEditor`, private names, CSS class reuse from `globals.css`, the exact markup of the error list, tour tooltip component details within react-joyride's API, the spec's setup steps per picture, WebP quality within the 120 KB budget.

## Data and State Flow

- Reads: public pages via `managedPrayer()` → `getPrayerSettings()` (`ContentProvider`); admin page via `readAdminPrayer()` (`contentEditor().readPrayer`). Both parse with `prayerSettingsSchema`.
- Writes: `savePrayerAction` / `saveRecordAction` → `currentAdmin()` → zod (all issues; prayer via `prayerSaveSchema`, D-14) → business checks → `contentEditor()` with the `updated_at` version → `revalidatePath("/", "layout")` → redirect with `?saved=1`. Refusals return `KeptFormState`.
- Activity log: database trigger (unchanged) records the new column and Jumu'ah data; `activity.ts` adds labels "Hijri date adjustment" and keeps the retired labels for old entries.
- Tours: client only; `localStorage` (P-9 = A). Help pictures: static files under `public/admin-help/` served by Next.
- Sandbox: `demoPrayer` drops retired fields, adds `hijri_adjustment: 0`; sample adapter unchanged (stores whatever the schema gives).

## Failure Modes

- Supabase unavailable: public pages keep today's honest unavailable state; the admin page shows "Settings could not be loaded"; saves return `unavailableMessage("save")` with typed values kept.
- Stale version (two editors): unchanged conflict message; typed values kept.
- Session expiry mid-edit: `sessionExpired`; typed values kept so the board can copy them after signing in.
- Double submit: Save disabled while pending (unchanged).
- Migration missing (new code before migration): reads fail zod (`hijri_adjustment` required) → public prayer shows the unavailable state and saves fail; the release checklist orders migration first. Old code after migration: compatible (see Compatibility).
- Coordinates empty: no starts; public line per P-13; Hijri date uses the civil day (today's behaviour).
- A Jumu'ah change on a non-Friday or an incomplete "Different time or room": refused with named issues.
- Restore of a pre-PR4 version: allowed; retired fields dropped; current Hijri adjustment kept; a version with both a fixed clock and an offset for one prayer is refused, naming the prayer (D-14 amendment, 2026-10-05).
- A stored row with both a fixed clock and an offset for one prayer (allowed before PR4): read as stored; public pages show the offset; the admin screen shows both boxes and the row error, and a save is refused until the board picks one (D-14 amendment, 2026-10-05).
- Tour target missing (layout changed): react-joyride skips the step; the help-pictures spec and the tour e2e fail in development, so it is fixed before merge.
- `localStorage` blocked: tour does not auto-start; "Show me how" still works.
- Deployment skew: old clients posting the old prayer form (field names changed) get a refusal listing missing fields; reload fixes it. Copy: "This page is out of date. Reload it and try again." when required new fields are absent.

## Compatibility and Migration

File `supabase/migrations/202610060001_prayer_simplification.sql` (sorts after `202610050003_archive.sql`):

1. `alter table public.prayer_settings add column hijri_adjustment smallint not null default 0 check (hijri_adjustment between -1 and 1);` (0 = "as calculated", the meaning every existing row already has).
2. `create or replace function public.valid_prayer_exceptions(value jsonb)`: same rules as `202609110001_prayer_adjustments.sql`, except `adjustments` becomes optional (if present it must still be a valid map, so old code keeps working) and an optional `jumuah` object is validated: `change` in (`none`, `cancelled`, `changed`); for `changed`, `khutbah` and `iqamah` match `^([01]\d|2[0-3]):[0-5]\d$` and `location` is 1..250 characters; for `cancelled`/`changed` the date is a Friday (`extract(isodow from date) = 5`). Unknown keys inside `jumuah` are refused. `set search_path = ''`, immutable, as today.
3. No column drops. `confirmed`, `method`, `madhab`, `adjustments` stay unread and unwritten; PR7's contract migration drops them together with `latitude`/`longitude` once PR4 is live in production. Add that note to the PR7 roadmap row (WP-8).

Compatibility: old production code with the new schema reads `select *` (extra column stripped by zod) and writes exceptions with `adjustments` (still accepted) → safe to apply before the Release PR. New code needs the migration (fails honestly without it).

Behaviour changes to confirm before release (human check, WP-1): (a) if production has `confirmed = false` but coordinates set, prayer starts start showing; (b) non-zero `adjustments` or exception start corrections stop applying (starts may move by those minutes). Exact read-only check, run in each project's **SQL Editor** (staging, then production):

```sql
select confirmed, latitude, longitude, method, madhab, adjustments,
  (select count(*) from jsonb_array_elements(exceptions) e
    where e->'adjustments' is not null
      and e->'adjustments' <> '{"fajr":0,"sunrise":0,"dhuhr":0,"asr":0,"maghrib":0,"isha":0}'::jsonb)
    as exceptions_with_corrections
from public.prayer_settings;
```

Apply steps (human, staging first): Supabase → project **sgu-msa-staging** → **SQL Editor → New query** → paste the whole file (Raw/Copy) → **Run** once → verify `select hijri_adjustment from public.prayer_settings;` returns `0`. Test the integration branch locally against staging. Production: same steps, before the Release PR that ships PR4 is merged. Rollback: `alter table public.prayer_settings drop column hijri_adjustment;` and re-run the `valid_prayer_exceptions` body from `202609110001_prayer_adjustments.sql` (only after removing any `jumuah` keys, which old code ignores anyway).

Tests: `tests/prayer-migration.test.ts` extended (PGlite: both migrations; accepts old-shape and new-shape exceptions, refuses bad Jumu'ah values, non-Friday changes, `hijri_adjustment = 2`); `npm run test:db` runs all migrations in Docker (CI).

## Parallel Work and Merge Order

```yaml
WP-1:
  {
    creates: [supabase/migrations/202610060001_prayer_simplification.sql],
    extends: [tests/prayer-migration.test.ts],
    shared_contract_changes:
      [prayer_settings.hijri_adjustment, valid_prayer_exceptions],
    depends_on: [],
  }
WP-2:
  {
    extends:
      [
        src/lib/prayer/*,
        src/lib/community/schema.ts,
        src/lib/time/hijri.ts,
        src/lib/community/managed.ts,
        src/lib/community/activity.ts,
        src/lib/demo/fixtures.ts,
        src/features/prayer/JumuahCard.tsx,
        src/features/prayer/PrayerToday.tsx,
        src/features/home/HomeHero.tsx,
        src/app/page.tsx,
        src/app/prayer/page.tsx,
        src/features/admin/actions.ts (prayer parts),
      ],
    depends_on: [WP-1 hard],
    potential_conflicts:
      [Track B PR8 home/prayer worktrees edit the same public files],
  }
WP-3:
  {
    creates: [src/features/admin/form-state.ts],
    extends:
      [
        fields.ts,
        FormMessages.tsx,
        people-actions.ts,
        actions.ts (saveRecordAction),
        schema messages,
      ],
    depends_on: [WP-2 hard (schema.ts, actions.ts)],
  }
WP-4:
  {
    extends:
      [
        PrayerEditor.tsx,
        src/app/admin/prayer-times/page.tsx,
        dashboard card text,
      ],
    deletes: [PrayerAdjustmentsEditor.tsx],
    depends_on: [WP-3 hard],
  }
WP-5:
  {
    extends: [ContentEditor.tsx, fields.ts contentFields, content edit page],
    depends_on: [WP-3 hard],
    potential_conflicts: [WP-4 none by file],
  }
WP-6:
  {
    adds_dependency: [react-joyride],
    creates: [src/features/admin/tour/*],
    extends: [AdminHeader.tsx, data-tour attributes in admin screens],
    depends_on: [WP-4, WP-5 hard],
  }
WP-7:
  {
    creates:
      [
        help-pictures.ts,
        tests/e2e/help-pictures.spec.ts,
        tests/help-pictures.test.ts,
        scripts/help-pictures.mjs,
        public/admin-help/*.webp,
      ],
    extends: [src/app/admin/help/page.tsx, package.json],
    depends_on: [WP-6 hard],
  }
WP-8: { extends: [docs/*], depends_on: [WP-7] }
integration_owner: planner
```

- WP-4 and WP-5 may run in parallel after WP-3 (disjoint files; neither edits `fields.ts` except WP-5's `contentFields` block, which WP-3 creates empty).
- Track B (PR8) edits `src/app/page.tsx`, `src/app/prayer/page.tsx`, `HomeHero`, `PrayerToday`, `JumuahCard` in its own worktrees: integration dependency. WP-2 keeps public edits to data props and copy only; whichever merges second rebases and reruns `npm run check` and the e2e prayer/home checks.
- Merge order: WP-1 → WP-2 → WP-3 → WP-4/WP-5 → WP-6 → WP-7 → WP-8. One PR per WP to `integration` (ADR 0016); each updates **Unreleased** in `docs/release-checklist.md`.

## Work Packages

### WP-1: Migration and database tests

- Purpose: storage for the Hijri adjustment and Friday Jumu'ah changes; old code keeps working.
- Depends on: none.
- Expected files: `supabase/migrations/202610060001_prayer_simplification.sql`, `tests/prayer-migration.test.ts`, `docs/release-checklist.md`.
- Reuse: `valid_prayer_map`, existing checks, `scripts/test-db.mjs`.
- Required changes: as Compatibility and Migration; release checklist "Settings to set before merging the Release PR" gets the exact apply steps and the read-only check, and "Needs your confirmation" gets the two behaviour changes.
- Must not: drop or rename columns; change RLS or grants; add a table; touch production.
- Tests: PGlite migration test; `npm run test:db`.
- Done when: tests pass; a human applied it to staging and reported the check query result (planner relays (a)/(b) to the user).

### WP-2: Fixed calculation, schema, Hijri adjustment, Jumu'ah state

- Purpose: domain rules and public data for the new model.
- Depends on: WP-1 (hard).
- Expected files: `src/lib/prayer/calculate.ts`, `adjustments.ts`, `congregation.ts`, `src/lib/community/schema.ts`, `src/lib/time/hijri.ts`, `src/lib/community/managed.ts`, `src/lib/community/activity.ts`, `src/lib/demo/fixtures.ts`, `src/features/prayer/JumuahCard.tsx`, `PrayerToday.tsx`, `src/features/home/HomeHero.tsx`, `src/app/page.tsx`, `src/app/prayer/page.tsx`, `src/features/admin/actions.ts` (`calculationProblem`, `restorePrayerVersionAction` only), tests.
- Reuse: `calculatePrayers`, `congregationTimes`, `managedPrayer`, `clock()`.
- Required changes: Design A; public copy per P-13; reasons per P-5. The existing `PrayerEditor` keeps compiling by temporarily rendering only the fields that still exist (WP-4 replaces it).
- Must not: read env for the method; add a provider or port; restyle public components; change `congregationTimes` precedence.
- Tests: `tests/prayer-today.test.ts` and new cases in `tests/community.test.ts`: fixed method (MWL Fajr 18°/Isha 17° for 12.05,−61.75 on a fixed date), no starts without coordinates, retired fields ignored, `jumuahFor` (regular, cancelled, changed, before/after Friday, non-current schedule), `hijriDate` with −1/0/+1 before and after Maghrib, restore of a pre-PR4 version; `tests/activity.test.ts` label.
- Done when: `npm run check` passes; sandbox Home and Prayer show starts, adjusted Hijri date and a Jumu'ah change set in the store.

### WP-3: Form state and error lists

- Purpose: every refused save lists all problems and keeps typed values.
- Depends on: WP-2 (hard).
- Expected files: `src/features/admin/form-state.ts`, `fields.ts`, `FormMessages.tsx`, `people-actions.ts`, `actions.ts` (`saveRecordAction`), `ContentEditor.tsx` (state wiring only), `src/lib/community/schema.ts` and `src/lib/validation/date-time.ts` (messages), tests.
- Reuse: PR3's `PeopleFormState` pattern (moved, behaviour identical for People).
- Required changes: Design C "Errors" and "Refused saves keep typed values".
- Must not: change People behaviour or messages; add a client store or context; return raw Supabase errors.
- Tests: `tests/editor.test.ts` (`issuesOf` order and dedupe; multiple issues returned); e2e: a content save with three problems shows three items and keeps the title text.
- Done when: People e2e still green; content refusal keeps typed values.

### WP-4: Prayer & iqamah screen

- Purpose: the simplified board screen (P-1, P-2, P-3, P-5, P-6).
- Depends on: WP-3 (hard).
- Expected files: `src/features/admin/PrayerEditor.tsx` (rewrite), delete `PrayerAdjustmentsEditor.tsx`, `src/lib/prayer/congregation.ts` (`prayerFormValues`), `src/features/admin/actions.ts` (`savePrayerAction`), `src/app/admin/prayer-times/page.tsx` (Hijri labels, Today column), `src/app/admin/dashboard/page.tsx` (card text "Iqamah, Jumu'ah, one-day changes and Hijri date →"), `tests/e2e/editor.spec.ts`, `tests/e2e/demo.spec.ts`.
- Reuse: `KeptFormState`, `FormMessages`, `PrayerHistory`, `congregationTimes`, `hijriDate`.
- Required changes: Design B; labels exactly as the approved mockup.
- Must not: show method, madhab, confirmed or start-correction controls; add a second Save or separate forms per section (one version check); store anything outside `prayer_settings`.
- Tests: e2e sandbox: switch Fajr to "After adhan 20" and save → Prayer page iqamah = start + 20; add a Friday "No Jumu'ah" → Prayer card shows the cancellation; Hijri "One day later" → Home shows the next date; refusal with two problems lists both and keeps values; axe passes; History restore still works.
- Done when: acceptance criteria 1-5 pass in the sandbox.

### WP-5: Simplified content forms

- Purpose: P-7.
- Depends on: WP-3 (hard). Parallel with WP-4.
- Expected files: `src/features/admin/ContentEditor.tsx`, `fields.ts` (`contentFields`), `src/app/admin/content/[kind]/[id]/page.tsx` (new-record defaults only if needed), `tests/e2e/editor.spec.ts`, `tests/e2e/demo.spec.ts`.
- Reuse: `recordSchema`, `ImageField`, `ActionForm`, duplicate/archive sections unchanged.
- Required changes: Design C table and labels; events summary merge; hidden fields keep stored values.
- Must not: change `recordSchema` columns, RLS or public rendering; add announcement priority (unless P-4 = B, which gets its own WP).
- Tests: e2e per kind: removed fields absent, labels present, publish via "Everyone on the website", event with summary-only content shows the same description publicly after save, newsletter archive unaffected.
- Done when: all four editors pass e2e and axe in light and dark.

### WP-6: Tours

- Purpose: P-8, P-9, P-10.
- Depends on: WP-4, WP-5 (hard).
- Expected files: `package.json`/lockfile (`react-joyride@^3.2.0`), `src/features/admin/tour/AdminTour.tsx`, `ShowMeHow.tsx`, `steps.ts`, `AdminHeader.tsx`, `data-tour` attributes in dashboard, prayer, content edit and People screens, `tests/e2e/demo.spec.ts`.
- Reuse: admin CSS variables; `AdminHeader`.
- Required changes: Design D. Draft step texts (≤ 25 words each) are shown to the user for approval before merge (ADR 0008).
- Must not: load react-joyride on public pages; add a Context/Provider or global store; store tour state in the database (unless P-9 = B, which needs a new WP with a migration); auto-start any tour other than the dashboard's.
- Tests: e2e: first dashboard visit starts the tour; Skip ends it and a reload does not restart it; "Show me how" replays; `?tour=1` starts the page tour; keyboard-only Next/Skip; axe with the tooltip open.
- Done when: tours run in the sandbox on all P-10 pages.

### WP-7: Picture help

- Purpose: P-11 and ADR 0008 layer 3.
- Depends on: WP-6 (hard; final screens and `data-tour` targets).
- Expected files: `src/features/admin/help-pictures.ts`, `tests/e2e/help-pictures.spec.ts`, `tests/help-pictures.test.ts`, `scripts/help-pictures.mjs`, `public/admin-help/*.webp`, `src/app/admin/help/page.tsx`, `package.json` scripts/format lists, `docs/guides/developer.md` (one short section: when and how to run `npm run help:pictures`).
- Reuse: sandbox sign-in helper, `sharp`, `HelpCard`.
- Required changes: Design E; help cards updated for WP-4/WP-5 screens; new cards "Change one Friday's Jumu'ah" (says to post an announcement too until PR5, if P-4 = A) and "Hijri date"; "End of term" gets "check the Hijri date setting".
- Must not: capture anything but the sandbox; commit PNGs; add a CI job that pixel-compares; exceed 120 KB per picture.
- Tests: unit test in `npm test`; spec check mode in `npm run test:e2e` (`E2E_DEMO=true`); demo walkthrough "every screen has a help card and passes axe" extended.
- Done when: `npm run help:pictures` regenerates all pictures from a clean checkout and `npm run check` passes.

### WP-8: Docs, roadmap and release notes

- Purpose: keep docs single-sourced and current.
- Depends on: WP-7.
- Expected files: `docs/guides/prayer-times.md` (new model; remove "removed in PR4" rows and the "on main" migration paragraph's corrections wording), `docs/guides/board.md` (Prayer line; picture help now exists), `docs/roadmap.md` (PR4 status; move "Jumu'ah exceptions" from the PR5 row to PR4; PR5 row keeps "Jumu'ah urgent notice question" if P-4 = A; PR7 row: "drops retired prayer columns"; P-12 items listed), `docs/architecture.md` (reminders diagram: `hijriDate` takes the board adjustment), `docs/release-checklist.md` (What changed, How to test, Needs your confirmation: P answers, behaviour changes (a)/(b), "Prayer calculation" confirmation item resolved or kept), `AGENTS.md` Commands line (`npm run help:pictures`) within the 150-line budget.
- Reuse: existing guides; no new guide.
- Must not: add a new guide file (guides are capped); edit an ADR.
- Tests: `tests/documentation.test.ts`, `tests/agent-config.test.ts`.
- Done when: `npm run check` passes and the planner's review with `reviewing-engineering-changes` is clean.

## Implementation Constraints

- Do not read the calculation method or madhab from env, the database or the form; only `prayerCalculation` (ADR 0017).
- Do not drop, rename or reuse the retired prayer columns in PR4.
- Do not add a table, bucket, port, adapter, Supabase client, env variable, RLS policy, auth check or Context/Provider.
- Do not create a second banner or urgent-notice mechanism (P-4).
- Must not change `congregationTimes` precedence or `isScheduleCurrent` semantics.
- Must not write through anything but `contentEditor()`; every mutating action keeps `currentAdmin()` first.
- Must not restyle public pages or the dashboard beyond the approved layout; reuse classes in `src/app/globals.css`.
- Do not add a dependency other than `react-joyride` (ADR 0008); no paid tool or service (ADR 0009).
- Do not capture help pictures from staging or production; sandbox only.
- Do not silently default `hijriDate`'s adjustment or `hijri_adjustment` in zod.
- Must not make a product or wording choice beyond the approved decisions; ask through the planner.

## Worker Escalation Conditions

Stop and emit `PLAN MISMATCH` when: the staging check shows data the plan does not cover (for example exceptions with unknown keys); react-joyride 3.x cannot run under React 19.2 / Next 16 without a workaround or needs another dependency; `select *` + zod stripping does not hold (a reader rejects the new column); the activity log trigger cannot store the new data; PR8 has changed `JumuahCard`/`HomeHero`/`PrayerToday` so that WP-2's prop changes no longer fit; deterministic sandbox pictures exceed 120 KB; any decision P-1..P-13 is still open when its WP starts.

## Test Strategy

- Unit (`npm test`, CI): `tests/prayer-migration.test.ts` (PGlite), `tests/prayer-today.test.ts`, `tests/community.test.ts` (fixed calculation, `jumuahFor`, Hijri adjustment, restore of old versions), `tests/editor.test.ts` (`issuesOf`, `KeptFormState`), `tests/activity.test.ts` (labels), `tests/help-pictures.test.ts` (files, size, alt), `tests/documentation.test.ts`, `tests/agent-config.test.ts`.
- Database (`npm run test:db`, CI, Docker): all migrations apply in order; `valid_prayer_exceptions` accepts old and new shapes.
- End-to-end (`npm run test:e2e`, local; sandbox with `E2E_DEMO=true`): prayer flows (WP-4), four content editors (WP-5), tours (WP-6), help-pictures check mode (WP-7), axe light and dark on every changed screen, History restore regression, People forms regression.
- Manual (sandbox, then staging after the migration): the release checklist "How to test" steps written by each WP; on a phone width for the prayer screen.
- Gate: `npm run check` and `npm run build` by the integration owner after each merge; `reviewing-engineering-changes` per WP.

## Acceptance Criteria

1. On **Prayer & iqamah** a board member sees no method, madhab, start correction or "Leadership has confirmed" control, and the screen says starts are automatic (Muslim World League, Standard Asr).
2. Setting Fajr to "After adhan, 20 minutes" and saving shows a Fajr iqamah 20 minutes after the calculated Fajr start on **/prayer** the same day, without a redeploy.
3. Adding a Friday change "No Jumu'ah this week" with a reason shows the cancellation (and the reason, per P-5) on the **/prayer** Jumu'ah card and the Home Jumu'ah line from the Saturday before until that Friday ends; the next week shows the regular Jumu'ah again.
4. Choosing "One day later" for the Hijri date shows the next Hijri date on Home and **/prayer**; "As calculated" restores it; the choice appears in Recent changes.
5. A prayer save with two problems lists both, and every typed value is still in the form.
6. Each content editor shows only the approved fields and labels; saving an event, announcement, news post and newsletter publishes as before; an event that had only a short summary shows the same description after saving.
7. A content save with several problems lists all of them at once and keeps the typed text.
8. A board member's first dashboard visit (per P-8) offers or starts the tour; Skip ends it; **Show me how** replays it on each P-10 page.
9. **/admin/help** shows a picture for each step chosen in P-11; `npm run help:pictures` re-creates them from the sandbox; a renamed button makes the e2e check fail.
10. The site keeps working in the sandbox (`npm run demo`) and Storybook; `npm run check` passes; old prayer History entries still restore.

## Open Risks or Escalations

- Staging/production prayer data is unverified: the WP-1 check decides whether behaviour changes (a) starts appearing, (b) start corrections disappearing, need the founders' confirmation (the release checklist asked to confirm MWL + Standard Asr before the screen is simplified; the user confirmed it against mobile prayer apps on 2026-10-05).
- The roadmap lists Jumu'ah exceptions under PR5; this plan moves them to PR4 (WP-8 updates the roadmap). Say if they should stay in PR5.
- Track B PR8 is restyling Home and Prayer in parallel; small rebase conflicts in five public files are expected (integration dependency).
- Help pictures are checked for presence and that each target exists, not for pixel freshness; a purely visual change (colours, spacing) will not force re-capture. Re-run `npm run help:pictures` after PR8's dashboard restyle.
- No e2e in CI today; tours and help flows are verified locally by the integration owner. Adding an e2e CI job is a separate, optional change.
