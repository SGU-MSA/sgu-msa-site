# 0016. Integration branch and Release PR

- Status: Accepted
- Date: 2026-10-03

## Context

[ADR 0010](0010-production-deploys-from-main-only.md) deploys only `main`, and only commits merged by the Vercel account owner are built. If every feature PR targeted `main`, each merge would publish on its own and the owner would have to merge every PR. Several tracks of work run in parallel and need one place to come together and be tested first.

## Decision

- **All PRs target `integration`**, branched from `integration`. The maintainer or agent merges them once CI and review pass. Nothing deploys from `integration`.
- **Going live is one standing Release PR `integration → main`**, merged only by the Vercel account owner with **Create a merge commit** (ADR 0010 still applies; it is refined, not superseded).
- Test locally from `integration` (`git checkout integration && git pull && npm run dev`); there are no preview deployments.
- D1 design prototype branches are throwaway: they are never merged; the chosen direction is rebuilt properly in PR2.
- Decided by the user (D0 follow-up, 2026-10-03); rejected: stacked PRs straight to `main`.

## Consequences

- The owner merges one PR per release instead of every feature PR.
- `integration` can hold several merged features that have not gone live; the Release PR shows exactly what will publish.
- A broken merge into `integration` is fixed there before the Release PR is merged.
