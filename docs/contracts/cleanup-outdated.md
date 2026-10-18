---
status: done
mode: light
---

# Clean up outdated code, content, media and docs

## Capability

**A repository that only contains what the live site, the sandbox and the roadmap use.** Retired prototype pieces (a preview route, an unrendered banner, a role list that contradicts ADR 0007, a prototype event list, a route video nobody plays, archived QA reports and duplicate reference media) are removed together with their schemas, fallbacks, validators, tests and doc mentions, so the next agent or developer never mistakes them for current behaviour. The local sandbox signs in through the normal form with username `admin` and password `admin` (sample adapter only). Everything tied to the six review themes stays until roadmap item PR8.

## Requested Behavior

User request (2026-10-03): "you can and should delete anything outdated from before and cleanup code as well as any docs etc." Plus: the sandbox `AdminAuth` accepts username `admin` / password `admin` through the normal sign-in form in sample mode only; production must still reject it with the same guards.

Visible to visitors on the live site: nothing changes except four sentences that wrongly promise a route video (see decision A5). Visible on a developer's computer (`npm run demo`): `/demo/prayer-settings` returns 404 and `/admin` shows a username and password form instead of the "Sign in as demo admin" button (decision A6).

Non-goals: no restyle and no change to anything the six themes use (PR8); no change to the D1 prototype branch (`design/d1-prototypes`, worktree `.claude/worktrees/d1`); no ADR edits; no git history rewrite; no new board-editable feature; no Supabase migration; nothing in the ASK list is deleted before the user answers it.

### Inventory by class

Totals: **DELETE 25 items** (19 code/content, 6 docs/media groups; about 87 doc/media files and 45 MB of working tree), **ASK 6 items**, **KEEP-UNTIL 11 items**. Git history keeps every deleted file.

**DELETE: code and content (unreferenced or overridden; evidence in the next section)**

| #   | What                                                                                                                                                                                                                                                                                                                           | Size / scope                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| C1  | `/demo/prayer-settings` route: `src/app/demo/prayer-settings/page.tsx` (and the empty `src/app/demo/` folder)                                                                                                                                                                                                                  | 1 file; approved by user (D-1)                                                                            |
| C2  | `DeploymentProfile.editorPreview` in `src/lib/runtime/wiring.ts` plus its two assertions in `tests/runtime.test.ts` (lines 398, 410)                                                                                                                                                                                           | only C1 reads it                                                                                          |
| C3  | The `/demo/prayer-settings` block in `tests/e2e/themes.spec.ts` (lines 43-47); the rest of the spec is KEEP-UNTIL PR8                                                                                                                                                                                                          | 5 lines                                                                                                   |
| C4  | `src/shared/layout/AnnouncementBar.tsx`                                                                                                                                                                                                                                                                                        | never imported; D0 decision D7 rejected a separate banner setting in favour of Urgent announcements (PR5) |
| C5  | `PendingNote` export in `src/shared/ui/Meta.tsx`                                                                                                                                                                                                                                                                               | never used                                                                                                |
| C6  | The `admin` editorial document: `content/admin.yaml`, `adminSchema`/`AdminContent` in `src/lib/content/schemas.ts`, the `admin` entry in `src/lib/content/documents.ts`, `getAdmin` in `src/lib/content/index.ts`                                                                                                              | no consumer; its eight-role permission list contradicts ADR 0007 (equal admins + two permissions)         |
| C7  | `content/integrations.yaml` `drive` and `calendar` sections and `payments.enabled`/`payments.provider`, with their schema fields and fallback                                                                                                                                                                                  | only `payments.leaving_site_notice` is read; answers release-checklist confirmation item (line 82)        |
| C8  | `content/events.yaml` prototype `events` list (21 entries) and `disclaimer`; `eventsFileSchema.events`/`.disclaimer`; `publicEvents()` and its re-export; the events checks in `scripts/validate-content.ts`; the dead disclaimer block in `src/app/calendar/page.tsx` (lines 51-60) and `disclaimer: null` in `managedEvents` | `managedEvents()` replaces the list and forces the disclaimer to null                                     |
| C9  | `content/prayer.yaml` `times`, `last_updated`, `last_updated_label`, `notice`; `prayerSchema.last_updated`                                                                                                                                                                                                                     | `managedPrayer()` overrides the other three; `last_updated` is read nowhere                               |
| C10 | `content/jumuah.yaml` `gatherings`                                                                                                                                                                                                                                                                                             | overridden by `managedPrayer()`                                                                           |
| C11 | `content/newsletters.yaml` `issues`                                                                                                                                                                                                                                                                                            | overridden by `managedNewsletters()`                                                                      |
| C12 | `content/musallah.yaml` `route.video` block, `musallahSchema.route.video`, `video: null` in the musallah fallback                                                                                                                                                                                                              | no component renders it (the player was retired to `docs/archive/source/route-video.tsx.txt`)             |
| C13 | `public/video/musallah-route.mp4` and the unused `.media-frame` rules in `src/app/globals.css` (lines 282-296)                                                                                                                                                                                                                 | 12.6 MB; user decision D-2                                                                                |
| C14 | `content/site.yaml` `announcement` block and `siteSchema.announcement`                                                                                                                                                                                                                                                         | never rendered (only consumer was C4); D7                                                                 |
| C15 | `content/site.yaml` `poc_mode`, its schema field and fallback, and `\|\| site.poc_mode` in `src/app/support/page.tsx` line 25                                                                                                                                                                                                  | redundant: `support.prototype_notice` is `true`, so the notice still shows                                |
| C16 | `hero.compact` in `heroSchema` and the eight `compact: true` YAML lines                                                                                                                                                                                                                                                        | pages pass `compact` themselves; the YAML value is never read                                             |
| C17 | `googleEnabled` prop and the disabled "Continue with Google" stub in `src/features/admin/SignInForm.tsx`                                                                                                                                                                                                                       | always `false`; no ADR plans Google sign-in (ADR 0007: email and password)                                |
| C18 | `.content-shell` and `.rule-gold` in `src/app/globals.css`                                                                                                                                                                                                                                                                     | no element uses them                                                                                      |
| C19 | `DemoSignInForm`, `demoSignInAction` and the `"demo"` variant of `AdminAuth.signIn`                                                                                                                                                                                                                                            | replaced by admin/admin (D-3); conditional on decision A6 = replace                                       |

**DELETE: docs and media**

| #   | What                                                                                                                                                                                                                                                                                                                                                                              | Size                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| X1  | `docs/archive/notes/` except `PAYMENTS_PROPOSAL.md`, `MERCH_DECISIONS.md` (A4) and `ASSET_MANIFEST.md` (K3): ADMIN_PREVIEW, ARCHITECTURE, CHANGELOG_POC, CONTENT_EDITING_POC, DESIGN_OPTIONS, DESIGN_REVIEW, DESIGN_SYSTEM_HANDOFF, DEVELOPMENT, FOUNDER_CALL_CHECKLIST, IMPLEMENTATION_REPORT, INTEGRATIONS, MEETING_DEMO, OWNER_SETUP, ROUTE_INVENTORY, design-review.html      | 15 files, about 150 KB      |
| X2  | `docs/archive/qa/**` (5 QA reports, `design/`, `modernization/`, 44 screenshots)                                                                                                                                                                                                                                                                                                  | 61 files, 22 MB             |
| X3  | `docs/archive/reviews/2026-09-11.md`                                                                                                                                                                                                                                                                                                                                              | 1 file                      |
| X4  | `docs/archive/source/*.txt` (route-video, tide-hero, google-embed-validator and its test)                                                                                                                                                                                                                                                                                         | 4 files; retired components |
| X5  | Byte-identical duplicates (checked with `cmp`): `docs/archive/assets/extracted/00_reference_poc/` (= originals POC PNGs), `extracted/01_brand/sgu-msa-logo-source.jpeg` (= `originals/logo msa.jpeg`), `extracted/10_newsletter_assets/msa-newsletter-spring-source.pdf` and `originals/MSA Newsletter Spring.pdf` (both = live `public/documents/msa-newsletter-april-2026.pdf`) | 6 files, 9.9 MB             |
| X6  | `.plans/data-providers.md` (local, gitignored): superseded by `docs/contracts/data-providers.md` (status done)                                                                                                                                                                                                                                                                    | local only                  |

**ASK** (unchecked decisions below): A1 Facebook photo archive, A2 original route video recording, A3 founder design inputs, A4 payments proposal pinned by ADR 0005, A5 route-video wording on the live site, A6 sandbox sign-in replace or alongside.

**KEEP-UNTIL**

| #   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Removed by                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Six themes: `src/config/design.ts`, `design-keys.ts`, `src/styles/design.css` (including its dead Tide hero rules `.design-hero`, `.hero-layout`, `.hero-story` and friends), `src/styles/review.css` (including `.content-shell` selectors), `ReviewHero`, `scripts/review.mjs`, `tests/e2e/themes.spec.ts`, `tests/e2e/design.spec.ts`, `SITE_DESIGN`, the six `@fontsource-variable/*` packages, and the six-theme sentences in README, AGENTS.md, developer guide, release checklist and skills | PR8 (D-4)                                                                                                                                            |
| K2  | `content/home.yaml` hero text (`eyebrow`, `headline`, `emphasis`, `body`, CTAs, `aside`), unread on `integration` because `ReviewHero` uses `design.ts` copy                                                                                                                                                                                                                                                                                                                                        | D1 then PR8: the D1 prototypes on `design/d1-prototypes` render exactly these fields (`src/app/d1/_lib/view.ts` `hero: home.hero`)                   |
| K3  | Inherited photos in `public/images/**` (34 webp, about 2.1 MB, incl. the unreferenced `home/hero-campus-dusk.webp`) and their provenance/consent record `docs/archive/notes/ASSET_MANIFEST.md`                                                                                                                                                                                                                                                                                                      | D1 then PR8: `SafeImage` shows placeholders for them today, but their paths drive the placeholder briefs and the D1 prototypes display three of them |
| K4  | `docs/proposals/go2pay.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | PR6 (open Go2Pay questions; linked from ADR 0005, ADR 0006, README, release checklist)                                                               |
| K5  | `content/events.yaml` `terms` and the calendar Term and Category filters (dashboard events are always category `msa` with no term, so those filters cannot match)                                                                                                                                                                                                                                                                                                                                   | PR5 (event fields and status); flagged in Open Risks                                                                                                 |
| K6  | `.plans/d0-board-task-inventory.md` (local, gitignored)                                                                                                                                                                                                                                                                                                                                                                                                                                             | after the PR3-PR7 contracts are written                                                                                                              |
| K7  | `MUSALLAH_*` variables and the `config` places adapter                                                                                                                                                                                                                                                                                                                                                                                                                                              | PR7                                                                                                                                                  |
| K8  | `DONATION_URL` and the `link`/`off` payments adapters                                                                                                                                                                                                                                                                                                                                                                                                                                               | PR6                                                                                                                                                  |
| K9  | Permanent minute corrections in the prayer editor                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PR4                                                                                                                                                  |
| K10 | `content/*.yaml` and the YAML editorial adapter as a whole                                                                                                                                                                                                                                                                                                                                                                                                                                          | PR5                                                                                                                                                  |
| K11 | `public/documents/msa-newsletter-april-2026.pdf`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | not outdated: the live Resources page links it (`content/resources.yaml` line 30)                                                                    |

## Existing System Evidence

- `src/app/demo/prayer-settings/page.tsx`: gated by `deploymentProfile().editorPreview`; the only reader of that field (`grep editorPreview` hits only `wiring.ts`, this page, `tests/runtime.test.ts`, docs). `PrayerEditor` stays: `src/app/admin/prayer-times/page.tsx` uses it. Referenced in `tests/e2e/themes.spec.ts:43`, `docs/release-checklist.md:41,83`, `docs/contracts/data-providers.md` (history).
- `src/shared/layout/AnnouncementBar.tsx`: no importer (import scan over `src`, `tests`, `scripts`); `.plans/d0-board-task-inventory.md` row 18 records D7 "No separate banner setting ... The YAML `announcement` bar is never rendered". Named in `.claude/skills/designing-ui-components/SKILL.md:54` and `.claude/skills/core-web-vitals-optimization/SKILL.md:42`.
- `src/lib/content/index.ts:39` `getAdmin`: zero callers. `content/admin.yaml` roles (`super_admin`, `treasurer`, ...) contradict `docs/adr/0007-people-and-permissions.md`. Only generic loops (`editorialKeys` in `scripts/validate-content.ts`, `tests/editorial.test.ts`) touch it.
- `src/lib/integrations/payments/index.ts` `paymentsLeavingNotice()`: the only reader of `getIntegrations()`, and it reads only `payments.leaving_site_notice` (used by `src/app/ramadan/page.tsx:36`).
- `src/lib/community/managed.ts`: `managedEvents()` returns `{...getEvents(), events: records, disclaimer: null}`; `managedPrayer()` overrides `times`, `last_updated_label`, `notice` and `jumuah.gatherings`; `managedNewsletters()` overrides `issues`. `publicEvents()` (`src/lib/content/documents.ts`) is called only by `scripts/validate-content.ts`.
- Display types stay: `PrayerContent["times"]` (`src/features/prayer/PrayerTimes.tsx`, `src/features/ramadan/TonightPanel.tsx`), `JumuahContent["gatherings"]` (`JumuahCard.tsx`, `PrayerSummary.tsx`), `NewslettersContent` (`NewsletterArchive.tsx`), `SiteEvent` (calendar UI, `src/lib/calendar/ics.ts`). Those schema fields already default to `[]`/null, so removing the YAML data needs no schema change.
- `src/lib/content/schemas.ts` `musallahSchema.route.video` (lines 219-229): no reader in `src`; `src/app/prayer/page.tsx:95` comment "Without a video the directions take the full width". `content/musallah.yaml:15` is the only reference to `/video/musallah-route.mp4`. Roadmap PR7 already lists "route video removed".
- Stale live copy promising a video: `content/musallah.yaml:11` subheading (rendered as the section intro on `/prayer`), `content/faq.yaml:17`, `content/resources.yaml:73`, `src/app/contact/page.tsx:37`.
- `src/app/support/page.tsx:25` `support.prototype_notice || site.poc_mode`: `content/support.yaml:14` sets `prototype_notice: true`.
- `heroSchema.compact` (`schemas.ts:113`): no `.compact` read; pages pass `compact` literally (`src/app/prayer/page.tsx:46`, `resources/page.tsx:34`, ...).
- `src/shared/ui/SafeImage.tsx`: renders only `/media/` and `/images/approved/` sources; everything else in `public/images` becomes a `PhotoPlaceholder` with a brief derived from the path (`src/lib/media/shot-list.ts`). `public/images/home/hero-campus-dusk.webp` has no reference (`git log -S hero-campus-dusk`: last reference removed in `140540b`).
- Sandbox sign-in: `src/lib/backend/providers/contract.ts` `AdminAuth.signIn(input: {email,password} | "demo")`; `src/lib/backend/providers/sample.ts` `createSampleAdminAuth` accepts only `"demo"`; `src/lib/backend/providers/supabase.ts:153` rejects `"demo"`; `src/features/admin/actions.ts` `signInAction` (zod `z.email()`, error "Enter a valid email and password.") and `demoSignInAction`; `src/features/admin/SignInForm.tsx` (`type="email"` input, `DemoSignInForm`); `src/app/admin/page.tsx` branches on `deploymentProfile().adminPortal === "sample"`. `src/lib/demo/fixtures.ts` `demoAdmin` is the sandbox identity.
- Production guards (unchanged): `src/lib/runtime/config.ts:138` rejects `SITE_DEMO_MODE=true` on Vercel Production; `planWiring` throws for sample adapters in production (`src/lib/runtime/wiring.ts`); `adminClient()` returns null unless `adminPortal === "ready"` (`src/lib/backend/server.ts:10`).
- Tests naming the demo button: `tests/e2e/demo.spec.ts:41-47` (asserts no password input, clicks "Sign in as demo admin"), `tests/editor.test.ts:209-223` (`rejectsCredentialsOrDemo`). Docs: `docs/guides/developer.md:38`, `docs/architecture.md:99,143`, `docs/release-checklist.md:18,41,44,50,80`, `docs/contracts/data-providers.md` D-6 (history).
- Links into the archive: `docs/adr/0005-payments-channel-policy.md:20` links `archive/notes/PAYMENTS_PROPOSAL.md` (ADRs are immutable, ADR 0001), which links `MERCH_DECISIONS.md`; `content/README.md:7` links `CONTENT_EDITING_POC.md`; `.claude/skills/applying-design-styles/SKILL.md:403` names the Coastal brief PDF; `.claude/skills/planning-engineering-changes/references/engineering-principles.md:43`, `README.md:32,45-46`, `AGENTS.md:94`, `docs/guides/developer.md:158,272,274`, `tests/documentation.test.ts:96`, `tests/agent-config.test.ts:222` mention `docs/archive`. `tests/documentation.test.ts` fails on any broken local Markdown link.
- D1 overlap: `git diff integration...design/d1-prototypes` adds only `src/app/d1/**`, three `src/shared/ui` files and one dependency; it reads `home.hero`, `site.footer`, `musallah.route.heading/directions`, `musallah.facilities`, `home.contribution` and three `public/images` photos. None of those are deleted here.
- `git log --oneline -5`: last merged work is WP-7 (`1a9df2f`); no other open branch touches these files.

## Owner

One cleanup PR against `integration`, owned by one agent. Each item keeps its existing owner: editorial documents `src/lib/content/**` + `content/*.yaml`; runtime policies `src/lib/runtime/wiring.ts`; sign-in `src/lib/backend/providers/**` (port and adapters) with `src/features/admin/actions.ts` and `SignInForm.tsx`; sample credentials `src/lib/demo/fixtures.ts`; shared UI `src/shared/**`; docs per the docs map in `AGENTS.md`.

## Source of Truth

- Editorial shapes: zod schemas in `src/lib/content/schemas.ts` and the documents table in `src/lib/content/documents.ts`; YAML files hold only fields a schema declares and a page reads.
- Operational data (events, prayer, Jumu'ah, newsletters): Supabase rows behind `ContentProvider`, shaped by `src/lib/community/managed.ts`; the YAML copies removed in C8-C11 were never authoritative.
- Sandbox credentials: one constant in `src/lib/demo/fixtures.ts`, read only by the sample `AdminAuth`. The production guarantee stays in `config.ts` (build refuses demo mode in production) and `planWiring` (no sample adapter in production); the Supabase adapter and the live form's email validation are a second line.
- Implementation status: `docs/roadmap.md`; release notes: `docs/release-checklist.md` Unreleased.

## Product Decisions Required

- [x] Remove the `/demo/prayer-settings` preview route.
      Decision: D-1
- [x] Remove the web route video `public/video/musallah-route.mp4`.
      Decision: D-2
- [x] Sandbox accepts username `admin` / password `admin` through the normal sign-in form, sample mode only; production rejects it with the same guards.
      Decision: D-3
- [x] Everything tied to the six old themes stays until PR8.
      Decision: D-4
- [x] A1. Facebook photo archive: `docs/archive/assets/originals/Sgu Msa _PHOTOS.pdf` (15.5 MB), `Sgu Msa _ Facebook.pdf` (5.7 MB), `Sgu Msa Reels _ Facebook reels.pdf` (4.0 MB) and the 403 photos extracted from them in `extracted/99_full_archive/` with `manifest.tsv` (14 MB); about 39 MB. It is the MSA's own photo record and could seed a dashboard media library, but it includes children (outreach visit), named board headshots and close-up banquet portraits that ASSET_MANIFEST says must not be published without consent.
      Options: (a) the owner copies it to the MSA's shared Drive, then it is deleted from the repo; (b) delete without a copy (git history only); (c) keep it in the repo.
      Recommendation: (a). Photos of minors and named students do not belong in a code repository; the club Drive is the right home for a media library source, and git history remains a fallback.
      Decision: D-5
- [x] A2. Original route video recording `docs/archive/assets/originals/musallah Route Video.37.41.mp4` (27.8 MB phone video; the 12.6 MB web copy is deleted per D-2).
      Options: (a) copy to the MSA Drive, then delete from the repo; (b) delete (git history only); (c) keep.
      Recommendation: (a). PR7 replaces the video with a map; a raw recording is media, not source.
      Decision: D-6
- [x] A3. Founder design inputs: `docs/archive/source/SGU_MSA_Coastal_Heritage_POC_Brief.pdf` (0.7 MB) and `SGU_MSA_Website_Design_and_Commerce_Brief.pdf` (2.3 MB), the three POC screenshots in `docs/archive/assets/originals/` (5.7 MB; the identical copy is X5) and the logo source `originals/logo msa.jpeg` (9 KB). The `applying-design-styles` skill points at the Coastal brief; D1 (design direction) is in progress and PR2 needs a logo source for the SVG.
      Options: (a) keep until D1 is chosen and PR2's logo SVG exists, then copy to the Drive and delete; (b) delete now (git history only); (c) keep permanently.
      Recommendation: (a). They state the founder's intent while the direction is being chosen.
      Decision: D-7
- [x] A4. `docs/archive/notes/PAYMENTS_PROPOSAL.md` and `MERCH_DECISIONS.md` (it links that file). ADR 0005 links PAYMENTS_PROPOSAL, ADRs may not be edited (ADR 0001), and a broken link fails `tests/documentation.test.ts`. MERCH_DECISIONS also lists the merch reservation and pickup questions PR6 may need.
      Options: (a) keep both files in place; (b) delete both and let ADR 0005's link sentence be changed as a one-time exception you approve; (c) delete both and write a superseding ADR 0018 without the link.
      Recommendation: (a). Two small files are cheaper than bending ADR immutability.
      Decision: D-8
- [x] A5. Wording that promises a route video on the live site (no video has played since the player was retired). Proposed replacements: `content/musallah.yaml` route subheading "Follow the written directions below from the Charter Hall bus stop."; `content/faq.yaml` musallah-location answer "The Musallah is a short walk from the Charter Hall bus stop. The Prayer & Musallah page has step-by-step written directions."; `content/resources.yaml` finding-the-musallah description "A walking route from the Charter Hall bus stop, with step-by-step written directions."; `src/app/contact/page.tsx` card text "Follow the written directions on the Prayer & Musallah page. Exact map, parking, and accessibility details are awaiting confirmation."
      Options: (a) use the proposed sentences; (b) give your own wording; (c) leave the copy until PR5 moves page text to the dashboard.
      Recommendation: (a). The current sentences are false today.
      Decision: D-9
- [x] A6. Sandbox sign-in form: replace the "Sign in as demo admin" button, or keep it next to the new form? And the sandbox wording: field label "Username" (placeholder "admin") and note "This is the local sandbox with sample data. Sign in with username admin and password admin to try the board dashboard. Changes show on this computer's demo site only and are erased when the demo restarts."
      Options: (a) replace the button, use the proposed wording; (b) keep the button alongside the form; (c) replace, with your own wording.
      Recommendation: (a). One sign-in path that looks like the live one, and the `"demo"` port variant (C19) disappears.
      Decision: D-10

## Decisions

- D-1: Remove `/demo/prayer-settings` and its components that nothing else uses (chosen by user, 2026-10-03; option rejected: keep it as a read-only preview, asked in `docs/release-checklist.md:83`).
- D-2: Remove `public/video/musallah-route.mp4` now rather than in PR7 (chosen by user, 2026-10-03; option rejected: keep until PR7).
- D-3: The sandbox signs in through the normal form with username `admin` / password `admin`, sample adapter only; production guards unchanged (chosen by user, 2026-10-03; option rejected: button-only sandbox sign-in of data-providers D-6). This amends data-providers D-6 for the sign-in method only.
- D-4: Anything referencing the six old themes stays until PR8 (chosen by user, 2026-10-03; option rejected: remove theme code now).
- D-5: Delete the Facebook photo archive (3 PDFs + 403 extracted photos) from the repo now; git history keeps it (user, 2026-10-03; rejected: copy to Drive first, keep in repo).
- D-6: Delete the original route video recording now (user, 2026-10-03; rejected: copy to Drive first).
- D-7: Keep the founder design inputs (2 brief PDFs, 3 mockup screenshots, logo source) until D1 is decided and the logo SVG exists (user, 2026-10-03; rejected: delete now).
- D-8: Keep `docs/archive/notes/PAYMENTS_PROPOSAL.md` and `MERCH_DECISIONS.md` because ADR 0005 links them and ADRs are immutable (planner recommendation, accepted 2026-10-03).
- D-9: Replace the false route-video wording with the proposed sentences and keep short written directions; they become an optional board-editable field in PR5/PR7 once the map works (user, 2026-10-03; rejected: map only now, remove text after map).
- D-10: Replace the "Sign in as demo admin" button: one sign-in form everywhere; in the sandbox it accepts username `admin` / password `admin` (label "Username", placeholder "admin", proposed note wording); production rejects it (user, 2026-10-03; rejected: keep both).

## Board Self-Sufficiency Check

No board-facing capability is added or removed. The deletions remove YAML that looked like configuration but did nothing (`admin.yaml` roles and dashboard modules, `integrations.yaml` Drive/Calendar links, the `site.yaml` announcement bar, prototype events, prayer times, Jumu'ah and newsletters that the dashboard already overrides), so nobody will edit a file expecting a change on the site. The remaining YAML page text is the known PR5 gap already on `docs/roadmap.md`. The Urgent banner a board member needs is PR5 decision D7 (an announcement priority in `/admin`), not a YAML switch. The sandbox credentials are developer-only and never reach the live site.

## Design

Smallest coherent change: delete, never move or rename. Keep display schemas whose data now comes from `managed.ts`; remove schema fields only where nothing reads them.

Sandbox sign-in (assuming A6 = replace):

```text
/admin (sample portal)          /admin (live portal, unchanged)
SignInForm sandbox=true          SignInForm sandbox=false
  text input "Username"            email input "Email"
        |                                 |
        +--------- signInAction ----------+
                   zod: sample portal -> non-empty string, max 254
                        live portal   -> z.email(), max 254 (same error copy)
                   adminAuth().signIn({ email, password })
                        |                         |
            sample AdminAuth                 Supabase AdminAuth
            ok only for admin/admin          invalid when email is not an email
            (constant in demo/fixtures.ts)   (no network call), else unchanged
```

Port: `AdminAuth.signIn(input: { email: string; password: string })` (the `"demo"` variant goes). In the sandbox the `email` field carries the username; the port doc comment says so.

## Work Packages

### WP-1: Code and content removal (C1-C18)

- Depends on: nothing.
- Files: `src/app/demo/prayer-settings/page.tsx`, `src/lib/runtime/wiring.ts`, `tests/runtime.test.ts`, `tests/e2e/themes.spec.ts`, `src/shared/layout/AnnouncementBar.tsx`, `src/shared/ui/Meta.tsx`, `content/{admin,integrations,events,prayer,jumuah,newsletters,musallah,site}.yaml` and the eight files with `compact: true`, `src/lib/content/{schemas,documents,index}.ts`, `scripts/validate-content.ts`, `src/lib/community/managed.ts`, `src/app/calendar/page.tsx`, `src/app/support/page.tsx`, `src/features/admin/SignInForm.tsx`, `src/app/admin/page.tsx`, `src/app/globals.css`, `public/video/musallah-route.mp4`.
- Required changes: as listed in the DELETE table. `validate-content.ts` keeps the forms check and drops the duplicate-id and no-public-events checks and the events count from its success line. Update YAML header comments that describe removed fields (`content/events.yaml` visibility block, `content/musallah.yaml` line 2). Remove the unused `Info` import if the calendar disclaimer was its only use.
- Done when: `npm run check` and `npm run validate:content` pass and the grep in Test Strategy is clean.

### WP-2: Sandbox sign-in admin/admin (C19, after A6)

- Depends on: A6.
- Files: `src/lib/backend/providers/{contract,sample,supabase}.ts`, `src/lib/demo/fixtures.ts`, `src/features/admin/actions.ts`, `src/features/admin/SignInForm.tsx`, `src/app/admin/page.tsx`, `tests/editor.test.ts`, `tests/e2e/demo.spec.ts`.
- Required changes: add `sandboxCredentials = { username: "admin", password: "admin" }` beside `demoAdmin`; sample `signIn` returns `"invalid"` unless both match, then sets the existing cookie; Supabase `signIn` returns `"invalid"` before any network call when `input.email` fails `z.email()`; `signInAction` picks its zod schema from `deploymentProfile().adminPortal`; `SignInForm` takes `sandbox: boolean` (text input, label and placeholder from A6) and keeps `name="email"`; the admin page renders the A6 note plus `SignInForm sandbox`. If A6 = alongside, keep `DemoSignInForm`/`demoSignInAction` and the `"demo"` variant and only add the form.
- Done when: the sandbox signs in with admin/admin, rejects anything else with the existing "Sign-in unsuccessful" message, and the live form is byte-for-byte the same apart from C17.

### WP-3: Archive and duplicate media (X1-X5, then the answered ASK items)

- Depends on: nothing for X1-X5; A1-A4 for the rest.
- Required changes: `git rm` the listed paths. Keep `PAYMENTS_PROPOSAL.md`, `MERCH_DECISIONS.md`, `ASSET_MANIFEST.md` and every A1-A3 file until answered. Delete `.plans/data-providers.md` locally (X6).
- Done when: `tests/documentation.test.ts` passes (no broken links).

### WP-4: Docs, skills and release notes

- Depends on: WP-1 to WP-3.
- Required changes: `README.md` lines 32 and 45-46 and `AGENTS.md` line 94 (describe `docs/archive` only if files remain); `docs/guides/developer.md` lines 38 (admin/admin), 73 ("16" documents), 79 (drop `editorPreview`), 152 ("legacy assets preserved" line), 158, 272, 274; `content/README.md` (drop "retained prototype records" and the archive link); `docs/architecture.md` lines 99 and 143; `docs/guides/photography.md` line 3 (video already removed); `docs/roadmap.md` PR7 (drop "route video removed"); `tests/documentation.test.ts:96` message and `tests/agent-config.test.ts:222` comment; skills `designing-ui-components/SKILL.md:54` and `core-web-vitals-optimization/SKILL.md:42` (drop AnnouncementBar), `planning-engineering-changes/references/engineering-principles.md:43` ("git history" instead of `docs/archive/` if the archive is gone), `applying-design-styles/SKILL.md:403` only per A3 (project-notes section only; vendored skill). `docs/release-checklist.md` Unreleased: rewrite lines 15, 18, 41, 44, 50, 80 for the new sandbox sign-in and the removed route; delete the answered confirmation items at lines 82 and 83; add one "What changed" entry and a "How to test" step for this cleanup. `docs/contracts/data-providers.md`: append one line under Decisions noting D-6's sign-in method is amended by this contract (no other edits).
- Done when: no current doc describes a removed file, route, field or button.

## Implementation Constraints

- Do not delete or edit anything listed under KEEP-UNTIL, including `content/home.yaml` hero fields, `public/images/**`, `src/config/design*.ts`, `src/styles/design.css`, `src/styles/review.css`, `ReviewHero`, or the rest of `tests/e2e/themes.spec.ts`.
- Do not delete any A1-A6 item, or apply any A5 wording, before the user answers.
- Do not edit any file in `docs/adr/`; do not rewrite git history or run `git filter-repo`.
- Do not touch `.claude/worktrees/d1` or the `design/d1-prototypes` branch.
- Must not change the live sign-in form's label, input type, placeholder, button text or error messages (beyond removing the Google stub, C17).
- Must not add a new auth helper, env variable, config field, `DeploymentProfile` field or second sign-in action; do not read `deploymentProfile()` or `@/lib/runtime/*` from a client component.
- Must not weaken a production guard: `config.ts` demo rejection, `planWiring` throw, `adminClient()` null on the sample portal stay as they are.
- Do not remove display-type fields from `prayerSchema`, `jumuahSchema`, `newslettersSchema` or `eventSchema` that components still type against.
- Do not edit `docs/contracts/data-providers.md` beyond the single amendment line.
- If any target turns out to be referenced (for example a new import appears on `integration`), stop and emit `PLAN MISMATCH`.

## Test Strategy

- `npm run check` (lint, typecheck, unit tests incl. `tests/editorial.test.ts`, `tests/documentation.test.ts`, `tests/agent-config.test.ts`, format) and `npm run validate:content`.
- Unit, `tests/editor.test.ts`: replace `rejectsCredentialsOrDemo` with: sample `AdminAuth` returns `"invalid"` for admin/wrong, wrong/admin and `someone@example.invalid`/anything; Supabase `AdminAuth` returns `"invalid"` for admin/admin without a network call. `tests/runtime.test.ts`: profile assertions without `editorPreview`; production still throws for sample wiring.
- E2E sandbox (`E2E_DEMO=true`, `npm run demo`): `tests/e2e/demo.spec.ts` fills Username admin and Password admin, clicks Sign In, reaches the dashboard, edits an event as today; a wrong password shows the "Sign-in unsuccessful" alert; `/demo/prayer-settings` returns 404.
- E2E themes (`E2E_REVIEW=true`, `npm run review`): `tests/e2e/themes.spec.ts` passes without the removed block.
- Build guard: `npm run build` with live settings passes; the existing config test for `SITE_DEMO_MODE=true` with `VERCEL_ENV=production` still fails the build.
- Grep gate: `grep -rn "demo/prayer-settings\|editorPreview\|getAdmin\|AnnouncementBar\|PendingNote\|musallah-route.mp4\|poc_mode\|googleEnabled\|DemoSignInForm\|demoSignInAction\|Sign in as demo admin" src tests scripts content docs README.md AGENTS.md .claude/skills` returns only `docs/contracts/data-providers.md` (history).
- Manual: open `/prayer`, `/faq`, `/resources`, `/contact`, `/support`, `/calendar`, `/ramadan` and the home page on `npm run dev`; they look the same except the A5 sentences.

## Acceptance Criteria

- On the live site every page looks and behaves as before; the only visible differences are the A5 sentences, and no page mentions a route video.
- The Support page still shows the "Proposed Student Support Service" label and governance notice.
- In `npm run demo`, `/admin` shows a Username and Password form; admin/admin opens the dashboard, any other pair shows "Sign-in unsuccessful. Check your credentials or try again later."; `/demo/prayer-settings` shows the 404 page.
- On the live site `/admin` shows the same Email and Password form as before, and admin/admin is rejected.
- `public/video/` is gone; `docs/archive/` holds only the files kept by A1-A4 and K3; the repository working tree is about 45 MB smaller before the ASK items (up to about 112 MB more if A1-A3 are deleted).
- A developer reading README, AGENTS.md, the developer guide, `content/README.md` or the skills finds no reference to a removed file, route, YAML field or button.

## Open Risks or Escalations

- Six ASK decisions (A1-A6) are unanswered; WP-1 and the X items of WP-3 can proceed without them, WP-2 needs A6.
- Light mode was requested, but WP-2 changes the `AdminAuth` port signature (sample path only). If the reviewer treats that as an auth change under the light-mode exclusions, split WP-2 into its own full contract.
- Deleting files does not shrink the git repository: history still holds about 105 MB of archive media. Shrinking it means a history rewrite and a force push to shared branches, a separate owner decision not proposed here.
- The D1 prototype branch was cut before the data-providers work (merge base `e72dae7`) and already imports removed modules (`@/lib/demo/mode`, `@/lib/community/adapters`); this cleanup does not add conflicts with it, but whoever revives D1 code must rebase it.
- K5: the calendar Term and Category filters offer choices that no dashboard event can match; PR5's event contract should decide whether events gain a category/term or the filters go.
- `docs/release-checklist.md` Unreleased already describes the demo button for not-yet-released work; WP-4 rewrites those lines in place rather than appending a contradiction.
