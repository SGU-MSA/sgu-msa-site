> **Archived 2026-10-02 — historical record, not instructions.** Superseded by [ADR 0005](../../adr/0005-payments-channel-policy.md) and [ADR 0006](../../adr/0006-self-serve-payment-funds.md). Provider facts moved to [Go2Pay notes](../../proposals/go2pay.md).

# Payments, reservations, and inventory: decision brief

Status: proposal for board discussion, not approved functionality. Prepared September 9, 2026; Go2Pay facts added October 2026. The channel policy decided since then is [ADR 0005](../../adr/0005-payments-channel-policy.md) (Go2Pay is the only channel the website and backend know about) and the board-managed funds plan is [ADR 0006](../../adr/0006-self-serve-payment-funds.md); where this brief differs, the ADRs win. Read alongside [the existing merchandise decisions](MERCH_DECISIONS.md). No checkout, stock holds, payment integration, or visitor accounts are authorized by this document.

## Recommendation and responsibility boundary

Use one ordering and inventory system with separately configurable, explicitly approved payment channels. A guest reservation with a random text code is a good fit for local pickup. Add a QR representation of the same claim only if it helps staff; a scanner is optional. Regular visitors do not need accounts. Public browsing and community content should remain independent of merchandise.

Start with a single approved flow when decisions are settled. The smallest useful version is reservation, payment verification at pickup, and collection. It is more work than a catalogue: secure guest claims, stock concurrency, expiration, reliable notifications, staff operations, and exception handling are real requirements. Multiple channels are feasible if they share the same order records; do not maintain separate unofficial and official inventories.

**A dual-channel system is not inherently suspicious.** Accepting a hosted payment and accepting an approved payment at pickup can be an ordinary product choice. What matters here is authorization, who receives the money, and whether records and required reporting are complete. A system designed to omit cash/Zelle from university reporting, disguise a recipient, or route around a required university collection process would be a different proposition. Do not build that behavior.

Transparent software does not make an unauthorized channel permissible. There is no verified university policy or written approval in this brief. Ask the board to obtain confirmation from the university office responsible for club finances for the specific proposed channels and recipients. Keep account details and financial-policy correspondence in the organization's private records, not this repository. The developer needs the resulting operational decision, not responsibility for negotiating it.

The developer owns reliable inventory, secure access, accurate interface wording, traceable status changes, documentation, and maintainable integrations. The club/university owns permitted accounts and channels, custody and transfer of money, fees, financial reporting, refunds, disputes, and operating the process after handoff. The developer should neither hold their money nor become the permanent reconciliation operator.

## Guest and staff experience

1. A visitor chooses an actual product variant, quantity, and pickup option. Show the price, currency, hold deadline, and payment instructions before confirmation.
2. The server reserves available stock and returns a reservation reference, a separate secret claim token, and a clear message such as “Reserved; payment due at pickup.” Never call this a completed purchase or paid receipt.
3. The visitor saves the text code or QR. Collect only contact information needed for confirmation and recovery. If email is selected, notification delivery and account ownership must be handed over; an on-screen confirmation should still work if email delivery fails.
4. At pickup, an authenticated board member looks up the reservation, checks its current status and variant, verifies payment through the approved channel, and records collection.
5. The system records who performed each action and when. A second scan shows that collection already happened; it cannot collect the order twice.

The QR identifies a reservation; it is not proof of payment. Encode no name, bank information, or amount owed in it. A short human-readable lookup reference can be shared as a payment memo, but must not itself grant access to private order details. Use an unguessable claim token for guest access, rate-limit lookup, and authenticate staff. A forwarded secret may let another person claim the goods, so the board must decide whether possession is sufficient or pickup needs an additional check. Scanning must open a review screen, never automatically mark paid or collected.

## Inventory and lifecycle

Track variants independently: for example, each shirt size/color needs its own quantity. Admins should be able to edit descriptions and photos, add received stock, and record corrections with a reason. Preserve product name, variant, unit price, and currency snapshots on an order so later catalogue edits do not rewrite its history.

Define on-hand as physically present stock. Then:

`available = on-hand − active unpaid holds − paid allocations awaiting pickup`

Every unit belongs to at most one of those allocations. Do not count a paid order again as an unpaid hold.

| Event | Payment/fulfillment result | Inventory result |
| --- | --- | --- |
| Guest reserves | Unpaid, awaiting pickup | Available decreases; on-hand stays the same |
| Payment verified | Paid, awaiting pickup | Hold becomes paid allocation; no second deduction |
| Item collected | Paid, collected | On-hand and allocation both decrease |
| Unpaid hold expires/cancels | Expired/cancelled | Release hold; on-hand stays the same |
| Paid customer misses pickup | Paid, uncollected exception | Keep allocation until approved resolution |
| Uncollected order refunded/cancelled | Record refund confirmation and cancellation | Release allocation according to approved resolution |
| Collected item refunded | Financial change only initially | Add stock only after an accepted, physically received, resalable return |

Use separate reservation, payment, and fulfillment fields rather than one ambiguous status. A minimal vocabulary can include reservation active/expired/cancelled, payment unpaid/pending/confirmed/refund-pending/refunded, and fulfillment uncollected/collected. Server-side transition rules must reject contradictions. An expired reservation can still receive a late payment: record it as a reconciliation exception rather than discarding the money event or silently taking stock from another customer.

Availability checks and reservations must run atomically in the database. “Read quantity, then update later” can oversell. Use transaction-safe stock operations, consistent locking for multiple variants, idempotency keys for retried submissions, and atomic one-time collection. Store deadlines as absolute timestamps and display pickup/expiry in the organization's configured timezone.

Expire unpaid holds using a scheduled job plus authoritative request-time handling. Browser countdowns are informative only. Expiry and payment confirmation must serialize against each other. If money arrives after release, staff must resolve available replacement stock or an actual refund; never automatically promise an unavailable item. Keep paid no-shows allocated until the agreed policy is applied. A stock adjustment must not silently reduce physical quantity below committed allocations; flag the discrepancy for staff resolution.

Prevent stock being monopolized with limits on quantities and active reservations, basic rate limiting, and contact verification if abuse warrants it. Do not initially build waitlists, partial pickups, split payments, substitutions, or recurring reminders unless operations need them.

## Manual cash and Zelle

The website records a staff confirmation; it does not process an external payment. For cash, confirmation means staff actually received it. For Zelle, staff must verify the incoming transaction in the authorized recipient's banking record. A customer's screenshot, claim code, or “I paid” button is not verification.

Record order reference, method, amount, currency, received time, verifying admin, and a limited external transaction reference where available. Associate that reference with the order and check for accidental reuse. Do not collect bank credentials, full bank statements, or unnecessary payer details. Record corrections and reversals with reasons instead of erasing financial history. A simple list/export of orders and payment confirmations is sufficient; this is operational reconciliation, not a replacement accounting system.

Prefer manual payment **at pickup** in the first version. It avoids many “paid before hold expired but verified later” cases. If advance transfers are approved, define a payment-reporting window and review deadline; “payment reported” remains unverified and must not allow indefinite holds.

The recipient must be organization-provided and approved before instructions appear. Zelle says business-account availability depends on the financial institution and account type; consumer availability does not establish business eligibility. The club must have the relevant bank confirm suitability for its proposed use. This documentation does not classify the club's account or endorse a personal account. See [Zelle's account eligibility guidance](https://www.zelle.com/faq/small-business).

A reservation QR and a bank-provided payment QR serve different purposes and should be clearly labeled if both eventually exist. Never invent a Zelle API, scrape a banking session, or automatically infer received money from a payment memo.

## Official university checkout alongside manual payments

Both channels start with the same order and stock allocation. The board enables permitted methods in one configuration. An order may have several payment attempts, but a successful attempt must not duplicate its allocation or collection entitlement.

For an approved university provider with an integration, create the hosted checkout on the server with the order reference, expected amount/currency, and supported expiry. Confirm payment through the provider's verified server mechanism, check order/amount/currency, and deduplicate retries. A browser redirect to “success” is not evidence that money was received. Provider-specific implementation must follow its actual documentation; Stripe is only an example of a provider documenting [payment fulfillment handling](https://docs.stripe.com/checkout/fulfillment), not a provider selected for this project.

If the university supplies only a payment page with no supported order reference or verifiable callback, it can still coexist, but payment confirmation must use staff reconciliation from an accessible university transaction record. Do not promise automatic matching. If staff cannot see a useful reference, payer, amount, or receipt identifier, resolve that limitation before launching that flow.

Changing payment method must resolve any existing live checkout first where supported. Otherwise flag possible duplicate payment and reconcile it. Payment success racing with cancellation or expiry needs the same exception handling described above. Provider refunds and disputes are separate events; do not automatically restock goods that were already collected. An attempted or requested refund must not be shown as completed until confirmed.

## Architecture that survives a payment change

Keep this within the existing application and database. Suggested modules are catalogue, reservations/inventory, payments, and pickup/admin. Use ordinary focused tables for products, variants, orders, order items, payment attempts/confirmations, and stock adjustments/action history. A small history table is enough; do not introduce event sourcing or a separate financial ledger platform.

Payment adapters should expose only the needed operations: start an attempt, verify a provider event or manual confirmation, and record the result. They call the same internal payment-transition operation. Manual cash, manual Zelle, and hosted university payment must not each implement inventory logic. Store provider references and timestamps with payments; keep secrets server-side. Enable or disable channels centrally, preserving historical method information when recipients/providers change.

Guest operations need narrow validated server endpoints with abuse controls; they must not expose public database writes to order or stock tables. Staff operations need authenticated backend authorization as well as the private interface. Claim tokens, contact data, and payment references must not enter public content feeds, analytics, or ordinary URL logs. Donation payments should remain a separate configured flow, without merchandise inventory or claims about tax deductibility.

## Decisions required before implementation

The board should return a written decision record with an owner and date for each item:

- **Authority:** Which university office has confirmed which collection methods and recipients? Are all channels included in required university reporting? Is there a documented answer for the proposed non-university recipient?
- **Products:** Actual catalogue, photos and usage rights, variants, initial physical counts, currency, prices, and treatment of any fees/taxes determined by the responsible organization.
- **Reservation rules:** Hold duration, pickup place/windows, quantity limits, cancellation deadline, and whether advance manual payment is allowed.
- **Verification:** Who can access official and manual payment records, what reference links them to an order, and who resolves unidentified, duplicate, underpaid, or late payments?
- **Collection:** Whether forwarded codes are accepted, lost-code recovery, whether partial pickup is necessary, and what staff do when internet access fails. Default: pause redemption during an outage; two disconnected devices cannot reliably prevent duplicate claims.
- **Exceptions:** Paid no-shows, refunds, returns, stock discrepancies, disputes, and who contacts the customer. Paid stock must not be released under an unpaid-expiry rule.
- **Ownership:** Named operational owner, successor onboarding, access removal, notification account, retention/export policy, and where approvals and reconciliation records live.
- **Official checkout capability:** Provider identity, approved URL/account, sandbox access, reference fields, callbacks, expiry behavior, refund process, and transaction visibility.

Do not build bank-account custody/transfers, university fee routing, hidden reporting modes, a custom wallet, tax/accounting automation, shipping, public membership accounts, or complex permission roles. Do not store card data. Do not implement provisional recipients “for now.”

## Handoff and implementation gate

Continue unrelated public-site/CMS work while these decisions are discussed. Keep merchandise informational and donation destinations unconfigured until approved details exist. Once the decisions are recorded, scope and build the agreed first flow; adding a second adapter later should preserve orders and stock behavior.

Handoff should include a board-facing picture guide for editing products/photos/stock, finding reservations, verifying each method, collecting once, handling expiry/no-shows, correcting mistakes, and exporting reconciliation records. A developer runbook should describe schema migrations, configuration, notification setup, scheduled expiry, backup/restore, provider callbacks, secret rotation, and tests for concurrent last-item reservations, repeated requests/scans, late/duplicate payments, cancellation races, refunds, and job outages. Document ongoing service costs and who responds to failures.

This brief completes the product recommendation only. It does not confirm university compliance, payment-account eligibility, provider access, board policy, or implemented commerce functionality.

