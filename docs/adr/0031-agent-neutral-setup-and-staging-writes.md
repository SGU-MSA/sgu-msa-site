# 0031. Agent-neutral setup and staging writes

- Status: Accepted
- Date: 2026-10-14
- Partially supersedes: [ADR 0003](0003-shared-agent-configuration.md) for the canonical skills directory, and [ADR 0030](0030-project-local-mcp-additions.md) for the staging read-only default and manual private registration.

## Context

The user explicitly corrected staging to read/write and required the repository to be agent-agnostic, with working Claude and Codex configuration. Shared policy must not depend on a particular client or drift between private configurations.

## Decision

- `AGENTS.md` remains the canonical policy source. `CLAUDE.md` imports it without adding policy.
- `.agents/skills` is the canonical skill directory. Relative compatibility symlinks expose the same files at `.claude/skills` and `.codex/skills`; there are no copied skill sets.
- `.mcp.json` remains the neutral shared MCP source. Staging uses its existing project scope with database write tools enabled. Write capability does not authorize unrelated work or waive migration/release procedures.
- Shared launch commands locate the repository without Claude-specific environment variables.
- `.mcp.local.json` remains the only private additions source. The existing generator derives Codex project configuration; its explicit `--claude-local` mode synchronizes the same additions using Claude's native local scope. Matching registrations are preserved; failed replacements restore the previous definition. Normal installation does not mutate Claude configuration.
- Each client manages its own OAuth grants outside Git. Validate native discovery in both clients; do not equate one client's authentication with another's. A changed endpoint may need first consent for the changed connection.
- Production remains project-local and ignored for both clients. No production data/schema change, paid feature or deployment is authorized by this setup decision.

## Consequences

Adding a supported agent requires a thin discovery/configuration adapter, not a new policy or skill copy. Existing links through client skill aliases continue to resolve locally. Shared source changes and client parity checks belong in the same PR.
