> Archived reference, not current operating instructions. Start with [the project README](../../../README.md).

# Merchandise and payment discussion — not implemented

Per the project owner's direction, public visitor accounts, checkout, reservations, ticket codes, inventory, and payment reconciliation remain undecided. The current merch page is a catalogue/archive only. This document records choices for the founder; it does not commit the organization to a provider or transaction model.

## Decisions that determine the design

| Question | Why it matters |
| --- | --- |
| Is an online request a reservation or a completed purchase? | The confirmation must not imply payment if payment is still due. |
| When and how is payment verified? | A treasurer's manual verification and a processor webhook require different workflows. |
| Is stock held before payment? For how long? | Prevents unpaid reservations from blocking available items indefinitely. |
| Is each size/color tracked separately? | A total shirt count cannot prevent selling an unavailable size. |
| What information identifies the collector? | A guest email plus secret claim code may be enough; visitor accounts may be unnecessary. |
| Can another person collect on the buyer's behalf? | Determines pickup verification and forwarding rules. |
| What happens after a missed pickup or failed payment? | Payment and pickup states need separate reconciliation rules. |
| Is a paid but uncollected item refunded, held, or released? | Stock must not be silently released while the buyer still owns a paid claim. |
| Who can correct stock and reconcile orders? | The existing equal-access board policy may need operational guidance, not complex RBAC. |

## Two plausible flows for discussion

**Reservation first:** Guest selects a variant and quantity, provides minimal contact information, and receives a reservation code with a clear deadline. Stock is temporarily held. At pickup, a board member finds the reservation, verifies the agreed payment method, and marks it collected. Unpaid reservations expire according to a board-approved policy.

**Externally paid order:** Guest completes the official external payment flow. A verified provider callback or treasurer confirmation marks the order paid. A pickup confirmation is issued or activated. A board member checks it once and marks the order collected. Failed/abandoned payments release holds according to a defined timeout; paid no-shows require an explicit policy.

Neither flow inherently requires a public account. Recovery through an email and claim reference may be simpler, but email delivery, privacy, abuse controls, and support ownership must be considered.

## Pickup code options

A random text code is simple to show, type, and print. A QR code can encode the same secret lookup link as a convenience, with the text code always available as a fallback. A QR image alone is not proof of payment. Pickup status must be checked on the authenticated board interface, and collection must be recorded atomically so the same claim cannot be redeemed twice.

Do not encode names, payment details, or other private information directly in the QR. Define what board members should do during an internet outage before relying on online redemption.

## Inventory expectations if approved

Products would have board-editable photos, descriptions, active status, and variants (such as size/color). Each variant would have an on-hand quantity. Available stock would subtract valid holds/uncollected allocated orders under the chosen policy. Reservation and collection changes must be atomic in the database to prevent overselling when two visitors act at once.

Manual adjustments need a short reason and a history. Expiration should use a reliable scheduled job plus request-time checks. Do not use a visitor's browser timer as the stock authority. Physical stock counts still need occasional reconciliation.

## Before development

Agree on payment verification, hold duration, pickup windows, no-show/refund policy, variant tracking, guest contact/recovery, code redemption, privacy/retention, and who handles disputes. Then implement one agreed flow and test concurrency, duplicate redemption, unpaid expiry, cancellations, stock corrections, and paid no-shows.

No shipping is expected. Do not build shipping addresses, fulfilment integrations, or an unnecessary customer account system.
