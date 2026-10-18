---
name: planning-engineering-changes
description: Plans architecture-safe changes to this Next.js + Supabase site and produces an implementation contract that a delegated coding agent can execute without making architecture or product decisions. Use when planning a feature or epic, adding a board-editable setting, changing a Supabase table, RLS policy, server action or admin dashboard screen, deciding code ownership or reuse, introducing or extending an abstraction, splitting work across parallel agents, or writing instructions for another agent. Not for one-line fixes, copy edits, standalone utility functions, or reviewing a finished diff (use reviewing-engineering-changes).
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(node scripts/validate-plan.mjs:*)
  - Bash(git log:*)
  - Bash(git diff:*)
  - mcp__supabase__list_tables
  - mcp__supabase__list_migrations
  - mcp__supabase__execute_sql
  - mcp__supabase__search_docs
  - mcp__next-devtools__nextjs_index
  - mcp__next-devtools__nextjs_call
  - mcp__next-devtools__nextjs_docs
---

# Planning engineering changes

Design the change before delegating it. The output is an evidence-based contract that says what capability changes, where it belongs, what must be reused, where state and rules are authoritative, what the board can change without a developer, what may run in parallel, what must not be duplicated or bypassed, and how completion is verified. Optimize for coherent fit, not speed. Existing repo conventions beat generic preferences unless the task is to change them.

## Core rule

Before asking "what code should be written?", answer:

1. What system capability is changing?
2. Does it already exist (search before inventing)?
3. Who owns it?
4. Where is its source of truth (Supabase row + RLS, zod schema, content YAML, env var)?
5. Which public boundary should consumers use?
6. What is the smallest coherent change?

Never invent architecture before inspecting the repository.

## Repository non-negotiables

- **Read `docs/adr/README.md` first**, then `docs/roadmap.md` and `docs/architecture.md`. Accepted ADRs bind the plan; changing one needs a new superseding ADR, which is a user decision.
- **Agents never make product or design decisions.** List every one under `Product Decisions Required`, ask the user with 2-3 options plus a recommendation (pictures or rendered mockups when the choice is visual), then record the answer under `Decisions` or in a new ADR. A plan with an unanswered decision is not ready.
- **Board self-sufficiency is the motto.** Anything a board member may want to change must be editable from `/admin` without a developer, code edit or redeploy. Fill in `Board Self-Sufficiency Check` for every plan. Content YAML (`content/*.yaml`) and env vars (for example `DONATION_URL`) need a developer; Supabase rows edited through `src/features/admin/` do not. A gap that remains must be a recorded decision and appear on `docs/roadmap.md`.
- **Payments know only Go2Pay** (ADR 0005). No other payment channel appears in code, dashboard or docs; nothing may hide money from required university reporting.
- **One place per contract.** Data shapes live in zod schemas (`src/lib/community/schema.ts`, `src/lib/content/schemas.ts`) plus `supabase/migrations/`; never a second hand-written copy.

## Workflow checklist

Copy this list into the draft and tick items as you go.

- [ ] 1. **Scope.** User-visible behavior, business behavior, page/server/data-contract changes, explicit non-goals, acceptance criteria. Separate what was requested from implementation assumptions.
- [ ] 2. **Inspect existing code.** Search by concept and synonyms across `src/app`, `src/features`, `src/lib` (`backend/`, `community/`, `content/`, `integrations/`, `prayer/`), `supabase/migrations`, `src/proxy.ts`, `tests/`, `scripts/`, `docs/contracts/`, `.plans/`. Read call sites, not just definitions. Check `git log`/`git diff` for in-flight work. Without repo access, mark assumptions and never claim reuse was checked.
- [ ] 3. **Capability and owner.** Express the task as a capability ("show a Zakat button" becomes "board-managed Go2Pay funds"). Prefer extending the existing owner; otherwise pick the narrowest coherent owner.
- [ ] 4. **Semantic duplication, repo-wide.** Business rules, visibility, auth/admin checks, data access, caching/revalidation, uploads, formatting, error copy, persistence. Different syntax can encode the same rule.
- [ ] 5. **Sources of truth and boundaries.** For each rule or state: authoritative location (usually Postgres constraint + RLS) versus UX mirror (zod, disabled buttons). Security-sensitive rules are never client-only. Define the public interface; hide internals.
- [ ] 6. **Reuse, extend, create** in that order: reuse unchanged; extend the owner coherently; extract a repeated concept to its proper owner; create new only when ownership is genuinely new. No speculative abstractions, but do abstract a real invariant, state owner or external boundary.
- [ ] 7. **Beyond the happy path**, realistic cases only: Supabase unavailable, retry/double submit, idempotency, stale `updated_at` (two editors), session expiry mid-edit, revalidation lag, out-of-order webhooks, deployment skew (old server action IDs), partial migration rollout, authorization failure.
- [ ] 8. **Dashboard UI.** For any admin screen or dashboard-controlled public result, the contract lists every UI state (empty, error, unsaved, saving, saved, archived, disabled), the prevention rules (date limits, hidden or disabled controls) and where the content appears, as the [admin UX gate](../reviewing-engineering-changes/references/admin-ux-gate.md) requires.
- [ ] 9. **Product decisions and board check.** Collect every product/design choice; ask the user; record answers. Complete the Board Self-Sufficiency Check.
- [ ] 10. **Parallel work.** Shared capabilities and contracts touched, file and semantic overlap, prerequisites, merge order, one integration owner. See [parallel-agents.md](references/parallel-agents.md).
- [ ] 11. **Write the contract** from [implementation-contract.md](references/implementation-contract.md), specific enough that a cheaper agent executes it without repo-level decisions. Give positive and negative constraints.
  - Bad: "Implement fund editing using existing patterns."
  - Good: "Extend `src/features/admin/actions.ts` with `saveFundAction` using `currentAdmin()` and the `updated_at` version check. Do not create a second Supabase client, a new auth helper, a client-side store, or a fund list in `content/*.yaml`."
- [ ] 12. **Validate.** Run `node scripts/validate-plan.mjs .plans/<feature>.md` (add `--light` in lightweight mode). Fix and rerun until it passes. The validator checks structure, not architecture: still review the design against [engineering-principles.md](references/engineering-principles.md).

## Lightweight mode

Use for small, low-risk changes: one owner, no new table/RLS policy/abstraction, no payments or auth change, no parallel work. Required sections: Capability, Requested Behavior, Existing System Evidence, Owner, Source of Truth, Product Decisions Required, Decisions, Board Self-Sufficiency Check, Implementation Constraints, Test Strategy, Acceptance Criteria. Mark `mode: light` in the front matter or pass `--light`. If inspection shows any exclusion applies, switch to the full contract.

Trivial edits (typo, copy fix, dependency bump, isolated helper) need no contract at all.

## Where plans live

- Draft: `.plans/<feature>.md` (gitignored scratch).
- Approved: move to `docs/contracts/<feature>.md` with `status: approved` once the user has answered every product decision. Set `status: done` when merged. See `docs/contracts/README.md`.
- Cross-cutting or long-lived decisions: a new ADR in `docs/adr/` (immutable; supersede, never edit).

## Gathering evidence with MCP (read-only)

- **Supabase (staging; use read-only evidence queries while planning):** `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`, `mcp__supabase__execute_sql` (SELECT only, to confirm columns, policies via `pg_policies`, row counts), `mcp__supabase__search_docs`. If unavailable, read `supabase/migrations/*.sql` and the zod schemas, and mark live-state claims as unverified. Never point any tool at production.
- **Next.js dev server:** `mcp__next-devtools__nextjs_index`, then `mcp__next-devtools__nextjs_call` with `get_errors`, `get_page_metadata` or `get_server_action_by_id`; `mcp__next-devtools__nextjs_docs` for version-accurate docs. If unavailable, read `node_modules/next/dist/docs/` directly. This Next.js version differs from training data; verify APIs there.

## Delegation boundary

The implementer may decide: private names, straightforward private helpers, control flow, formatting, test fixture details.

The implementer must not introduce on their own: a new Supabase client or data provider, global state, Context/Provider, service layer, shared hook, domain abstraction, persistence mechanism (table, bucket, YAML file, env var), auth/admin check, RLS policy, cross-feature dependency, public API expansion, new business-rule source of truth, or any product/design choice.

When reality contradicts the plan, the implementer stops and reports:

```text
PLAN MISMATCH
Expected: <what the contract said>
Observed: <what the repository actually does>
Impact: <what cannot be done as planned>
Files / capabilities involved: <paths, symbols>
No alternative architecture was introduced.
```

## Escalate and re-plan when

- the proposed owner does not own the concept, or a dependency cycle appears;
- another active task or contract implements the same capability;
- an existing abstraction has incompatible semantics;
- an undeclared shared-contract change is needed (schema, migration, RLS, server action signature);
- behavior contradicts tests, constraints or an accepted ADR;
- rollout order is impossible (for example a migration that production code cannot tolerate);
- a "local" change creates repo-wide coupling;
- a board-editable need would end up in YAML, env vars or code.

Never resolve a mismatch with an ad hoc duplicate abstraction.

## Reference map

| Need | Read |
| --- | --- |
| Engineering judgment (ownership, abstraction test, SOLID, state machines, idempotency) | [references/engineering-principles.md](references/engineering-principles.md) |
| Pages, server actions, client components, caching, proxy | [references/nextjs-react.md](references/nextjs-react.md) |
| Tables, RLS, migrations, storage, auth, generated types | [references/supabase.md](references/supabase.md) |
| Splitting work across agents | [references/parallel-agents.md](references/parallel-agents.md) |
| The contract template (single copy) | [references/implementation-contract.md](references/implementation-contract.md) |
| Worked examples from this repo | [references/examples.md](references/examples.md) |
