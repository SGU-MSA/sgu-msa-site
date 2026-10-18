# 0009. Free tools only

- Status: Accepted
- Date: 2026-10-02

## Context

The MSA is a student organization with changing leadership and no ongoing tooling budget. A paid subscription can lapse at turnover and break the site or the workflow.

## Decision

- Development tools, component libraries, design registries and MCP servers added to this project must be **free** (open-source or free tier).
- Excluded examples: Magic UI Pro, Motion+ (and its MCP server), Unlumen Pro.
- Allowed examples: shadcn registries (@magicui, @smoothui, @unlumen-ui free tier, @animate-ui, @react-bits), the free Motion MCP, `react-joyride`, MapLibre with OpenFreeMap.
- Hosting plans (Vercel, Supabase) and Go2Pay transaction fees are not developer tools; they stay owner/board decisions as described in the owner setup guide.

## Consequences

- Some premium components are unavailable; agents build from free registries instead.
- Adding any paid tool needs a new ADR approved by the board.
