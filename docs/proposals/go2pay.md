# Go2Pay integration notes

Facts and open questions for the payments work (roadmap PR6). Policy lives in [ADR 0005](../adr/0005-payments-channel-policy.md) and [ADR 0019](../adr/0019-go2pay-products-made-by-the-board-payments-only-key.md) (which replaces parts of [ADR 0006](../adr/0006-self-serve-payment-funds.md)); this page only records what we know about the provider. Go2Pay ([go2pay.gd](https://go2pay.gd), run by Go2Fete, Grenada) is the channel chosen in ADR 0005.

## What the live key can do (2026-10-05, PR6 WP-2, "Take payments only" test key)

The live site will use a key with the permission **Take payments only** ([PR6 contract](../contracts/pr6-go2pay-payments.md), D-58): the board makes, edits and closes each Go2Pay product by hand and pastes its link into the dashboard. A developer checked such a key (test mode) with read-only `GET` calls on 2026-10-05. Only field names are written here, never key values, names, emails, phone numbers or amounts.

| Call | Answer |
| --- | --- |
| `GET /auth/me` | 200. |
| `GET /orders` (also `?page=`) | 200. The answer has `success`, `data` (the orders) and `pagination` (`page`, `limit`, `total`, `total_pages`): 20 per page, newest first. |
| `GET /products`, `GET /products/{id}`, `GET /customers`, `GET /bank-accounts`, `GET /withdrawals`, `GET /payment-requests` | 403, "limited to taking payments". |

- **Orders are readable, so the Payments screen can be built in full** (not the "open it in Go2Pay" fallback). Each order has `product_id`; the amounts `price`, `qty`, `donation`, `subtotal`, `processing_fee`, `customer_total`, `service_fee`, `refunded`, `refunded_date`, `balance`; `status`; `note` (the giver's "Note for Vendor") and `vendor_note`; `created`; `test_mode`; the buyer's `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `state`, `country`; `customer_ip`, `payment_intent_id`, `payment_intent_secret`; settlement fields (`withdrawn`, `withdraw_bank_account`, `settlement_date`); and the product as `pay_product` (`id`, `title`, `description`, `purchase_note`, `price`, `min_quantity`, `max_quantity`, `quantity_available`, `donations`, `donation_slots`, `donation_min`, `donation_max`, `donation_description`, `active`, `archived` and more).
- `withdraw_bank_account` is a number (an id), not bank details.
- **Products cannot be read**, so the website cannot know a product's price or stock, or whether it is sold out, until someone buys it. Our pages therefore show neither: the button reads "See price and buy ↗" and Go2Pay's page shows the price and "Sold out" (P-72 B, user, 2026-10-05).
- **A test key returns the live orders** (`test_mode` is 0 on every order read): real givers' names, emails and phone numbers. So any developer key exposes real personal data. Keep developer keys only on computers that need them, never log or store order data, and the site shows only what the Payments screen needs: the website keeps the order number, product, amounts, status, note, time and the giver's name (on screen only), and drops every other field when it reads an order (never `customer_ip`, `payment_intent_secret` or the address).

## What we checked earlier (2026-10-04, PR6 WP-2, full-access test key)

Before the board chose the payments-only key, a developer used the MSA's **test** key (permission "Everything my account can do") against `https://go2pay.gd/api/v1` and read the public docs at https://go2pay.gd/api-docs. Only field names and behaviour are written here, never key values, emails, names or bank details. No payment was made, and no real product was changed.

| Question | Answer | How we know |
| --- | --- | --- |
| Can a key withdraw money or change bank accounts? | **Probably yes, with the full key.** `GET /bank-accounts` answers with the MSA's bank details (account and routing numbers, IBAN, SWIFT, payout contact fields). `/withdrawals` exists (it refuses GET with "Method not allowed", so it takes another method). Neither is in the public docs. The "Take payments only" key refuses "anything to do with withdrawals or bank accounts". | Read-only GET calls; nothing was written. Asked Go2Pay (draft below). |
| Who am I (`GET /auth/me`) | `id`, `first_name`, `last_name`, `username`, `email`, `phone`, `company`, `country`, `pay_user` (`account_id`, `admin`, `active`, `max_transaction_limit`). | Test key, 200. |
| Order fields | `id`, `uniqueid`, `type`, `product_id`, buyer `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `state`, `country`, `price`, `qty`, `discount`, `donation`, `subtotal` (= price × qty + donation), `processing_fee`, `customer_total` (= subtotal + processing fee), `service_fee`, `refunded`, `refunded_date`, `balance` (= subtotal − service fee − refunded), `currency`, `method`, `status`, `card_type`, `last4`, `note` (the giver's "Note for Vendor"), `vendor_note`, `withdrawn`, `withdraw_bank_account`, `settlement_date`, `test_mode`, `created` (with a `-04:00` offset, which is Grenada time), plus the full product as `pay_product`. Amounts are text such as `"4.00"`. | Test key, 114 orders. |
| Order statuses | `PAID`, `PARTIAL REFUND`, `REFUNDED` (docs), and also **unfinished attempts** `REQUIRES_SOURCE` and `REQUIRES_PAYMENT_METHOD` (25 of 114). These are not payments. | Test key. |
| Filter orders by product | **Yes**: `?product_id=` works. `?status=` works. | Test key. |
| Filter orders by date | **No.** None of 12 tried date parameters changed the result. Orders come newest first, 20 per page; `limit` is ignored. | Test key. Asked Go2Pay. |
| Is the "Note for Vendor" seen by the MSA? | **Yes**, in each order's `note` (32 of 114 orders had one). | Test key. |
| 5% payout fee on every order? | **Yes.** `service_fee` is 5% of `subtotal` (gift included) on 88 of 89 paid orders (the other is a rounding cent). It is taken from the MSA's balance. The card fee (3.9% + US$0.30) is added for the buyer. | Test key. Asked Go2Pay about a reduced rate. |
| Payout timing | **Not daily.** Withdrawn orders share 9 settlement dates, mostly at month end; paid orders since late April 2026 are not withdrawn yet, so payouts seem to happen only after the MSA asks. Median 14 days from payment to settlement. | Test key. Asked Go2Pay. |
| Product fields | `id`, `title`, `description` (may hold HTML), `purchase_note`, `price` (text), `min_quantity`, `max_quantity`, `quantity_available`, `donations`, `donation_slots`, `donation_min`, `donation_max`, `donation_description`, `image`, `pay_processing_fee`, `success_url`, `cancel_url`, `error_url`, `endpoint`, `active`, `archived`, `type`, `show_on_grid`, `show_on_pos`, `via_api`, `send_receipt`, `test_mode`, `order_count`, `total_revenue`, `payment_url`, and more. `GET /products/{id}` adds `available_qty`. | Test key. |
| Donation box | **It exists as product fields**: `donations` (on/off), `donation_slots` (preset amounts as text, for example `"3,7,11,15"`), `donation_min`, `donation_max`, `donation_description` (the caption). The page shows the caption exactly; an empty caption shows no caption, only the buttons and an "Other" box capped at the account's transaction limit (US$2,500). **The gift is added on top of price × quantity**, so the giver pays at least the product price. Whether the API accepts these fields when creating or updating is **not known yet** (creating fails, below). | Public pages go2pay.gd/557 and go2pay.gd/5478; product reads. Asked Go2Pay. |
| Stock meaning | Docs say `quantity_available: null` = unlimited. Hand-made products show `0` and still sell, so `0` seems to mean unlimited too. Test orders never count against stock (docs). | Product reads, public page. Asked Go2Pay. |
| Create, update, archive products | **Not run (blocked by Go2Pay).** `POST /products` returns `500 Internal server error` every time with the test key (15 tries, minimal to full fields, about 06:40–07:05 Grenada time on 4 October 2026); a missing title or price correctly returns 422. `PUT` and `DELETE` on an unknown id return 404. Nothing was created, so the archive-twice, update-after-archive, maximum lengths, `max_quantity` limit, donation-field writes and 10-creations timing checks could not run. | Test key. Reported to Go2Pay. |
| Rate limits | No rate-limit headers seen; calls took 0.3–1.7 s. Not documented. | Test key. Asked Go2Pay. |
| Refund window | Docs mention "outside the refund window" (400) but not its length. Refunds are made in Go2Pay only (D-40). | Docs. Asked Go2Pay. |

Old open questions now answered: a "Take payments only" key cannot create products (docs list its endpoints); products can take a buyer-chosen extra amount (the donation box); Go2Pay emails receipts (`send_receipt`).

## Human checks still to do (need an inbox; do not use a real card)

1. Open a test product's page (made by hand in Go2Pay): it shows the TEST banner. Pay with card 4242 4242 4242 4242, any future date, any code, and your own name and email.
2. In the receipt email, check that the `purchase_note` text appears, and whether the caption and the gift line show.
3. Pay again with 4000 0000 0000 0002: it is declined.
4. Someone signed in to Go2Pay confirms the button names on go2pay.gd/integration-keys (creating a test or live key, **Revoke**) so the owner guide matches.

## Email to Go2Pay support (rev 7; send from so-msa@sgu.edu, the address that owns the Go2Pay account, to support@go2pay.gd; never paste a key)

> Subject: SGU MSA: questions about "Take payments only" keys, orders and fees
>
> Hello Go2Pay team,
>
> We are the SGU Muslim Students' Association (Go2Pay account "SGU MSA"). Our board will make our product pages by hand in Go2Pay, and our website will link to them. We want the website's key to have as little access as possible. Could you help with these questions?
>
> 1. **"Take payments only" keys.** We tested our payments-only key: it can read our orders, and it is refused for products, customers, bank accounts and withdrawals. Please confirm that this kind of key can **never** see our bank details, change bank accounts or withdraw money, now or after future updates.
> 2. **Creating products with a test key.** `POST /api/v1/products` with a title and a price returned "500 Internal server error" every time (15 tries on 4 October 2026, 10:40–11:05 UTC). Is this a known problem? (We no longer depend on it, but wanted you to know.)
> 3. **Donation box.** Do orders always show the donation part separately from the product price? Can a product with the donation box have a price of 0, so the amount the giver types is the whole gift?
> 4. **Orders by date.** Can `GET /orders` be filtered by date (from/to), or return more than 20 per page?
> 5. **Payouts.** When does money reach our bank: on a schedule, or only when we ask? How many days does it usually take?
> 6. **Refunds.** If we refund an order (for example, when the last ticket was also sold in person), do we get Go2Pay's fees back, or are they kept? Does the buyer get back the card fee they paid?
> 7. **The 5% fee.** Does the 5% fee also apply to the donation-box amount? Is there a lower rate for student or charity groups, or for zakat (charity given to people in need)?
>
> Thank you very much,
> SGU MSA board

## Still open for the board

- Has the university office responsible for club finances approved Go2Pay for this student organization, and what reporting does it need from us?
- Who covers the 5% fee on zakat: answered (P-58, D-75): nobody; the 5% is lost, also on zakat, and the Donate page says Go2Pay and payment processing take about 5%.
