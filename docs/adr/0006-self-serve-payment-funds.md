# 0006. Self-serve payment funds

- Status: Accepted
- Date: 2026-10-02

## Context

Board members currently need someone else to create Go2Pay links and paste them into the site. Under [ADR 0002](0002-product-principles.md) they should manage this themselves; under [ADR 0005](0005-payments-channel-policy.md) Go2Pay is the only channel.

## Decision

- Board members create and manage **funds** (named things people can pay for or give to) in the dashboard. The server creates the matching Go2Pay product through the API and stores its link.
- An **event** can have a ticket link to a fund.
- A **merch item** can have an order link to a fund.
- Payments are recorded from verified Go2Pay orders only (re-verified with `GET /orders/{id}`, idempotent).
- Exact fields, permissions and screens are decided in the feature contract, with the user choosing between options.

## Consequences

- Needs a Go2Pay key that can create products; whether a "payments only" key suffices is an open question in the [Go2Pay notes](../proposals/go2pay.md).
- Go2Pay supports fixed price × quantity in USD; donation amounts may need preset levels unless variable amounts are confirmed.
- Payment records become operational data the board can export for reporting.
