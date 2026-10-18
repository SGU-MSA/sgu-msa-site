---
status: approved
mode: light
---

# Vendor Vercel's Web Interface Guidelines into the review and design skills

Ticket: to be linked or created by the planner with `managing-project-work` before delegation (none created while drafting). Base: `origin/main` at `72ad392`. PR target: `main`. Approved by the maintainer 2026-10-18. Process and agent-documentation change; no site code.

## Capability

Agents reviewing or designing UI check a pinned, attributed copy of Vercel's Web Interface Guidelines, with project notes that say how each rule maps to this stack and where the project deliberately differs. The `motion-system-orchestration` skill stops claiming that no animation library is installed.

## Requested Behavior

1. Vendor `vercel-labs/web-interface-guidelines` `AGENTS.md` (the agent-oriented MUST/SHOULD/NEVER list, 156 lines) at commit `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05, "Add desktop overscroll guideline"; license MIT, `Copyright (c) 2025 Vercel Labs`, verified with `gh api repos/vercel-labs/web-interface-guidelines` and the pinned `LICENSE`). The README's prose version, its "Vercel-specific" Copywriting section, "Integrate with Agents" (third-party skill install commands) and "Join Vercel" are not vendored.
2. Split into two reference files under `.agents/skills/reviewing-engineering-changes/references/` so each stays ≤ 150 lines (files over 100 lines need a Contents heading, `tests/agent-config.test.ts`):
   - `web-interface-guidelines-interactions.md`: upstream lines 1-65 (intro and Interactions: Keyboard, Targets & Input, Forms, State & Navigation, Feedback, Touch & Drag, Autofocus);
   - `web-interface-guidelines-presentation.md`: upstream lines 66-156 (Animation, Layout, Content & Accessibility, Content Handling, Performance, Dark Mode & Theming, Hydration, Design).
     Each file starts with an HTML comment header: source URL, path `AGENTS.md`, commit SHA, license MIT, "see ../NOTICE", "Vendored: edit only the Project notes section". Upstream text is otherwise byte-for-byte (download with `gh api "repos/vercel-labs/web-interface-guidelines/contents/AGENTS.md?ref=<sha>" -H "Accept: application/vnd.github.raw"` through `scripts/agents/github.sh`).
3. `.agents/skills/reviewing-engineering-changes/NOTICE`: what is vendored (both files, upstream path and SHA, date), the full MIT license text from the pinned `LICENSE`, and the modifications (split in two, header comment, Contents heading, Project notes sections added; nothing else changed).
4. `.agents/skills/reviewing-engineering-changes/SKILL.md`: frontmatter `metadata` gains `vendored-references: "references/web-interface-guidelines-interactions.md references/web-interface-guidelines-presentation.md"` and `upstream-commit: 434b7f91364665f2f733b310ec54809bf8f37937` (not `vendored: "true"`: the skill itself stays project-authored with the 200-line budget); the Review checklist gains one item: for any diff touching UI (`src/app/**` pages, `src/features/**`, `src/shared/**`, CSS), check it against both references, honouring their Project notes; a MUST or NEVER violation is a Medium finding, High when it blocks keyboard or screen-reader use.
5. `.agents/skills/designing-ui-components/SKILL.md` step 6 (Verify): one line linking both references (`../reviewing-engineering-changes/references/…`), keeping the file ≤ 200 lines (193 today).
6. "Project notes" at the end of each vendored file (local text; the only part later edits may touch), mapping rules to this stack:
   - Interactions file: focus rings use `--focus-ring`/`--ring` tokens and `keyboard-navigation-systems`; targets ≥ 24 px (44 px on touch) per `responsive-adaptive-systems`/`sensory-motion-accessibility`; forms already follow `CheckedForm`, `SaveStatus`, `UnsavedChangesGuard` and the version check (that is our idempotency, not a separate key); URL state uses `searchParams` as the calendar filters and Recent changes do, and `nuqs` is not installed (a new dependency needs approval). Conflict: "Optimistic UI" does not apply to board saves; the dashboard shows Saving… then Saved or a version conflict, because two editors can collide and the server is the authority.
   - Presentation file: Motion is installed (`motion/react` through `src/shared/layout/MotionRoot.tsx`, `LazyMotion` + `MotionConfig reducedMotion="user"`); CSS first, durations from `--transition-fast`, `--transition-standard`, `--motion-reveal` (`motion-system-orchestration`, `motion`); colours and both themes from `src/styles/tokens.css` (Quiet Paper, Green Ink and Dusk, ADR 0018); `colorScheme` and `themeColor` are set in `src/app/layout.tsx`; fonts are self-hosted with `next/font/local` (CSP `font-src 'self'`), so `preconnect` and manual font preload do not apply. Conflicts: contrast gate is WCAG 2 AA in both themes (`color-systems-contrast-intelligence`); APCA may be checked additionally but never replaces it. "Locale-aware dates/times" does not apply: dates and times are formatted on the server in `America/Grenada`, in English, to stay hydration-safe and match the musallah's clock (`rendering-strategy-app-architecture`). "Virtualize lists > 50" applies only when profiling shows a problem (lists here are short; no `virtua` dependency). Copy follows the board's plain-language sentence case; Vercel's Title Case copywriting is not vendored.
7. Fix `.agents/skills/motion-system-orchestration/SKILL.md` line 14: replace "No animation library is installed. CSS first; adding `motion` is a dependency decision …" with: Motion (`motion`, `motion/react`) is installed and wired in `src/shared/layout/MotionRoot.tsx` (`LazyMotion` with `domAnimation`, `MotionConfig reducedMotion="user"`) and used by `BlurFade`, the popover, `SortableList`, `UrgentNoticeRotator` and `TasbihThreadView`; CSS first, Motion when CSS cannot do it (the motion skill's CSS-or-Motion guide); a different animation library is a dependency decision.
8. `AGENTS.md` Skills bullet on vendored material: add that vendored reference files inside a project skill carry an upstream header and that skill's `NOTICE`, and only their "Project notes" are edited (stays ≤ 150 lines; 102 today).
9. A test in `tests/agent-config.test.ts`: every reference file whose first line is the vendored header names a 40-hex commit and its skill folder has a `NOTICE` that mentions that file.
10. Release checklist: one Latest changes entry (agent docs only; nothing visible on the site).

## Existing System Evidence

- `tests/agent-config.test.ts` lines 400-424 (SKILL.md ≤ 200, vendored ≤ 500; references ≤ 150 lines, Contents heading over 100) and 458-466 (`NOTICE` for skills with `metadata.vendored: "true"`).
- `.agents/skills/motion/SKILL.md` and `NOTICE`: the existing vendoring pattern (source URL, `upstream-commit`, MIT text, list of modifications).
- `.agents/skills/reviewing-engineering-changes/SKILL.md` (91 lines; "Review checklist" at line 31; `references/admin-ux-gate.md`).
- `.agents/skills/designing-ui-components/SKILL.md` (193 lines; "6. Verify" at line 168).
- `.agents/skills/motion-system-orchestration/SKILL.md:14` (the wrong claim); `package.json` `"motion": "^14.0.0"`; `src/shared/layout/MotionRoot.tsx`; `grep -rln 'from "motion' src`.
- Upstream metadata from `gh api repos/vercel-labs/web-interface-guidelines` (MIT, default branch `main`, not archived) and `…/commits/main` (SHA above); files `AGENTS.md` 7,995 bytes, `LICENSE` 1,068 bytes, `README.md`, `command.md`.
- `tests/documentation.test.ts` checks every local doc link.

## Owner

`reviewing-engineering-changes` owns the vendored references because the upstream text is a review checklist; `designing-ui-components` links to them rather than holding a second copy. `motion-system-orchestration` owns its own correction.

## Source of Truth

The upstream repository at the pinned SHA is the authority for the vendored text; the two reference files are its only copy in this repo, with attribution in `NOTICE`. Project-specific rules stay in our own skills and tokens; Project notes only point to them and name conflicts.

## Product Decisions Required

None. Approved by the maintainer on 2026-10-18; placement and splitting are agent-documentation engineering choices.

## Decisions

- D-1: Vendor the guidelines into the review and design skills (chosen by the maintainer, 2026-10-18).
- D-2: Vendor upstream `AGENTS.md` (agent-oriented list) rather than the README prose, and leave out the Vercel-specific copywriting and promotional sections (chosen by the planner, 2026-10-18; rejected: the README, which is longer and mixes in Vercel brand rules).
- D-3: One copy under `reviewing-engineering-changes/references/`, linked from `designing-ui-components` (rejected: a copy in each skill, which would duplicate).

## Board Self-Sufficiency Check

Not applicable to board members: this changes only agent instructions and tests; nothing on the site or dashboard changes, and no board-owned value moves into code or config. Board-facing UI keeps following the admin UX gate.

## Implementation Constraints

- Do not edit upstream text inside the vendored files (only the header comment, the Contents heading and Project notes are local).
- Do not mark `reviewing-engineering-changes` as `vendored: "true"`.
- Do not install the upstream `web-design-guidelines` skill or run `install.sh`; do not add dependencies.
- Must not exceed size budgets: SKILL.md ≤ 200, references ≤ 150, `AGENTS.md` ≤ 150.
- Must not change any other skill text than the lines named above; run `npm run agents:sync` only if the drift test asks for it after editing SKILL.md frontmatter.
- Allowed files: the two new reference files, the new `NOTICE`, the three SKILL.md files named, `AGENTS.md`, `tests/agent-config.test.ts`, `docs/release-checklist.md`, generated skill metadata if `agents:sync` rewrites it, this contract copied to `docs/contracts/vercel-web-interface-guidelines.md` with `status: approved`.

## Test Strategy

`npm run check` (includes `tests/agent-config.test.ts` budgets, Contents headings, NOTICE rules and the new vendored-reference test, and `tests/documentation.test.ts` link checks). Reviewer diffs each vendored file's upstream portion against the pinned upstream `AGENTS.md` lines (only the header, Contents and Project notes may differ) and reads the Project notes against the named skills and files.

## Acceptance Criteria

- An agent reviewing a UI pull request finds the two guideline references from the review checklist and from the design skill's Verify step, with a Project notes section that says which rules this project overrides (optimistic saves, locale formats, APCA) and why.
- The NOTICE names the upstream repository, the exact commit and the MIT license; the vendored text matches upstream at that commit.
- The motion-system-orchestration skill describes the installed Motion setup correctly.
- `npm run check` passes.
