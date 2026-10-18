---
status: approved
mode: light
---

# Tracked work, spending ceiling and documentation audiences

## Capability

Persist the user's engineering workflow and $0 spending constraint for maintainers and AI agents.

## Requested Behavior

Create/link tickets before work, explain scope before code, give progress updates and keep board usage separate from owner/developer/AI instructions. No application or cloud settings changes.

## Existing System Evidence

`AGENTS.md` owns agent procedure; `docs/guides/developer.md` owns maintainer instructions; README already routes all four audiences; `docs/roadmap.md` currently calls itself the only status tracker. Issues #109–#115 now exist under the user's explicit ticket instruction.

## Owner

Existing agent rulebook and developer guide own the procedure; a new ADR records this cross-feature user decision.

## Source of Truth

GitHub issues track execution; contracts record feature decisions; immutable ADRs record policy; roadmap summarizes scope and dependencies. Existing board handbook remains the sole board how-to.

## Product Decisions Required

None. The user explicitly requested tickets, updates, $0 spending and audience separation on 2026-10-12. npm license and future package choices are excluded.

## Decisions

D-1: Create/link tickets before tasks and explain changes before implementation (user, 2026-10-12).
D-2: Keep infrastructure at $0; paid subscriptions/add-ons/overages require a new explicit user decision (user, 2026-10-12).
D-3: Separate owner/developer/AI documentation from board instructions, reusing existing owners (user, 2026-10-12).

## Board Self-Sufficiency Check

No dashboard behavior changes. Board members continue using the handbook and dashboard; tickets and engineering procedure are for maintainers, not a board burden.

## Implementation Constraints

- Change only AGENTS.md, docs/guides/developer.md, docs/roadmap.md, docs/adr/0029-tracked-work-and-zero-spend.md, docs/adr/README.md, docs/release-checklist.md and this contract.
- Do not edit application code, accepted ADRs, handbook or cloud settings.
- Preserve draft PR #108 unmerged; use a separate docs-only PR linked to #115.

## Test Strategy

Run plan validation, npm run check and diff review. Documentation link checks and agent size/config tests cover these edits.

## Acceptance Criteria

- Future agents see ticket/update requirements and the spending ceiling in the canonical instructions.
- Each audience has one clear entrypoint, with no competing board how-to.
- Tickets track current work without duplicating execution status in roadmap text.
