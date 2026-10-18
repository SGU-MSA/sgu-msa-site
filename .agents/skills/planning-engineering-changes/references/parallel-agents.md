# Parallel agents

## Textual vs semantic conflicts

Git catches two agents editing the same line. It does not catch two agents each adding an "is this user an admin?" helper in different files, or two image uploaders. That is an architectural conflict with no merge conflict. Plan for semantic overlap, not just file overlap.

## Declare architectural effects per work package

```yaml
WP-2:
  consumes: [currentAdmin, contentEditor, recordSchema]
  extends: [src/features/admin/actions.ts]
  creates: [supabase/migrations/<timestamp>_funds.sql]
  shared_contract_changes: [new table public.funds, new zod fundSchema]
  potential_conflicts: [WP-3 also edits the dashboard card list]
  depends_on: [WP-1]
  integration_owner: planner
```

## Rules

- **Shared foundations get one owner.** Migrations, zod schemas, `src/lib/backend/*`, `src/features/admin/actions.ts` and dashboard navigation have exactly one work package that changes them per batch. Consumers parallelize after that boundary is stable.
- **No independent refactors of the same abstraction.** If two packages want to change `ContentEditor`, one does it first.
- **Plan around contracts.** Agree the schema, RLS policy and server action signature before UI work starts.
- **Dependency classes:**
  - *hard*: B cannot start until A is merged (UI needs the table);
  - *contract*: B can start against the agreed interface, merges after A;
  - *integration*: independent, but needs a joint check after both merge;
  - *none*: fully independent.
- **Merge order by dependency, not completion time.** Migrations first, then server code, then UI, then docs/help.
- **Re-check assumptions before merge.** Rebase, rerun `npm run check`, and confirm the contract still matches the code.
- **One integration owner** (the planning model) does cross-package consistency and the final review with `reviewing-engineering-changes`.
- **Shared checkout hygiene.** Parallel agents in one checkout must own disjoint files and must not run competing full builds; only the integration owner runs `npm run check` / `npm run build` at the end.

## Worker escalation

Workers that hit a contradiction stop and report, never improvise:

```text
PLAN MISMATCH
Expected: <what the contract said>
Observed: <what the repository actually does>
Impact: <what cannot be done as planned>
Files / capabilities involved: <paths, symbols>
No alternative architecture was introduced.
```
