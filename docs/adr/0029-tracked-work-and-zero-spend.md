# 0029. Tracked work, $0 spending and separate documentation audiences

- Status: Accepted
- Date: 2026-10-12

## Context

The user requested visible tickets and progress updates after the initial handoff produced an unexpected code PR. They require infrastructure to remain free and want owner/developer/AI instructions kept separate from board product instructions.

## Decision

Chosen by the user on 2026-10-12:

- Create or link a GitHub issue before each task. Explain the scope before implementation, link tickets/contracts in PRs and give concise progress updates. Issues track execution; the roadmap summarizes scope/dependencies. Untracked work and competing status trackers were rejected.
- Infrastructure authorization is $0. A paid plan, subscription, add-on or overage requires a new explicit user decision. Verify actual account funding and enforced metered-usage controls; alerts do not establish a spending cap, and budgets do not control every subscription.
- Reuse the existing audience owners: board product usage in the board-owned handbook (ADR 0028); accounts/billing/hosting/backups in owner setup; code/navigation/testing in the developer guide; AI procedure in AGENTS.md and skills. Avoid parallel how-to documents.
- Make changeable board-owned choices dashboard data, behind existing ports and focused abstractions for real variation. This extends board self-sufficiency (ADR 0002); it does not require speculative plugin frameworks or a configuration switch for every implementation detail.

## Consequences

- Current ecosystem issues are created in the existing private repository and move with a history-preserving transfer. Organization creation does not mean transfer, invitations or billing checks are complete.
- PR #108 remains a separate draft whose code scope is reviewed in issue #111; this decision does not approve merging or deploying it.
- Existing plan, design approval, integration release, testing and production restrictions remain in force.
