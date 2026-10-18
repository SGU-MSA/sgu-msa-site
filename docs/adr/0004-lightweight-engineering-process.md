# 0004. Lightweight engineering process

- Status: Accepted
- Date: 2026-10-02

## Context

The project is small, has one codebase and few maintainers. Heavy processes (role-based agent teams, multiple pipelines) would cost more than they save, but unplanned changes have previously produced duplicate code and stale docs.

## Decision

- **Plan before code.** Each feature starts with a plan using the planning skill: search for existing implementations, never duplicate, and list product questions for the user.
- **Contracts.** The agreed plan becomes `docs/contracts/<feature>.md` (status `draft`, `approved`, `done`), using the single template in the planning skill. Implementation starts only from an approved contract.
- **Review.** Changes are checked with the review skill before a PR, and by a human on the PR.
- **No role-based agents.** One agent plans, implements and reviews with skills; no simulated "PM/architect/QA" personas.
- **CI is `npm run check`** (plus content validation) on every PR to `main`. Vercel remains the only build/deploy integration.
- Data shapes are single-sourced in zod schemas and Supabase migrations, plus generated types once introduced.
- The PR template asks for the contract, ADRs, staging migration, diagram updates, a board self-sufficiency check and screenshots.

## Consequences

- Small fixes may skip a contract, but not the checks.
- Docs and diagrams change in the same PR as the code they describe.
