---
status: approved
mode: light
---

# PR template "At a glance", its CI check, and side-by-side design options

Ticket: SGU-MSA/sgu-msa-site-private-history#109 (process). Base: `origin/main`. PR target: `main`.

## Capability

Every pull request states in five seconds what it is, who notices, its risk, database and hosted-setting needs, how to roll it back and what to look at; CI refuses a PR whose "At a glance" table was left at the template defaults. Design choices are always shown side by side.

## Requested Behavior

1. Replace `.github/pull_request_template.md` with this structure (keep the existing merge note paragraph at the end, updated wording ok):
   - `## At a glance` table, rows: **Type** (`Feature · Fix · Design · Docs/process`), **Who notices** (`Visitors · Board (dashboard) · Developers only`), **Risk** (`Low · Medium · High: one line why`), **Database migration** (`None · Yes: file.sql, applied to staging ☐ production ☐ before merge`), **Hosted settings** (`None · list (Vercel/Supabase), done ☐`), **Rollback** (`Vercel Instant Rollback is enough · Needs more: explain (e.g. migration is additive, old code still works)`), **Preview** (`Vercel posts the link; pages to check: …`).
   - `## What changed and why` (plain language, 2–5 lines), `## What to look at` (numbered steps on the preview: pages, light/dark, phone/desktop), `## Screenshots (UI changes)` (before/after, phone + desktop), `## Links` (ticket · contract · ADR), `## Checks` (`npm run check`/CI green/independent review; release-checklist Latest changes entry; no secrets or personal data; board can manage it or gap ticketed), `## Handbook notes` (or "none").
2. New `scripts/check-pr-body.mjs` (Node, no dependencies): reads the PR body (from `GITHUB_EVENT_PATH` → `pull_request.body`, or a file path argument for tests) and the template; fails with a clear message listing each problem when: the `## At a glance` section is missing; any of the seven rows is missing; any row's value is still exactly the template default. Skips (exit 0 with a note) when the PR author is a bot (`user.type === "Bot"`). Export a pure function for tests.
3. CI: add a step to the existing `quality` job in `.github/workflows/validate.yml` that runs the script on `pull_request` events (no new required check, no new job). Make sure `pull_request` `edited` events re-run it (add `types: [opened, synchronize, reopened, edited]`) — confirm this does not disturb the other jobs' triggers or required checks.
4. Unit tests `tests/pr-body.test.ts`: template defaults fail; filled body passes; missing section fails; bot skipped.
5. Side-by-side design options: in `.agents/skills/designing-ui-components/SKILL.md` (respect the ≤200-line budget), change the pictured-options step so options are shown **side by side on one interactive page** — a throwaway Storybook comparison story ("Design options/…") with light and dark panels and plain captions, plus the real page in context if useful — never as query-string switches or one-option-at-a-time previews. Mirror one line in `docs/guides/developer.md` where design options are described.
6. `docs/release-checklist.md`: top of **Latest changes** entry. `docs/guides/developer.md`: one sentence that the PR body is checked.

## Existing System Evidence

`.github/pull_request_template.md`, `.github/workflows/validate.yml` (`quality` job, PR triggers `main` and `integration/**`), `.agents/skills/designing-ui-components/SKILL.md`, `tests/agent-config.test.ts` (skill size budgets), `tests/documentation.test.ts`.

## Owner

`.github` owns the template and CI; the script lives in `scripts/`; the design skill owns how options are presented.

## Source of Truth

The template file itself is the source of the default values the script compares against (no second copy of the defaults in code).

## Product Decisions Required

None.

## Decisions

- D-1 (maintainer, 2026-10-18): adopt the proposed template and the CI check.
- D-2 (maintainer, 2026-10-18, amended): design options are judged in their real context on real devices. Each option is built in the real component or page at its real size and pushed as a throwaway branch `option/<topic>-<n>` so Vercel gives it a preview link (staging data). Links are given to the maintainer grouped by decision, with device limits noted (for example iPhone Safari lacks `corner-shape`). A side-by-side Storybook comparison may help quick scanning but is never the only basis; no query-string switches or isolated, enlarged mockups. Option branches and any staging test data are deleted after the decision. This supersedes the earlier "side by side on one interactive page" wording in Requested Behavior 5.

## Board Self-Sufficiency Check

Not applicable: this changes only the developer pull request process, so board members and the handbook are unaffected.

## Implementation Constraints

- Allowed files: `.github/pull_request_template.md`, `.github/workflows/validate.yml`, `scripts/check-pr-body.mjs`, `tests/pr-body.test.ts`, `package.json` (format-check path list only, if the script must be covered), `.agents/skills/designing-ui-components/SKILL.md`, `docs/guides/developer.md`, `docs/release-checklist.md`, this contract copied to `docs/contracts/pr-template.md`.
- Do not add dependencies. Do not add a new required status check or job. Do not change other workflow jobs. (Amended: the separate `pr-body` workflow is allowed, and making `pr-body` a required check on `main` after merge is approved by the maintainer, done by the planner.)
- Branch `chore/pr-template` from `origin/main`. Fill the new template in the PR body you prepare (`.plans/pr-template-body.md`), so the PR passes its own check.

## Test Strategy

`npm run check`; run the script locally against the filled body file and against the raw template (must fail).

## Acceptance Criteria

- New template in place; script fails on defaults and passes on a filled body; CI runs it in `quality`.
- Skill and developer guide state the side-by-side rule.

## Amendment (planner, after review of PR #6)

The body check runs in its own workflow `.github/workflows/pr-body.yml` (job `pr-body`; types opened, edited, synchronize, reopened; concurrency per PR), not in `quality`; `validate.yml` is unchanged from `main`. The script fails closed when the template lacks the section and reports empty cells separately.

## Amendment 2 (maintainer)

"At a glance" uses tick-box groups under `###` headings instead of a table (GitHub templates have no dropdowns): Type (one), Who notices (one or more), Risk (one; Medium/High need "Why:"), Database migration (one; Yes needs "File:" and both "Applied to" boxes), Hosted settings (one of None / Before merge / After merge; both need "What:", only Before merge needs "Done"; After merge items are tracked in the release-checklist entry), Rollback (one; "Needs more" needs "How:"), Preview (one; "Check these pages" needs "Pages:"). Free text only where an explanation is needed. The template is the single source of each group's options: the script reads them from it and validates the body against them, so a new option is accepted without a code change. The script holds only rule metadata (which groups allow several answers, which follow-up line or box an option requires). If the template and the rules disagree (an unknown group, an unknown follow-up line, or a rule option or line missing from the template) the check fails with "the template and the PR body check are out of sync". This supersedes the table rows in Requested Behavior 1 and the row checks in 2.
