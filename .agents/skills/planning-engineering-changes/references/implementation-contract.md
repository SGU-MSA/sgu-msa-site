# Implementation contract template

The single template for plans and contracts. Copy everything below the line into `.plans/<feature>.md`, replace every `<...>`, then run `node scripts/validate-plan.mjs .plans/<feature>.md`.

## Contents

- Conventions (headings, product decisions, lightweight mode)
- Template

## Conventions

- Headings are `## <Section>` exactly as written; keep the order. Write "None." with a reason where a section does not apply.
- **Product Decisions Required:** one checkbox per decision. Unanswered: `- [ ] <question>` followed by indented `Options:` and `Recommendation:` lines. Answered: tick it (`- [x]`) and add an indented `Decision: D-<n>` line (or `Decision: ADR-NNNN`). The validator rejects any `- [ ]` and any `- [x]` without a `Decision:` line. Write "None." when the change involves no product or design choice.
- **Decisions:** the durable record of the user's answers, one per line: `D-<n>: <choice> (chosen by <who>, <date>; options rejected: <...>)`. Cross-cutting or long-lived choices also get an ADR in `docs/adr/`.
- **Lightweight mode** (`mode: light`): keep only Capability, Requested Behavior, Existing System Evidence, Owner, Source of Truth, Product Decisions Required, Decisions, Board Self-Sufficiency Check, Implementation Constraints, Test Strategy, Acceptance Criteria.
- `status` is `draft` in `.plans/`, `approved` once moved to `docs/contracts/`, `done` after merge.

---

```markdown
---
status: draft
mode: full
---

# <Feature name>

## Capability

<The system capability that changes, phrased as a capability, not a UI task.>

## Requested Behavior

<User-visible and business behavior. Non-goals. Acceptance criteria given by the user.>

## Existing System Evidence

- `<path>` `<symbol>`: <what it owns; why it matters>
- <Or: "Repository inspection impossible because ...; assumptions marked below.">

## Owner

<Module or feature that owns the capability, and why.>

## Source of Truth

<For each rule or state: authoritative location (table, constraint, RLS policy, zod schema) and any declared UX mirrors.>

## Reuse and Duplication Analysis

<What is reused unchanged, what is extended, what was searched for and not found (with search terms).>

## New Abstractions

<"No new shared abstractions." or, per abstraction: Name / Responsibility / Why the existing owner cannot hold it / Variation isolated / Consumers / Public API / Private details / Pattern name if any.>

## Product Decisions Required

- [ ] <Question for the user>
  Options: <A>; <B>; <C>
  Recommendation: <option and why; link to mockup or screenshot>

## Decisions

<"None." or D-1: <choice> (chosen by <who>, <date>; options rejected: <...>)>

## Board Self-Sufficiency Check

<Can a board member make every change they will plausibly want here from /admin, without a developer or redeploy? Which dashboard screen, which help entry? If not, why not, and is that a recorded decision?>

## Design

<Smallest coherent change. Flow diagram (mermaid or ASCII) for anything with more than one hop.>

## Public Contract

<Exported functions, server action signatures, zod schemas, table columns, RLS policies, routes.>

## Private Implementation

<What stays internal and may be decided by the implementer.>

## Data and State Flow

<Where data is read, validated, written, cached and revalidated; which client/provider is used.>

## Failure Modes

<Expected behavior (not just risks) for: Supabase unavailable, stale version, session expiry, double submit, invalid upload, external service failure.>

## Compatibility and Migration

<Migration file, before/after-deploy compatibility, defaults/backfill, RLS/grants, rollback, staging-then-production steps. "None." if no schema change.>

## Parallel Work and Merge Order

<Effects block per work package (see parallel-agents.md), dependency list, merge order.>

## Work Packages

### WP-1: <name>

- Purpose:
- Depends on:
- Expected files:
- Reuse:
- Required changes:
- Must not:
- Tests:
- Done when:

## Implementation Constraints

- Do not <specific, realistic negative constraint>.
- Must not <...>.

## Worker Escalation Conditions

<When the implementer must stop and emit PLAN MISMATCH.>

## Test Strategy

<Unit tests in tests/*.test.ts, e2e in tests/e2e, manual checks in the dashboard, npm run check.>

## Acceptance Criteria

- <Observable outcome a board member or visitor can verify; never "code is clean".>

## Open Risks or Escalations

<"None. Plan is ready for delegation." or the open items.>
```
