---
status: approved
mode: full
---

# PR8: Restyle every public page (Quiet Paper)

## Capability

Every public page uses the Quiet Paper layouts from [ADR 0018](../adr/0018-design-direction-quiet-paper.md), built on the PR2 foundation. The legacy token aliases and old page classes are removed. The site is then ready for the Release PR.

## Requested Behavior

- **Home and Prayer** take the layouts the user approved in the D1 prototypes.
- **Events, Donate and About** take the option the user picks from pictures (D-1 to D-3).
- **Community, Resources, Get Involved, FAQ, Support, Merch, Ramadan, Contact, Privacy and the system pages** also take the option the user picks from pictures (one decision per page, added below as the options arrive).
- **Each page's reminder** (level Arabic margin note with "?") is as listed in ADR 0018:
  - Home 13:28, Prayer 4:103, Events and Get Involved 5:2, Community 49:10, Donate 3:92, Resources 96:1 (D-10), Ramadan 2:183; Support is switched off (D-10);
  - About per D-3;
  - FAQ, Merch, Contact, Privacy and the error pages: none.
- **No change** to data, logic, routes, copy, empty, unavailable or demo states, or `/admin`.
- After PR8: remove the legacy token aliases and the dead `design.css` classes, and mark the D1/PR2/PR8 roadmap rows.
- Non-goals: dashboard restyle (after PR3–PR7); new features; copy rewrites.

## Existing System Evidence

- **Foundation (PR2, merged as #28):**
  - `src/styles/tokens.css` (Paper, Green Ink, Dusk, and legacy aliases);
  - `src/shared/ui/*` (Seal, InkRing, PaperLayers, MarginNote, MeaningTip, HijriDate, DhikrOfTheHour, TasbihThread, ThemeToggle, PageHero, Section, ButtonLink, FormCta);
  - `content/reminders.yaml` with `loadReminders()`;
  - Storybook.
- **Pages:** `src/app/{page,about,calendar,calendar/[eventId],community,community/[kind]/[id],contact,donate,faq,get-involved,merch,prayer,privacy,ramadan,resources,support}/page.tsx` and `error.tsx`, `not-found.tsx`, `loading.tsx`.
- **Features:** `src/features/{home,prayer,calendar,community,resources,involve,merch,ramadan}/*`.
- **Approved references:** the D1 prototypes `design/d1-prototypes:src/app/d1/quiet-paper/{page.tsx,prayer/page.tsx,paper.module.css}`, and the option routes for Events, Donate and About (`design/pr8-options-*`, throwaway).
- **Tests:** `tests/e2e/{site,rendering,theme,design}.spec.ts` (axe on all public pages in both themes).

## Owner

- Page layout: each route's `page.tsx` and its `src/features/<area>` components.
- Shared look: `src/shared/ui` and `src/styles/tokens.css`. These are frozen during the page work packages; only the integration package changes them.

## Source of Truth

- Unchanged: content, data adapters and ports, prayer calculation, payments port (Go2Pay), and reminders YAML.
- Styling: tokens only.

## Reuse and Duplication Analysis

- Reused: every PR2 primitive. Page-specific pieces stay in `src/features/<area>`.
- A pattern needed by two or more groups (for example an event-card ink layout) is reported back to the integration package. It then becomes one shared component instead of two copies.
- Removed: the legacy aliases (`--msa-*`, `--design-*`), old page classes in `design.css`, `PhotoPlaceholder` if unused, and `ReviewHero` once Home has its new hero.

## New Abstractions

No new shared abstractions are planned. The integration package may promote a component used by two or more groups into `src/shared/ui`.

## Product Decisions Required

- [x] Which Events layout? (pictures on the options board)
      Options: the 2–3 options from the options run
      Recommendation: given on the board.
      Decision: D-1
- [x] Which Donate layout?
      Options: the 2–3 options from the options run
      Recommendation: given on the board.
      Decision: D-2
- [x] Which About layout, and does About carry 49:10 or no verse?
      Options: the 2–3 options from the options run
      Recommendation: given on the board.
      Decision: D-7 (Chapters, with 49:10 under the board, as in option C)
- [x] Which layout for each of Community, Resources, Get Involved, FAQ, Merch, Ramadan, Contact, and Privacy with the system pages?
      Options: the 2–3 options per page from the second options run
      Recommendation: given on the board.
      Decision: D-4, D-7

## Decisions

- D-1: Events = option C "Almanac": a mini month always open beside event cards. This replaces the separate Month view and the Agenda/Month switch (user, 2026-10-03, accepting that product change; rejected: A Ledger, B Next up).
- D-2: Donate = option C "Letter": one centred sheet, seal, thanks, status, button, 3:92 as the signature (user, 2026-10-03; rejected: A Ink band, B Giving slip).
- D-4: Resources = option A "The Index"; Get Involved = option B "Chooser"; Community = option A "Front page" (user, 2026-10-03).
- D-5: Light theme = **Green Ink**. Paper is removed: Green Ink values become the default light tokens and the `data-light` override is deleted (board decision via the user, 2026-10-03; closes ADR 0018's open light-palette choice and PR2 D-4).
- D-6: Feedback from the board (user, 2026-10-03):
  - Short Arabic verses and dhikr stay on one line (no wrapping when they fit).
    - Amendment (user, 2026-10-05, demo review): one line is preferred for every verse and dhikr; the text shrinks to a readable minimum before it may wrap into two balanced lines, with no empty space reserved (the 26-letter rule is retired; see the PR5b contract's D-24 amendment).
  - The footer's verse (20:114) shows Arabic with the "?" meaning tip, like every other reminder, instead of the English line.
  - The Instagram and Facebook icons use the real brand marks.
  - The "?" meaning bubble shows only the meaning and the reference (surah and verse); the source line is not shown to visitors. Sources stay in `content/reminders.yaml` for review.
- D-7: Remaining picks (user, 2026-10-03): About = option C "Chapters"; FAQ = option B "Folded notes"; Merch = option A "Now Wearing"; Ramadan = option B "Tonight first" (the user said all three were fine); Contact = option A "Calling card" (first picked C "Campus map", then chose A because the Prayer page already shows the walking directions; see D-10); Privacy and the system pages = option B "Ledger". Support: see D-10.
- D-8: Every time of day on the public site shows in 12-hour form with AM/PM (for example "1:30 PM"), never 24-hour (user, 2026-10-03). One shared formatter and one `<time>` wrapper own this; stored values stay `HH:MM` 24-hour, so the data contracts don't change.
- D-9: The tasbih thread must shrink back when page content collapses (an FAQ answer closes). Bug reported by the user, 2026-10-03; fixed in the shared thread.
- D-10: Board answers (user, 2026-10-03):
  - The footer's quick links add **Community** and **FAQ** (rejected: also linking Support; keeping the list as it was).
  - Resources takes **96:1** ("Recite in the name of your Lord who created"), so 20:114 is only the footer's verse (rejected: 39:9; keeping 20:114 twice).
  - **Support is switched off** (`enabled: false` in `content/support.yaml`, so `/support` is not found): SGU has not approved the proposed service, and the user said there is no need to have it if SGU does not offer it. It is not restyled; turning it back on later needs a layout pick first.
  - Contact = option A "Calling card" (replacing C in D-7).
- D-11: Hijri dates appear only with prayer times and Ramadan, always next to the normal (Gregorian) date, never on events, posts, resources or anything the board enters; no visitor calendar setting (user, 2026-10-03; rejected: removing Hijri from Home (B), a Gregorian/Hijri choice for visitors (C)). The "from Maghrib" wording is removed, and the Hijri date changes at midnight with the normal date beside it, like phone calendars and printed timetables, so the two never disagree on screen (user, 2026-10-03, after comparing: rejected changing at sunset with a "from sunset" note, and changing at sunset with no note); this amends ADR 0018's "moves to the next date at Maghrib". Prayer times and Ramadan's Tonight still use the calculated Maghrib. Implementation: `HijriDate` takes the normal date (`date`, from `todayLabel`) and shows it first, the Hijri date the smaller line under it (Home, Ramadan's Tonight sheet; Prayer keeps its "Today · …" heading); the Ramadan eyebrow adds the Gregorian months of the Hijri year in the board's text (`ramadanSpan` in `src/lib/time/hijri.ts`, with `hijri_adjustment`).
  Amended 2026-10-05 (PR5a D-31): Ramadan's heading line shows no Hijri year; Hijri dates stay with prayer times and the calendar.
- D-0: Home and Prayer use the layouts approved in the D1 prototypes and are built now (WP-1, WP-2 without Contact). Every other public page gets 2–3 pictured options first; the user picks each one before it is built (chosen by the user, 2026-10-03, revising an earlier answer that limited options to Events, Donate and About; rejected: building the other pages without options).
- D-12 (user, 2026-10-05; review fixes PR-1): the seal is drawn inside the page, once (`SealSymbol` in the root layout holds `src/shared/ui/seal-art.ts` as one `<symbol>`, and each `Seal` is a same-page `<use>` of it; the art is generated from `public/images/brand/seal.svg` by `node scripts/seal-art.mjs`; `tests/seal-art.test.ts` fails on drift), so `--seal-ink`, `--seal-mint` and `--seal-cream` reach it in every browser: the green ink seal in light, the lighter seal in dark. Home's prayer times are one table (Prayer | Begins | Iqamah, the Prayer page's headings) with fixed, end-aligned time columns. `.editor-form` labels and form fields align to the top and one-line boxes and drop-downs share one height. The Events term filter lists T1–T5.
- Amendment to D-12 (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): the seal is no longer drawn inline. `node scripts/seal-art.mjs` turns `public/images/brand/seal.svg` into one cached file, `public/images/brand/seal-sprite.svg` (`<symbol id="msa-seal">`, each shape's `style` set to `fill:var(--seal-ink|mint|cream, original colour)`), and `src/shared/ui/seal-art.ts` (its address with a hash of the drawing, cached for a year by `next.config.ts`). `SealSymbol` is removed from the root layout and Storybook; `Seal` is an `<svg viewBox="0 0 1170 1170">` with `<use href>` to the file, so the symbol's own box (40 30 1170 1170) is applied once (it was applied twice, which shifted the art and clipped it at the top and left). About 100 KB less HTML on every page. `tests/seal-art.test.ts` checks the sprite, the module and that no page carries the drawing inline.

## Board Self-Sufficiency Check

There are no new board-owned values. Reminders (PR5) and the Hijri adjustment (PR4) remain recorded gaps. Page text stays in `content/*.yaml` behind the editorial source until PR5.

## Design

Each page work package rebuilds its page body in Quiet Paper patterns using the shared primitives. After all page packages merge, the integration package removes the aliases and dead CSS, promotes shared patterns, and runs the full check.

## Public Contract

No API, route, schema or data changes. Only the components' markup and CSS modules change. The feature components keep their props or change them only together with their single caller.

## Private Implementation

Markup structure, CSS module names, and decorative layer placement within the ADR 0018 rules.

## Data and State Flow

Unchanged. Pages keep their loaders, adapters, server clock and caching.

## Failure Modes

All existing empty, unavailable, pending and demo states must render in the new layout. Each page agent lists and screenshots them. If the reminders fail to load, nothing shows (as in PR2).

## Compatibility and Migration

No database changes or settings. Removing the aliases is the last step, after every page uses the new tokens. Rollback: revert the PR.

## Parallel Work and Merge Order

- Page packages WP-1 to WP-7 run in parallel, each in its own worktree branched from `feature/restyle-public`. They touch disjoint files.
- WP-8 (integration) merges them in order WP-1 to WP-7, resolves anything shared, removes the aliases, and runs every check.

## Work Packages

### WP-1: Home

- Purpose: Home in the approved prototype layout (hero with dhikr and Hijri date, verse band 13:28, events, community with 49:10, Donate band with 3:92, tasbih thread).
- Depends on: none.
- Expected files: `src/app/page.tsx`, `src/features/home/*`, `src/features/community/HomeNotice.tsx`.
- Reuse: PR2 primitives; home.yaml copy (D-6 of PR2).
- Required changes: rebuild the body; drop `ReviewHero`.
- Must not: edit `src/shared/**`, tokens, globals, or other features' files.
- Tests: the existing e2e specs stay green; axe in both themes.
- Done when: screenshots at 390 and 1440 in light and dark match the prototype's structure.

### WP-2: Prayer and Contact

- Purpose: Prayer in the approved prototype layout (begins and iqamah table, ring on the next prayer, Hijri date beside "Today", 4:103, Jumu'ah card, written directions); Contact in the same patterns.
- Depends on: none.
- Expected files: `src/app/prayer/page.tsx`, `src/app/contact/page.tsx`, `src/features/prayer/*`.
- Reuse: PR2 primitives; the places port (map box unchanged in behaviour).
- Required changes: rebuild both page bodies.
- Must not: change the map or directions behaviour, the prayer data, or shared files.
- Tests: as WP-1.
- Done when: as WP-1.

### WP-3: Events

- Purpose: the picked Events option (D-1) for the list and the event detail page, with 5:2.
- Depends on: D-1.
- Expected files: `src/app/calendar/**`, `src/features/calendar/*`.
- Reuse: PR2 primitives; existing filters and ICS logic unchanged.
- Required changes: rebuild per the picked option.
- Must not: change filter or ICS logic or shared files.
- Tests: as WP-1, plus the calendar interactions in `site.spec.ts`.
- Done when: as WP-1.

### WP-4: Community and Resources

- Purpose: Community (49:10) and Resources (20:114) in the patterns.
- Depends on: none.
- Expected files: `src/app/community/**`, `src/app/resources/page.tsx`, `src/features/community/*` except `HomeNotice`, `src/features/resources/*`.
- Reuse: PR2 primitives.
- Required changes: rebuild these page bodies.
- Must not: edit shared files or `HomeNotice`.
- Tests: as WP-1.
- Done when: as WP-1.

### WP-5: Get Involved, About, FAQ and Support

- Purpose: Get Involved (5:2), About (per D-3), FAQ (no verse); Support is switched off (D-10).
- Depends on: D-3.
- Expected files: `src/app/{get-involved,about,faq,support}/page.tsx`, `src/features/involve/*`.
- Reuse: PR2 primitives.
- Required changes: rebuild these page bodies.
- Must not: edit shared files or `FAQPreview` (it belongs to WP-1); if FAQ needs it, report back.
- Tests: as WP-1.
- Done when: as WP-1.

### WP-6: Donate, Merch and Ramadan

- Purpose: the picked Donate option (D-2, 3:92, Go2Pay only), Merch (no verse) and Ramadan (2:183).
- Depends on: D-2.
- Expected files: `src/app/{donate,merch,ramadan}/page.tsx`, `src/features/{merch,ramadan}/*`.
- Reuse: the payments port unchanged.
- Required changes: rebuild these page bodies.
- Must not: name any payment channel other than Go2Pay, or edit shared files.
- Tests: as WP-1.
- Done when: as WP-1.

### WP-7: Privacy and system pages

- Purpose: Privacy, `error.tsx`, `not-found.tsx` and `loading.tsx` in the patterns.
- Depends on: none.
- Expected files: `src/app/privacy/page.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/loading.tsx`.
- Reuse: PR2 primitives.
- Required changes: restyle these pages.
- Must not: edit shared files.
- Tests: as WP-1.
- Done when: as WP-1.

### WP-8: Integration and verify

- Purpose: merge WP-1 to WP-7; promote any shared pattern; remove the legacy aliases and dead CSS; run the full check, the e2e suite and Storybook; screenshot every page in light and dark at 390 and 1440; run Lighthouse accessibility; review against this contract; update the docs, roadmap and release checklist.
- Depends on: WP-1 to WP-7.
- Expected files: `src/styles/*`, `src/app/globals.css`, `src/shared/ui/*` (promotions only), docs.
- Reuse: as above.
- Required changes: as in Purpose.
- Must not: change any page's agreed layout.
- Tests: every existing check, plus the screenshots and Lighthouse runs above.
- Done when: all checks pass and the before-and-after board is ready for the user.

## Implementation Constraints

- Tokens only; no raw hex values; no `dark:` variants; no `[data-design]`.
- Scripture and dhikr are always level, never behind other text, never faint wallpaper, and never next to delete or trash UI.
- Do not change copy, data, logic or routes.
- Go2Pay is the only payment channel named.

## Worker Escalation Conditions

- A page needs a shared component change, a copy change, or a data change.
- An existing state cannot be shown in the new layout.
- Axe failures cannot be fixed inside the work package's own files.

## Test Strategy

- `npm run check`, `npm run test:e2e` (theme, site, rendering and design specs) and `npm run build-storybook`.
- Screenshots of every public route at 390 and 1440 in light and dark (before and after).
- Lighthouse accessibility of 100 (mobile) on Home, Prayer, Calendar, Donate and About in both themes.
- A keyboard pass.

## Acceptance Criteria

- Every public page is in Quiet Paper layouts in light and dark, with the assigned reminder.
- No legacy aliases remain.
- All checks pass.
- The user approves the before-and-after board. The Release PR can then be merged by the owner.

## Open Risks or Escalations

- The board's check of the Arabic text and the founders' seal confirmation remain before release.
- Track A may merge dashboard work at the same time: PR8 does not touch `/admin`.
