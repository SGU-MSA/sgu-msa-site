# 0008. Layered admin onboarding

- Status: Accepted
- Date: 2026-10-02

## Context

Board members are non-technical and change every year. A single text help page is easy to skip and goes stale when screens change. [ADR 0002](0002-product-principles.md) prefers pictures over text.

## Decision

Three layers, each useful on its own:

1. **Simpler forms with inline hints**: fewer fields, plain labels, examples next to the field.
2. **Guided tours**: a first-login tour and a per-page **Show me how** button, built with `react-joyride` (MIT).
3. **Picture help**: the help page shows screenshots of each step. Screenshots are captured automatically with Playwright, so they are re-taken whenever screens change instead of going stale.

## Consequences

- Tours and screenshots must be updated in the same PR as UI changes; the screenshot script makes this cheap.
- Adds one small dependency (`react-joyride`).
- Wording and tour content are product choices the board/user approves in the contract.
