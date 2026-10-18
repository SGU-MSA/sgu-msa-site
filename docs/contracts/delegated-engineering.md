---
status: approved
mode: light
issue: 115
---

# Plan, delegate, review, hand off

## Capability

One reusable engineering workflow across Claude and Codex, with capable planning/review and bounded implementation by a lower-cost model.

## Requested Behavior

The primary agent plans, resolves scope and coordinates. A delegated implementer writes code from an approved, precise contract. A separate capable reviewer tests correctness, contract compliance, security and edge cases. The maintainer reviews and merges the PR. Use native agent files and the existing GitHub tracker; no autonomous queue service or per-message GitHub hooks.

## Existing System Evidence

AGENTS.md is canonical for both clients; skills live in .agents/skills with client symlinks. planning-engineering-changes writes contracts; reviewing-engineering-changes owns review gates. managing-project-work tracks task boundaries. scripts/agents/sync-mcp.mjs already owns generated MCP configuration, not agent business policy. No project custom agent definitions exist. Native Codex currently documents standalone .codex/agents TOML; Claude uses .claude/agents Markdown frontmatter. Verify installed client support rather than assume configuration controls every runtime.

## Owner

AGENTS.md owns the shared stage workflow; .agents/roles/{planner,implementer,reviewer}.md own narrowly scoped role instructions. Native client agent files are thin references/model adapters. Existing skill/SOP owners retain their responsibilities.

## Source of Truth

AGENTS.md plus shared role documents define process. Approved docs/contracts define executable feature decisions; .plans holds ignored drafts. GitHub issues/Project track status and link contracts/PRs, not competing specifications. Model fields belong in native role adapters; no copied policy or credentials.

## Product Decisions Required

None. Model routing and final human merge are explicitly requested engineering preferences. Unavailable client/model support must be disclosed, not silently replaced.

## Decisions

D-1: Maintainer requests capable planner, weaker coding agents, separate capable reviewer, then personal review/merge (2026-10-14). This supersedes the earlier standing automatic integration-merge instruction.
D-2: Use available Codex gpt-6-luna/high for implementers; capable planner/reviewer inherit a capable current model where appropriate, with reviewer adapter gpt-6.1-sol/high when supported. Terra is not exposed in the current session; do not invent its model ID.
D-3: Claude adapters use opus for planning/review and sonnet for implementation; aliases avoid unverified account/version claims. Model availability/substitution remains client-owned and must be checked when dispatching.
D-4: Planning/review may run diagnostic commands and write plans/review documentation. Product, test and tooling code is delegated. Review fixes go back to an implementer; the reviewer does not silently rewrite them. No merge/publication/deployment is authorized by successful tests alone.

## Board Self-Sufficiency Check

No board workflow change; process instructions remain in developer/agent docs, not the board handbook.

## Implementation Constraints

Expected files: this contract; AGENTS.md; existing managing-project-work and frontend-testing-visual-qa skills; .agents/roles/{planner,implementer,reviewer}.md; .codex/agents/{planner,implementer,reviewer}.toml; .claude/agents/{planner,implementer,reviewer}.md; tests/agent-config.test.ts; developer/architecture/release docs; ADR0032 and index.

Do not add a second canonical workflow, model-calling daemon, paid automation, auto-writing hook, secret, permission bypass or new dependency. Do not force the root session model or overwrite ignored native MCP config. Custom roles inherit runtime permissions; instructions are not a sandbox guarantee. Do not delete existing agent files. Keep root planning and final integration coordination separate from implementation ownership; one agent owns each overlapping file at a time. A new session reads current user instructions and approved contracts; stale do-not-implement text in historical drafts does not revoke later approval, but unresolved product alternatives still require a precise child contract.

Use independent contexts for implementation/review where supported. Every handoff names ticket, contract path/status, base revision, allowed files, acceptance cases, commands, constraints and stop conditions. Implementers report PLAN MISMATCH rather than decide product behavior. Reviewers follow the existing reviewing skill and require actual test results; defects loop back to implementer and get rechecked. PR remains for human review/merge.

## Test Strategy

Validate contract; parse native adapters with available client diagnostics and supported parsers; test three role names/model choices/canonical references and no independent copied policy or privilege overrides. Verify both clients discover definitions without making paid model turns just for validation. Run npm run agents:sync/check and full npm run check. Demonstrate workflow using #124's Luna implementation and separate capable review. Record unsupported client/runtime limitations honestly.

## Acceptance Criteria

Both client adapters reference the same three shared role documents, supported configured models are verified, and SOP requires plan → delegate → independent review/tests → human review/merge. Current implementation is actually delegated. New PRs remain unmerged. Existing private MCP/credentials remain ignored/project-local. No application behavior, account permission or production change.
