# 0020. Format rules, fixed product rules and changeable settings

- Status: Accepted
- Date: 2026-10-05

## Context

Rules about what the site accepts were spread across zod schemas, components, server actions and the database, and every new feature asked again whether a rule should be a board setting. The user asked for one clear place per kind of rule and for settings only where a rule is likely to change (PR6 contract, D-19 and the answer sheets of 2026-10-05). Full reasoning: [PR6 contract](../contracts/pr6-go2pay-payments.md).

## Decision

1. Format and integrity checks (shape, length, type, references, ordering such as end ≥ start) live in zod schemas and database constraints.
2. Product rules that make sense and rarely change are named constants and functions in **one policy module per area** (`<area>-policy.ts`), never scattered through components or actions. A database copy exists only where RLS must enforce the rule, declared as a mirror.
3. Only rules likely to change become board-editable data (for example season dates). Not everything is a setting.
4. Validation stays sensible, not strict: no limit on future dates unless a real need appears.
5. Every default is a recorded decision and is shown where it applies; none is silent.
6. Security and legal rules (permissions, consent) stay in the database under their ADRs.
7. There is no universal rule object and no rules engine. Existing rules are classified by the rules-audit contract and moved in small PRs.

## Consequences

- PR6's rules live in `src/lib/community/payment-policy.ts` and `season-policy.ts` (for example the four categories, the fee line and the closing-soon window).
- Changing a fixed product rule is a developer change with a recorded decision; the board changes only the settings that are data.
- The rules audit (roadmap PR6 WP-11) is its own contract and moves existing rules later, in small PRs.
