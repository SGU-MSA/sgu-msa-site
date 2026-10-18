---
name: designing-ui-components
description: Orchestrates the end-to-end workflow for adding or redesigning UI on the SGU MSA site - audits existing primitives and tokens, has the user pick a visual direction from 2-3 pictured options (Claude Design or HTML mockups), finds free components in the configured shadcn registries (Magic UI, SmoothUI, Unlumen UI free tier, Animate UI, React Bits), adapts them to the site tokens, adds motion safely and verifies accessibility and visuals. Use when building or restyling a page, section, admin dashboard screen or component, or when installing a registry component. Do not use just to look up one style's recipe (use applying-design-styles), for a single concern such as typography, contrast, keyboard handling or animation performance on its own (use the matching frontend domain skill), or for backend, data or payment work.
allowed-tools:
  - Read
  - Grep
  - Glob
  - mcp__shadcn__get_project_registries
  - mcp__shadcn__list_items_in_registries
  - mcp__shadcn__search_items_in_registries
  - mcp__shadcn__view_items_in_registries
  - mcp__shadcn__get_item_examples_from_registries
  - mcp__shadcn__get_add_command_for_items
  - mcp__shadcn__get_audit_checklist
  - mcp__magicui__listRegistryItems
  - mcp__magicui__searchRegistryItems
  - mcp__magicui__getRegistryItem
  - mcp__motion__search-motion-docs
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__resize_page
  - mcp__chrome-devtools__emulate
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__take_snapshot
  - mcp__chrome-devtools__lighthouse_audit
  - mcp__chrome-devtools__list_console_messages
---

# Designing UI components

Workflow skill: it sequences other skills and tools, it does not replace them.
Project principles apply throughout (see AGENTS.md): board self-sufficiency,
the user decides design, plan before code, pictures over text, never duplicate.
If a linked skill is not installed in this environment, follow the step's
bullets here directly and say which skill was missing.

Copy this checklist into the plan and tick it off:

```
- [ ] 1 Audit: existing primitives, tokens, themes searched
- [ ] 2 Direction: 2-3 pictured options shown, user picked, choice recorded
- [ ] 3 Components: reuse > free registry install > hand-built; dry-run reviewed
- [ ] 4 Adapt: tokens only, works in light and dark, board copy is plain
- [ ] 5 Motion: researched, reduced-motion respected
- [ ] 6 Verify: keyboard, contrast, ARIA, Lighthouse, Playwright e2e, screenshots
```

## 1. Audit before adding

Read, in this order, and reuse anything that already fits:

- `src/shared/ui/` - primitives (ButtonLink, Section, Container, PageHero,
  FormCta, SafeImage, PhotoPlaceholder, ImageViewer (opt-in photo viewer),
  SiteIcon, Meta; Quiet Paper's Seal,
  InkRing, PaperLayers, MarginNote, DhikrOfTheHour, TasbihThread,
  MeaningTip, ArabicLine, HijriDate, ThemeToggle, BrandIcon, SocialIcon,
  Rubric, InkHeading, BlurFade, NoiseTexture, popover; `page.module.css`
  holds the page patterns every public page uses) and
  `src/shared/layout/` (Navbar, Footer, SiteChrome). Browse them all in
  Storybook (`npm run storybook`).
- `src/features/<area>/` - feature components; search before writing:
  `grep -rn "<ComponentIdea>" src`.
- `src/styles/tokens.css` - the only source of colors, type scale, spacing,
  radius, motion and z-index. Use the Quiet Paper semantic tokens (`--paper`,
  `--paper-light`, `--ink`, `--muted`, `--rule`, `--ring`, `--font-display`,
  `--font-arabic`...). The few legacy names left (`--msa-*`, `--text-*`)
  serve only the dashboard sign-in form; never use them in new UI.
- One design, light and dark ([ADR 0018](../../../docs/adr/0018-design-direction-quiet-paper.md)):
  Green Ink on `:root` (the board's light pick, PR8 D-5), Dusk on
  `[data-theme="dark"]`. New UI must look right in both themes; check both
  in Storybook. The old six
  `data-design` themes are retired; never offer them, or restyled versions
  of them, as a direction.
- `src/app/globals.css` - Tailwind 4 `@theme inline` mapping (no
  tailwind.config file).

If a near-match exists, extend it with a variant prop instead of adding a
sibling. Two components that do the same job is a defect.

## 2. Direction: the user picks from pictures

Never choose the look yourself. Present 2-3 directions plus a recommendation.

1. Shortlist with the `applying-design-styles` skill, filtered by brand fit
   (a university mosque: calm, welcoming, dignified, readable).
2. Show pictures, not paragraphs:
   - **Claude Code with Claude Design:** run `/design-login` once per
     machine, then `/design <brief>` for 2-3 artboards with real site
     content. Bring the chosen design back through its handoff bundle and
     build from it.
   - **Don't run `/design-sync` until a direction is chosen** and its tokens
     and components are in the repo. Before that it would upload the
     discarded themes and pull the artboards back toward them.
   - **Codex, or Claude Design unavailable:** write quick static HTML
     mockups (one per option, using the real token values) under
     `.plans/mockups/<feature>/`, open each with
     `mcp__chrome-devtools__new_page` and capture
     `mcp__chrome-devtools__take_screenshot` at 390 px and 1440 px. If
     chrome-devtools is unavailable, use a Playwright screenshot script.
     Screenshots go in the ignored `artifacts/` folder.
   - **Always side by side:** put all options on one interactive page (a
     throwaway Storybook comparison story, "Design options/<feature>", with a
     light and a dark panel per option and plain captions; add the real page
     in context if useful). Never show options through query-string
     switches or one at a time.
3. Ask the user to choose. Record the choice in the feature contract's
   Decisions section (`docs/contracts/<feature>.md`). Only if it affects
   several features or is hard to reverse (site-wide palette, type, motion
   personality, a new registry or dependency) also write an ADR in
   `docs/adr/` and index it in `docs/adr/README.md` (ADR 0001); the
   `planning-engineering-changes` skill covers both formats.

## 3. Components: reuse, then free registries, then hand-built

Registries are configured in `components.json` (free only; details and
licenses in [references/registries.md](references/registries.md)).

1. Search:
   - `mcp__shadcn__search_items_in_registries` across `@magicui`,
     `@smoothui`, `@unlumen-ui`, `@animate-ui`, `@react-bits`; inspect with
     `mcp__shadcn__view_items_in_registries` and
     `mcp__shadcn__get_item_examples_from_registries`.
   - Magic UI catalog: `mcp__magicui__searchRegistryItems`,
     `mcp__magicui__getRegistryItem`.
   - Fallback without MCP: `npx shadcn@latest search @smoothui -q "<term>"`
     and `npx shadcn@latest view @smoothui/<item>`.
2. Excluded: anything Pro, paid, license-keyed or Motion+. If an item asks
   for a key or returns 401/403, it is paid - drop it and say so.
3. Preview before writing: get the command from
   `mcp__shadcn__get_add_command_for_items`, then run it with `--dry-run`
   (and `--diff` for existing files). Report files and npm dependencies to
   the user. A new dependency is the user's decision: record it in the
   contract's Decisions; an ADR only if it affects several features or is
   hard to reverse (ADR 0001).
4. Install only after approval: `npx shadcn@latest add <item>`. Code lands in
   the repo, so we own and can edit it. If files land outside
   `src/shared/ui/` (some registries hard-code `src/components/...`), move
   them there and fix imports so there is one home for primitives.
5. Prefer a registry install (source in repo) over adding an npm UI library.
   Hand-build only when nothing fits; keep it in `src/shared/ui/`.

## 4. Adapt to the site

- Replace registry colors, radii, shadows and fonts with tokens
  (`var(--...)` or the `@theme inline` utilities). No raw hex values, no
  `dark:` variants (dark mode is token values under `data-theme`).
- If an install adds CSS variables to `src/app/globals.css`, map them onto
  existing tokens instead of introducing a second palette.
- Server Components by default; add `"use client"` only to the leaf that
  needs state, effects or motion.
- Board-facing (admin) UI: plain words, one primary action per screen,
  44 px minimum targets (`min-h-11`), visible labels, helpful empty and error
  states, and help text with pictures. Anything a board member may want to
  change must be editable from the dashboard, never hard-coded.
- Dashboard UI: build with the shared fields, save state, image fit and empty states, and pass the [admin UX gate](../reviewing-engineering-changes/references/admin-ux-gate.md).
- Payments UI mentions Go2Pay only (AGENTS.md principle 6).
- Hijri dates: only with prayer times and Ramadan, always next to the normal
  date (`HijriDate` with `date`), changing at midnight with it, never on
  board-entered content (PR8 D-11).

## 5. Motion

- Before animating, read the `motion` skill and query
  `mcp__motion__search-motion-docs` for the pattern (fallback: the `motion`
  skill alone, or context7 docs for `motion`).
- Use existing durations (`--transition-fast`, `--transition-standard`,
  `--design-motion`). Animate transform and opacity only.
- Respect `prefers-reduced-motion` (see `sensory-motion-accessibility`):
  reduced users get a static, fully usable result. `tests/e2e/design.spec.ts`
  already checks the hero this way; extend it for new motion.
- Motion is decoration: content and actions must work without it.

## 6. Verify (validate, fix, repeat)

Start the app (`npm run demo` for sample data) and Storybook
(`npm run storybook`), then:

1. Keyboard: tab through every control; focus is visible
   (`--focus-ring`); Escape closes overlays; no traps
   (`keyboard-navigation-systems`).
2. ARIA and semantics: real buttons and links, labelled inputs, landmarks
   (`aria-complex-widget-accessibility`, `semantic-document-architecture`).
3. Contrast: WCAG AA in light and dark (`color-systems-contrast-intelligence`).
4. Lighthouse: `mcp__chrome-devtools__lighthouse_audit` (mobile and desktop)
   for accessibility; fix every failed audit. Check
   `mcp__chrome-devtools__list_console_messages` is clean. Fallback: the
   axe checks in Playwright below.
5. Visual: `mcp__chrome-devtools__take_screenshot` at 390 and 1440 px in
   light and dark (tap the header switch); show the user before and after.
   Add or update the component's Storybook story in both themes.
6. Playwright: `npm run test:e2e` against the demo (command in the
   [developer guide](../../../docs/guides/developer.md#normal-development-and-production-checks));
   `tests/e2e/theme.spec.ts` runs axe on every public page in both themes.
   Add or extend a spec for new interactive UI.
7. Targeted static checks on touched files: `npx eslint <files>`,
   `npx prettier --check <files>`.

Repeat until clean, then hand the screenshots to the user for sign-off.
