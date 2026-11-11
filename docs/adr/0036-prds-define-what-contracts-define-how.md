# 0036. PRDs define what, contracts define how

- Status: Accepted
- Date: 2026-11-11

## Context

The project has 25 feature contracts but no product requirements. A contract records how one change is built and the decisions made along the way; nothing says, per feature, who needs what and which edge cases matter. Reviews of the dashboard (for example the Prayer & iqamah screen) had no agreed stories to measure against, and the same behaviour is spread across several contracts.

## Decision

- Each feature area has one PRD, `docs/product/<feature>.md`, written for board members first: user stories with testable acceptance lines, the product rules with their sources, the real edge cases, known gaps (with tickets) and open questions. The shape lives once, in [`docs/product/README.md`](../product/README.md).
- A PRD says **what** and **why**. A [feature contract](../contracts/README.md) says **how** one change is built. Every new contract names the PRD and the stories it serves; a change that alters a feature's behaviour updates its PRD in the same pull request.
- PRDs never make product decisions. They record the maintainer's decisions with their source (ADR, contract decision or quote) and list anything undecided under Open questions ([ADR 0002](0002-product-principles.md)).
- Board how-to steps stay in the handbook ([ADR 0028](0028-board-how-to-in-one-handbook.md)); a PRD describes behaviour, not click-by-click instructions.
- Decided by the maintainer 2026-11-11 ("PRD = what, contract = how"; one file per feature).

## Consequences

- UX reviews, tests and new plans measure against the PRD stories.
- Old contracts are not rewritten; their PRDs cite them.
- One more document type to keep current; the same-PR rule keeps it honest.
