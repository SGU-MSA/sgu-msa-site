---
status: approved
mode: full
---

# PR5b: Page text, sign-up forms, Qur'an verses (implementation contract)

**Approved: user answers 2026-10-05** (`.plans/answers-2026-10-05.md`, round 1 Q37–Q42, Q45 and round 2 "Answer sheet 2"). Every product decision below is answered. Source plan: `.plans/pr5-self-serve-content.md` (rev 3), PR5b part, copied here unchanged in substance; decision numbers (D-n) are the umbrella plan's so they can be traced; engineering choices made while building are E-n. PR5a is done ([contract](pr5a-notices-events-continuity.md)); PR5c (seasons, merch) keeps the umbrella plan until its own contract.

**Delivered as three PRs against `integration`** (one branch each, from `origin/integration`, in the worker's own worktree):

| PR                                                       | Work packages                                                                                                                                                                                 | What the board and visitors get                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PR-A** Page text in the database and the Pages screens | WP1 database and seed, WP2 Supabase page text, field lists, save rules, Google Forms rule, `system-text.ts`, the Qur'an service port, WP3 Pages screens with Edit \| Preview tabs and History | The board edits the words and photos of every page, the sign-up forms list and the site-wide details from Pages, sees a change on the website without a deploy, and restores an earlier version |
| **PR-B** Previews and copy out of code                   | WP4 page previews, WP5 copy moved out of components, verse placement read by the pages, the closed-form button                                                                                | The Preview tab shows the page itself; the Donate opening, Contact and Community headings become page text; each page's verse comes from the verse library                                      |
| **PR-C** Verse picker and help                           | WP7 Qur'an verse picker, WP6 help cards, Google Forms how-to, ADR 0022, guides                                                                                                                | The board searches and picks each page's Qur'an verse without typing it; help with pictures                                                                                                     |

## Capability

**Board-managed page text.** Every public sentence and photo the board may want to change (each page's headings and text, FAQ, resources, contact details, the organisation's name, tagline, email and social links, the Support page switch, the sign-up forms list and each page's Qur'an verse) is stored in Supabase (`public.page_texts`, one JSON document per page; `public.quran_verses`, the verse library), edited from `/admin/pages` with Edit | Preview tabs, logged in the add-only activity log, and restorable from each page's History. Fixed rules (the Google Forms link rule, Qur'an text kept exactly as the Qur'an service gives it, photo limits) are named constants. Fixed system wording (buttons, refusals, unavailable states, the meaning of each database error code) is not board text: it lives in one shared module, `src/lib/system-text.ts`, used by server and browser.

## Requested Behavior

From the roadmap PR5 row, the D0 inventory (D2, D5, D6) and the user's answers of 2026-10-03 to 2026-10-05:

- **Page text fields** per page, including the About team block heading and note (D-6, D-22).
- **Sign-up forms list:** the board changes, opens and closes each Google Form link; links are Google Forms links only, checked in code and in the database; a short how-to (D-7, D-13, D-25).
- **Qur'an verse per page:** the board searches api.alquran.cloud and picks; never types (D-24).
- **Preview before saving** as Edit | Preview tabs on every screen size (D-11, D-23).
- **History and Restore** for page text (D-12).
- **Every box shows an example placeholder**, never saved (D-26).
- Non-goals: seasons and merch (PR5c); funds, money types, the Donate page's giving lines (PR6); navigation and footer links, the privacy page, the Go2Pay receipt note (developer-only, Board Self-Sufficiency Check); storing sign-up answers (ADR 0014); building any Google Forms improvement (D-25); the dhikr of the hour and the tasbih (developer-owned YAML, D-24).

User acceptance: a non-technical board member changes any page text from the dashboard, sees it before saving, can undo it, and the public site follows without a deploy.

## Existing System Evidence

- Editorial port: `src/lib/content/providers/contract.ts` `EditorialSource` ("PR5 moves documents into Supabase one by one behind this same port"), `src/lib/content/documents.ts` (`editorialDocuments`, `parseEditorialDocument`), `src/lib/content/providers/yaml.ts`, `src/lib/content/index.ts` (request `cache`), `src/lib/runtime/providers.ts` `editorialSource()`, `src/lib/runtime/wiring.ts` (`editorial: "yaml"` before PR5b).
- Shapes: `src/lib/content/schemas.ts`; starter text `content/*.yaml`.
- Hardcoded copy: `src/features/donate/DonateLetter.tsx`, `src/features/contact/ContactCallingCard.tsx`, `src/features/community/CommunityFrontPage.tsx`, the prayer schedule lines in `src/lib/community/managed.ts` `managedPrayer`.
- Verses picked by hardcoded id in `src/app/**/page.tsx` and `src/shared/layout/Footer.tsx` `footerVerseId`; `content/reminders.yaml` verses came from api.alquran.cloud (`quran-uthmani`, `en.sahih`), several as part of a verse.
- Forms: `content/forms.yaml`, `src/lib/integrations/forms.ts` `resolveForm`, `src/shared/ui/FormCtaView.tsx`.
- Board writes: `ContentEditor` in `src/lib/backend/providers/contract.ts`; `src/features/admin/actions.ts` (`restorePrayerVersionAction` = version history from the log), `fields.ts`, `form-state.ts`, `file-cleanup.ts`, `ImageField.tsx`, `preview/EditorTabs.tsx` (PR5a).
- Database: `record_activity`, `published_attachment`, `community_file_in_use` as last re-created in `supabase/migrations/202610070001_notices_events_handover.sql`.
- Root layout `src/app/layout.tsx` is `force-dynamic` (PR5a E-1), so every public page reads current text.

## Owner

- Page text shapes and reads: `src/lib/content/**` (`documents.ts` keys and fallbacks incl. `pageTextKeys`, `schemas.ts`, `EditorialSource` adapters `supabase.ts` and `sample.ts`); field lists and save rules: `src/lib/content/page-fields.ts`.
- Board writes: `ContentEditor.readPageText` / `savePageText` (both adapters); actions in `src/features/admin/pages/page-actions.ts`.
- Google Forms rule: `src/lib/integrations/google-forms.ts` (`isGoogleFormUrl`, re-exported by `forms.ts`; E-2).
- Verse library: `public.quran_verses`, read by `ContentProvider.getVerses`; the outside service behind `QuranSource` (`src/lib/quran/providers/**`); placement: page text `reminder-places`, read by `reminderFor(place)`.
- Fixed system wording: `src/lib/system-text.ts`.

## Source of Truth

| Rule or state                                   | Authority                                                                                                | Mirrors                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Page text document shape                        | zod schema per key in `schemas.ts` via `editorialDocuments`                                              | editor field list in `page-fields.ts` (labels, required, limits); the save rules are built from it |
| Page text values                                | `public.page_texts` row per key (RLS: everyone reads, `is_admin()` writes, no delete)                    | sandbox: starter YAML plus in-memory edits                                                         |
| Sign-up form links, open/closed                 | page text `forms`                                                                                        | `resolveForm` (only reader)                                                                        |
| Google Forms link rule                          | `isGoogleFormUrl` (forms list save and event save)                                                       | `events_url_google_forms` check (`googleFormSqlPattern`, a test runs both on the same cases)       |
| Qur'an verse text                               | `quran_verses` rows, written only by the verse picker's save (PR-C), which fetches the text by reference | none; public pages read the row, never the service                                                 |
| Verse placement                                 | page text `reminder-places`                                                                              | none                                                                                               |
| Who changed which page                          | `activity_log` (trigger `record_activity('key', 'full')`)                                                | History, Recent changes                                                                            |
| Fixed system wording and database code meanings | `src/lib/system-text.ts`                                                                                 | a test: every `SGU` code raised in `supabase/migrations/` has an entry                             |

## Reuse and Duplication Analysis

Reused unchanged: `currentAdmin`, `publicClient()`, `Outcome`, `issuesOf`, `keepTyped`, `typedValues`, `FormMessages`, `ActionForm`, `ActivityFeed` (`actions` slot), `AdminHeader`, `EditorTabs` + `useTypedValues` (PR5a), `ImageField` (gains a `name`), `normalizeUpload`, `ContentEditor.upload`, `removeUnusedFiles`, `record_activity`, `touch_updated_at`, `archived_read_only`, `is_admin()`, `revalidatePath("/", "layout")`.

Extended (one owner each): `EditorialSource` gains Supabase and sandbox adapters; `editorialDocuments` gains `donate`, `contact`, `community`, `reminder-places`; `prayerSchema` gains the three schedule lines; `formsSchema` entries gain `open` and `closed_label` (they replace `placeholder` and `pending_label`, E-3); `ContentEditor` gains `readPageText`, `savePageText`; `ContentProvider` gains `getVerses`; `recordFormSchema` refuses a non-Google-Forms event link; `activityKinds` gains "Pages".

One model, not two: one `page_texts` table and one generic editor driven by field lists (no per-page tables or screens); version history reads the activity log, as prayer history does; Qur'an text is fetched once at save time and stored; messages move into `system-text.ts`, none copied.

## New Abstractions

1. Supabase `EditorialSource` adapter: all page text in one read per request through `publicClient()` (3 s, no-store), each document parsed by `parseEditorialDocument`; `ramadan`, `merch`, `reminders` still come from YAML until PR5c.
2. Sandbox `EditorialSource` adapter: starter YAML plus the sandbox store's saved page text.
3. `page-fields.ts`: `pageFields[key]` (sections and boxes: line, text, paragraphs, lines, link, email, google-form, image, icon, form, verse, yes/no, choice, list, entries), `pageTextSaveSchema(key)`, `mergePageText`, `withEveryField`, the photo path helpers.
4. `PageTextEditor` (client): one form for every page, drawn from its field list, inside `EditorTabs`.
5. `QuranSource` port with adapters `alquran-cloud` and `sample`; wiring `quran: "alquran-cloud" | "sample"`.
6. `src/lib/system-text.ts`.
7. SQL: `page_text_names_file(doc, file)`, trigger function `quran_verse_text_fixed()` (SGU11).

## Product Decisions Required

- [x] Page text as fill-in fields per page
      Decision: D-6
- [x] Sign-ups through the board's Google Forms, "Sign up →" button, new tab, no embed, no stored answers
      Decision: D-7
- [x] Preview before saving on each editor; full-page draft preview only if the board asks later
      Decision: D-11
- [x] Archive instead of delete, version history for page text
      Decision: D-12
- [x] Google Forms: picture how-to now; improvements listed, not built
      Decision: D-13
- [x] Which texts the board edits (Q37)
      Decision: D-22
- [x] Editor and preview layout (Q38)
      Decision: D-23
- [x] Qur'an verses (Q37 note, Q39)
      Decision: D-24
- [x] Google Forms tips and allowed links (Q40)
      Decision: D-25
- [x] Example placeholders in every box (Q41 notes)
      Decision: D-26
- [x] Mockup wording approved; no photo success or size messages (Q45, Q92, Q93)
      Decision: D-28

## Decisions

- D-6: Page text as fill-in fields per page (user, 2026-10-03, D0 D2).
- D-7: No stored member data; sign-ups through the board's Google Forms; an event's form link is a styled "Sign up →" button opening a new tab; no embed (user, 2026-10-03, D0 D5, D6, ADR 0014).
- D-11: Preview before saving on each editor; a full-page "preview as a visitor" only if the board asks later (user, roadmap PR5 row).
- D-12: Archive instead of delete, Duplicate, version history for page text and seasons (user, 2026-10-03, ADR 0013).
- D-13: Google Forms: short picture how-to now; optional improvements written down for the user to pick, not built (user, 2026-10-04).
- D-22: Every page text and photo is board-editable (all pages, FAQ, resources, contact, organisation name, tagline, social links, the Support page switch). Not board text: fixed system wording and anything the backend enforces, in one shared module `src/lib/system-text.ts`. Navigation, the privacy page and the Go2Pay receipt note stay developer-only (user, 2026-10-05, Q37).
- D-23: Editors show "Edit | Preview" tabs on every screen size (user, 2026-10-05, Q38 B).
- D-24: Qur'an verses: the board never types. A dashboard verse picker searches api.alquran.cloud (free, no key) by reference ("2:255", "2:255-257", at most `VERSE_RANGE_MAX = 3` verses) or by words; it shows the Uthmani Arabic and the Saheeh International meaning and saves the Arabic, meaning, reference and translator in `quran_verses`; public pages read only our database. The dhikr of the hour and the tasbih stay as they are (user, 2026-10-05, Q37 note and Q39). Engineering, stated: alquran.cloud, not quran.com v4 (needs OAuth and forbids keeping content over a week).
- D-25: The how-to lists Google's built-in tips 1, 2 and 5; tip 4 only when an event fills up; not tip 3. The forms list and an event's "Sign up →" link accept Google Forms links only (`https://docs.google.com/forms/…` or `https://forms.gle/…`); anything else is refused with "Sign-up link: use a Google Forms link (docs.google.com/forms/… or forms.gle/…)." (user, 2026-10-05, Q40 B).
- D-26: Every box in every PR5 editor shows an example placeholder, also in a newly added empty row; placeholders are never saved (user, 2026-10-05, Q41 notes).
- D-28: The wording in the mockups is approved (Q45); no photo success or size lines (Q92, Q93).
- E-1 (engineering): all page text is read in one query per request (18 small documents, about 25 KB), not one query per document.
- E-2: `isGoogleFormUrl` lives in a module with no server-only import (`google-forms.ts`), because the event save rules run in the browser too; `forms.ts` re-exports it.
- E-3: a sign-up form entry is `{ label, url, open, closed_label, description }`; `open` and `closed_label` replace `placeholder` and `pending_label` (one concept each). Every starter link is the same example form, so every starter form is seeded closed (`open: false`), as it showed before. Until PR-B's closed button, a closed form looks exactly as a placeholder form did.
- E-4: the Supabase adapter delegates `ramadan`, `merch` and `reminders` to YAML until PR5c; they are not page text yet.
- E-5: the Qur'an adapter leaves out the basmala the service puts before the first verse of every surah except Al-Fatiha (it is not part of that verse; `content/reminders.yaml` did the same for 96:1). Ranges are joined with " ۝ " (Arabic) and a space (meaning). Search completes each match (at most 20) in both editions one request at a time, 100 ms apart (the service allows 12 a second), within 15 s for the whole search; when a lookup fails or time runs out, the verses already found are shown, and only a search with none found says the service could not be reached (PR-C review).
- E-6: the verse library starts empty. The seed script's verse step (`--verses`) compares each margin verse in `content/reminders.yaml` with the service and stops on any difference, as this contract requires; 8 of the 9 YAML verses are parts of a verse (and 96:1 differs by the basmala), so it stopped. `reminder-places` is seeded with today's references; a page shows no verse until its verse is in the library (see Open Risks).
- E-7: an empty optional box is left out of the stored document (the page hides that block, or shows the document's own default line where the schema has one); new list items get an id from their title.
- E-8: History restores the text; a photo replaced since that version keeps the photo that is there now (the replaced file is deleted when replaced, D-23 of PR3).
- E-9: the Preview tab of the Pages editor says the picture of the page comes with the next update until PR-B's previews land (WP4).
- E-10: the "Verse on each page" document (`reminder-places`) is edited on the verse screen (PR-C), not in the Pages list.
- E-11 (review of PR-A): the developer-only parts of page text (`developerOwnedPaths` in `src/lib/content/documents.ts`: the menu, header button, footer, logo and search keywords in `site`, `events.terms`, `resources.categories`) always come from `content/*.yaml`, laid over the stored row or the fallback by the Supabase and sandbox adapters. A developer changes them in YAML and deploys; they show while the database is down; a test fails if a YAML part is neither a board field nor listed.
- E-12 (review of PR-A): the database mirrors the Google Forms rule in one function, `public.is_google_form_url` (`googleFormSqlPattern` and `googleFormSqlRefused`, which refuses a backslash or a "." / ".." path part that a browser resolves to another address), checked on `events.url` and on every link in the `forms` page text (`page_texts_forms_google_forms`).
- E-13 (PR-B): previews are drawn in the browser (`PagePreview` in `src/features/admin/pages/previews.tsx`) by each page's own body component; the live lists and the other pages' stored text that page draws are read once on the server when the editor opens (`previewLive(key)`), and the typed text replaces this page's document in them.
- E-14 (PR-B): the preview leaves out verses (PR-C's screen), the map box, and Home's community updates and featured notice (server-only parts, passed to the body components as slots); a photo chosen but not saved shows after Save. Donate and Leaving the site keep the E-9 line until PR6's Donate page (WP5 waits for it).
- E-15 (PR-B): the preview document is what a save would store (`previewPageText`: `mergePageText` then `pageTextSaveSchema`); when a save would be refused, the preview lists the same problems instead of the page.
- E-16 (PR-B): the closed-form button follows the approved picture: a closed form shows its `closed_label`; a closed form without one, an open form without a link (or with an unsafe one) and an unknown key show nothing. One pure reader, `formDestination(forms, key)`, serves `resolveForm` and the preview; the callers' fixed "… Coming Soon" fallbacks are gone.
- E-17 (PR-B): `footer.copyright` is removed; the footer prints "© {the current year} {the brand name}. All rights reserved." with the year in Grenada on the server clock (`siteYear`), the same words the site showed.
- E-18 (PR-B): `placedReminder(place)` turns the placed library verse into the reminder primitives' shape (`verseReminder`): reference "Qur’an 94:5–6 (Ash-Sharh)" and the translator credit "Translation: Saheeh International" on its own line in the "?" tip (`systemText.verses`).
- E-19 (review of PR-B): `donate` is left out of the Pages list (`pagesOnScreen`) until `DonateLetter` reads `getDonate()` (WP5, after PR6's Donate page), so no save says "Saved" for words the site does not show. The follow-up is tracked in the roadmap's PR6 row.
- E-20 (PR-C): the verses ADR is [ADR 0023](../adr/0023-quran-verses-picked-from-alquran-cloud.md): 0022 went to the daily check and 0019–0021 are PR6's. Where this contract says "ADR 0022" for verses, read 0023.
- E-21 (PR-C): the verse screen follows the mockup `verse-picker` (find; saved verses with the places each shows on; which verse shows on each page; the closing note). The Edit | Preview tabs sit on part 3 (the only part that is saved as one form; its Preview draws each place with its verse as a margin note), and the page's History is under the three parts. Not built from the mockup: the "new" / "just added" marks on a verse just saved (the "Use this verse" button answers with a line instead). The library lists the newest first; archived verses fold under "Archived verses" with Restore.
- E-22 (PR-C): `ContentEditor` gains `listVerses`, `addVerse` (a current verse with the same reference is reused, an archived one restored, a race on the unique reference counts as saved), `archiveVerse`, `restoreVerse`; `VersionedVerse` lives beside `QuranVerse` in the Qur'an port so screens may name it. No migration: PR-A's `quran_verses` rules cover it.
- E-23 (PR-C): the search box is read by `verseQuery` (`src/lib/quran/reference.ts`): anything shaped "surah:verse" is a number (a wrong one is named, a range over 3 is refused), anything else is words (at most 100 characters). The words are sent to the service and shown again, never stored or logged.
- E-24 (PR-C): the Google Forms how-to (steps and tips) has one copy, `FormsHowTo.tsx`, shown beside the forms list and on the help card "Sign-up forms and Google Forms". The help cards "Edit a page", "Sign-up forms and Google Forms" and "Qur’an verses" have one picture each; no "Show me how" tour for the Pages screens yet (WP6 lists help cards only).
- Amendment (user, 2026-10-05; review fixes PR-1): each resource has an `archived` yes/no (Pages → Resources, "Archived"); visitors see only resources with a link that are not archived (`shownResources` in `src/features/resources/library.ts`). The "Text while there is no link" box is removed (`pending_label` stays readable in stored text, never shown). Migration `202610140001_resources_archived.sql` removes the four starter resources without a link and archives the two marked "Archive", without an activity entry.

- D-24 amendment (user, 2026-10-05, demo review, `.plans/review-fixes-plan.md` PR-3; answers Open Risks "Starter verses" with option C): **a library verse may show only part of itself.**
  - `quran_verses` keeps the whole verse, fixed (SGU11), and gains an optional part, `excerpt_arabic` + `excerpt_meaning` (both or neither), each a word-for-word piece of the stored whole text. Checked in code (`src/lib/quran/excerpt.ts`: Arabic words exactly, composed form; meaning words without punctuation or capitals) and in the database (`quran_excerpt_is_part`, constraint `quran_verses_excerpt_is_part`); a test runs both on the same cases. The reference shown is always the whole verse's ("Qur’an 5:2 (Al-Maaida)").
  - In Pages → Qur’an verses, each saved verse has "Choose the words to show": the board taps the first and last word of the Arabic and of the meaning (pause marks are not offered), sees the part as a margin note and saves; "Show the whole verse" clears it. The form posts only word numbers; `saveVerseWordsAction` builds the part from the stored verse (`ContentEditor.setVerseExcerpt`, the version on screen, current verses only). Nothing can type Qur’an text.
  - One line (replaces restyle-public D-6's 26-letter rule): `ArabicLine` sizes the text to fill its box on one line, from the place's largest size down to a readable smallest one (`--arabic-min`), using the text's measured width; only then it wraps, into balanced lines, and no space is reserved for lines it does not use. The same rule applies to the Home dhikr, the Home verse band and the footer. The picker's preview (and the "Verse on each page" Preview) shows the margin note at its narrowest (18rem) and warns "Too long for one line. Choose a shorter part." when it would not fit there.
  - E-6 is replaced: the library starts with today's 9 margin verses (`content/reminders.yaml`) stored as their whole verses (fetched once by `scripts/page-text-seed.mjs --fetch-verses` into `src/lib/quran/starter-verses.json`, never at runtime) with the text the site showed as their part (94:5–6 was shown whole: no part). The migration seeds them (`on conflict (reference) do nothing`, not logged), and the sandbox starts with the same library, so every page shows its verse again; the release gate in Open Risks is lifted.
- Amendment (user, 2026-10-05; review-fixes PR-2, see the [PR3 contract](pr3-people-permissions-activity.md) amendment of that date): the lists inside a page's text (such as the FAQ questions) are reordered with the shared `SortableList` (drag the handle ⠿, or the Move up / Move down arrows) instead of the Move up / Move down buttons; **Save page** still saves the whole page, order included.
- Amendment to E-1 (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): page text is no longer read once per request. Each document is cached (`"use cache"`, `cacheLife("max")`, tag `page-text`) until a board save expires it (`publicDataChanged()`: `updateTag` for every public tag), so a save still shows on the next page load; a fallback read (database unreachable) is kept a few minutes only. The verse library is cached the same way (tag `verses`).
- Amendment (user, 2026-10-05/06; review 3 B, `.plans/review3-plan.md` section B): **sections of a page, edited by the Executive board.**
  - **Who:** only people in the Executive board group with a login that is not turned off edit Pages (every page text, the sign-up forms, Site-wide, "Verse on each page", the Go2Pay receipt note). No tick-box: it follows People. The database decides (`can_edit_pages()`, RLS `executive_insert` / `executive_update` on `page_texts`, edited in place in `202610100001_page_texts.sql`); the Pages screens send anyone else to the dashboard (`requirePageEditor`), the Pages actions refuse them ("Only people in the Executive board can change pages."), the dashboard hides the Pages card from them, and while no Executive board member has a login it shows "Nobody can edit pages: add an executive" with a link to People (`nobodyEditsPages`). The verse library is fixed (review 3 E): nobody writes `quran_verses`; the verse of each place is page text (`reminder-places`). Recorded in [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md).
  - **Sections:** `src/lib/content/page-layouts.ts` lists each page's sections below its top (Home, About, Prayer & Musallah, Events, Community, Resources, Get involved, FAQ, Contact, Support), where each one's words are edited, and the starter order (today's page). The page's text stores `sections`: every section once, in order, each shown or hidden (`pageSectionsSchema`; the starter text and the seed list them all, shown). The top is always first and shown; Support's "Show the page" settings stay above it. Sections whose content is not this page's text are listed too, so the list is the whole page: another page text's section (Jumu'ah and the four Musallah directions sections on Prayer & Musallah, the Newsletter archive on Resources, "On Home" of the FAQ on Home), another screen's (Community updates on Home: Announcements and Community news) or fixed words (Home's "Your first visit" and "Support our community").
  - **Editor:** a page with sections is a list: the top (Edit), then the dragged list (`SortableList`, saved with **Save page**), each row with "Show this section on the page", the handle and Edit (opens its boxes here, or the page text or screen that edits it, `?section=` opening it there). A section another page shows says where, with a link. One-section texts keep their open form. A refused save opens the sections that need fixing ("Needs fixing"; `CheckedForm` `onProblems`). History restores the order and shown state with the words; a restore (and its preview) does not check the boxes of sections hidden in that version or on the page that shows them (`restoredPageText(key, earlier, current, elsewhere)`).
  - **Required boxes only apply when shown:** in a hidden section (hidden on its own page, or on the page that shows it) an empty required box is allowed and kept empty; a photo or a choice stays required (the stored page needs it). Showing a section of another page text again needs its required boxes filled: on Save page they are checked on their own boxes (they are on that screen, amendment below); a History restore that would show it is refused ("<Section>: fill in its required boxes before showing it.").
  - **Public pages and Preview:** each body component draws its sections in the saved order without the hidden ones, each in a `PageSection` (`display: contents`). Pairs drawn together stay together when next to each other: today's times and Jumu'ah side by side, the photos of the way inside the directions band, the Contact card beside the welcome when it comes first; apart, each is drawn on its own. About's contact band splits the chapters when moved up (the index stays with the first chapters). Preview shows the whole page (with the server's parts, `previewSlots`, and the page's verses) scrolled to the section opened last.
  - **Editor grouping (engineering):** the Resources "Search" boxes joined the "Resources" section (one part of the page); Get involved's "Introduction" joined its top (it is in the heading); "No events" and "No updates" are named "Events list" and "Updates list".
  - **Help:** a "What you can change" card (who changes what, and what only the site owner changes); "Edit a page" describes the list. Nobody outside the Executive board is offered a link into Pages: the Pages, Sign-up forms and Qur'an verses cards say "Only people in the Executive board can change pages." instead of their **Open …** link, and the funds and tickets screens' empty-receipt-note line asks them to have an Executive board member add it (`canEditPages` passed from the route).
- Amendment (user, 2026-10-06, dashboard polish after review 3): **every section is edited on the page that shows it.** A section whose words are another page text's (Jumu'ah and the four Musallah directions sections on Prayer & Musallah, the FAQ's "On Home" as Common questions on Home, the Newsletter archive on Resources; `sharedTexts(key)` in `page-layouts.ts`) opens its boxes in place with Edit, like the page's own; the "Its words are edited on (page)." note and the link to the other screen are gone. Storage is unchanged: those words stay in their own document (one copy), and that document's own Pages screen still edits them too. **Save page** posts each shared document beside the page's (`document:<key>`, `version:<key>`, photos `photo:<key>:<path>`), checks each by its own save rules with the sections the page hides as hidden (`pageTextsForm`, browser and server; a shared box's problem key is `<key>:<path>`), and saves the page's text and every shared text this save changed in one step, or none (`ContentEditor.savePageTexts`, database function `save_page_texts`: rows locked, every version checked, RLS decides; edited in place in `202610100001_page_texts.sql`, no hosted data). Each text is logged as its own change. **History stays one stored text per Restore** (engineering, the clearest correct option): Restore on Prayer & Musallah puts back its own words, order and shown/hidden, never Jumu'ah's or Musallah directions' words (the Jumu'ah heading is also on Home, so restoring it from Prayer & Musallah would change Home without saying so); under History a line names the sections whose words are kept elsewhere and links to that text's History. The Preview tab draws the shared words as typed.
- Amendment (user, 2026-10-06, hand-in plan `.plans/final-plan.md` A2, **shared text option A**): a section whose words show on more than one page **shows in every page that uses it**, labelled "Shared · also on (pages)"; editing it on any of them changes it everywhere (stored once, saved as in the dashboard polish amendment above). `page-layouts.ts` declares where words are drawn: a row's `with` (sections of the same text drawn inside it: the FAQ's **Questions** in Home's **Common questions**) and a page's `inside` (sections of another text drawn in the page's own parts, edited in a fixed row under the top: the Jumu'ah heading and note on Home); `placesOf`, `pagesShowing`, `drawnOn` and `sharedTexts` read them. A section is hidden (its required boxes may stay empty) only when every page that draws it hides it (`hiddenSections`; an `inside` part is never hidden). **Preview has a page switcher** ("Preview the page") listing `previewPages(page)`: the page, then every page that draws words edited there, each drawn from its stored text with the words as typed over it (`OtherPagePreview`, `sharedOver` by page). **Jumu’ah, Musallah directions and Newsletter archive leave the Pages list** (`editedOn(key)` in `pages-list.ts`: no layout of its own and every section drawn elsewhere); `/admin/pages/<key>` stays for them with "Its words are edited on the page that shows them:" and links, and their History (the **History of …** links are kept). No database change.
- Amendment to D-12 and E-8 (user, 2026-10-05/06, review 3 D; see the [PR3 contract](pr3-people-permissions-activity.md) amendment of that date): a page's History (and the "Verse on each page" History) asks before restoring, with the shared confirmation, and previews the page as the restore would save it: the Preview tab's picture (`PagePreview`) of `restoredPageText(key, earlier, current)`, the earlier text with today's photos (E-8), which `restorePageTextVersionAction` saves (with `restored_from`). A restore deletes no photo and no log entry.

- D-24 amendment (user, 2026-10-06, third review, `.plans/review3-plan.md` section E; [ADR 0026](../adr/0026-fixed-quran-verse-library.md) supersedes ADR 0023): **a fixed library of short whole verses; no excerpts, no live search.** This replaces the D-24 amendment of 2026-10-05 above (excerpts), E-20 to E-23 and the "verse search" parts of D-24 and WP7.
  - `quran_verses` is the whole library, filled once and never changed: every whole verse whose Arabic fits one line where a verse shows (`fitsOneLine(arabicEmEstimate(arabic))`: at most 29 letters, spaces and signs, harakat not counted, ≈ 11.47em), 1655 verses, Uthmani Arabic and Saheeh International exactly as api.alquran.cloud gave them (basmala before a surah's first verse left out, except 1:1). Columns `surah`, `ayah`, `reference` (generated "94:5"), `surah_name`, `arabic`, `meaning`; select for everyone, no write grant, no archive, no activity trigger. Fetched by `scripts/page-text-seed.mjs --fetch-verses` into `src/lib/quran/verse-library.json`; the migration's insert is generated from it (`--verses`), and a test checks the two agree. The excerpt columns, `quran_excerpt_is_part`, SGU11 and the starter 9 verses are gone (edited in place: `202610100001_page_texts.sql`, `202610130001_one_room_verse_library.sql`, renamed from `…_verse_excerpts.sql`).
  - "Verse on each page" (page text `reminder-places`) names one whole verse per place ("94:5"; ranges are refused by `verseReferencePattern`). On Pages → Qur’an verses each place shows its verse (Arabic, meaning, name) with **Change verse** / **Choose a verse** and **No verse**; Change opens a search inside the library (`searchVerses` in `src/lib/quran/search.ts`, in the board's browser over the library the screen was given): a verse number, a surah number, or words of the English meaning, the surah's name or the Arabic typed without harakat; at most 20 shown with the total. **Use this verse** sets the place; **Save verse choices**, Preview, History and Restore are the page text's as before. Starter picks are pre-filled (release checklist, to approve).
  - Removed: the `QuranSource` port and its adapters, wiring `quran`, `ContentEditor.listVerses/addVerse/archiveVerse/restoreVerse/setVerseExcerpt`, the verse actions, `VersePicker`, `VerseLibrary`, `VerseWords`, the "Too long for one line" warning, and the `verses` list in `content/reminders.yaml` (which now holds the dhikr and the tasbih only). `ContentProvider.getVerses` is replaced by `getVerse(reference)` (public pages, cached with no tag) and `getVerseLibrary()` (the verse screen, read 1000 rows at a time). The "one line" rule of the 2026-10-05 amendment stands.

- Amendment (user, 2026-10-06; approved final plan A6, "every public picture changeable from the dashboard"): Home's **Your first visit** photo was fixed in code (`VisitSection`); it is now `visit.image` in the Home page text, edited in Pages → Home → **Your first visit** (one Photo box, required; the note "Only the photo can be changed here; the words are fixed."). The section's source in `page-layouts.ts` is `text("home")` instead of `fixed`; its words stay fixed. The starter photo is `content/home.yaml` `visit.image` (the seed in `202610100001_page_texts.sql` regenerated for Home only, edited in place, no hosted data). The page draws the photo itself (`HomeBody` → `VisitSection image map`), and only the map stays a server slot (`map`, as on Prayer & Musallah), so the Preview tab shows the photo as typed. Every Pages photo box also offers "Choose from uploaded photos" (PR5a amendment of this date).
- Amendment (PR5c, 2026-10-06; see the [PR6 contract](pr6-go2pay-payments.md) amendment of this date): page text gains the key **`merch`** (the Merch page's small heading, title, short description and the note about the shirts; Pages → Merch, Executive board), seeded from `content/merch.yaml`, which now holds only that opening. The `ramadan` document is removed: Ramadan's page is the Ramadan season's own page (Seasons → Ramadan → Public page). Only `reminders` (the dhikr and tasbih) is still read from YAML.

## Board Self-Sufficiency Check

Pages edits every document in `pageTextKeys` except `reminder-places` (PR-C's verse screen): Home, About (incl. the team heading and note), Prayer & Musallah (incl. the schedule lines), Jumu'ah, Musallah directions, Events page, Community page, Newsletter archive, Resources, Get involved, Sign-up forms, FAQ, Donate opening (from WP5, after PR6's Donate page; E-19), Contact, Support (incl. its on/off switch), Leaving the site, Site-wide (name, tagline, email, social links, search description). Stays developer-only: navigation and footer links, the logo, the privacy page, filter lists (event terms, resource categories), the Go2Pay receipt note, the dhikr and tasbih, fixed system wording, prayer calculation, keys. Help cards with pictures: PR-C (WP6). Qur'an verses: Pages → Qur'an verses (PR-C).

## Design

```text
/admin/pages ─► list of pages (last saved by, when, from the log) ─► /admin/pages/[key]
PageTextEditor(pageFields[key]) inside EditorTabs
   ─► savePageTextAction ─► mergePageText ─► pageTextSaveSchema(key), per text (pageTextsForm) ─► photo uploads (≤ 3 per save) ─► ContentEditor.savePageTexts([page, changed shared texts]) (one step, or none)
   ─► page_texts (version = updated_at) ─► activity_log full row ─► History ─► restorePageTextVersionAction
Public page ─► getX() ─► editorialSource() = Supabase adapter (one read per request) ─► parseEditorialDocument (fallback + unavailable on failure)
Sandbox ─► starter YAML + in-memory edits
reminderFor(place) ─► reminder-places + quran_verses (ContentProvider.getVerses), never the outside service
```

- Required vs optional: a required box left empty is refused with the typed text kept: the box turns red with its reason under it and Save shows one line at the top, "Some boxes need fixing." (the shared field check, PR4 contract amendment of 2026-10-05); messages name the section and box ("Our team · Heading: fill in this box."); an optional box left empty hides that block.
- Photos: image boxes upload through `ContentEditor.upload("image", …)` inside the save, stored as `/media/` plus the file name in the document's `src`; a photo the page no longer names is removed afterwards; starter photos keep their `/images/…` paths.
- Links: a page of this site (fixed list `sitePaths`, with `#part` or `?filter`), a file under `/documents/`, or `https://`; social links also `mailto:`. Text renders as text; no HTML or Markdown.
- Forms list: the forms screen shows each form with where it shows, its link, Open, the closed line and description, and the how-to card from the mockup `forms-register`.
- Qur'an verses (PR-C): the design in `.plans/pr5-self-serve-content.md` Design → PR5b "Qur'an verses" applies unchanged.

## Public Contract

Migration `supabase/migrations/202610100001_page_texts.sql`: `public.page_texts (key primary key in the 18 keys, document jsonb object, created_at, updated_at)`, seeded once by `scripts/page-text-seed.mjs`; RLS public select, `is_admin()` insert/update, no delete; triggers `touch_updated_at`, `record_activity('key','full')`; `page_text_names_file(doc, file)`; `public.quran_verses` (reference unique `^[0-9]{1,3}:[0-9]{1,3}(-[0-9]{1,3})?$`, surah_name, arabic, meaning, translator, source, archived_at, timestamps), public select of current rows, admin select/insert/update, no delete, text fixed after insert (SGU11), archived rows read-only; `events_url_google_forms` check NOT VALID; `published_attachment` and `community_file_in_use` also cover photos named by page text.

```ts
// src/lib/content/documents.ts
export const pageTextKeys: readonly PageTextKey[];   // the 18 keys
// src/lib/content/page-fields.ts
export const pageFields: Readonly<Record<PageTextKey, PageDocumentFields>>;
export function pageTextSaveSchema<K extends PageTextKey>(key: K): z.ZodType<EditorialDocuments[K]>;
export function mergePageText(key, stored, posted): { ok: true; document } | { ok: false; reason: "out_of_date" };
// src/lib/integrations/google-forms.ts
export function isGoogleFormUrl(value: string): boolean;
// src/lib/quran/providers/contract.ts
export type QuranVerse = { reference; surahName; arabic; meaning; translator; source };
export interface QuranSource { byReference(reference): Promise<QuranResult<"not_found" | "unavailable", QuranVerse>>; search(words): Promise<QuranResult<"unavailable", QuranVerse[]>> }
export const VERSE_RANGE_MAX = 3;
// src/lib/content/index.ts
export function reminderFor(place: ReminderPlace): Promise<QuranVerse | null>;
// src/lib/backend/providers/contract.ts (ContentEditor)
readPageText(key): Promise<{ document; version } | null>; savePageText(key, document, version): Promise<WriteResult>;
// src/lib/system-text.ts
export const systemText: { buttons; messages; sguCodes; pages };
```

Routes: `/admin/pages`, `/admin/pages/[key]`; PR-C adds `/admin/pages/verses`. Actions: `savePageTextAction`, `restorePageTextVersionAction`; PR-C adds `searchVersesAction`, `saveVerseAction`, archive and restore for verses.

## Private Implementation

The implementer decides the editor's layout inside the approved mockups, the field list's kinds and helper names, the reorder control (Move up / Move down buttons), the seed script's output format, and component splits inside `src/features/admin/pages/`.

## Data and State Flow

- Reads: pages → `src/lib/content/index.ts` (`cache` per request) → `editorialSource()` → Supabase adapter (one `page_texts` read per request) → `parseEditorialDocument`. Verses → `getVerses()` → `ContentProvider` (RLS hides archived rows).
- Writes: server actions only; RLS is the authority; version check on `updated_at`; `revalidatePath("/", "layout")` after each save.
- Uploads: browser shrink → `FormData` (`photo:<path>`) → action → `normalizeUpload` → `ContentEditor.upload` → stored name in the document.
- Qur'an service: dashboard server actions only, `fetch` with `cache: "no-store"` and a 5 s timeout; no CSP change.

## Failure Modes

| Situation                                                      | Expected behaviour                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Supabase down, or `page_texts` missing (migration not applied) | Each page shows its documented fallback with the unavailable flag; the board screen says "This page's text could not be loaded…" |
| Two editors on one page                                        | Version check → "Someone else changed this; reload before trying again." Typed values kept                                       |
| Required box emptied                                           | Refused with every problem listed; nothing falls back to code text                                                               |
| Not a Google Forms link (forms list or event)                  | Refused with the D-25 line, typed text kept                                                                                      |
| Four new photos in one save                                    | Stopped with "Add up to 3 new photos per save, then save again."                                                                 |
| Old tab posts a form after the field list changed              | "This page is out of date. Reload it and try again."                                                                             |
| Placement names a verse not in the library                     | No verse on that page; a warning in the server log                                                                               |
| Qur'an service down or slow (PR-C)                             | The unavailable line; nothing saved; public pages unaffected                                                                     |
| An old event row has a non-Google link                         | The NOT VALID check leaves it until a person fixes it; saving that event asks for a Google Forms link                            |

## Compatibility and Migration

- One additive migration, applied by a human to staging, then production, before the Release PR. Check queries (release checklist): `select count(*) from public.page_texts;` (expect 18), `select count(*) from public.events where url <> '' and url !~ '^https://(docs\.google\.com/forms/|forms\.gle/)\S+$';` (expect 0, then `alter table public.events validate constraint events_url_google_forms;`; the release checklist's query also lists links with a "." / ".." path part).
- After PR-A is live, editing `content/*.yaml` changes only the sandbox (`content/README.md`).
- Rollback: switch `editorial` back to `yaml` in `src/lib/runtime/wiring.ts`, restore `published_attachment` from `202610070001` and `community_file_in_use` from `202610050003`, then drop the events check, the two tables and the four functions (the tested undo script is in the PR-A pull request).
- Env: none new.

## Parallel Work and Merge Order

```yaml
PR-A: { WP1, WP2, WP3, creates: [migration 202610100001_page_texts, scripts/page-text-seed.mjs, src/lib/content/providers/{supabase,sample}.ts, src/lib/content/page-fields.ts, src/lib/system-text.ts, src/lib/quran/**, src/app/admin/pages/**, src/features/admin/pages/**] }
PR-B: { WP4, WP5, depends_on: [PR-A], potential_conflicts: [Track B public restyles, PR6 DonateLetter] }
PR-C: { WP7, WP6, depends_on: [PR-A] }
```

PR6, the daily check and PR7 run in parallel and also edit `src/lib/runtime/config.ts`, wiring, the release checklist and migrations: whichever merges second keeps both sides; a migration that re-creates `published_attachment`, `community_file_in_use` or `record_activity` starts from the newest version on `integration`. PR6's new `SGU` codes need entries in `systemText.sguCodes` (a test fails otherwise).

## Work Packages

### WP1: Database and seed (PR-A)

Migration, `scripts/page-text-seed.mjs`, `tests/page-texts-migration.test.ts`. Must not allow delete, grant anon writes, or seed `reminders`, `ramadan` or `merch`. Tests: every key seeded and valid; anon read; admin write; full documents logged; a photo named in a document is public and in use; events Google Forms check; the verse library's rules. Done when tests pass and staging has it.

### WP2: Supabase page text, field lists, save rules (PR-A)

Adapters, wiring (`editorial: "supabase" | "sample"`, `quran: "alquran-cloud" | "sample"`), new documents, `pageFields` with an example per box, `pageTextSaveSchema`, `ContentEditor.readPageText/savePageText`, forms `open`/`closed_label`, `isGoogleFormUrl` (also on the event save), `system-text.ts`, `QuranSource` and both adapters, `reminderFor`, the prayer schedule lines in the `prayer` document. Must not read YAML for page text in production, or branch on demo mode. Tests: wiring matrix; adapter over a stub client; save rules; Google Forms cases in TS and SQL; examples present; SGU codes covered; `QuranSource` over recorded responses (2:255, a 3-verse range, a search, a 404, a timeout).

### WP3: Pages screens and History (PR-A)

`/admin/pages`, `/admin/pages/[key]`, `PageTextEditor`, actions, the dashboard card "Pages", the forms screen with the how-to card. Must not write a screen per page, accept unknown keys, or save more than three new photos at once. Tests: e2e edit About team heading and see `/about` change; empty required refused with text kept; restore an earlier version; photo replace; forms link rule; axe light and dark, desktop and phone.

### WP4: Page previews (PR-B)

`src/features/admin/pages/previews.tsx` renders each page's own section components with the typed document; sections written inline in `page.tsx` move unchanged into presentational components. Must not change public styling or duplicate markup.

### WP5: Copy moved out of code (PR-B)

`DonateLetter` (opening only, after PR6's Donate page), `ContactCallingCard`, `CommunityFrontPage`, `Footer` (verse and copyright), every page's verse via `reminderFor`, `FormCtaView` closed line. Must not move PR6's fixed lines into page text.

### WP6: Help, how-to, ADR, docs (PR-C)

Help cards "Edit a page", "Sign-up forms and Google Forms" (tips 1, 2, 5; 4 when full), "Qur'an verses"; ADR 0022; `content/README.md`; guides; roadmap.

### WP7: Qur'an verse picker (PR-C)

`/admin/pages/verses`, `VersePicker.tsx`, `searchVersesAction`, `saveVerseAction` (receives only the reference, fetches the text itself), archive and restore, the per-place "Verse on this page" choice. Must not call the service from the browser or a public page, accept Arabic or meaning text from the form, or store the board's search words.

## Implementation Constraints

- Do not add per-page tables or per-page editors.
- Do not accept HTML or Markdown in page text; never use `dangerouslySetInnerHTML` for board text.
- Do not let the board type or change Qur'an text; public pages never call the Qur'an service.
- Do not keep a fixed label or message in two places; new fixed wording goes in `src/lib/system-text.ts`.
- Do not read page text from YAML in production; do not ask "is this the demo?" in code.
- Do not add delete policies; restore from History instead.
- Do not add a dependency for the Qur'an service (plain `fetch`).
- Must not make product or design choices; new user-visible wording goes to the release checklist's "You or the founder must decide".

## Worker Escalation Conditions

Emit PLAN MISMATCH when api.alquran.cloud's terms, rate limit or response shape change or it asks for a key; when a public section cannot render in the browser without changing its styling (WP4); when PR6 has not merged its Donate page before WP5 touches `DonateLetter`; when a migration must rewrite a policy whose current text differs from the repo; when any change needs a new env variable, secret, bucket or table not listed here.

## Test Strategy

- Unit (`npm test`): `tests/page-text.test.ts` (field lists, examples, save rules, merging, photos, Supabase adapter over a stub, verse placement, SGU codes, Recent changes wording), `tests/quran.test.ts` (recorded responses), `tests/runtime.test.ts` (wiring), `tests/notices.test.ts` (event Google Forms rule).
- Database: `tests/page-texts-migration.test.ts` (PGlite, every migration in order; the TS and SQL Google Forms rules on the same cases).
- E2E (`E2E_DEMO=true`): `tests/e2e/pages.spec.ts`; axe in light, dark and on a phone.
- Manual (staging): edit a page from a phone and see it on the site; restore; replace a photo; check `/faq` follows without a deploy.

## Acceptance Criteria

- The board edits every page text listed under Board Self-Sufficiency Check, including the About team heading and note, from `/admin/pages`, and the public page follows without a deploy.
- A required box left empty is refused with every problem listed and the typed text kept.
- Only Google Forms links are accepted for sign-up forms and event sign-up links, in the app and the database.
- Each page has History with Restore; restoring is logged.
- Every box shows an example placeholder; nothing falls back to text in code.
- PR-B: the Preview tab shows the page itself; PR-C: the board picks each page's verse without typing it.

## Open Risks or Escalations

- **Starter verses (answered 2026-10-05: option C, see the D-24 amendment; kept for history):** the verse library starts empty because 8 of the 9 margin verses in `content/reminders.yaml` are part of a verse (for example 5:2 shows only "And cooperate in righteousness and piety"), while the library stores whole verses as the service gives them (D-24). Until a verse is in the library, the pages that switch to `reminderFor` in PR-B show no verse there. Options for the user: A. keep whole verses (5:2 becomes a long paragraph); B. pick shorter whole verses for those places; C. allow part of a verse (changes D-24). Recorded in the release checklist's decide list.
- **Free Supabase pausing (edge I6):** after PR-A every page's text comes from Supabase; if the free project pauses, every page shows the minimal fallback text.
- **Qur'an service:** free and run by volunteers, no uptime promise; only the dashboard search stops when it is down.
