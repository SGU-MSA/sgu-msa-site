---
status: done
mode: full
---

# PR3: People, permissions, activity log, archive and the public team page

## Capability

**Board-run access, accountability and recovery.** One People list in the database decides who may use the dashboard (equal admins plus two permissions, "manage people" and "manage money") and who appears on the public team list (only with recorded consent). Postgres enforces the access safety rules, records every change to managed data in an add-only activity log, and turns removal into a reversible archive. Prayer settings keep restorable versions. Everything plugs into the existing ports and composition point (ADR 0012) with Supabase and sample (sandbox, D-6 of the data-providers contract) adapters; production guards stay unchanged. Free tools only (ADR 0009): emails go through the MSA's existing Gmail account.

## Requested Behavior

Roadmap item PR3, ADR 0007, ADR 0013, ADR 0014, task brief and user answers (2026-10-03):

- People list in `/admin`: name, role title, required section (board-editable; starters Board, Musallah team, Advisors), required "Show on public page?" with nothing preselected, optional photo, optional login.
- Two per-person permissions: "manage people" (invite, deactivate, change permissions) and "manage money" (stored now, used by PR6).
- Invite by email (person sets their own password), deactivate (reversible, ends their sessions), reactivate, forgot password (ends other sessions).
- Database guards: no self-removal of access or "manage people"; the last active "manage people" holder is protected; serialized with a lock taken before re-counting; stale screens refused via `updated_at`; proved by a two-connection race test.
- Add-only activity log written by triggers (who, what, when, before → after); no role can update or delete it; "Recent changes" feed for all admins; prayer changes highlighted.
- Archive instead of delete, Restore, Duplicate (events, announcements), prayer version history, permanent delete only from Archived (type DELETE, logged).
- Public team list from People with consent records (date + method) for listing and, separately, for photo; refused saves keep typed input; photos in Supabase Storage; no photo, no image. YAML board roster retired.

Non-goals: "sign out on all devices" button and two-step sign-in (D-15); handover checklist (stays PR5, D-14); Go2Pay and anything using "manage money" (PR6); page-text and season history (PR5); change notification emails; changing a login email; volunteer logins; restyling.

## Existing System Evidence

Inspected on `origin/integration` at `1a9df2f`.

- `supabase/migrations/202609090001_community.sql`: `public.admins(user_id, created_at)` with only `own_membership` select and `grant select`; `public.is_admin()` (security definer, `search_path = ''`); `touch_updated_at()`; four content tables with `public_read` + `admin_manage for all`; `prayer_settings` singleton; private `community` bucket, `published_attachment` policy, no delete policy.
- `src/lib/backend/providers/contract.ts`: `ContentEditor`, `AdminAuth`, `WriteResult`, `AdminIdentity = { userId, email }`. Data-providers contract rule 6: PR3 adds archive, duplicate, history and People as port methods with sample adapters.
- `src/lib/backend/providers/{supabase,sample}.ts`, `src/lib/demo/{store,fixtures}.ts`: session-cookie adapter under RLS; sandbox store with the same `updated_at` check.
- `src/lib/runtime/{config,wiring,providers}.ts`: only `process.env` reader (refuses `sb_secret_` as publishable key, never echoes values), `planWiring` refuses sample wiring in production, composition point.
- `src/lib/backend/server.ts` `currentAdmin()`; `src/lib/backend/admin-content.ts`; `src/lib/backend/storage.ts` `normalizeUpload`.
- `src/features/admin/actions.ts` (`saveRecordAction`, hard-delete `deleteRecordAction`, `savePrayerAction`), `ContentEditor.tsx`, `src/app/admin/{page,dashboard,help,content}/**`; `src/proxy.ts` refreshes sessions only on `/admin/:path*`.
- `src/lib/community/providers/contract.ts` `ContentProvider`; `src/lib/community/schema.ts` `isVisible` (declared mirror of `public_read`).
- `content/about.yaml` `board.members`/`advisor`, `aboutSchema` in `src/lib/content/schemas.ts`, fallback in `src/lib/content/documents.ts`, rendered by `src/app/about/page.tsx`.
- `scripts/test-backend.ts` (local Supabase only), `supabase/config.toml` (`local_smtp`, `minimum_password_length = 6`, no templates), `tests/editor.test.ts`, `tests/runtime.test.ts`, `tests/e2e/demo.spec.ts`.
- `docs/guides/owner-setup.md` §8-§10 (interim admin SQL, "never use `sb_secret_`"), `docs/guides/board.md` "cannot do yet".
- In flight: `docs/contracts/cleanup-outdated.md` (approved) replaces the sandbox `"demo"` sign-in with admin/admin and removes `editorPreview`, `content/admin.yaml`, `googleEnabled`.
- Searched with no match in `src`, `scripts`, `tests`, `supabase`: `people`, `activity_log`, `archived_at`, `restore`, `duplicate`, `forgot`, `resetPassword`, `inviteUser`, `SECRET_KEY`, `audit`, `history`, `team`.

## Owner

- Database authority: `supabase/migrations/`. Admin membership stays owned by `public.admins` + `public.is_admin()`; permissions extend that table.
- Shapes and pure rule mirrors: `src/lib/community/people.ts`, `src/lib/community/activity.ts`; password rule: `src/lib/backend/password.ts`.
- Ports and adapters: `src/lib/backend/providers/` (write ports, secret-key inviter), `src/lib/community/providers/` (`getTeam`); composition `src/lib/runtime/providers.ts`; config `src/lib/runtime/config.ts`.
- Screens and actions: `src/features/admin/`, `src/app/admin/**`; team list in `src/app/about/page.tsx`.

## Source of Truth

| Rule or state                                                                                                                   | Authority                                                                        | Declared mirror                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Admin                                                                                                                           | `is_admin()`: `admins` row for `auth.uid()`, `deactivated_at is null`            | `AdminAuth.current()`                                           |
| Permissions                                                                                                                     | `can_manage_people()`, `can_manage_money()`                                      | `AdminIdentity` flags (UX only)                                 |
| Self-removal, last manager, serialization                                                                                       | trigger `admins_guard` (advisory lock, then count)                               | `accessChangeProblem()` (sample adapter, disabled buttons)      |
| Stale screen                                                                                                                    | `updated_at` + `touch_updated_at()`                                              | sample store versions                                           |
| Consent for listing/photo; show-on-public answered                                                                              | `check` constraints; `show_on_public boolean not null`, no default               | `personSchema` + conditional `required`                         |
| Public team list                                                                                                                | `public_team()` function                                                         | sample `getTeam`                                                |
| Content visibility                                                                                                              | `community_item_visible()` in `public_read` and `published_attachment` (D-24)    | `isVisible`                                                     |
| Archived People entries and sections are read-only until restored, except clearing an archived person's photo and photo consent | trigger `archived_read_only` (D-20, D-26)                                        | sample adapters (`clearsOnlyPhoto`); `savePersonAction` refusal |
| Activity log, add-only                                                                                                          | `activity_log`, `record_activity()`, revoked grants + raising triggers           | sample adapters append entries                                  |
| Prayer versions                                                                                                                 | `activity_log` rows for `prayer_settings` (full rows)                            | none                                                            |
| Password rule                                                                                                                   | Supabase Auth settings (min 12; lower, upper, digit, symbol)                     | `passwordSchema` (zod)                                          |
| Passwords                                                                                                                       | Supabase Auth stores only a bcrypt one-way hash; the app never stores or sees it | none                                                            |
| Secret key                                                                                                                      | `SUPABASE_SECRET_KEY` in `parseRuntimeConfig`                                    | `.env.example`, owner guide table                               |

## Reuse and Duplication Analysis

Reused: `adminClient`, `publicClient`, `sessionCookieOptions`, `normalizeUpload` + `ContentEditor.upload` (people photos, same bucket), `touch_updated_at`, version check and `outcome()`, `revalidatePath("/", "layout")`, `useActionState`/`EditorState`, `AdminHeader`, admin CSS, typed-DELETE pattern, `force-dynamic` page pattern (`/community`).

Extended: `admins`, `is_admin()`, content `public_read` and `published_attachment`, `ContentEditor`, `AdminAuth`, `ContentProvider`, `RuntimeConfig`/`planWiring`, sandbox store, `isVisible`, existing tests.

Replaced: hard `deleteRecordAction` → archive; owner interim SQL snippet → `owner_add_admin()` (needed because `admins.person_id` becomes required); YAML roster → People.

Deliberately not added: a history table (history reads the log), a Duplicate port method (pure function + `saveRecord(…, null)`), per-user sandbox sessions (the email-link flow is tested on the local Supabase stack instead), generated types (zod parses RPC results).

## New Abstractions

- `PeopleEditor` port: people, sections, access under RLS. Separate from `ContentEditor` to avoid a god object (principle 5). Adapters: Supabase, sample. Consumers: People list, person editor, sections editor, access panel.
- `AccountInviter` port: the only holder of the secret key; methods `invite` and, since D-21, `deleteAccount`. Adapters: Supabase (admin API), sample (no email), off (local only). Least privilege (ADR 0007).
- `ActivityLog` port (read only): Recent changes, prayer history, dashboard highlight. Adapters: Supabase, sample.
- Pure modules `people.ts`, `activity.ts`, `password.ts`. No Context, service layer or new client factory beyond the inviter's admin client.

## Product Decisions Required

- [x] PD-1. Invite email, reset email and sign-in screen wording.
      Decision: D-1
- [x] PD-2. Who sends emails, and what happens before it works.
      Decision: D-2
- [x] PD-3. How long invite and reset links stay valid.
      Decision: D-3
- [x] PD-4. Who sees what in Recent changes.
      Decision: D-4
- [x] PD-5. Log retention and personal data in the log.
      Decision: D-5
- [x] PD-6. Who may restore and permanently delete.
      Decision: D-6
- [x] PD-7. Who may edit team sections.
      Decision: D-7
- [x] PD-8. Whether People entries without a login need "manage people".
      Decision: D-8
- [x] PD-9. Permissions and People entries right after the upgrade.
      Decision: D-9
- [x] PD-10. Where the team list appears and what it shows.
      Decision: D-10
- [x] PD-11. Ordering of people and sections.
      Decision: D-11
- [x] PD-12. Archive versus deactivate for a person with a login.
      Decision: D-12
- [x] PD-13. What Duplicate and Restore bring back.
      Decision: D-13
- [x] PD-14. Handover checklist in PR3 or PR5.
      Decision: D-14
- [x] PD-15. "Sign out on all devices" and two-step sign-in.
      Decision: D-15
- [x] PD-16. Password rules.
      Decision: D-16
- [x] PD-17. Developer-only tool for the race test.
      Decision: D-17

## Decisions

All chosen by the user, 2026-10-03.

- D-1: Use the drafts in Design → "Draft wording", naming the inviter; the user reviews exact text in the PR and release checklist (rejected: no inviter name; own wording).
- D-2: The MSA's existing free Gmail account sends emails through Supabase custom SMTP (`smtp.gmail.com`, port 587, Gmail address as username, a Google App Password; needs 2-Step Verification). Gmail allows about 500 emails a day. Until Gmail SMTP is connected, the owner adds admins with the interim SQL step in the owner guide. No paid service, no domain, no copyable invite link (rejected: paid mail service; copy-link fallback).
- D-3: Links valid for 24 hours (rejected: 1 hour).
- D-4: Every admin sees every change; consent details and emails show as "changed" without values (rejected: everything visible; People changes for managers only).
- D-5: The log stores the actor as an account id and shows the name from People when read; People and access entries record which fields changed but not personal values (name, consent date/method, email, photo name); content and prayer entries keep full before → after. A later privacy deletion leaves no names in the log, which stays add-only. Deactivated logins are kept until a "manage people" holder permanently deletes the person. Time-based removal is not built (would need a new ADR) (rejected: keep everything forever; yearly removal).
- D-6: Any admin may restore; only "manage people" holders may permanently delete (rejected: anyone; managers only for both).
- D-7: Any admin may add, rename, reorder or archive sections (rejected: managers only).
- D-8: Any admin may add and edit People entries; only login, permissions and deactivation need "manage people" (rejected: all People editing needs it).
- D-9: Every current admin gets "manage people" (not "manage money") and a People entry in Board named after their login email, hidden from the public list until details are filled in (rejected: owner names the first manager; both permissions for all).
- D-10: The team list replaces the "Leadership" block on `/about`: one heading per section, role title and name, photo only with consent; when nobody is listed, the existing "Board roster to be confirmed." text shows (rejected: new "Our team" page; home preview).
- D-11: Manual order number for people and sections, lower first (rejected: alphabetical; drag-and-drop).
- D-12: "Archive person" also deactivates their login in the same step (guards apply); "Deactivate login" alone keeps a listed person on the team list (rejected: two independent actions; single "Remove").
- D-13: Duplicate makes an unpublished, not featured draft with "(copy)" added to the title and the date kept; Restore brings items back as unpublished drafts (rejected: clear the date; restore as it was).
- D-14: Handover checklist stays in PR5 (rejected: build in PR3).
- D-15: No "sign out on all devices" button and no two-step sign-in. Instead, deactivating a person ends all their sessions, and a password reset ends all other sessions of that person (see Design) (rejected: button; button plus 2FA).
- D-16: Passwords need at least 12 characters with at least one lower-case letter, one upper-case letter, one digit and one symbol, enforced in Supabase Auth settings and in the site's set-password form (zod) with the hint "At least 12 characters, including a lower-case letter, a capital letter, a number and a symbol." (rejected: 12 characters only; Supabase default 6).
- D-17: Add `pg` and `@types/pg` as development-only dependencies, used only by `scripts/test-backend.ts` (rejected: `dblink` SQL test; single-connection test).
- D-18: Database tests run against a throwaway database started with **docker compose** (a `compose.test.yaml` service with a meaningful name such as `sgu-msa-test-db`, the lightest image that provides what the migrations need — plain `postgres:*-alpine` with minimal Supabase role/`auth` stubs if sufficient, otherwise a pinned `supabase/postgres` tag with the reason recorded), started the same way locally (Docker Desktop) and in a free GitHub Actions job on every PR into `integration`/`main`. (User, 2026-10-03; rejected: local-only tests.)

Planner amendments (planner, 2026-10-03), implemented by the FIX work package after WP-C. The WP-A migrations had not been applied to any hosted database, so FIX amends the three migration files in place instead of adding new ones.

- D-19 (implements D-12): `set_access` refuses turning on the login of an archived person with the new result `person_archived` (as `grant_access` already does), mapped by the Supabase and sample adapters; the board message is "Restore this person first." (rejected: allow it and explain it in the help card).
- D-20 (implements "archived items read-only until restored"): a before-update trigger on `people` and `people_sections` refuses (SGU06) every change to an archived row except Restore (`archived_at` back to null and nothing else), for every role, because RLS policies cannot compare a row with its earlier version; `savePersonAction` keeps its own refusal (rejected: the action check alone).
- D-21 (privacy completeness, ADR 0013): permanently deleting a person also deletes their Supabase Auth account through `AccountInviter.deleteAccount(userId)`, the server-only secret-key module (`auth.admin.deleteUser`, never the browser), called after `purgePerson` succeeds; the sandbox removes the sample account (rejected: the owner deletes it by hand in Supabase).
- D-22 (ADR 0013 archive model): archived team sections can be restored with `PeopleEditor.restoreSection(id, version)` (`name_taken` when a current section has that name), Supabase and sample adapters, and a Restore button under "Archived sections" on the sections screen; any admin (D-6) (rejected: add a new section with the same name).
- D-23: any admin, not only "manage people" holders, may delete a stored file that no row names, so the clean-up after a photo replace or a refused save works for everyone (storage policy `admin_delete_unreferenced`) (rejected: managers only, which left unused files behind).
- D-24 (no duplication): one SQL function `community_item_visible(archived_at, published, shown_from, expires_on)` holds the "currently visible" rule for the four `public_read` policies and `published_attachment` (events pass no `shown_from`) (rejected: eight inline copies).

Planner amendments (planner, 2026-10-03), implemented by FIX2 after WP-E (not a separate work package). The three migrations had still not been applied to any hosted database, so FIX2 amends `202610050001_people_access.sql` and `202610050002_activity_log.sql` in place.

- D-25 (mail scanners; SGU uses Outlook): `/admin/auth/confirm` is a page that never verifies the token on GET; it shows a **Continue** button, and only that form's POST (`confirmEmailLinkAction`) calls `verifyEmailLink`, because link scanners open links with GET and would use up one-time invite and reset links (rejected: verify on GET, the WP-D route handler).
- D-26 (ADR 0014 consent withdrawal): `archived_read_only` (D-20) also allows, on an archived person and only there, the one change that clears `photo_path` and both photo consent columns with nothing else changed, so a withdrawn photo consent is honoured without restoring the person first; `savePerson` with only those fields cleared is the remove-photo path (sample mirror `clearsOnlyPhoto`) (rejected: restore, remove the photo, archive again).
- D-27 (activity log accuracy): when a person is created, personal fields that are null or empty are left out of the entry instead of listed as changed; values are still never stored (D-5) (rejected: list every personal column on create).
- D-28: the shared content form schema (`recordSchema`) turns Windows line breaks (`\r\n`) into `\n`, so saving unchanged multi-line text logs no change (rejected: show line-break-only changes in Recent changes).

User decisions (user, 2026-10-03), answering the WP-F and WP-G questions in the release checklist; implemented by FIX3 after WP-G (not a separate work package):

- Prayer history Restore brings back the settings as they were **before** the chosen change (the entry's `before` row), as built in WP-F, with the button "Restore the version before this change" (rejected: the settings as they were right after the change).
- The `/about` team block heading (`board.heading` in `content/about.yaml`) becomes "Our team"; the small "Leadership" label above it stays (rejected: keep "Board", which repeated the first section's name; rename the starter section "Board").
- The old faculty-advisor sentence ("The MSA works with a faculty advisor who connects the organization to the university.") stays removed until the founder decides; it is listed under "You or the founder must decide" in the release checklist.

Planner amendments (planner, 2026-10-03), implemented by FIX3 (not a separate work package). `202610050002_activity_log.sql` had still not been applied to any hosted database, so FIX3 amends it in place.

- D-29 (activity log accuracy, mirrors D-27): when a person is permanently deleted, personal fields that are null or empty are left out of the entry instead of listed as removed; values are still never stored (D-5); sandbox mirror in `recordActivity`; database test (rejected: list every personal column on delete).
- D-30 (mirrors D-28): the prayer settings **Schedule notice** (`prayerSettingsSchema.notice`) uses the same text rule as `recordSchema` (`\r\n` becomes `\n`, then trimmed), so saving an unchanged multi-line notice logs no change; unit test (rejected: keep Windows line breaks in the notice).
- D-31: the release checklist's "Needs your confirmation" drops the WP-F and WP-G items answered above and the two items D-29 and D-30 answer.

Amendment (user, 2026-10-05; the demo review and the founder's team structure, `.plans/review-fixes-plan.md` PR-2), implemented by review-fixes PR-2 with the new migration `202610120001_team_groups_order.sql` (the PR3 migrations are live on no hosted database yet, but staging may have them, so this is a new file, not an edit):

- D-11 is replaced: the board orders people and sections **by drag and drop**, never by typing an order number. One shared `SortableList` (`src/shared/ui`, Motion's `Reorder`, already installed; a visible handle ⠿ and Move up / Move down arrows for the keyboard and screen readers) is used by every ordered board list, and `OrderedList` (`src/features/admin`) saves each list with one **Save order** (`saveOrderAction` → port `OrderEditor` → database function `save_order`: rows get 1, 2, 3 … in the given order, all or none, each with the version on screen, under RLS; rows already in place are not touched). The same list replaces typed order numbers on Funds and Tickets (PR6) and the Move up / Move down buttons of the hand-over steps (PR5a) and of page-text lists (PR5b). A new person, or one moved to another section, goes last in that section; a new section goes last. The public team list and the database order are unchanged (`position`, then name).
- The founder's three groups: the starter sections are renamed **Executive board**, **General board** and **Advisors/Faculty** (only current sections that still carry the starter names, and only when the new name is free). `owner_add_admin` (D-9) files new admins under the Executive board (or a current "Board" on a database that was not renamed).
- D-10 amended ("Show on public page?" has no default): for a **new** person the answer starts as the section's start answer, **Yes for the Executive board, No for the others**, and follows the chosen section until the board picks Yes or No; it can always be changed, and Yes still needs the listing consent. The start answer is a per-section, board-editable setting (`people_sections.shown_by_default`, the tick box "New people in this section start as “Show on public page: Yes”" on Edit sections), not a rule on the section's name in code.
- **Role title** offers suggestions (a `datalist`, still free text): the founder's titles (`STARTER_ROLE_TITLES` in `src/lib/community/people.ts`: President, Vice President (Brothers), Vice President (Sisters), Treasurer, Secretary, Musallah coordinator, Social media manager, Brothers coordinator, Sisters coordinator, T1 rep to T5 rep, Pre-med term rep), then every other title already used in People.
- Who sits on the board, under which name, and the 80% average rule are the board's responsibility, not a website feature (user, 2026-10-05). The sandbox team uses the founder's roles with made-up names.
- New wording is listed under "You or the founder must decide" in the release checklist.
- Amendment (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): `/about` no longer exports `force-dynamic`; `getTeam()` calls `connection()` first, so the team list is still read on every visit and a People save shows at once. People and access actions call `publicDataChanged()`.

Amendment (user, 2026-10-05, "review 2"; `.plans/review2-plan.md` PR-B; [ADR 0025](../adr/0025-team-list-without-consent-records.md)), implemented by review 2 PR-B by **editing the PR3 migrations in place** (no hosted database holds real data; staging and production are rebuilt from the clean files, user 2026-10-05). It supersedes the consent parts of D-10, D-26 and the Design and Public Contract sections above, and the 2026-10-05 amendment's "Yes still needs the listing consent" and its rename step:

- **Sections are called groups** in every board and public word (Group box, Edit groups at `/admin/people/groups`, Archived groups, help, tour, Recent changes, privacy page). Code and tables keep `people_sections` / `section_id`.
- **Consent removed** (supersedes D-10's consent and the consent check rows of Source of Truth): `people` has no `listing_consent_on`, `listing_consent_method`, `photo_consent_on`, `photo_consent_method` and none of their checks; `personSchema` has no consent fields and no `superRefine`; `public_team()` lists people with `show_on_public` in current groups and returns `photo_path` whenever it is set. D-26 now means: an archived person's `photo_path` alone may be cleared ("Remove photo"). The activity trigger hides `full_name` and `photo_path` only.
- **Two permanent groups:** `people_sections.kind` (`'executive'`, `'general'`, or null for the board's own; unique). The trigger `always_kept` (SGU13; named to run before `archive_check`) refuses renaming, archiving, deleting or re-kinding them, also from the SQL editor; RLS lets the board insert only `kind is null`. The migration seeds Executive board (executive, shown by default), General board (general) and Advisors/Faculty (none).
- **Executive board by role:** `EXECUTIVE_ROLES` (the first five of `STARTER_ROLE_TITLES`; repeated in `public.executive_role_rank()`, which a unit test compares). The trigger `executive_role` (SGU12) refuses a person in the Executive board whose role is not one of them; `personFormSchema(executiveGroupId)` shows the same on the **Role** box (a select of the five in that group). People and the public list order that group by role, then the stored order, then name (`inGroupOrder`, the mirror of `public_team()`); it has no drag handle.
- **Delete an empty group:** `PeopleEditor.deleteSection` and `deleteSectionAction` (typed DELETE, "manage people" holders, D-6), for archived groups nobody (archived or not) is in; the people foreign key refuses otherwise (`in_use`).
- `owner_add_admin` and the D-9 backfill file new admins under the General board (the Executive board needs a role).
- **No move arrows:** `SortableList`'s handle is a focusable button; the up/down arrow keys (and Home/End) move its item and the move is announced. This replaces the Move up / Move down buttons of the 2026-10-05 amendment for every ordered list.
- The People and Group forms use the shared field check and unsaved-changes guard of review 2 PR-A (`CheckedForm`).
- New wording is listed under "You or the founder must decide" in the release checklist.

Amendment (user, 2026-10-05/06, review 3 B; `.plans/review3-plan.md` section B; [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md)): **Pages are edited by the Executive board only.** This narrows D-7's "any admin may edit" for page text: a board member edits Pages while their People entry is current, in the Executive board (`people_sections.kind = 'executive'`), and their login is not turned off. There is no new permission and no tick-box; moving someone into or out of the Executive board gives or takes it at once. `public.can_edit_pages()` (in `202610100001_page_texts.sql`) is the authority; `AdminIdentity.canEditPages` and `editsPages` / `nobodyEditsPages` (`src/lib/community/people.ts`) mirror it. The dashboard says "Nobody can edit pages: add an executive" while no Executive board member has a login. Everything else in this contract (equal admins for content, "manage people", "manage money") is unchanged; see the [PR5b contract](pr5b-page-text-forms-reminders.md) amendment of this date.

Amendment (user, 2026-10-05/06, "review 3 D"; `.plans/review3-plan.md` D), implemented by review 3 D by **editing `202609090001_community.sql` and `202610100001_page_texts.sql` in place** (no hosted data). It extends the prayer history (WP-F, Design → Prayer history) and the page-text History of the [PR5b contract](pr5b-page-text-forms-reminders.md) (D-12); Restore still brings back the version **before** the chosen change ("Restore the version before this change", decision of 2026-10-03 kept):

- **Confirmation first, on every History screen:** one shared component (`src/features/admin/history/VersionHistory.tsx` with the client `RestoreVersion.tsx`; wording only in `systemText.history`) opens a dialog: "This puts <item> back to how it was on <date, time>. The <N> changes made to it after that will be replaced. Nothing else on the website changes. You can undo this from History." with **This version** (a preview of what comes back) and **Restore** / **Cancel**. A refusal shows inside the dialog. <item> is the screen's title in quotes; <date, time> is when that version was saved (the previous change's time: History reads one entry more than it lists; for the item's first change, its starting row's `updated_at`); <N> counts the chosen change and every newer one (`historyList`, `versionBefore` in `src/lib/community/activity.ts`). The server action recomputes both from the log.
- **Restores are labelled:** `prayer_settings.restored_from` and `page_texts.restored_from` (`timestamptz`, null). A restore saves the time of the version it puts back (`ContentEditor.savePrayerSettings` / `savePageText` take an optional `restoredFrom`); every other save writes null. The activity trigger is unchanged (full rows); `restoredVersion(entry)` reads an update with a new `restored_from` as a restore: heading "Restored <area>" and the line "Restored to the version of <time>" in History and Recent changes; `restored_from` is never listed as a changed field.
- **Nothing is deleted:** a restore is an ordinary update, logged as a new entry; undo = restore the version before it.
- Seasons have no version history (their **Restore** only brings back an archived season), so the dialog does not apply there; asked under "You or the founder must decide".
- Sandbox: the starting page text and prayer settings are versioned by the seed time (`starterVersion(seed)`), as the database's starting rows carry their migration time, so their first change can be dated.
- New wording is listed under "You or the founder must decide" in the release checklist.

Amendment (user, 2026-10-06, hand-in plan `.plans/final-plan.md` A1), implemented by **editing `202610050001_people_access.sql` (and `set_access` in `202610090001_payments_seasons.sql`) in place** (no hosted data). It narrows D-8 and the 2026-10-05/06 Pages amendment:

- **"Manage people" and "manage money" are held only by Executive board members.** The trigger `executive_only` on `admins` refuses either flag on a person outside the Executive board (SGU14 `not_executive`, every role, the site owner included); `grant_access` and `set_access` answer `not_executive`. Mirror: `permissionsProblem`; `accessLocks(person, people, actor, executive)` locks both boxes with the reason, also on the invite form.
- **Moving someone into or out of the Executive board, or changing an executive's role, needs "manage people"** (trigger `executive_moves` on `people`, SGU15; the site owner in the SQL editor is not asked). Other edits of an executive (name, photo, "Show on public page?") stay any admin's (D-7). Mirror: `touchesExecutive`; `savePersonAction` refuses before the database; the person form greys out **Group** and **Role** of an executive, and the **Executive board** choice, for those without "manage people".
- **Moving someone out of the Executive board turns off both flags in the same step** (trigger `leave_executive`), under `admins_guard`: nobody moves themselves out while they hold "manage people" (SGU01) and the last active holder stays in the Executive board (SGU02). `PeopleEditor.savePerson` answers `forbidden`, `self` or `last_manager`. Engineering choice (listed for the user): turning off rather than refusing the move.
- `owner_add_admin(email, full_name, manage_people, executive_role default null)`: with "manage people" the new entry goes in the Executive board (hidden), without it in the General board; the D-9 backfill files old admins under the Executive board. (Amended the same day for one person per role, below: the role is the first free one, `first_free_executive_role()`; a named role is handed over.) This replaces the review 2 note that `owner_add_admin` and the backfill use the General board.
- Consequence: an Executive board member with an active login always exists, so "Nobody can edit pages: add an executive" is no longer reachable from the dashboard; the warning stays as a safety net.

Amendment (user, 2026-10-06, "keep it simple"), implemented by **editing `202610050001_people_access.sql` in place** (no hosted data): **each Executive board role has one current holder.**

- The trigger `one_role_holder` (`people_one_role_holder`, SGU17 `role_taken`; named to run after `executive_role`) refuses a second current (not archived) person in the Executive board with the same role, on insert, update and Restore; it takes one transaction lock first (as `admins_guard`), so two saves of a role run one after another. `roleHolder` (`src/lib/community/people.ts`) mirrors it.
- **Handing a role over:** `save_person_taking_role(person jsonb, version, holder, holder_version)` (security invoker) saves the entry and moves the holder to the end of the General board with an **empty role title** (their "Show on public page?" answer unchanged), both or neither; the activity trigger logs both. Only "manage people" holders (`forbidden`); a changed entry or holder is `conflict`; the access guard's `self` / `last_manager` pass through. `PeopleEditor.savePersonTakingRole`.
- `owner_add_admin` with "manage people" gives the **first free role** (`first_free_executive_role()`, President first; `executive_roles()` now holds the five once) and refuses when all five are held; a **named role** is handed over (its holder moves to the General board with no role title), so the owner can always add a manager in a lock-out. The D-9 backfill gives the first free role, and with all five held files a further admin under the General board without "manage people".
- **The person form** asks under Role, when the chosen role is taken: "<holder> is <role>. Make <name> <role> instead?" with **Yes** / **Cancel** (`roleHolders`, `RoleQuestion` in `PersonEditor.tsx`, wording in `roleTakenWords`). Yes posts the holder and its version with the save; Cancel puts the role back. Without "manage people", or when the holder is you or the last "manage people" holder (moving out of the Executive board turns it off), only the reason and Cancel are shown. The server checks the holder again; the database decides.

## Board Self-Sufficiency Check

From `/admin` a board member can: add, edit, order and archive People entries and sections, restore archived sections (D-22), record consent, upload or remove a photo, invite, resend, deactivate and reactivate logins, change the two permissions ("manage people" holders), reset their own password, read Recent changes, archive, restore and duplicate items, restore a prayer version, and permanently delete archived items ("manage people" holders). Each gets a help card in `/admin/help` (WP-H). This removes D0 rows 23, 32, 51-54, 57, 82 and the access row in `docs/guides/board.md`.

Remaining owner steps are one-time setup with exact steps in WP-H: Gmail SMTP, email templates, redirect URL, link expiry, password rules, `SUPABASE_SECRET_KEY`, and the interim SQL until Gmail works (D-2). Team headings and the "to be confirmed" text stay in `content/about.yaml` until PR5. The handover checklist stays on the roadmap under PR5 (D-14).

## Design

```text
form ─► action (features/admin/*-actions.ts): currentAdmin() → zod → port(version) → revalidatePath
port accessors (runtime/providers.ts):
  contentEditor | peopleEditor | activityLog | adminAuth  ─ supabase session client (RLS) | sandbox store
  accountInviter                                          ─ supabase admin client (secret, invite only) | sample | off
Postgres: RLS (is_admin, can_manage_people) · admins_guard (lock → count) · record_activity → activity_log
public /about ─► contentProvider().getTeam() ─► rpc public_team()
```

**Invite:** manager → `inviteAction(personId, email, perms)`: (1) `currentAdmin().canManagePeople`; (2) `accountInviter().invite(email, SITE_URL + "/admin/auth/confirm", { fullName, invitedBy })`, where an already existing account is not an error; (3) `peopleEditor().grantAccess(personId, email, perms)` via RPC `grant_access` (logged with the actor); (4) if step 2 found an existing account that never signed in, `adminAuth().requestPasswordReset(email)`. Retrying is safe: no grant without an account, no second link. Invitee opens `/admin/auth/confirm?token_hash=…&type=invite`, a page with a **Continue** button that does not touch the token (D-25); clicking it posts `confirmEmailLinkAction`, which calls `adminAuth().verifyEmailLink` (sets the session cookie), then `/admin/set-password` → `setPasswordAction` → `adminAuth().setPassword` → dashboard. Token-hash links work when the email is opened on another device; they need the Supabase email templates changed (owner step).

**Forgot password:** `/admin/forgot-password` → `requestPasswordReset` → always the same neutral message → link to `/admin/auth/confirm?type=recovery` → `/admin/set-password`. After `updateUser({ password })` succeeds, the adapter calls `auth.signOut({ scope: "others" })`, ending every other session of that person (D-15).

**Deactivate/permissions:** `setAccessAction` → RPC `set_access(person, perms, active, version)` → `update admins … where updated_at = version` → `admins_guard` takes `pg_advisory_xact_lock(fixed key)`, refuses self-removal, then counts other active managers with a fresh statement snapshot and refuses zero. Two concurrent removals serialize; the second re-counts after the first commits. The guard also covers SQL-editor, secret-key and `auth.users` cascade writes. When `deactivated_at` becomes set, the same trigger runs `delete from auth.sessions where user_id = old.user_id`, which revokes the person's refresh tokens on every device (D-15); their remaining access token (at most 1 hour) is useless because `is_admin()` is already false.

**Archive:** `archived_at` on the four content tables, `people`, `people_sections`; Current/Archived tabs; archived items read-only until restored; permanent delete allowed by RLS only on archived rows, from Archived, typed DELETE, "manage people" holders (D-6); afterwards `removeFile` deletes the stored file when no row references it (ADR 0013/0014). Duplicate = `duplicateAsDraft(record, newId)` + `saveRecord(kind, copy, null)`.

**Prayer history:** the prayer page lists the last 20 prayer log entries (when, who, what changed); Restore parses the entry's logged `before` row (the settings as they were before that change, user 2026-10-03) with today's `prayerSettingsSchema`, runs `savePrayerAction`'s calculation check, and saves with the current version (logged). A version that no longer validates is refused.

**Team list (D-10, D-11):** `/about` (`force-dynamic`) renders `getTeam()`; photo `alt` is the person's name; `board.members` and `advisor` YAML are removed; `board.heading`, `board.note`, `board.pending_label` stay.

**Sandbox:** the store gains `people`, `sections`, `admins`, `activity` (append-only array); sample adapters apply the pure mirrors and append activity on every write. Sample invite and reset return `delivery: "sandbox"` and the screen says "Sandbox: no email was sent." (branch on data, ADR 0012 rule 5); the sample invited person becomes "Invited". Seeds: sandbox admin with both permissions linked to "Sample Board Member", one listed sample person with consent, one hidden, the three sections.

**Passwords:** set and reset only through Supabase Auth, which stores a bcrypt one-way hash; the app passes the typed password straight to Supabase over HTTPS and never stores, logs or displays it.

**Draft wording (D-1):**

- Invite subject "You're invited to the SGU MSA website dashboard". Body: "Assalamu alaikum {name}. {inviter} added you to the SGU MSA board dashboard. Choose your password here: [Set my password]. The link works once and expires in 24 hours. If you were not expecting this, you can ignore this email."
- Reset subject "Reset your SGU MSA dashboard password". Body: "Someone asked to reset the password for this email on the SGU MSA board dashboard. [Choose a new password]. The link works once and expires in 24 hours. If it was not you, ignore this email; your password stays the same."
- Sign-in page: "Forgot your password?" link, and "Need access? Ask a board member who can manage people." Forgot-password result: "If this email belongs to a board account, a reset link is on its way. Check your inbox and spam folder."

## Public Contract

```sql
-- 202610050001_people_access.sql
people_sections(id uuid pk, name text 1..80 (unique lower(name) where not archived), position int,
  archived_at, created_at, updated_at)  -- seeded: Board 1, Musallah team 2, Advisors 3
people(id uuid pk, full_name text 1..120, role_title text <=120, section_id uuid not null fk,
  position int, show_on_public boolean not null /* no default */,
  listing_consent_on date, listing_consent_method text, photo_path text ('' or uuid.webp),
  photo_consent_on date, photo_consent_method text, archived_at, created_at, updated_at,
  check methods in ('email','message','in_person','paper'); date and method both set or both null;
  check (not show_on_public or listing_consent_on is not null);
  check (photo_path = '' or photo_consent_on is not null))
admins + person_id uuid unique not null fk people (after D-9 backfill), can_manage_people bool,
  can_manage_money bool, deactivated_at timestamptz, updated_at timestamptz
-- functions: security definer, set search_path = '', execute revoked from public
is_admin()  (redefined: and deactivated_at is null) · can_manage_people() · can_manage_money()
admin_accounts() returns (person_id, user_id, email, can_manage_people, can_manage_money,
  deactivated_at, last_sign_in_at, updated_at)              -- only when is_admin()
grant_access(person, email, manage_people, manage_money) returns text
  -- ok | forbidden | no_account | already_linked | person_has_login | person_archived
set_access(person, manage_people, manage_money, active, version) returns text
  -- ok | forbidden | conflict | self | last_manager | person_archived (turning on an archived person's login, D-19)
owner_add_admin(email, full_name, manage_people) returns void
  -- SQL editor only (revoked from anon, authenticated, service_role); interim adds and first manager
public_team() returns (section_id, section_name, section_position, person_id, full_name,
  role_title, position, photo_path)                        -- granted to anon, authenticated
trigger admins_guard (before update or delete): advisory lock; raise self | last_manager;
  on deactivation delete from auth.sessions for that user
RLS: people, people_sections select/insert/update using is_admin(); delete only archived and
  can_manage_people(). admins: own_membership + admin_read (is_admin()); no write grants (functions only).
trigger archived_read_only (before update on people, people_sections): raise SGU06 for any change to an
  archived row except Restore (archived_at -> null, nothing else)          -- D-20
  and, on people only, clearing photo_path and photo consent with nothing else changed  -- D-26

-- 202610050002_activity_log.sql
activity_log(id bigint identity pk, occurred_at, actor uuid /* null = owner or database */,
  area text, record_id text, action text in ('created','updated','archived','restored','deleted',
  'access_granted','access_changed'), before jsonb, after jsonb, highlight bool /* prayer_settings */)
select policy is_admin(); revoke all from anon, authenticated, service_role; grant select to authenticated;
raising triggers for update, delete, truncate; record_activity() after insert/update/delete on
events, announcements, news_posts, newsletters, prayer_settings, people, people_sections, admins (D-5 content rule)

-- 202610050003_archive.sql
archived_at on the four content tables; community_item_visible(archived_at, published, shown_from,
expires_on) (D-24) used by every public_read and by published_attachment; admin_manage split into
select/insert/update (is_admin()) and delete (is_admin() and can_manage_people() and archived);
published_attachment recreated (archived rows excluded; consented people photos added);
storage delete policy admin_delete_unreferenced: community bucket, is_admin(), name referenced by no row (D-23).
```

```ts
// src/lib/community/people.ts
consentMethods; sectionSchema; personSchema (no default for show_on_public; consent dates not in the future);
type Access = { state: "none" } | { state: "invited" | "active" | "deactivated"; userId; email: string | null;
  canManagePeople; canManageMoney; version };
accessChangeSchema; accessChangeProblem(holders, change, actorUserId): "self" | "last_manager" | null;
type TeamSection = { id; name; people: { id; fullName; roleTitle; photoPath: string | null }[] };
// src/lib/community/activity.ts
activityEntrySchema; describeChange(entry) → { label; fields: { name; before; after }[] };
// src/lib/backend/password.ts
passwordSchema; passwordHint;            // D-16
// src/lib/community/schema.ts
duplicateAsDraft(record, id); isVisible(...) false when archived_at is set
// src/lib/backend/providers/contract.ts
AdminIdentity = { userId; email; canManagePeople; canManageMoney };
ContentEditor += listRecords(kind, view?: "current" | "archived"), archiveRecord(kind, id, version),
  restoreRecord(kind, id, version), purgeRecord(kind, id, version), removeFile(name) /* any admin, D-23 */
PeopleEditor { listPeople(view?), readPerson(id), savePerson(row, version | null), archivePerson(id, version),
  restorePerson(id, version), purgePerson(id, version), listSections(view?), saveSection(row, version | null),
  archiveSection(id, version) /* refused while it holds current people */,
  restoreSection(id, version) /* name_taken when a current section has the name, D-22 */,
  grantAccess(personId, email, perms), setAccess(change) }   // results: WriteResult or AccessResult
AccountInviter { invite(email, redirectTo, { fullName, invitedBy }) →
  { ok: true; delivery: "email" | "sandbox" } | { ok: false; reason: "already-registered" | "email-unavailable" | "unavailable" | "off" };
  deleteAccount(userId) → { ok: true } | { ok: false; reason: "unavailable" | "off" } }  // D-21, an account already gone is ok
ActivityLog { list({ before?, limit, area?, recordId? }) → { entries; unavailable } }
AdminAuth += current() → AdminIdentity | null (null when deactivated),
  requestPasswordReset(email, redirectTo), verifyEmailLink(tokenHash, "invite" | "recovery") → "ok" | "expired",
  setPassword(password) → "ok" | "weak" | "no-session" | "unavailable"   // then signOut({ scope: "others" })
ContentProvider += getTeam() → { sections: TeamSection[]; unavailable; provenance }
// src/lib/runtime
SUPABASE_SECRET_KEY: required with live data; "sb_secret_…" or "off"; "off" refused in production;
  ignored with sample data; never echoed. RuntimeConfig += invites: "on" | "off" (value NOT on RuntimeConfig);
  supabaseSecretKey(config) importable only by runtime/providers.ts (ESLint importNames).
Wiring += people, activity: "supabase" | "sample"; inviter: "supabase" | "sample" | "off" (production: supabase only)
providers.ts += peopleEditor(), activityLog(), accountInviter()
```

Actions: `people-actions.ts` (`savePersonAction`, `archivePersonAction`, `restorePersonAction`, `purgePersonAction`, `removePhotoAction`, `saveSectionAction`, `archiveSectionAction`, `restoreSectionAction` (D-22); refused saves return `values`), `access-actions.ts` (`inviteAction`, `resendInviteAction`, `setAccessAction`, `requestPasswordResetAction`, `setPasswordAction`, `confirmEmailLinkAction` (D-25)), `actions.ts` (`archiveRecordAction` replaces `deleteRecordAction`; `restoreRecordAction`, `purgeRecordAction`, `duplicateRecordAction`, `restorePrayerVersionAction`).

Routes: `/admin/people`, `/admin/people/[id]`, `/admin/people/sections`, `/admin/activity`, `/admin/forgot-password`, `/admin/set-password`, `/admin/auth/confirm` (page with a **Continue** button; the token is verified only on its POST, D-25), `/admin/content/[kind]?view=archived`; dashboard cards People and Recent changes; `/about` team section.

Files: `supabase/templates/{invite,recovery}.html` (token-hash links, D-1 wording), `supabase/config.toml` (templates, `site_url` and redirect `http://localhost:3000/admin/auth/confirm`, `otp_expiry = 86400`, `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits_symbols"`), `.env.example` (`SUPABASE_SECRET_KEY=off`), local-only `SUPABASE_TEST_DB_URL`.

## Private Implementation

The implementer decides: SQL layout, private helper functions, the lock key, custom SQLSTATE codes, jsonb trimming, page size (20-50), component splits in `src/features/admin/`, adapter helpers, fixture names, `describeChange` formatting, reuse of admin CSS.

## Data and State Flow

Admin reads: page → `requireAdmin()` → helpers in `admin-content.ts` (`listAdminPeople`, `readAdminPerson`, `listAdminSections`, `listActivity`) → port → adapter → zod. Public read: `/about` → `getTeam()` in `queries.ts` (`cache()`) → `contentProvider().getTeam()` → `rpc("public_team")` (3 s timeout) or sandbox; failure shows the pending text. Writes: form → action → `currentAdmin()` → zod → port with version → Postgres (RLS, checks, guard, log trigger in the same transaction) → `revalidatePath("/", "layout")` → redirect. Photos: `contentEditor().upload("image")` before `savePerson`; `removeFile` after photo removal or purge. Secret key: parsed once, kept off `RuntimeConfig`, passed by `providers.ts` to the inviter factory, used only for `auth.admin.inviteUserByEmail` and, after a permanent delete of a person, `auth.admin.deleteUser` (D-21).

## Failure Modes

- Supabase down: lists show "could not be loaded"; saves keep typed text; team section shows pending text; a failed invite grants nothing.
- Stale version: "Someone else changed this; reload before trying again."
- Guards: `self` → "You cannot remove your own access or your own 'manage people' permission. Ask another manager." `last_manager` → "At least one active person must keep 'manage people'. Give it to someone else first." `person_archived` → "Restore this person first." (D-19)
- Archived entry or section changed (SGU06, D-20): treated as a stale screen ("Someone else changed this; reload before trying again.").
- Login account removal fails after a permanent delete of a person (D-21): the person and their access are gone; "The person was deleted, but their login account could not be removed. Ask the site owner to delete it in Supabase → Authentication → Users."
- Consent missing: browser blocks submit (conditional `required`); server refuses naming the missing field and re-renders typed values; a chosen photo must be chosen again (browsers cannot restore file inputs).
- Weak password: the form shows the D-16 hint; Supabase refuses it too.
- Session expiry or deactivation mid-edit: "Your session expired or access was removed. Sign in again."; RLS refuses immediately.
- Double submit: buttons disabled while pending; invite retry is idempotent.
- Email not connected or over limit (Gmail about 500 a day; Supabase hourly email limit): "The invite email could not be sent. Nothing was changed. Ask the site owner to check the email setup." Until Gmail works, the owner uses the interim SQL (D-2).
- Expired or used link: "This link has expired or was already used. Ask for a new invite or use Forgot password."
- Purge file removal fails: the item is gone, the unreferenced file is not public; "Try Remove again." Any admin may remove an unreferenced file (D-23).
- Old prayer version invalid today: refused with the existing out-of-order message.
- Deployment skew: old tabs posting `deleteRecordAction` get Next's missing-action error ("reload the page"); before deploy, old hard deletes of current items are refused by RLS with the existing message.
- Missing or invalid `SUPABASE_SECRET_KEY` in production: the build fails naming the variable.

## Compatibility and Migration

- Files `202610050001_people_access.sql`, `202610050002_activity_log.sql`, `202610050003_archive.sql` (dates follow the merge date, order kept), applied by a human: local stack → staging → verify → production before the Release PR merges. FIX (D-19..D-24) amended these three files in place because none had been applied to a hosted database, FIX2 (D-26, D-27) amended the first two again, and FIX3 (D-29) amended `202610050002_activity_log.sql` once more, for the same reason; whoever applies them uses the versions on `integration`.
- Old code on the new schema: reads and saves work; `is_admin()` is unchanged for existing admins; old hard deletes of current items are refused (safe); triggers log old-code writes.
- Backfill (D-9) in migration 1, then `person_id` becomes `not null`.
- Rollback: revert code per WP; a rollback migration restores old `public_read`, `admin_manage` and `published_attachment`; new tables and columns stay unused so no log data is lost.
- Owner settings before the Release PR: listed in WP-H and the release checklist.

## Parallel Work and Merge Order

```yaml
cleanup-outdated: { prerequisite_for: [WP-B, WP-D] }   # changes AdminAuth.signIn and SignInForm
WP-A: { creates: [3 migrations, supabase/templates/*], extends: [scripts/test-backend.ts, supabase/config.toml, package.json], depends_on: [] }
WP-B: { creates: [community/people.ts, community/activity.ts, backend/password.ts, providers/supabase-people.ts, providers/supabase-inviter.ts, providers/sample-people.ts], extends: [backend/providers/{contract,supabase,sample}.ts, community/providers/*, community/{schema,queries}.ts, demo/*, runtime/*, backend/{server,admin-content}.ts, eslint.config.mjs, .env.example, tests], depends_on: [WP-A (contract), cleanup-outdated] }
WP-C: { creates: [app/admin/people/**, people-actions.ts, PersonEditor.tsx, SectionsEditor.tsx], extends: [admin dashboard (People card)], depends_on: [WP-B] }
WP-D: { creates: [access-actions.ts, AccessPanel.tsx, forgot-password, set-password, auth/confirm], extends: [person page, SignInForm.tsx, app/admin/page.tsx], depends_on: [WP-B, WP-C (integration)] }
WP-E: { creates: [app/admin/activity, ActivityFeed.tsx], extends: [admin dashboard], depends_on: [WP-B, WP-C (integration)] }
WP-F: { creates: [PrayerHistory.tsx], extends: [actions.ts, ContentEditor.tsx, content list and editor pages, prayer page, people list and editor], depends_on: [WP-B, WP-C (integration)] }
WP-G: { extends: [app/about/page.tsx, content/about.yaml, content/{schemas,documents}.ts, validate-content.ts, app/privacy/page.tsx], depends_on: [WP-B] }
WP-H: { extends: [admin help, docs/guides/{owner-setup,board,developer}.md, docs/architecture.md, docs/roadmap.md, docs/release-checklist.md, tests/e2e/demo.spec.ts], depends_on: [WP-C..WP-G] }
FIX: { extends: [3 migrations (in place), scripts/test-backend.ts, community/people.ts, backend/providers/{contract,supabase-people,sample-people,sample,supabase-inviter,off-inviter}.ts, people-actions.ts, SectionsEditor.tsx, app/admin/people/sections, tests, docs], depends_on: [WP-C] }
```

Merge order: cleanup-outdated → A → B → C → FIX → D → E → F → G → H. After C, the D-G packages can be written in parallel and merge in order after rebasing. One PR per WP against `integration`, each updating release-checklist **Unreleased**; the integration owner runs `npm run check` and the final `reviewing-engineering-changes` review.

## Work Packages

### WP-A: Schema, guards, log triggers, archive and database tests

- Purpose: every authoritative rule lives in Postgres, proven locally, then applied to staging.
- Depends on: nothing.
- Expected files: three migrations, `supabase/templates/{invite,recovery}.html`, `supabase/config.toml`, `scripts/test-backend.ts`, `package.json` (`pg`, `@types/pg` dev only, D-17).
- Reuse: `touch_updated_at`, the `is_admin()` function style, content policy shape, the backend test harness and its localhost guard.
- Required changes: all SQL in Public Contract, D-5 log content, D-9 backfill, session deletion on deactivation.
- Must not: grant writes on `activity_log` or `admins` to any API role; use `security definer` without `set search_path = ''`; add a bucket; touch production.
- Tests (local only): anon, outsider and deactivated admin are refused everywhere; non-managers cannot change access; `self`, `last_manager` (also via a direct secret-key update) and `conflict`; one log row per change with the right actor, People entries without personal values; update/delete/truncate on the log fail for authenticated and secret key; archived rows and their files hidden from anon; delete only on archived rows and only by managers; referenced files cannot be deleted; `public_team()` returns only consented people and no consent or account columns; deactivation removes the user's `auth.sessions` rows; `owner_add_admin` works from SQL only. Race: two `pg` connections as the only two managers A and B; connection 1 begins and removes B's "manage people" without committing; connection 2 removes A's and is still waiting after 300 ms; commit 1; connection 2 gets `last_manager`; one holder remains.
- Done when: backend tests pass on a fresh `npx supabase start`; staging applies cleanly (human).

### WP-B: Ports, adapters, configuration and sandbox

- Purpose: every capability is reached through ports; the secret key lives in one adapter.
- Depends on: WP-A signatures (merges after), cleanup-outdated.
- Expected files: as in the WP-B effects block.
- Reuse: `outcome`, `versioned`, `adminClient`, `normalizeUpload`, `nextVersion`, `sandboxStore`, `recordFromRow`.
- Required changes: port extensions and new ports with Supabase and sample adapters (`off` inviter), `passwordSchema`, `SUPABASE_SECRET_KEY` parsing and accessor, wiring, accessors, `AdminIdentity`, `admin-content.ts` helpers, `getTeam`, `isVisible`, `duplicateAsDraft`, sandbox store and seeds, ESLint `importNames` rule, `.env.example`.
- Must not: import adapters outside `providers.ts`; create an admin client outside `supabase-inviter.ts`; use the secret key beyond `inviteUserByEmail`; put the secret on `RuntimeConfig` or in `next.config.ts` `env`; branch on mode or env; add UI.
- Tests: conformance suites for `PeopleEditor`, `ActivityLog`, `AccountInviter`, extended `ContentEditor` and `AdminAuth` on sample adapters; `tests/people.test.ts` mirrors the database guard cases; `passwordSchema` cases (D-16); `tests/runtime.test.ts` secret-key rules (value never in messages, `off` refused in production, no sample/off wiring in production); a source test that `sb_secret`, `supabaseSecretKey` and `auth.admin` appear only in `runtime/config.ts`, `runtime/providers.ts` and `supabase-inviter.ts`.
- Done when: `npm run check` passes and `npm run demo` starts.

### WP-C: People screens

- Purpose: the board manages People and sections.
- Depends on: WP-B.
- Expected files: as in the WP-C effects block.
- Reuse: `useActionState` (+ `values`), `AdminHeader`, the image field from `ContentEditor.tsx`, `contentEditor().upload`.
- Required changes: list grouped by section with login status and permission badges; person form (name, role, section, unselected Yes/No, consent date + method shown and required when Yes, photo with its own consent, order number); refused saves keep typed values; sections page (add, rename, order, archive); dashboard People card.
- Must not: preselect show-on-public; rely on browser checks alone; add a second uploader; add access or archive controls (WP-D, WP-F).
- Tests: sandbox e2e: Yes without consent is refused, the message names the consent, typed fields remain; with consent it saves; axe on new pages.
- Done when: People and sections can be managed in the sandbox.

### WP-D: Access and passwords

- Purpose: board members join, leave and reset passwords without the owner.
- Depends on: WP-B; merges after WP-C.
- Expected files: as in the WP-D effects block.
- Reuse: sign-in validation style, `SignInForm` (after cleanup), `runtimeConfig().siteUrl`.
- Required changes: `AccessPanel` (invite with the two switches, status, resend, deactivate/reactivate, switches with version), invite flow, guard messages (including `person_archived` → "Restore this person first.", D-19), sandbox notice, forgot-password page with the neutral message, confirm route, set-password page with the D-16 hint and `signOut({ scope: "others" })` after success, D-1 sign-in copy.
- Must not: use the secret key outside `accountInviter()`; reveal whether an email has an account; grant before the invite succeeded; put auth routes outside `/admin`.
- Tests: sandbox e2e: invite shows "Invited" and the sandbox notice; own "manage people" cannot be removed; deactivated person sent to sign-in. The last-holder refusal cannot be reached from the screens by one person (whoever acts holds "manage people" and cannot remove their own), only by two managers acting at the same moment, so it is covered by unit (`accessChangeProblem`), conformance and the database race tests instead of e2e. The D-19 e2e case (archived person's login) moved to WP-F, which adds the person Archive button. Local stack (Inbucket, port 54324): invite and reset emails arrive with token-hash links; following them sets a password meeting D-16; a second browser session is signed out after a reset and after deactivation.
- Done when: the access lifecycle works in the sandbox and on the local stack.

### WP-E: Recent changes

- Purpose: every admin sees who changed what and when.
- Depends on: WP-B; rebases on WP-C's dashboard.
- Expected files: as in the WP-E effects block.
- Reuse: `describeChange`, `ActivityLog.list`.
- Required changes: `/admin/activity` newest first with "Older changes"; when (Grenada time), who (People name, "Site owner" for a null actor, "Former member" when gone), what and before → after per D-4/D-5; prayer entries highlighted plus a dashboard notice for 7 days; dashboard card.
- Must not: write to the log from the app; show raw jsonb, emails or consent values.
- Tests: unit `describeChange`; sandbox e2e: edit an event, see old and new title in the feed.
- Done when: the feed shows sandbox and local-stack changes.

### WP-F: Archive, restore, duplicate, permanent delete, prayer history

- Purpose: removals are reversible, items reusable, prayer settings restorable.
- Depends on: WP-B; merges after WP-C.
- Expected files: as in the WP-F effects block.
- Reuse: typed DELETE, version inputs, `savePrayerAction` validation (shared private function in `actions.ts`), `duplicateAsDraft`.
- Required changes: Archive replaces "Delete permanently"; Current/Archived tabs for content and People; Restore (D-13); permanent delete on archived items for managers (D-6); Duplicate on events and announcements; person archive deactivates the login (D-12); `purgePersonAction` reads the person's login first and, after `purgePerson` succeeds, calls `accountInviter().deleteAccount(userId)` (D-21); "Remove photo (consent withdrawn)" (`removePhotoAction`: `savePerson` with only the photo and photo consent cleared, which works for archived people too (D-26), then `removeFile`); prayer History panel with Restore.
- Must not: hard delete current items; add a history table; skip validation on restore; delete referenced files.
- Tests: sandbox e2e: archive an event, gone from `/calendar`, restore as draft; duplicate an announcement; permanent delete needs DELETE; permanently deleting a person with a login also removes their sandbox account (D-21); an archived person's login cannot be turned on ("Restore this person first.", D-19, moved from WP-D); restore an earlier Fajr and see it on `/prayer` and in Recent changes.
- Done when: no screen offers hard delete of a current item.

### WP-G: Public team list and YAML retirement

- Purpose: `/about` lists consented People; the YAML roster is gone.
- Depends on: WP-B.
- Expected files: as in the WP-G effects block.
- Reuse: `Section`, `SafeImage`, `about.board.heading/note/pending_label`.
- Required changes: team section per D-10/D-11, `force-dynamic`; remove `board.members` and `advisor` from YAML, schema, fallback and validator; privacy page paragraph: People data held (name, role, section, consent records, optional photo and login email) in Supabase, consent can be withdrawn, and passwords are stored by Supabase only as a one-way bcrypt hash that nobody at the MSA can see.
- Must not: show anyone without listing consent or any photo without photo consent; fall back to YAML names.
- Tests: sandbox e2e: listed person visible, hidden person absent, consent withdrawn removes them; `tests/editorial.test.ts` passes.
- Done when: `content/about.yaml` has no roster.

### WP-H: Help, guides and release notes

- Purpose: board, owner and developers can run PR3 alone.
- Depends on: WP-C to WP-G.
- Expected files: as in the WP-H effects block.
- Reuse: help card format; owner guide sections §8-§10, §13; release checklist sections.
- Required changes:
  - Help cards: People, Inviting and access, Forgot password (with the D-16 rule), Recent changes, Archive/Restore/Duplicate, Prayer history, Team list and consent; rewrite "End of term".
  - Owner guide, new "Connect the MSA Gmail for invite and reset emails" (exact steps; Gmail sends about 500 emails a day):
    1. Sign in to the MSA Gmail account, open myaccount.google.com → **Security** → **2-Step Verification** → **Turn on**, and finish the phone steps.
    2. Open myaccount.google.com/apppasswords, type the name `SGU MSA website`, click **Create**, and copy the 16-character password (spaces do not matter). Keep it only in the club password manager.
    3. Supabase (staging first, then production) → **Authentication** → **Emails** → **SMTP Settings**: turn **Enable custom SMTP** on; Sender email = the Gmail address; Sender name = `SGU MSA`; Host = `smtp.gmail.com`; Port = `587`; Username = the Gmail address; Password = the 16-character app password; **Save**.
    4. Send yourself a test invite: in the dashboard, People → a test entry → **Invite** with an address you own (before this release is live: Supabase → **Authentication** → **Users** → **Add user** → **Send invitation**). Check it arrives (also in Spam), then deactivate the test entry (or delete that mistake user in Supabase).
  - Owner guide, other one-time Supabase steps with exact clicks: **Authentication → Emails → Templates**: paste subject and body from `supabase/templates/invite.html` into "Invite user" and `recovery.html` into "Reset password", **Save**; **Authentication → URL Configuration**: Site URL = the `SITE_URL` value, **Add URL** `SITE_URL/admin/auth/confirm`; **Authentication → Sign In / Providers → Email**: Email OTP expiration `86400`, Minimum password length `12`, Password requirements "Lowercase, uppercase letters, digits and symbols", **Save**; **Project Settings → API Keys → Secret keys**: create a key named `website-invites`, copy the `sb_secret_…` value, then Vercel → **Settings → Environment Variables** → add `SUPABASE_SECRET_KEY` (Production only) → **Redeploy**. Replace "never use `sb_secret_`" with "only in `SUPABASE_SECRET_KEY`".
  - Owner guide §10: until Gmail is connected (D-2), add an admin by creating the Auth user (**Add user → Create new user**) and running `select public.owner_add_admin('email', 'Full name', true);`; on a new empty database the same call creates the first manager; after Gmail works, board members invite from People. Remove the old "Remove an admin" SQL (managers deactivate in People). State that passwords are stored only as a bcrypt one-way hash in Supabase Auth.
  - Release checklist **Settings to set before merging the Release PR**: the four Gmail steps, templates, URL configuration, OTP expiry, password requirements, `SUPABASE_SECRET_KEY`, and the three migrations (staging, then production); "How to test" and "Needs your confirmation" (exact D-1 email text).
  - Board guide "cannot do yet" row removed; developer guide (new ports, `SUPABASE_SECRET_KEY=off`, Inbucket, `SUPABASE_TEST_DB_URL`); architecture diagram 4 plus an invite flow; roadmap PR3 status and PR5 without "Our team" page.
- Must not: add a new guide file; edit ADRs; describe unmerged features; mention a paid service.
- Tests: `tests/documentation.test.ts`, `tests/agent-config.test.ts`; full sandbox walkthrough in `tests/e2e/demo.spec.ts`.
- Done when: every new screen has a help card and the owner can finish setup from the guide alone.

### FIX: planner amendments D-19..D-24

- Purpose: close the gaps the planner found after WP-C (archived logins, archived rows, privacy completeness, section restore, unused files, one visibility rule) before WP-D builds on them.
- Depends on: WP-C. Not applied to any hosted database yet, so the WP-A migrations are amended in place (Compatibility and Migration).
- Expected files: as in the FIX effects block; `docs/release-checklist.md`, `docs/roadmap.md`, `docs/guides/owner-setup.md`, `.claude/skills/planning-engineering-changes/references/supabase.md`.
- Reuse: `outcome`, `inView`, `accessChangeProblem`, `recordActivity`, `sandboxFileInUse`, the sections form and its `useActionState` pattern, the database suite helpers.
- Required changes: D-19 `set_access` result `person_archived` + `setAccessResults` + both adapters; D-20 trigger `archived_read_only` + SGU06 mapped to `conflict` + sample mirrors; D-21 `AccountInviter.deleteAccount` on the Supabase (`auth.admin.deleteUser`), sample and off adapters, owner guide line; D-22 `restoreSection` port method, adapters, `restoreSectionAction` and the "Archived sections" list with Restore; D-23 storage policy `admin_delete_unreferenced` (`is_admin()`), sample `removeFile` for any admin, port and action comments; D-24 `community_item_visible()` in all eight places.
- Must not: add a migration file; use the secret key outside `supabase-inviter.ts` or for anything but invite and account deletion; let an archived row change except by Restore; widen file deletion to files a row still names; add access or archive controls that belong to WP-D or WP-F (their wiring of D-19 and D-21 is listed in those packages).
- Tests: database suite: `person_archived` from `set_access`; archived People entries and sections refused for an admin and the owner, Restore allowed, Restore plus an edit refused; section restore and `name_taken` on restore; any admin deletes an unreferenced file, nobody deletes a referenced one; no policy repeats the visibility rule. Unit: conformance for `person_archived`, archived saves refused, `restoreSection`, `deleteAccount` (sample and off), `removeFile` by an admin without "manage people".
- Done when: `npm run test:db` and `npm run check` pass; `grep -c "America/Grenada" supabase/migrations/202610050003_archive.sql` prints 2 (the function only); `grep -rn "manager_delete_unreferenced" supabase src` finds nothing; `grep -rn "person_archived" src/lib/community/people.ts supabase/migrations/202610050001_people_access.sql` shows both result lists.

## Implementation Constraints

- Do not create an admin (secret-key) Supabase client outside `src/lib/backend/providers/supabase-inviter.ts`, or any client outside `src/lib/backend/server.ts` and that file. The secret key is used only for `inviteUserByEmail`, `deleteUser` (D-21) and, since the approved review-fixes plan of 2026-10-07 (P4, "Change email"), `updateUserById` for a login's email.
- Do not read `process.env` outside `src/lib/runtime/config.ts` (tests and `scripts/test-backend.ts` excepted); do not default, log or echo `SUPABASE_SECRET_KEY`.
- Do not write to `activity_log` from the app or add any update/delete path for any role.
- Do not enforce guards, consent or archive rules only in UI or actions; Postgres decides.
- Do not hard delete current content or people; do not add a history table.
- Do not store, log or display passwords; pass them only to Supabase Auth.
- Must not add buckets, YAML files, env variables beyond `SUPABASE_SECRET_KEY` (and local-only `SUPABASE_TEST_DB_URL`), or dependencies beyond D-17.
- Must not import adapters outside `providers.ts`, branch on mode or env, or wire sample/off adapters in production.
- Must not list a person or photo without consent, or preselect "Show on public page?".
- Must not use or document any paid service; must not mention a payment channel other than Go2Pay.

## Worker Escalation Conditions

Emit `PLAN MISMATCH` if cleanup-outdated has not merged or changed `AdminAuth` differently; the trigger cannot delete from `auth.sessions` (then stop; a secret-key ban is the alternative and needs the user); `inviteUserByEmail` cannot carry metadata or the redirect; `verifyOtp` with `token_hash` cannot set the cookie from a route handler or server action in this Next.js (check `node_modules/next/dist/docs/`); `signOut({ scope: "others" })` is unavailable in the installed `@supabase/supabase-js`; the advisory lock does not serialize under Supabase; a trigger cannot read `auth.uid()` for RPC calls; the storage policy cannot express "unreferenced"; Supabase refuses the D-16 password setting; a port needs an unlisted method; or a test would need production.

## Test Strategy

- Unit (`npm test`): `tests/people.test.ts`, `tests/activity.test.ts`, password cases, extended `tests/editor.test.ts` conformance (all new ports on sample adapters), `tests/runtime.test.ts`, `tests/provider.test.ts` (`getTeam`, archived hidden), the secret-boundary source test, `tests/editorial.test.ts`.
- Database (`npm run test:backend`, local Supabase only): WP-A cases, the two-connection race test, emails via Inbucket, session revocation.
- End-to-end (`tests/e2e/demo.spec.ts`, `E2E_DEMO=true`): consent refusal keeping input, access guards, Recent changes, archive/restore/duplicate/purge, prayer restore, team visibility; axe on new pages and `/about`.
- Build: `npm run build` with `SUPABASE_SECRET_KEY=sb_secret_test_marker`, then confirm `.next/static` has no `sb_secret_`; one build without it shows the failure message.
- Manual (staging, human): Gmail test invite and reset from a phone, deactivate and confirm the other device is signed out.
- Gate: `npm run check` per WP; full suite after WP-H.

## Acceptance Criteria

- A "manage people" holder invites a member by email from the MSA Gmail; the member sets a password (12+ characters with lower, upper, digit, symbol) and reaches the dashboard without the owner.
- Deactivating a member removes access at once and signs them out on every device; reactivating restores access without a new invite.
- Nobody can remove their own access or own "manage people", and the last holder keeps it even when two managers act at the same moment.
- A forgotten password is reset from the sign-in page, without revealing whether an email has an account, and the person's other sessions end.
- Every change to content, prayer, People, sections and access appears in Recent changes; nobody, including the secret key, can edit or delete an entry; People entries show which fields changed without personal values.
- Removing an item archives it; Restore brings it back as a draft; events and announcements can be duplicated; permanent delete is only from Archived, by a manager typing DELETE, and is logged.
- An earlier prayer schedule can be restored and shows on `/prayer`.
- `/about` lists only people marked "Yes" with consent, photos only with photo consent; refused saves keep the typed details; `content/about.yaml` has no roster.
- The sandbox shows all of this on sample data; production refuses to build without a valid `SUPABASE_SECRET_KEY`, and the key never appears in browser code.

## Open Risks or Escalations

- Gmail is the MSA's account: if 2-Step Verification or the app password is lost at turnover, emails stop; the owner guide and handover (PR5) must name who holds it. Daily limit about 500 emails.
- Deleting `auth.sessions` from a trigger depends on Supabase granting that to the migration owner; verified locally in WP-A, escalated if refused.
- PR4 changes the prayer settings shape; older versions are restored only if they pass today's schema.
- cleanup-outdated is in flight; WP-B and WP-D wait for it.
- None of these block delegation once WP-A's local checks pass. Plan is ready for delegation.
