# 0002. Product principles

- Status: Accepted
- Date: 2026-10-02

## Context

The site is handed to non-technical board members who change every year. Developers and AI agents come and go. The founder stated the motto for the project: think of everything a board member might want to do, and make it so they do not need a developer to edit code and rebuild.

## Decision

1. **Board self-sufficiency is the motto.** Anything a board member may reasonably want to change must be possible from the admin dashboard, without a developer, a code change or a redeploy. Content that still lives in code or YAML is tracked as a gap on the [roadmap](../roadmap.md).
2. **Agents never make product or design decisions.** They present 2–3 options (with pictures when possible) and a recommendation; the user/board chooses. The choice is recorded in the contract's Decisions section or an ADR.
3. **Pictures over text** for anything board-facing: help, onboarding and option comparisons use screenshots and mockups first, words second.

## Consequences

- Every feature contract includes a board self-sufficiency check: "Can a board member change this without a developer?"
- Some features cost more up front (dashboard forms instead of config files), in exchange for not needing a developer later.
- Agents must stop and ask rather than guess on product questions, which adds a short round-trip per feature.
