---
status: approved
mode: light
---

# Homepage centering, password visibility, archive-photo label and cross-device layout gate

Tickets: SGU-MSA/sgu-msa-site-private-history#128 (centering + layout matrix), #129 (password toggle). Parent #109. Base: `origin/main` 43c2483 (same tree as integration 23936e2). PR target: `main` in the public repo `SGU-MSA/sgu-msa-site` (amended 2026-10-17: the integration branch is retired for normal PRs).

## Capability

The homepage hero looks deliberately balanced on every device class; password fields can be revealed; the invite email reads well without a name; and every PR proves public pages lay out correctly from small phones to 4K/projectors.

## Requested Behavior

1. **Hero: columns balanced, next section follows (option 1, amended 2026-10-18).** The hero has no forced full-screen height. Side by side, the shorter headline column is vertically centred against the taller prayer-times column; stacked (phones, tablets) each keeps its own height. Comfortable padding above and below: 3rem on phones and tablets (the gap under the menu or band is 40-56px), growing with screen height on wide layouts (`clamp(3rem, 7vh, 6rem)`). The next section follows directly: no empty band over 15% of the viewport height at 1920x1080, 2560x1440 and 3840x2160. Horizontal layout, type sizes and content are unchanged. Replaces the old `@media (min-width: 64rem) and (min-height: 49rem)` padding heuristic in `src/features/home/home.module.css`.
2. **Password show/hide.** Every password input (sign-in, set-password after invite/reset — both fields) gets a show/hide button at its right edge: eye / eye-off icon from the existing `lucide-react` dependency, `type="button"`, accessible name "Show password"/"Hide password", `aria-pressed`, keyboard operable, visible focus ring, works in light and dark using tokens only. Each field toggles independently. One shared component (`src/shared/ui/PasswordInput.tsx`) owns this; no per-form copies. It is based on a reviewed throwaway prototype (not committed), using the real token names from `src/styles/tokens.css`.
3. **Invite email.** `supabase/templates/invite.html` copes with a missing name or inviter (an invite sent from the Supabase dashboard): `Assalamu alaikum{{ if .Data.full_name }} {{ .Data.full_name }}{{ end }},` and `{{ if .Data.invited_by }}{{ .Data.invited_by }} added you{{ else }}You have been added{{ end }} to the SGU MSA board dashboard.` The subject has no apostrophe ("You are invited to the SGU MSA website dashboard"); the link is unchanged. Covered by `tests/auth-emails.test.ts`.

   Archive label: not part of this change (removed separately by PR #4).

4. **Cross-device layout gate.** Add a Playwright layout matrix that runs in CI on every PR:
   - Viewports (CSS px): phones 320×568, 360×800, 390×844, 412×915, 430×932, 844×390 (landscape); tablets 768×1024, 800×1280, 820×1180, 1024×768, 1024×1366; laptops 1280×800, 1366×768, 1440×900, 1536×864; desktop/projector 1920×1080; wide 2560×1440; 4K 3840×2160. Phones/tablets use `isMobile`/`hasTouch`.
   - Themes: light and dark (`data-theme`), `reducedMotion: "reduce"`, fixed `SITE_DEMO_DATE`, demo server like `playwright.smoke.config.ts`.
   - Pages: every public route linked from the header/footer (/, /about, /calendar, /community, /contact, /donate, /faq, /get-involved, /merch, /prayer, /privacy, /ramadan, /resources) plus /admin/login.
   - Geometric assertions on every page × viewport × theme: no horizontal page overflow (`scrollWidth <= innerWidth`); header visible and not overlapping main content; on `/`, side-by-side hero columns' vertical centres are within 3px of each other, the gap from the hero content to the next section is at most 15% of the viewport height at 1920x1080 and wider, and on stacked layouts the gap from header/band bottom to the eyebrow is 40–56px.
   - Screenshot comparisons (`toHaveScreenshot`, viewport only, not full page, animations disabled, small maxDiffPixelRatio): `/` and `/admin/login` at 390×844, 768×1024, 1366×768, 1920×1080, 2560×1440, 3840×2160 in light and dark (24 images), plus `/resources` and `/prayer` at 390×844 and 1440×900 light. Baselines must be generated inside the official Playwright Docker image matching the installed `@playwright/test` version, and the CI job must run in that same image, so renders match. Provide `npm run test:layout` and `npm run test:layout:update` (the update script runs Docker locally).
   - CI: run it as its own parallel `layout` job in `validate.yml` (amended, see D-8), in the Playwright image. Upload diffs on failure (retention 3 days), like the smoke job. The planner adds `layout` to main's required checks after merge.

## Existing System Evidence

- Hero: `src/features/home/HomeHero.tsx`, `src/features/home/home.module.css:26-52`, rendered by `src/features/home/HomeBody.tsx` inside `PageSection id="top"`; urgent band/notice composition in `HomeBody` and the layout header in `src/shared/layout/**`.
- Password inputs: `src/features/admin/PasswordForms.tsx` (`SetPasswordForm`), `src/features/admin/SignInForm.tsx`.
- `ArchiveTag`: `src/shared/ui/Meta.tsx`, used by `src/features/resources/ResourceExplorer.tsx:127`; story `src/shared/ui/Meta.stories.tsx`.
- Playwright: `playwright.config.ts`, `playwright.smoke.config.ts`, `tests/support/playwright-config.ts`, existing specs `tests/e2e/design.spec.ts`, `real-site-look.spec.ts`, `theme.spec.ts`, `rendering.spec.ts` — check these first and extend/reuse their helpers instead of duplicating viewport or theme setup.
- CI: `.github/workflows/*.yml` jobs `browser-smoke` and `layout`.
- Testing ownership/skill: `.agents/skills/frontend-testing-visual-qa/`.

## Owner

Home feature owns hero layout. `src/shared/ui` owns `PasswordInput` and `ArchiveTag`. `tests/e2e` + a Playwright config own the layout gate. The frontend-testing-visual-qa skill documents when to update baselines.

## Source of Truth

Viewport list lives once in a single exported constant (e.g. `tests/support/viewports.ts`) used by the layout config/spec and any existing spec that already lists viewports. Visual baselines are the committed snapshots. Tokens remain in `src/styles/tokens.css`.

## Product Decisions Required

None outstanding.

## Decisions

- D-1 (maintainer, 2026-10-18): option 1 (columns balanced, next section follows) chosen after preview review. It replaces the earlier option A (hero centred in a full first screen), which left dead space on large monitors.
- D-2 (maintainer, 2026-10-17): standard eye icon toggle as previewed is approved.
- D-3: archive label dropped from this change (amended 2026-10-17); PR #4 removed it separately.
- D-6 (maintainer, 2026-10-17): the invite template handles a missing name/inviter, and its subject avoids the apostrophe.
- D-4 (maintainer, 2026-10-17): every visual change must pass CI and regression tests across phone, tablet, laptop, wide-screen and projector sizes.
- D-7 (maintainer, 2026-10-18): `SignInForm` has no styles of its own; it uses the shared `editor-form`, label, input, `FormMessages` and `button-primary` like `ForgotPasswordForm`. The layout spec asserts the two primary buttons look identical in light and dark.
- D-8 (planner, 2026-10-18, review of PR #7): the layout gate is its own parallel `layout` CI job (to become a required check after merge), not a step of `browser-smoke`. the password button keeps one name with `aria-pressed` and the field returns to hidden on submit; browser suites share one demo seed and the viewport list.
- D-5 (planner): short laptops keep the current headline size; adjusting type for short screens is out of scope.

## Board Self-Sufficiency Check

No new board setting. Hero text stays dashboard-edited.

## Implementation Constraints

- Allowed files: `src/features/home/**`, `src/shared/ui/PasswordInput.tsx` (+ story `PasswordInput.stories.tsx`, light and dark), `supabase/templates/invite.html`, `supabase/config.toml` (invite subject only), `tests/auth-emails.test.ts`, `docs/guides/owner-setup.md` (invite subject wording only), `src/features/admin/PasswordForms.tsx`, `src/features/admin/SignInForm.tsx`, `src/app/globals.css` or a shared CSS module for the toggle, `tests/e2e/**`, `tests/support/**`, a new `playwright.layout.config.ts`, `package.json` scripts only (no new dependencies), `.github/workflows/*.yml`, `.gitignore` (test output only), `.agents/skills/frontend-testing-visual-qa/**` (project notes/references only; respect size budgets), `docs/guides/developer.md` (testing section), `docs/release-checklist.md` (Unreleased), this contract copied to `docs/contracts/home-centering.md`.
- No new npm dependencies. Use existing `lucide-react` and `@playwright/test`.
- Server-renderable components stay server components; only `PasswordInput` is a client component.
- Use `svh` with `vh` fallback; no JS to measure layout for centering unless pure CSS cannot meet the acceptance criterion — if JS is required, stop and report (PLAN MISMATCH).
- Do not change header, nav, type scale, colors or any other page's layout. Do not touch the preview worktree.
- Commit identity: the developer's normal git identity. Branch `feat/home-centering-password-toggle`.

## Test Strategy

- `npm run check` (lint, typecheck, unit + coverage floors, format).
- `npm run test:smoke` stays green.
- `npm run test:layout` green in Docker locally and in CI; baselines committed.
- Storybook builds (`npm run build-storybook`) with the new story in light and dark.
- Manually inspect the generated screenshots at 390×844, 1366×768, 2560×1440 and 3840×2160 in both themes; attach a few to the PR body.

## Acceptance Criteria

- Hero per Requested Behavior 1 at all matrix viewports; asserted by the layout spec.
- Prayer-times aside and headline column are centred against each other on side-by-side layouts.
- Password toggle works by mouse and keyboard on all three password fields; screen reader name/state correct; axe shows no new violations on /admin/login.
- The invite email renders cleanly without a name or inviter.
- No page in the matrix overflows horizontally in either theme.
- CI's existing four required checks pass, and the layout gate passes in its own parallel `layout` job (the planner adds `layout` to main's required checks after merge).
- Release checklist Unreleased updated (what changed, how to test, no settings change).
