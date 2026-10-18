# 0019. Go2Pay products made by the board, linked by the site, payments-only key

- Status: Accepted
- Date: 2026-10-05

## Context

[ADR 0006](0006-self-serve-payment-funds.md) planned for the website to create each fund's Go2Pay product itself. That needs a Go2Pay key with the permission "Everything my account can do", which can also read the MSA's bank details and may reach withdrawals. A "Take payments only" key reads orders and refuses products, bank accounts and withdrawals (checked 2026-10-05, [Go2Pay notes](../proposals/go2pay.md)). The user chose the payments-only key and board-made products (PR6 contract, answer sheets of 2026-10-05). Full reasoning: [PR6 contract](../contracts/pr6-go2pay-payments.md).

## Decision

1. Every fund and priced item links to its own Go2Pay product. The board makes, edits and closes products by hand in Go2Pay and pastes the link; the site validates it and stores only the id.
2. The live site uses a "Take payments only" key. It reads orders and nothing else; it can't reach products, bank accounts or withdrawals. A broader key is refused in production.
3. Each fund has one fixed category: Zakat al-Fitr, Zakat al-Mal (restricted, fixed rule lines, never added to other totals), Sadaqah or General (unrestricted). The category locks once shown. The site gives visibility (totals per fund), not spending control.
4. Orders are read live and never stored; no webhooks. Money holders see names and notes on screen; the CSV has notes, not names.
5. Visitors reach Go2Pay only through `/donate/<slug>/give`; closed or unknown slugs are a 404.
6. Supersedes ADR 0005's webhook/record bullet, ADR 0006's "payments are recorded" and ADR 0014's "payment order records". It also replaces ADR 0006's first bullet (the server creates the Go2Pay product) with point 1; the rest of ADRs 0005, 0006 and 0014 stands.

## Consequences

- The MSA's Go2Pay login and keys belong to so-msa@sgu.edu ([owner guide](../guides/owner-setup.md#the-payments-key-go2pay_api_key)); `GO2PAY_API_KEY` stays `off` on the live site until launch.
- Each new fund, ticket or size means making a product by hand in Go2Pay; the dashboard's copy box and help cards keep it short.
- With a payments-only key the site can't confirm that a pasted link belongs to the MSA's account, nor read a product's price or stock; Recent changes highlights every link change, and pages say "See price and buy ↗" instead of a price.
- Even a test key returns real orders, so developer keys expose real givers' details and are never logged or stored.
