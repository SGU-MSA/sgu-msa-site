---
name: reviewing-engineering-changes
description: Reviews a diff or branch in this Next.js + Supabase repo against its implementation contract in docs/contracts, checking scope, Must-not constraints, semantic duplication and ownership, single-sourced data contracts, RLS and server authorization, secrets, board self-sufficiency, docs and ADR updates, tests, and the required admin UX gate for dashboard changes. Use when asked to review a change, a pull request or a delegated agent's work before merge, or to check that an implementation matches its plan. Not for designing tooling such as CI gates or regression budgets, or writing visual, accessibility or end-to-end tests (frontend-testing-visual-qa), or planning a new change (planning-engineering-changes).
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git status:*)
  - Bash(npm run check)
  - Bash(node scripts/validate-plan.mjs:*)
  - mcp__next-devtools__nextjs_index
  - mcp__next-devtools__nextjs_call
  - mcp__supabase__list_tables
  - mcp__supabase__execute_sql
---

# Reviewing engineering changes

Judge the change against its contract and the repo's principles, not against personal taste. Report findings; do not rewrite the change during review.

## Inputs

1. The diff: `git diff <base>...HEAD` (or the PR / working tree the user names).
2. The contract: `docs/contracts/<feature>.md` (or the `.plans/` draft). Structure is defined once in [the contract template](../planning-engineering-changes/references/implementation-contract.md); do not restate it.
3. `docs/adr/README.md` and any ADR the contract cites.

No contract for a non-trivial change is itself a finding (severity high): the work skipped planning. For trivial edits, review against the principles only.

## Review checklist

Copy and tick:

- [ ] **Contract status.** `node scripts/validate-plan.mjs <contract>` passes; `status` is `approved`; no `- [ ]` product decision remains.
- [ ] **Scope.** Every changed file is in a work package's expected files or clearly private implementation. Anything else is scope creep or a PLAN MISMATCH that was not reported.
- [ ] **Must-not constraints.** Check each `Must not` / `Do not` line from the contract and its work packages against the diff, one by one.
- [ ] **Product decisions.** No product or design choice appears in the diff that is not recorded under `Decisions` or in an ADR (copy, layout, defaults, which options exist).
- [ ] **Ownership and duplication.** Search the repo for the concepts the diff introduces. Flag semantic duplicates: a second Supabase client, a second admin check, a second uploader, a second visibility rule, a new `utils`/`helpers` module, a Context or store holding server data. Cite principles from [engineering-principles.md](../planning-engineering-changes/references/engineering-principles.md) by number.
- [ ] **Single-sourced contracts.** Data shapes change in the zod schema and the migration together (plus generated types if the repo has them); no hand-written third copy; content YAML schemas live only in `src/lib/content/schemas.ts`.
- [ ] **Security.** New tables enable RLS with `public_read` / `admin_manage` via `is_admin()`; every mutating server action calls `currentAdmin()`; no secret key, `NEXT_PUBLIC_` secret, `.env*` value or personal path in the diff; uploads go through `normalizeUpload` and `contentEditor().upload`.
- [ ] **Migrations.** Each schema change is a new additive migration file dated after the baseline, with an explicit compatibility plan; staging-first rollout with the user's OK noted; nothing applied to production by an agent. A diff that edits a baseline migration (`supabase/migrations/202610150001`-`202610150004`) is a blocker.
- [ ] **Payments** (ADR 0005). Only Go2Pay appears; keys are server-only; orders are re-verified with `GET /orders/{id}` and recorded idempotently; nothing hides money from required university reporting.
- [ ] **Release checklist.** `docs/release-checklist.md` **Unreleased** lists the change in plain language, step-by-step test instructions, any new settings, and every unconfirmed value under "Needs your confirmation". Missing entries are Medium findings.
- [ ] **Board self-sufficiency.** Anything the board will plausibly want to change is editable in `/admin` with plain-language labels and board steps under "Handbook notes" in the PR body (ADR 0028). New YAML fields or env vars for board-owned facts are findings unless the contract records the decision and `docs/roadmap.md` lists the gap.
- [ ] **Failure modes.** The behaviors listed in the contract's Failure Modes section exist in code (unavailable state, version conflict message, session-expired message, idempotency).
- [ ] **Docs.** When a flow, data path or ownership changed: `docs/architecture.md` diagrams, the relevant guide in `docs/guides/`, `docs/roadmap.md`, the handbook ("Handbook notes", including its "Only a developer can do this" table), and a new ADR if a cross-cutting decision was made. Contract `status` becomes `done` on merge.
- [ ] **Tests and gate.** Tests named in the contract exist and assert observable behavior; `npm run check` passes (run it, or state that it was not run).

## Required: admin UX gate

For any change to the dashboard (`/admin`), a dashboard-controlled public result, or other board-facing UI, run the [admin UX gate](references/admin-ux-gate.md). Copy its Final QA checklist into the review and mark every heading (Usability, Validation, State, Permissions, Consistency, Public result, Responsive) as passed, or explain why it does not apply. The verdict cannot be "approve" (ok to merge) while any heading is unchecked and unexplained; a failed heading is at least a High finding. Check that the screenshots it asks for exist and were looked at.

Use read-only evidence where it helps: `mcp__next-devtools__nextjs_call` with `get_errors` on a running dev server, and `mcp__supabase__list_tables` / read-only `mcp__supabase__execute_sql` (staging only, for example `pg_policies`). If unavailable, read the code and migrations and say the live state was not verified.

## Severity

- **Blocker:** security or authorization gap, secret or personal data exposed, production touched, unrecorded product decision shipped, payment rule violated, data loss, a baseline migration edited.
- **High:** contract violation (Must-not broken, out-of-scope change), semantic duplication of an owned concept, board-owned fact made developer-only, missing migration compatibility.
- **Medium:** missing failure-mode handling, missing or weak tests, docs/ADR not updated.
- **Low:** naming, readability, small inconsistencies with conventions.

## Output format

```text
REVIEW: <feature> against docs/contracts/<feature>.md
Verdict: approve | approve with fixes | request changes
Checks: npm run check <passed | failed | not run>; validate-plan <passed | failed>; UX gate <passed | explained | not applicable>

BLOCKER
1. <path>:<line> <finding>. Why: <contract line or principle #>. Fix: <smallest correct change>.
HIGH
...
MEDIUM
...
LOW
...
```

Omit empty severity groups. When the code contradicts the contract and the contract looks wrong, do not pick a side; report it for the planner:

```text
PLAN MISMATCH
Expected: <what the contract said>
Observed: <what the diff or repository does>
Impact: <what is affected>
Files / capabilities involved: <paths, symbols>
No alternative architecture was introduced.
```

Product questions surfaced by the review go to the user as options with a recommendation, never decided in the review.
