# 0032. Delegated implementation and human merge

- Status: Accepted
- Date: 2026-10-14

## Context

The maintainer wants a capable planner to specify work, lower-cost agents to implement bounded contracts, and an independent capable reviewer to verify behavior and edge cases. The latest instruction reserves final review and merge for the maintainer, superseding the earlier standing authorization to merge passing changes into integration.

## Decision

- Use one shared workflow: inspect/plan → delegated implementation → independent review and relevant tests → maintainer review/merge. Fixes return to an implementer and are rechecked.
- AGENTS.md and .agents/roles define the process once. Native Claude/Codex agent definitions are thin model/reference adapters; credentials and MCP configuration retain their existing owners.
- Use available Luna/Sonnet implementation models and capable planning/review models. Check actual availability and disclose substitutions. Model aliases/settings are preferences, not guarantees about a client's account or permissions.
- Approved contracts live in docs/contracts; ignored .plans holds drafts. GitHub issues, milestones and the Project track execution and link the contract. No per-message hook or autonomous queue service is needed.
- Planning/review agents may write process documentation and run diagnostics. Product, test and tooling implementation is delegated. Agent review and passing CI do not authorize merge, publication or deployment.

## Consequences

The maintainer receives a concrete PR with contract, test results and independent findings. Native adapters inherit client/runtime permissions; role instructions are not an independent sandbox. Missing agent/model support is disclosed instead of bypassed. Earlier approved plans remain approved, but explicitly unresolved product/visual decisions still need a bounded child contract before implementation.
