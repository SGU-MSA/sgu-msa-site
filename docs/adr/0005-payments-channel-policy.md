# 0005. Payments channel policy

- Status: Accepted
- Date: 2026-10-02

## Context

The MSA already sells iftar/banquet tickets through a Go2Pay hosted product link. The site will add donations, event tickets and merchandise orders. Money handling must stay simple, auditable and compatible with required university reporting.

## Decision

- The public site and backend know about **one payment channel: Go2Pay**. No other channel or recipient account appears in code, the dashboard or current docs.
- Nothing is ever built that hides, omits or disguises money from required university reporting.
- Go2Pay API keys are **server-only** (never in the browser or the repository), **test keys** (`g2p_test_`) are used until launch, and the **least-privileged** key that works is used.
- Go2Pay webhooks are unsigned, so they are only a hint: the server re-verifies every order with `GET /orders/{id}` and records it idempotently.
- University approval and financial reporting remain the board's responsibility; the software provides accurate records and exports.

## Consequences

- The earlier payments proposal is archived as history ([PAYMENTS_PROPOSAL](../archive/notes/PAYMENTS_PROPOSAL.md)); archived notes are not instructions, and this ADR wins.
- Changing provider later needs a new ADR.
- Open questions about Go2Pay (key permissions, payouts, rates, webhook retries) are tracked in the [Go2Pay notes](../proposals/go2pay.md).
