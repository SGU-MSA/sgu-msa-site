---
status: approved
mode: full
---

# PR2: Design-system foundation (Quiet Paper)

## Capability

The site gets one design system for the chosen direction ([ADR 0018](../adr/0018-design-direction-quiet-paper.md)):

- Quiet Paper tokens for light and dark;
- a remembered theme switch;
- the new fonts;
- shared primitives for the Arabic reminders, the Hijri date and the seal;
- a restyled header and footer;
- Storybook documenting all of it.

The six old review themes are retired.

## Requested Behavior

- Every public page shows Quiet Paper colours and fonts in light and dark, through aliases from the old token names. Page layouts are reworked later in PR8.
- The header and footer are the new Quiet Paper chrome. The header has the round theme switch (Magic UI), which follows the device until tapped and is remembered on the device, with no flash on load.
- New shared primitives, ready for PR8:
  - `Seal`, `InkRing`, `PaperLayers`;
  - `MarginNote`, `DhikrOfTheHour`, `TasbihThread`;
  - `MeaningTip` (the "?" toggletip);
  - `HijriDate` with its moon;
  - `ThemeToggle`, `BlurFade`, `NoiseTexture`.
- Home shows the dhikr of the hour, the Hijri date and the tasbih thread in its existing layout. Other pages get their reminders in PR8.
- Storybook (`npm run storybook`) shows every shared primitive in light and dark, plus a tokens page.
- The six review themes, `SITE_DESIGN` and `npm run review` are removed.
- Non-goals:
  - page-body layouts (PR8), except the Home headline source (D-6);
  - the dashboard restyle (after PR3–PR7);
  - the Hijri ±1 day adjustment (PR4);
  - board-editable reminders (PR5);
  - any copy changes.

## Existing System Evidence

- `src/styles/tokens.css`: 81 lines. Legacy brand names whose meaning differs from their values (`--msa-black` is light paper, `--msa-gold` is teal), plus semantic `--text-*`, `--background-*`, `--border-*`, type, space and radius tokens.
- `src/styles/design.css` (515 lines): base component classes with no per-theme selectors. `src/styles/review.css` (890 lines): 102 `[data-design]` selectors, mostly `coastal`.
- `src/app/globals.css`: the Tailwind 4 `@theme inline` mapping (`--color-msa-*`, `--font-sans`, `--font-serif`), base, admin and editor primitives.
- `src/app/layout.tsx`:
  - five per-design `localFont`s plus DM Sans from `@fontsource-variable/*`;
  - `data-design={selectedDesign()}`;
  - `themeColor` hard-coded `#f8f5ee`;
  - wraps every page in `SiteChrome`.
- `src/config/design.ts`, `src/config/design-keys.ts`: the six keys. These are read by `src/lib/runtime/config.ts` (the `SITE_DESIGN` required variable, validated at build), `next.config.ts` (`distDir` per design for review) and `src/features/home/ReviewHero.tsx` (per-design headline).
- Tests: `tests/runtime.test.ts`, `tests/payments.test.ts`, `tests/places.test.ts` (fixtures carry `SITE_DESIGN`); `tests/e2e/themes.spec.ts` (six-port axe run); `tests/e2e/design.spec.ts` (390 px journey + reduced motion).
- `scripts/review.mjs` (`npm run review`, six servers). `.env.example`, `docs/guides/owner-setup.md`, `docs/guides/developer.md` document `SITE_DESIGN` and review.
- `src/shared/layout/{SiteChrome,Navbar,Footer}.tsx`: chrome from `loadSite()`. `Navbar` has a mobile dialog menu with focus handling.
- `src/shared/ui/*`: PageHero, Section, ButtonLink, FormCta, Meta, SafeImage, Container, SiteIcon, PhotoPlaceholder, used in 79 imports.
- Prayer: `calculatePrayers` (`src/lib/prayer/calculate.ts`) and the server clock from WP-3 (`src/lib/runtime`). The dhikr slot and Hijri date must use the shared clock, never `new Date()`.
- CSP (`next.config.ts`): `script-src 'self' 'unsafe-inline'` allows the pre-paint theme script; `font-src 'self'` requires self-hosted fonts.
- Prototype reference only (never merged): `design/d1-prototypes`, `src/app/d1/quiet-paper/*` and `src/app/d1/_lib/reminders.json` (generated from the named sources).

## Owner

- Design tokens and themes: `src/styles/tokens.css`, the only owner of values.
- Shared primitives: `src/shared/ui`.
- Chrome: `src/shared/layout`.
- Reminder text: a new content document `content/reminders.yaml`, read through the existing editorial source (`src/lib/content`, WP-4), with its zod schema in `src/lib/content/schemas.ts`.
- The theme script lives in the root layout, the single place that renders `<html>`.

## Source of Truth

- Colours, type, space, radius, motion and z-index: `src/styles/tokens.css`.
  - Light on `:root`: Green Ink (amended by PR8 D-5; Paper and the `data-light` override are removed).
  - Dark on `[data-theme="dark"]`.
  - Tailwind utilities mirror the tokens through `@theme inline` in `globals.css`. That is a mirror only.
- Theme choice: the visitor's device (`localStorage` key `msa-theme`), applied pre-paint as `data-theme` on `<html>`. No server state, no cookie, no personal data ([ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md)).
- Reminder text: `content/reminders.yaml`, validated by zod. It is the only copy.
- Hijri date: computed from the shared server clock with `Intl` Umm al-Qura. No stored value.
- Prayer times: unchanged (`calculatePrayers`, ADR 0017).

## Reuse and Duplication Analysis

- **Reused unchanged:**
  - `calculatePrayers`, `managedPrayer`, `managedEvents`, the editorial source and loaders, the server clock;
  - `SiteChrome` structure;
  - `Container`, `SafeImage`, `SiteIcon`.
- **Extended:**
  - `tokens.css`: new semantic set, with legacy names kept as aliases until PR8;
  - `globals.css`: `@theme inline` mappings for the new tokens;
  - `Navbar` and `Footer`: restyled in place;
  - `PageHero`, `Section`, `ButtonLink`, `FormCta`, `Meta`: restyled through tokens, same props;
  - `src/app/layout.tsx`: fonts, theme script, `themeColor` for light and dark.
- **Created only where nothing exists:**
  - `Seal`, `InkRing`, `PaperLayers`;
  - the reminder primitives, `HijriDate`, `ThemeToggle`;
  - the registry pieces in `src/shared/ui`.

  Searched first with no match: `theme`, `dark`, `toggle`, `hijri`, `islamic`, `reminder`, `dhikr`, `verse`, `popover`, `tooltip`, `seal`, `logo`.

- **Removed:** `src/config/design.ts`, `design-keys.ts`, `review.css`, the per-design parts of `design.css`, `scripts/review.mjs`, `themes.spec.ts`, the `SITE_DESIGN` variable and validation, and the five unused font packages.
- **Not duplicated:** the clock and date helpers move to `src/lib/time` only if `src/features/calendar/format` and `src/lib/runtime` do not already provide them. Check those first.

## New Abstractions

- **Theme mode** (`data-theme` on `<html>`, plus `ThemeToggle` and the pre-paint script).
  - Responsibility: resolve and persist light or dark.
  - Why the existing owner cannot hold it: no theme owner exists. `data-design` is being retired.
  - Variation isolated: the visitor's choice versus the device setting.
  - Consumers: the root layout and `Navbar`.
  - Public API: `<ThemeToggle />`, plus the `data-theme` attribute contract.
  - Private: storage key, MutationObserver, View Transition.
- **Reminders content** (`loadReminders()` in `src/lib/content`).
  - Responsibility: validated Arabic verses and dhikr with meaning, reference and source.
  - Why a new document: no reminder content exists.
  - Consumers: `MarginNote`, `DhikrOfTheHour`, `TasbihThread`.
  - Public API: `loadReminders(): { verses, dhikr, tasbih }`.
  - PR5 later moves this behind the dashboard without changing consumers.
- **Dhikr slot** (`dhikrSlot(starts, now, isFriday)` in `src/lib/prayer`). A pure function next to the prayer code that owns those times.

## Product Decisions Required

- [x] Can the new dependencies be added (all free, MIT or OFL)?
      Options: approve all; approve all except Storybook; list changes
      Recommendation: approve all. The list:
      Decision: D-1
  - fonts: `@fontsource/instrument-serif`, `@fontsource-variable/instrument-sans`, `@fontsource/amiri-quran`, `@fontsource-variable/cormorant-garamond`;
  - `motion` and `radix-ui`;
  - registry code in `src/shared/ui`: Magic UI theme toggler, blur-fade and noise texture, and the Animate UI Radix popover;
  - dev only: Storybook 9 for Next.js (`storybook`, `@storybook/nextjs-vite` and its addons).

  The five old `@fontsource-variable` theme fonts are removed.

- [x] Should Storybook's build run in CI?
      Options: yes, as part of the PR gate; no, local only
      Recommendation: yes. It catches broken stories early and adds about 1–2 minutes per PR.
      Decision: D-2
- [x] Where should the reminder text live until the dashboard can edit it (PR5)?
      Options: `content/reminders.yaml` (developer edits); hard-coded in a component
      Recommendation: the YAML file. One validated copy that PR5 moves into the dashboard unchanged.
      Decision: D-3
- [x] While the board chooses, which light palette shows by default?
      Options: Paper; Green Ink
      Recommendation: Paper. Green Ink stays as a token override until the board picks; the loser is then deleted.
      Decision: D-4
- [x] Should the Release PR wait for PR8?
      Options: hold the Release PR until PR8 lands; release PR2 alone (new colours, fonts and header on the old page layouts)
      Recommendation: hold. The site goes live in one complete step, and the release checklist tells the owner.
      Decision: D-5

## Decisions

- D-1: Approve all new dependencies (the four fonts, `motion`, `radix-ui`, the Magic UI and Animate UI registry pieces, Storybook as a dev dependency) and remove the five old theme fonts (chosen by the user, 2026-10-03; option rejected: no Storybook).
- D-2: The Storybook build runs in CI as part of the PR gate (chosen by the user, 2026-10-03; option rejected: local only).
- D-3: Reminder text lives in `content/reminders.yaml` until PR5 moves it into the dashboard (chosen by the user, 2026-10-03; option rejected: hard-coded in components).
- D-4: Paper is the default light palette. Green Ink stays as a token override for comparison until the board picks, then the loser is deleted (chosen by the user, 2026-10-03).
  - Amendment (PR8 D-5, board decision via the user, 2026-10-03): the board picked **Green Ink**. Its values are now the light tokens on `:root`; Paper and the `[data-light="green"]` override are deleted, with the Storybook "Light palette" switch.
  - Amendment (PR8 D-6, user, 2026-10-03): the "?" shows the meaning and the reference only; the source stays in `content/reminders.yaml`. The footer verse (20:114) is Arabic with the "?", read from `content/reminders.yaml`.
- D-6: With the per-theme copy removed, the Home headline and intro come only from `content/home.yaml` ("A little closer. To faith. To each other." plus its body), which is what the board saw in the prototypes (chosen by the user, 2026-10-03; option rejected: today's courtyard headline "There's a place for you here.").
- D-5: The Release PR waits until PR8 restyles every public page, so the new look goes live in one step (chosen by the user, 2026-10-03; option rejected: release PR2 alone).

## Board Self-Sufficiency Check

- Theme mode is a visitor setting, not a board setting.
- Board-owned values:
  - the light palette: a one-time board pick, recorded in ADR 0018;
  - the reminder text: YAML until PR5, recorded as a roadmap gap (ADR 0018);
  - the Hijri adjustment: PR4, recorded as a roadmap gap.
- Nothing new becomes developer-only without a recorded gap.
- `/admin/help` needs no change in PR2: the dashboard is unchanged.

## Design

```text
<html data-theme=light|dark>   ← pre-paint script (stored choice ▸ device)
  tokens.css  :root (Green Ink, PR8 D-5) · [data-theme=dark] (Dusk)
     ├─ legacy aliases (--msa-*, --text-*, --background-*) → new tokens   (removed in PR8)
     └─ globals.css @theme inline → Tailwind utilities
  SiteChrome → Navbar(+ThemeToggle) · main · Footer
  Home: DhikrOfTheHour(dhikrSlot(clock, prayer starts)) · HijriDate(clock) · TasbihThread
  Primitives in src/shared/ui (Storybook stories for each, light + dark)
```

## Public Contract

- **Tokens** (names fixed by this contract; values from the prototype `theme.css`):
  - `--paper`, `--paper-light`, `--paper-deep`, `--band`;
  - `--ink`, `--muted`, `--rule`, `--ring`, `--thread`;
  - `--on-ink-muted`, `--on-ink-rule`, `--shadow`, `--photo-filter`;
  - `--seal-ink`, `--seal-mint`, `--seal-cream`;
  - `--font-display`, `--font-body`, `--font-arabic`, `--font-lux`;
  - the existing type, space and radius scale; a `--z-*` scale.
- **Attributes on `<html>`:** `data-theme="light"|"dark"`, and `data-theme-choice="light"|"dark"|"system"` (the optional `data-light` was removed by PR8 D-5).
- **`content/reminders.yaml`:**
  - `verses[]`: `{id, page, arabic, meaning, reference, source}`;
  - `dhikr[]`: `{id, slot: morning|evening|after-prayer|friday|night, arabic, meaning, reference, source}`;
  - `tasbih`: `{phrases[3], meanings[3], source}`.

  Exported as `loadReminders()` from `src/lib/content`.

- **Functions:** `dhikrSlot(starts, now, isFriday)` in `src/lib/prayer`; `hijriDate(now, maghribIso)` returns `{english, arabic, day, afterMaghrib}`.
- **Components** (props as in the prototype):
  - `<ThemeToggle />`, `<MeaningTip reminder />`, `<MarginNote reminder />`, `<DhikrOfTheHour reminder />`;
  - `<HijriDate hijri />`, `<TasbihThread />`, `<Seal size label? />`, `<InkRing />`, `<PaperLayers />`.
- **Removed:** the `SITE_DESIGN` variable, `npm run review`, `designs` and `designKeys`.

## Private Implementation

- Story layout, component-internal CSS module structure, the exact SVG path math for the thread and moon, the storage key name, and the pre-paint script's minified form.

## Data and State Flow

- Reminders: `content/reminders.yaml` → zod → `loadReminders()` → server components → props. There is no client fetch.
- The dhikr slot and Hijri date are computed on the server from the shared clock and the prayer starts. Pages that show them are already dynamic.
- Theme: client only. The script reads storage and the device setting, writes `<html>` attributes, and the CSS variables switch. `ThemeToggle` writes the same attributes and storage, and `useSyncExternalStore` keeps every toggle in sync. Nothing touches the server or database.

## Failure Modes

- **Storage blocked** (private mode): the theme follows the device and the toggle still works for the visit. Every storage call is wrapped in try/catch.
- **JavaScript disabled:** light theme (Green Ink since PR8 D-5) with no switch, and the page stays fully usable. The tasbih thread shows complete.
- **View Transitions unsupported:** the theme switches instantly.
- **Reminder YAML invalid:** the build fails with the zod message, consistent with the editorial source's fail-fast rule. Reminders never silently disappear.
- **Prayer times unavailable:** no dhikr slot; the hero shows no dhikr line. The Hijri date still shows.
- **Reduced motion:** no blur-fade, no thread drawing (shown complete), and an instant theme switch.
- **Fonts fail:** fallback stacks; the Arabic falls back to "Amiri", then serif.

## Compatibility and Migration

- No database change.
- Vercel: `SITE_DESIGN` is no longer read, so the owner may delete it; leaving it set is harmless.
- `.env.example` and the owner guide drop it.
- Tests and fixtures drop `SITE_DESIGN`.
- Old page markup keeps working through the token aliases until PR8.
- Rollback: revert the PR. The old themes come back with `SITE_DESIGN` still set on Vercel.

## Parallel Work and Merge Order

- Single work package, one agent, sequential. It touches shared files (`tokens.css`, `globals.css`, `layout.tsx`, `src/shared/**`), so no parallel work.
- Before starting, rebase on `integration` after PR #25 merges. Track A's next PRs touch `/admin` only; PR2 does not touch `/admin` styles beyond the token aliases.

## Work Packages

### WP-1: Quiet Paper foundation

- Purpose: everything in Requested Behavior.
- Depends on: PR #25 merged.
- Expected files:
  - `src/styles/tokens.css`, `src/styles/design.css`, `src/app/globals.css`;
  - `src/app/layout.tsx`;
  - `src/shared/layout/{Navbar,Footer,SiteChrome}.tsx`, `src/shared/ui/*` (restyle and new);
  - `src/lib/content/{schemas.ts,index.ts}`, `content/reminders.yaml`;
  - `src/lib/prayer/dhikr.ts`, `src/lib/time/hijri.ts` (or an existing owner);
  - `src/app/page.tsx` (place the hero reminders only);
  - `src/lib/runtime/config.ts`, `next.config.ts`, `.env.example`;
  - `package.json`, `.storybook/*`, `src/**/*.stories.tsx`;
  - tests (`runtime`, `payments`, `places`, e2e `design`, a new e2e `theme`);
  - docs (owner and developer guides, release checklist, roadmap, architecture);
  - the `design-token-architecture` and `designing-ui-components` skills.

  Removed: `src/config/design*.ts`, `src/styles/review.css`, `scripts/review.mjs`, `tests/e2e/themes.spec.ts`.

- Reuse: as in Reuse and Duplication Analysis.
- Required changes: as in Public Contract.
- Must not: change any page-body layout except the Home hero reminders; add a new data source or Supabase table; read `new Date()` for the dhikr or Hijri date; put raw hex values in components; use `dark:` Tailwind variants; touch `/admin` layouts.
- Tests:
  - unit: `dhikrSlot` for every slot boundary and Friday; `hijriDate` at the Maghrib boundary; the reminders schema rejects missing fields;
  - e2e: theme persists across pages; no flash (the attribute is set before paint); the `?` toggletip opens and closes by keyboard and Escape; reduced motion shows the thread complete; axe passes in light and dark at 390 and 1440;
  - `npm run check`; Storybook build.
- Done when: every Acceptance Criterion passes and the reviewing skill approves.

## Implementation Constraints

- Do not add a second palette, a theme context or provider, or a client store for the theme. `<html>` attributes plus CSS variables are the single mechanism.
- Do not keep any `[data-design]` selector.
- Do not create a second reminders copy (no JSON beside the YAML).
- Must not use `new Date()` in server code for reminders or the Hijri date. Use the shared clock.
- Must not tilt, fade below readable contrast, or overlap scripture with other content.
- Must not mention any payment channel other than Go2Pay.

## Worker Escalation Conditions

- The token aliases cannot keep an old page readable (contrast below AA) without changing that page's markup.
- The editorial source cannot take a new document without changing its port.
- Storybook needs a paid add-on or conflicts with Next 16 or Tailwind 4.
- The shared clock or prayer-start API differs from what this contract assumes.

## Test Strategy

- Unit tests in `tests/*.test.ts` for `dhikrSlot`, `hijriDate`, the reminders schema, and runtime config without `SITE_DESIGN`.
- E2E: a new `tests/e2e/theme.spec.ts` (persistence, no flash, axe in both themes) replacing `themes.spec.ts`, plus an updated `design.spec.ts`.
- Storybook build in CI, if approved.
- Manual checks:
  - chrome-devtools screenshots of every public route in light and dark at 390 and 1440, with Lighthouse accessibility of 100 on Home, Prayer, Calendar and Donate;
  - a keyboard pass through the header, the toggle and the toggletips.

## Acceptance Criteria

- Every public page shows Quiet Paper colours and fonts in light (Green Ink since PR8 D-5; Paper until then) and dark (Dusk).
- The header switch flips light and dark, is remembered after a reload, and never flashes the wrong theme.
- Home shows the dhikr of the hour, the Hijri date (English first, Arabic beneath, moon) and the tasbih thread. Each "?" shows the meaning, reference and source (since PR8 D-6: the meaning and reference only).
- Storybook lists every shared primitive in both themes.
- `SITE_DESIGN`, `npm run review` and the six themes are gone; `npm run check` and the e2e suite pass.
- Lighthouse accessibility is 100 (mobile) on Home, Prayer, Calendar and Donate in both themes.

## Open Risks or Escalations

- Logo source (A3 in the cleanup contract): the crisp-text draft is used. The founders confirm the seal artwork before launch.
- Every Arabic string needs the board's review before the Release PR.
