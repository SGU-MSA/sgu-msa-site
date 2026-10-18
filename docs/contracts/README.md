# Feature contracts

A contract is the approved plan for one non-trivial change: what capability changes, who owns it, what must be reused, which product decisions the user made, and how completion is checked. Implementers build exactly what the contract says and report a `PLAN MISMATCH` instead of improvising.

- **Template:** the single copy lives in [`.agents/skills/planning-engineering-changes/references/implementation-contract.md`](../../.agents/skills/planning-engineering-changes/references/implementation-contract.md). Do not copy it elsewhere.
- **Drafts** are written in `.plans/<feature>.md` (not committed). A draft moves here as `docs/contracts/<feature>.md` once every product decision is answered by the user.
- **Status** (front matter): `draft` while being written, `approved` when the user has signed off, `done` once merged. Never rewrite an approved contract silently; amend it with the user and note the change under `Decisions`.
- **Check structure:** `node scripts/validate-plan.mjs docs/contracts/<feature>.md` (add `--light` for lightweight contracts).
- Cross-cutting decisions also get an ADR in [`docs/adr/`](../adr/README.md).
