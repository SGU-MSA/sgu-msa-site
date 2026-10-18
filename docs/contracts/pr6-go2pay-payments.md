---
status: approved
mode: full
---

# PR6: Go2Pay payments (funds, priced items, seasons)

**Approved 2026-10-05.** Every product decision is answered by the user (answer sheets of 2026-10-05, Round 1 and Round 2, and the confirmations "yes go with recommended"). This is revision 7.1 of the plan, moved here unchanged except: the migration takes the next free number, `202610090001` (it was drafted as `202610090001`); the season table, `SeasonEditor` and ADR 0020/0021 texts that the plan cited as "unchanged from rev 5" are written out in full; and the engineering notes PR-A added are under Decisions → "Implementation notes (PR-A)".

Workflow checklist: [x] 1 Scope · [x] 2 Inspect · [x] 3 Capability/owner · [x] 4 Duplication · [x] 5 Sources of truth · [x] 6 Reuse · [x] 7 Beyond happy path · [x] 8 Product decisions (all answered; P-72, P-58 and P-73 by the user on 2026-10-05) · [x] 9 Parallel work · [x] 10 Contract · [x] 11 Validate

**Revision 7.1 (2026-10-05, answer sheet 2; `.plans/answers-2026-10-05.md` "Round 2"):**

- **P-73 approved with changes (D-77):** no headings on the Donate page by default (zakat slips included); the board may type an optional heading per fund. Every slip's wording is short and plain (new rule lines and examples in Design → Categories). The fine print keeps one line that Go2Pay and payment processing take about 5% (D-76, amends D-33).
- **P-58 resolved (D-75):** nobody covers Go2Pay's 5%; that money is lost, also on zakat. No top-up line on zakat slips. Zakat funds can be listed now: `ZAKAT_LISTING_OPEN`, `payment_settings_zakat_open()`, SGU11 `zakat_waiting`, the greyed zakat cards and WP-13 are removed.
- **P-72 (price on our pages):** recommended B (no price on our site, button "See price and buy ↗"), **approved by the user 2026-10-05**. The user asked which key we use: the live site uses the "Take payments only" key, which cannot read a product's price, so a typed price would have to be kept in two places.
- **HIJRI RULE (D-78):** Hijri dates appear only with prayer times and on the calendar. No Hijri date on Donate slips, in the fund editor's preview or in "Running again"; the Seasons screen shows Gregorian dates (the Hijri anchor stays the season's rule).
- The mockups `donate-slips*.png` still draw the old fixed headings and rule lines; the build follows D-77, and Track B redraws the slips from `DonatePageData`.

Revision 7 (2026-10-05). Folds in the user's answers to Q1–Q14, Q18, Q43, Q44 and Q95 (`.plans/answers-2026-10-05.md`). Three answers reshape the plan:

1. **The live site uses a "Take payments only" Go2Pay key (Q1 C).** The board makes, edits and closes each Go2Pay product **by hand** in Go2Pay and pastes the product's link (for example `go2pay.gd/1650`) into the fund or item editor. The site never creates, updates or archives a product.
2. **Funds are about visibility, not control (Q9, Q10).** Only Zakat al-Fitr and Zakat al-Mal are restricted. Everything else is Sadaqah or General money that the board may use as it sees fit. The site tells the board "people gave US$1,240 for Iftar"; it does not police spending. No "Set purpose" type, no leftover rules, no promise lock beyond the category.
3. **Any board member edits funds, items, prices and stock (Q44).** "Can manage money" now gates only the Payments screen (giver names, notes and the CSV).

### What rev 7 deletes, and what that simplifies

| Removed                                                                                                                                                              | Why it is no longer needed                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `sync.ts` (`syncItemProducts`, `closeEndedProducts`), create/update/archive gateway calls, `go2payProductSpec` sent to Go2Pay                                        | The board makes products by hand.                                                                         |
| `go2pay_sync` pending state, "Not synced — Retry", compensation (archive a product after a failed DB write), "Temporarily unavailable" because of a pending sync     | Nothing is sent to Go2Pay on save, so a save can't half-succeed.                                          |
| The nightly closer (WP-12, `/api/payments/close-ended`, `CRON_SECRET`, P-50)                                                                                         | The site can't close products. The board closes them in Go2Pay; the dashboard reminds them.               |
| P-48 donation-box API writes, `donation_box_done`, the "Finish in Go2Pay" to-do, P-66 smallest-gift field, P-67 presets, `max_quantity` logic                        | The board sets the donation box, preset amounts and price in Go2Pay's own form.                           |
| P-70 bank-details risk and the D-21 safeguards (path allow-list, rotation, withdrawal alerts)                                                                        | A payments-only key can't reach products, bank accounts or withdrawals (Go2Pay docs; WP-2 confirms).      |
| `money_type` with four rules, `LEFTOVER_RULES`, `leftover_rule`, `distribution_note`, `fund_promise_lock` on five columns, `isLate`, the Late flag, late-money lines | Unrestricted money needs no leftover rule (Q9). Only the category locks.                                  |
| `payment_categories` table, the Headings screen, `money_link_guard` (SGU07)                                                                                          | No headings table: a fund carries an optional heading of its own (D-77). Any admin may set tickets (Q44). |
| `price_cents`, `stock`, live `readProduct` on every Give click                                                                                                       | Go2Pay holds price and stock (Q13). The Give route checks only our own dates.                             |

Net effect: one table fewer, one route fewer, one secret fewer, one cron fewer, about half the gateway, no two-system consistency problem, and the Give button no longer depends on Go2Pay being reachable before redirecting.

## Capability

**Board-managed giving funds and priced items. Each one shows on the site at the right time (own dates, a Hijri-anchored season, or both) and links to a Go2Pay product the board made by hand. Each fund has one of four fixed categories, so givers and the board see which money is zakat. Money holders see live totals per fund and item from Go2Pay's orders.**

**One example, used throughout this plan.** In Ramadan, three students give:

| Giver      | Taps Give on                       | Category                  | What the board sees later                                                  |
| ---------- | ---------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| Aisha, $50 | **Zakat al-Mal**                   | Zakat al-Mal (restricted) | "Zakat al-Mal: US$50", on its own line, never added to anything else.      |
| Bilal, $30 | **Iftar** (in the Ramadan section) | Sadaqah                   | "Iftar: US$30". If iftar costs less, the board may use the rest elsewhere. |
| Omar, $20  | **MSA & Musallah**                 | General                   | "MSA & Musallah: US$20".                                                   |

Each fund is its own Go2Pay product (the board made three products and pasted three links), so the three gifts never land in the same place. Payments shows three separate lines.

**Funds** (`kind = 'fund'`):

- A fund has a name, a category, one optional board sentence ("About this fund"; required for both zakat categories), an optional heading (D-77; empty by default), a season or dates, "Show on the Donate page", and its Go2Pay link.
- The giver chooses the amount in Go2Pay's donation box (D-9). The slip shows no amount (D-49).
- Funds are never sold out. A closed fund is hidden from the public, and the board still sees it (D-52).

**Priced items** (`kind = 'priced'`): event tickets now, merch in PR5 (D-10). Their money is General. Price and stock live in Go2Pay (D-66); how our page shows them is P-72 (recommended B: no price on our page, approved by the user 2026-10-05).

**Give** (D-53): every Give or Buy button opens `/donate/<slug>/give` in a new tab. The server checks our own dates and "Show" tick, then redirects to `https://go2pay.gd/<id>`. An unknown or closed slug shows the not-found page with the approved wording. Because the root `loading.tsx` streams every page, that page is sent with status 200 and `noindex`, and an open slug's redirect is followed in the browser (about a third of a second), not as an HTTP 307 (accepted at the PR-C review; a route handler would move the closed page to another address).

**Seasons** (unchanged from rev 5): Ramadan, Eid al-Fitr, Eid al-Adha plus board-added seasons; expected days from `hijri.ts` plus the board's adjustment; the board confirms actual days; screens show Gregorian dates only (D-78).

**Payments** (money holders): live totals per fund and item from Go2Pay orders, grouped by category; the two zakat categories never added to anything; giver names and notes on screen; a CSV (with notes, without names) made on demand and never stored. If WP-2 finds the payments-only key cannot read orders, the screen instead links each fund to Go2Pay's own dashboard (fallback, D-64).

## Requested Behavior

From the user (answers 2026-10-03, 2026-10-04 and 2026-10-05):

- **Key (Q1 C):** a "Take payments only" key on the live site. The board makes, edits and closes Go2Pay products by hand and pastes the link. Send the support email (Q1, `.plans/go2pay-support-email.md`).
- **Funds (Q9, Q10):** categories Zakat al-Fitr, Zakat al-Mal (restricted), Sadaqah, General (unrestricted). Seasonal items such as Iftar appear in their own section (Iftar under Ramadan; round 2 changed this to "no heading unless the board types one", D-77), but their money is unrestricted. "Its not my obligation to tell them how to spend the money … what i can do is only tell them that people donated X for iftar."
- **Headings (Q10, changed in round 2 Q1):** "for zakat and things like that dont put a heading (by default), allow them to customize if they want. also improve the descriptions on all items, just keep it simple no need to yap." (D-77)
- **The 5% (round 2 Q1, Q8):** "dont worry about 5%, that money is lost forever even the msa doesnt have to recoupe. only keep the message at the bottom saying they take 5%." (D-75, D-76)
- **Price on our pages (round 2 Q2):** "i want to say dont put price on website because it requires setting it in 2 places right?" (P-72, recommended B)
- **Slip line (Q14 C):** only "The fund you choose is your intention."
- **Payments (Q11 A, Q12):** count only paid and refunded orders; show givers' notes and let them be downloaded.
- **Stock (Q13):** in-person sales mean a board member lowers stock in Go2Pay; refund if oversold.
- **Time left (Q18):** for funds that close, a small "time left" line with a clock icon, only near the end, instead of an email reminder.
- **Merch sizes (Q43):** "what do you think is a safe option" → our recommendation recorded (D-67).
- **Permissions (Q44):** any board member can change prices and stock.
- **Developers' test key (Q95 B):** a full-access test key is allowed, with a warning.
- **Kept:** D-2 (orders read live, never stored), D-3/D-39 (names on screen only), D-5, D-7, D-9, D-11–D-15, D-22–D-24, D-31–D-33, D-35–D-38, D-40, D-41, D-45, D-48, D-49, D-51–D-53, D-55, D-56.

Non-goals:

- Spending control, leftover rules, late-money rules, a money book (parked, `pr6-user-decisions-2026-10-04.md` item 5).
- Creating, editing or archiving Go2Pay products from the site; reading Go2Pay product details (price, stock) with the live key.
- Go2Pay payment requests (`POST /requests`): they need the giver's name and email first, which conflicts with "no stored donor data".
- Stored orders, buyer data, webhooks, donor emails from the site (D-2, D-9).
- Qurbani on the site (Q9 A: no use case; the board can add a Sadaqah fund if it ever arranges it).
- A refund button (D-40), recurring gifts, public totals, QR codes (D-45).
- Merch editing, the season page and page text (PR5); activity-log filters (D-8); other payment channels (ADR 0005).

## Existing System Evidence

Read from `origin/integration` @ b319d41 (2026-10-04) and the rev 6 inspection; nothing in these paths changed for rev 7.

- **Payment code today:** `src/lib/integrations/payments/providers/{contract,link,off}.ts` (`PaymentsProvider.donation(label)` fed by `DONATION_URL`); `src/lib/integrations/payments/index.ts` (`donationDestination`).
- **Key setting:** PR #58 (WP-1) adds `GO2PAY_API_KEY` to `src/lib/runtime/config.ts` with the `WeakMap` secret pattern; its owner-guide text names the full-access key and needs the one-line change in WP-10.
- **Donate page:** `src/app/donate/page.tsx` renders `src/features/donate/DonateLetter.tsx`; Track B picked "Paper slips" (option B).
- **Not-found page (#56):** `src/features/system/NotFoundSignpost.tsx` (`title`, `body`, `ways`); the approved closed-fund wording is in `SystemPages.stories.tsx`, story `ClosedFund`. `src/app/not-found.tsx` is the root boundary.
- **Next.js 16:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` (`notFound()` in Server Components renders the nearest `not-found` with `noindex`).
- **Hijri:** `src/lib/time/hijri.ts` (`hijriDate`, private `firstOfMonth`, `ramadanSpan`, `gregorianSpanLabel`); callers `src/app/page.tsx`, `src/app/prayer/page.tsx`, `src/app/ramadan/page.tsx`, `src/app/admin/prayer-times/page.tsx`.
- **Dates:** `localDate`, `isUpcoming`, `isVisible`, `TIMEZONE` in `src/lib/community/schema.ts`; `src/lib/runtime/clock.ts`.
- **Migrations:** `202610050001_people_access.sql` (`can_manage_money()`, `set_access`, SGU01–04, SGU06), `202610050002_activity_log.sql`, `202610050003_archive.sql`, `202610060001_prayer_simplification.sql`.
- **Board-side code:** `src/lib/backend/providers/contract.ts` (`Outcome<R>`, `AdminIdentity.canManageMoney`, `PeopleEditor` precedent); `src/features/admin/*`; `src/lib/community/activity.ts`.
- **Public pages using giving:** home `GiveBand`, Ramadan `SupportBand`, `src/app/calendar/[eventId]/page.tsx`, `src/features/privacy/PrivacyLedger.tsx`.
- **Tests:** `tests/payments.test.ts`, `tests/runtime.test.ts`, PGlite `tests/prayer-migration.test.ts`, `scripts/test-backend.ts`, `tests/e2e/demo.spec.ts`.
- **ADRs:** 0005, 0006, 0014, 0015 change; 0019–0021 are free.

### Go2Pay facts

From https://go2pay.gd/api-docs (re-read 2026-10-05) and WP-2 (2026-10-04, full-access test key, read-only):

- **"Take payments only" key:** "POST /requests, GET /requests, GET /requests/{id}, GET /orders, GET /orders/{id}, GET /auth/me. Everything else is refused with 403." So, per the docs, it **can read orders** and **cannot read products, bank accounts or withdrawals**. WP-2 verifies this with a real payments-only test key.
- **Orders:** `GET /orders?page=&status=&q=&product_id=`, 20 per page, newest first, **no date filter**. Fields seen: `first_name`, `last_name`, `email`, `phone`, `price`, `qty`, `donation`, `subtotal` (= price × qty + donation), `processing_fee`, `customer_total`, `service_fee` (5% of subtotal), `refunded`, `refunded_date`, `status`, `note`, `created` (Grenada time), `pay_product`, `test_mode`. Statuses include unfinished attempts (`REQUIRES_SOURCE`, `REQUIRES_PAYMENT_METHOD`).
- **Public product page:** `https://go2pay.gd/<id>` (for example go2pay.gd/557): donation box (presets plus "Other", capped at US$2,500), caption, optional "Note for Vendor", quantity buttons, name, email and phone required.
- **Donation maths:** `subtotal = price × qty + donation`, so a fund product's price is added to every gift. The help card tells the board to set it to the smallest amount Go2Pay accepts (asked in the email whether 0 is allowed).
- **Fees:** 3.9% + US$0.30 added for the buyer; 5% taken from the MSA's payout, including the donation part; nobody makes it up (D-75). Our pages print one fine-print line about it, "Go2Pay and payment processing take about 5% of every payment." (D-76); no other fee number is printed.
- **Payouts:** settlements cluster on request, median 14 days after payment (affects zakat al-Fitr, D-69).
- **Test mode:** test payments never lower stock; card 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined.
- **Product creation with the test key failed** (500, 15 tries). It no longer blocks PR6, and stays in the support email.

## Owner

- **Funds, priced items and their Go2Pay links:** tables `public.payment_items` and `public.payment_item_links`; zod in `src/lib/community/payments.ts` (the Track B data shape); pure policy `src/lib/community/payment-policy.ts` (`CATEGORIES`, link parsing, windows, visibility, slips, closing-soon line, the zakat al-Fitr close, the Go2Pay copy text, the report).
- **Seasons:** table `public.seasons`; `src/lib/community/seasons.ts`; `season-policy.ts`; the `SeasonEditor` port.
- **Hijri lookup:** the existing `src/lib/time/hijri.ts`, extended with `hijriSpan`.
- **Go2Pay API:** the server-only `PaymentGateway` port (read orders, check the key), the only Go2Pay HTTP code.
- **Public reads:** the `PaymentsProvider` port plus `loadDonatePage(now)` in `src/lib/integrations/payments/index.ts`.
- **Board writes:** the `PaymentItemEditor` port, `src/features/admin/payment-actions.ts` and `season-actions.ts`.
- **Give route:** `src/app/donate/[slug]/give/page.tsx` and its `not-found.tsx`.
- **Donate slip UI:** Track B's `DonateSlips`, rendering `DonatePageData` only.
- **Permissions:** any admin (`is_admin()`) edits funds, items, links, tickets and seasons (D-65). `can_manage_money()` gates only the Payments screen and its CSV.
- **ADRs:** 0019 (payments with hand-made products and a payments-only key), 0020 (rules), 0021 (seasons).

## Source of Truth

- **Category:** `payment_items.category`. After a fund is first shown, the authority is the `fund_category_lock` trigger (SGU10); the editor's disabled cards are a mirror.
- **What each category means:** `CATEGORIES` in `payment-policy.ts` (fixed constants, ADR 0020): slip tag, fixed rule line (zakat categories only), whether the board sentence is required, whether it closes before Eid prayer, whether it is restricted.
- **Slip heading:** `payment_items.heading` (optional board text, empty = no heading, D-77); the slip order is `donateOrder` (D-77).
- **Which Go2Pay product belongs to which item:** `payment_item_links` (add-only; the newest row is the current link; a product id is unique across all rows, D-17). Our site never edits Go2Pay.
- **Price, stock, donation box, presets, Go2Pay wording, open or closed in Go2Pay:** Go2Pay, set by hand by the board. Our site neither stores nor mirrors them (P-72 recommended B; only an A or C answer would add a typed price text).
- **Wording the board copies into Go2Pay:** generated by `go2payCopyText(item)` from our row, so the zakat rule line is written once.
- **Window, visibility and "can pay now":** `paymentItemWindow`, `paymentItemVisible`, `canPayNow(item, window, today)`; "today" is `localDate(clock().now())`.
- **Slug:** made once by `slugFor(name, taken)`; unique over all rows, never changed (trigger).
- **Event ↔ ticket:** `events.ticket_payment_item_id`, unique where not null, priced items only (action check).
- **Orders, names and notes:** Go2Pay, read live after `currentAdmin().canManageMoney`; never stored, cached or logged.
- **Fixed constants (ADR 0020):** `CATEGORIES`, `INTENTION_LINE`, `FEE_LINE`, `ZAKAT_AL_FITR_CLOSE`, `GO2PAY_LINK`, `CLOSING_SOON_DAYS = 3`, `ENDED_REMINDER_DAYS = 7`, `OWN_DATE_REACH_DAYS = 60`, `BOARD_DATE_REACH_DAYS = 5`, `SEASON_RERUN_REMINDER_DAYS = 45`, `GATEWAY_TIME_BUDGET_MS = 8_000`, `MAX_ORDER_PAGES_PER_PRODUCT = 25`.
- **Board data:** fund and item fields (including the optional heading), links, season anchors and confirmed days, the Hijri adjustment.

## Reuse and Duplication Analysis

Reused unchanged: `currentAdmin`/`requireAdmin`, `publicClient()`, `Outcome<R>`, form helpers, `ViewTabs`, `RecordActions`, `archived_read_only()`, `touch_updated_at()`, `can_manage_money()`, `is_admin()`, `record_activity`, `localDate`, `clock()`, `hijriDate`, `gregorianSpanLabel`, `ButtonLink`, `MarginNote`, the `WeakMap` secret pattern, the version check, `revalidatePath`, and `NotFoundSignpost` (its `ClosedFund` story text moves into one exported constant `CLOSED_GIVING_SIGNPOST`, used by the story and the Give route).

Extended: `hijri.ts` (`hijriSpan`); `PaymentsProvider` (`items()`, `itemBySlug()`); `config.ts`, `wiring.ts`, `providers.ts`; `activity.ts` (link changes highlighted); `recordSchema` (`ticket_payment_item_id`); `DonateLetter`, `PrivacyLedger`, `GiveBand`, `SupportBand`, demo fixtures.

**One model, not two:** funds and priced items share `payment_items`, `payment_item_links`, the Give route and the report; they differ only by `kind`.

**One link parser:** `parseGo2PayLink` in `payment-policy.ts` is used by the zod schema (editor), the action and the tests; the redirect URL is built by `go2payPageUrl(id)` in the same module. No second regex anywhere.

**One closing-soon rule:** `closingSoon(window, today)` feeds the slip and the board's fund list; the daily-check plan reads the same function if it wants a dashboard warning (no email, D-68).

Searched for and not found (2026-10-04): "fund", "zakat", "sadaqah", "category", "slug" in `src/` and `supabase/`.

Retired: `DONATION_URL`, `link.ts`/`off.ts`, `donation(label)`; everything in the rev 7 deletion table above.

## New Abstractions

1. **`PaymentGateway`** (port; adapters `go2pay`, `fake`, `off`; server-only): `checkKey(): { ok: true; scope: "payments_only" | "too_broad" } | { ok: false; reason }` and `listOrders(productId, page)`. `checkKey` calls `GET /auth/me` and probes `GET /products?page=1` (403 means payments-only). Production refuses a too-broad key (Payments shows "Replace the Go2Pay key with a 'Take payments only' key"); development only warns (Q95 B). Pattern: Adapter.
2. **`PaymentItemEditor`** (port; `supabase`, `sample`): funds, priced items, links.
3. **`SeasonEditor`** (port; PR5 extends it).
4. **`payment-policy.ts`** and **`season-policy.ts`**: pure, one module per area (ADR 0020). `CATEGORIES` is a constant table, not an engine.
5. **`hijriSpan(...)`** in `hijri.ts`.
6. **`fund_category_lock()`** (trigger, SGU10) and **`FakeCheckout`** (sample only).

## Product Decisions Required

Answered before rev 7 and still in force: P-2, P-3R, P-4, P-5, P-6, P-9, P-10, P-14, P-17, P-20, P-21, P-22, P-23, P-25, P-26, P-27, P-28, P-29, P-30, P-31, P-32, P-33, P-34, P-37, P-38, P-41, P-42, P-43, P-46, P-47, P-53, P-54, P-59, P-60 (see Decisions; rev 6 lists the option texts). Answered in rev 7:

- [x] P-70 / P-52. Which Go2Pay key does the live site use? (Q1)
      Decision: D-58
- [x] P-55 / P-56 / P-64. Money types, leftover rules, sales for a cause (Q9)
      Decision: D-59
- [x] P-65. Headings on the Donate page (Q10)
      Decision: D-60
- [x] P-63. Changing a season fund's wording each year (Q8)
      Decision: D-61
- [x] Intention and late lines on the slips (Q14)
      Decision: D-62
- [x] P-57. Iftar: one fund or one product per night
      Decision: D-63
- [x] P-68 / P-69. Unfinished attempts and givers' notes (Q11, Q12)
      Decision: D-64
- [x] Who edits prices, stock and links (Q44)
      Decision: D-65
- [x] P-71. Stock and "Sold out" testing (Q13)
      Decision: D-66
- [x] Merch sizes (Q43)
      Decision: D-67
- [x] Reminder before a fund closes (Q18)
      Decision: D-68
- [x] P-61. Zakat al-Fitr given the night before Eid (Q6)
      Decision: D-69
- [x] P-62. Zakat al-Fitr amount per person (Q7)
      Decision: D-70
- [x] P-48 / P-66 / P-67. Donation box, smallest gift, preset amounts (Q3, Q4, Q5)
      Decision: D-71
- [x] P-49. The hand-made product go2pay.gd/557
      Decision: D-54 (amended in rev 7)
- [x] P-50 / P-51. Nightly product closing; iftar night cut-off
      Decision: D-72
- [x] Developers' full-access test key (Q95)
      Decision: D-73

Answered in rev 7.1 (answer sheet 2, 2026-10-05):

- [x] **P-58. Who covers Go2Pay's 5% on zakat?** Nobody; the 5% is lost.
      Decision: D-75
- [x] **P-73. The Donate page layout under the new categories.** Approved with changes: no headings by default, optional heading per fund, short plain wording.
      Decision: D-77

Open (approved by the user 2026-10-05 on our recommendation; mockups in `.plans/mockups/pr6/`):

- [x] **P-72. Price and "Sold out" for tickets and merch on our pages.** The payments-only key can't read Go2Pay's price or stock (403), so our page can't know them. Options: A. a board member types the price on our site too ("US$15 each"); there is no "Sold out" on our page, and Go2Pay's page says sold out after the tap · B. our page shows neither; the button reads "See price and buy ↗" · C. A, plus a "Sold out" switch a board member flips on our site when Go2Pay sells out.
      User (round 2 Q2): "i want to say dont put price on website because it requires setting it in 2 places right? im assuming were not using the full api key and only payments right?" Yes: the live key is "Take payments only" (D-58), which can't read prices, so with A the price lives in Go2Pay and on our site.
      Recommendation (changed from A in rev 7.1): **B**, approved by the user 2026-10-05. One place to set the price (Go2Pay), nothing to forget when a price changes; Go2Pay's page shows the price and "Sold out" before anyone pays. A merch or ticket description may still mention a price in its own words if the board wants. Picture: `priced-options.png` (middle).

The questions as asked before rev 7.1 (kept for the record, not open):

- P-58 as asked: **Who covers Go2Pay's 5% on zakat?** (for the board; the user relays.) Go2Pay takes 5% of every gift from the payout. On a US$100 zakat gift the MSA receives US$95. Options: A. the general fund tops it up, and the zakat slips say "Go2Pay's fees are covered by the general fund" · B. it comes out of the zakat, only if the board's scholar agrees, and the slips say so · C. no zakat on the website. Recommendation: A. Until answered, both zakat categories stay greyed out in the editor (`ZAKAT_LISTING_OPEN = false`) and no zakat fund can be shown. Picture: `donate-slips.png` (zakat slips drawn greyed, "waiting for the board").
- P-73 as asked: Fixed headings in this order: Zakat al-Fitr, Zakat al-Mal, then season sections (Ramadan …) while they are open, then Sadaqah, then General. Only zakat slips carry a rule line ("Given only to people in need, before Eid prayer." / "Given only to people eligible for zakat. Never used for MSA costs."). Every slip shows its category tag (so Iftar shows "Sadaqah"). A "Closes in 2 days" line with a clock icon appears only in the last 3 days. Options: A. approve as drawn · B. change the order or a line (say which). Picture: `donate-slips.png` (+ `-dark`, `-mobile`). Answer: D-77.
  Decision: B — no price or Sold out on our pages; the button reads "See price and buy ↗"; Go2Pay shows price and Sold out (user, 2026-10-05: "yes go with recommended").

## Decisions

Still in force from earlier revisions (text in rev 6, unchanged unless amended here):

- D-2: Orders are read live from Go2Pay; no copy, no webhook.
- D-3: Money holders see buyer names on screen only; nothing stored.
- D-5: Every event's tickets and every fund are their own item with their own Go2Pay product; Payments shows and filters per item, category and dates.
- D-6, D-12, D-13, D-15, D-22, D-24: seasons (Hijri-anchored, confirmed by the board, Eids are their own seasons). D-48 (Gregorian beside Hijri) is superseded by D-78 (Gregorian only).
- D-7: Validation is sensible; fixed rules are named constants.
- D-8: Activity-log filters are a roadmap follow-up.
- D-9: Amounts are chosen on Go2Pay's page in its donation box; the site stores no amount settings or donor data.
- D-10: Merch is in PR5 on `payment_items` (priced).
- D-11: An item may have its own show-from and show-until.
- D-14 (amended): Season items wait for "Running again in (season, year)", reminder 45 days before; the screen shows the Gregorian year the season starts in ("Ramadan 2027", D-78), while `season_year` keeps storing the Hijri year. Ticking it now asks the board to confirm the Go2Pay link: keep the same product (reopened in Go2Pay) or paste a new one.
- D-17: A Go2Pay product id belongs to one item only, ever.
- D-18: Nobody can turn on their own "Can manage money" (SGU09). Season date changes and Go2Pay link changes are highlighted in Recent changes.
- D-19, D-20: ADRs 0020/0021 accepted; PR6 before PR5; nothing goes live until the Release PR after PR8.
- D-23: "Buy ticket" disappears when the event ends, is archived, unpublished or cancelled; also while it is postponed without a new date (amended by D-81).
- D-27 (amended): Archiving an item an event uses is allowed with a warning; the help card says to close its product in Go2Pay too.
- D-28 (amended): Key values `g2p_test_…` or `off` on computers; `g2p_live_…` (Take payments only) or `off` on the live site, `off` until launch.
- D-29: No silent defaults; category and kind have no default.
- D-30 (amended): Zakat is allowed and kept apart, and can be listed now (D-75); each zakat fund's "About this fund" is required and says how the MSA passes it on. Zakat al-Fitr closes at the end of the Grenada day before 1 Shawwal (`ZAKAT_AL_FITR_CLOSE`). The board decides; no outside approval is required.
- D-31, D-32 (amended), D-33 (amended by D-76): fine print; the receipt note text is now copied by the board into Go2Pay's "Note shown on receipt" from the editor's copy box; the fee line is D-76's "about 5%" line.
- D-35, D-36, D-37, D-38, D-39: editor in boxes; Payments = filters + totals + one table; gift amount first, "Buyer paid" second; last 30 days by default; names not in the CSV.
- D-40: Refunds in Go2Pay only, with a help card.
- D-41: Home "Give" and Ramadan "Support" bands link to the Donate page when it shows funds.
- D-42: superseded for our pages by P-72 (Go2Pay's own page still shows sold out).
- D-45, D-46 (amended): posters are the board's; stopping all giving = unlist funds and items, then close the products in Go2Pay (help checklist).
- D-49: Paper slips, no amount line, Give opens Go2Pay in a new tab.
- D-51, D-52, D-53: prices, limits and Sold out only on priced items; closed funds hidden from the public; Give route `/donate/<slug>/give` with a 404 and the approved wording.
- D-54 (amended): Starting fresh in Go2Pay is the help card's advice. The site accepts any valid `go2pay.gd` link, so linking the old product 557 is now the board's choice in Go2Pay.
- D-55, D-56: two price types only (any amount, fixed price × quantity), set in Go2Pay; no per-payment or per-person limits (the help card says to set Go2Pay's per-payment maximum high).

Superseded: D-60 (by D-77), D-48 (by D-78), D-1 (by D-58), D-4, D-16 (by D-60, then D-77), D-21 (by D-58), D-25, D-26's "only money holders" (by D-65), D-34's headings (by D-60), D-43 (by D-59), D-44 (by D-63), D-47 (by D-53), D-50's money types (by D-59), D-57 (by D-71).

New in rev 7 (user answers 2026-10-05 unless noted):

- D-58: **Live key = "Take payments only" (Q1 C).** The board makes, edits and closes Go2Pay products by hand and pastes the product link into the fund or item editor. The site validates the link (`go2pay.gd/` plus digits, optional `https://`, `www.`, trailing slash or query) and stores only the id. The site never creates, edits or archives products. The support email is sent by the user (`.plans/go2pay-support-email.md`).
- D-59: **Four fixed categories (Q9).** Zakat al-Fitr and Zakat al-Mal are restricted, each with a fixed rule line (constants). Sadaqah and General are unrestricted and have no rule line. No Set purpose, no leftover or late rules. Sales (tickets, merch) are General. Qurbani is not taken on the site.
- D-60 (superseded by D-77): **Fixed headings by category (Q10).** A season-tied Sadaqah or General fund shows under its season's name (Iftar under "Ramadan"; an event programme is a season with typed dates). Zakat funds always stay under their zakat heading. Order: P-73.
- D-61: **Only the category locks (Q8 becomes moot).** Once a fund is first shown on the Donate page, its category and kind can't change (database trigger). Name, "About this fund", link, season and dates stay editable at any time; every change is logged.
- D-62: **Slip line (Q14 C):** "The fund you choose is your intention." (`INTENTION_LINE`, exactly that). No late-payment lines.
- D-63: **One Iftar fund for all of Ramadan** (P-57 A, user 2026-10-04).
- D-64: **Payments = visibility (Q11 A, Q12).** Totals per fund and item from Go2Pay orders, grouped by category, zakat lines never summed, no grand total. Only paid and refunded orders count; unfinished attempts are hidden. Givers' names and notes show on screen; the CSV includes notes but not names (D-39); it is built on request and never stored. Fallback if WP-2 shows the payments-only key can't read orders: each fund and item gets an "Open its orders in Go2Pay ↗" link and the help card shows Go2Pay's own export.
- D-65: **Permissions (Q44).** Any board member (`is_admin()`) creates and edits funds, priced items, their Go2Pay links and an event's ticket. "Can manage money" gates only the Payments screen (names, notes, totals) and its CSV. Who can change prices and stock in Go2Pay is whoever the board gives the Go2Pay login to.
- D-66: **Stock (Q13).** Go2Pay holds the stock for online sales. For a sale made in person, a board member lowers that product's stock in Go2Pay by hand (help card). If the last item sells in person and online at the same moment, the online buyer is refunded in Go2Pay (D-40). Whether Go2Pay keeps its fees on a refunded order is asked in the support email. Test payments never lower stock; there is no site-side stock to test (P-71 moot); on launch day a board member checks one real product's stock in Go2Pay.
- D-67: **Merch sizes: one Go2Pay product per size** (Q43; our recommendation at the user's request; PR5 builds it as one priced item per size, shown as size buttons). Safe because each size has its own exact stock and Sold out in Go2Pay. Edge cases: wrong size bought → exchange in person; one size sold out → only that size's button leads to a sold-out Go2Pay page (or is marked, if P-72 = C); in-person sale → lower that size's stock.
- D-68: **Time left instead of a reminder email (Q18).** In the last `CLOSING_SOON_DAYS = 3` days of a fund with an end date, its slip shows a clock icon and "Closes today", "Closes tomorrow" or "Closes in 2 days". No email (replaces daily-check P-7).
- D-69: **Zakat al-Fitr timing (Q6 A).** The board hands out zakat al-Fitr before Eid prayer from cash set aside and repays itself from the Go2Pay payout; it writes this in the fund's "About this fund".
- D-70: **Amount per person (Q7 A).** The board writes it in "About this fund" (for example "US$10 per person in your household this year"); no new field.
- D-71: **Donation box, preset amounts and smallest gift are Go2Pay settings the board sets by hand (Q3, Q4 C, Q5).** The help card says: donation box on, caption = the copy box text, preset amounts your choice, price = the smallest amount Go2Pay accepts (US$1 unless Go2Pay allows 0).
- D-72: **No nightly closing of Go2Pay products (P-50 moot; P-51 moot under D-63).** When a fund's window ends, the site hides it and the Give route returns 404. For `ENDED_REMINDER_DAYS = 7` days the board's fund list shows "Ended on (date) · close it in Go2Pay". A payment made through an old direct Go2Pay link still appears on Payments with its date.
- D-73: **Developers' test key (Q95 B).** A full-access test key is allowed on a developer's own computer, with the developer-guide warning that it can read the MSA's real bank details; never shared, deleted after use. The site itself needs only a payments-only key, which developers use by default.
- D-75: **Go2Pay's 5% is lost; nobody makes it up (P-58, user 2026-10-05, answer sheet 2 Q1 and Q8: "no one does, its money lost. the board will tell people and the website already does say that … 5% of that money is gone to go2pay or processing fees").** No top-up line and no fee sentence on zakat slips; zakat funds can be listed now. `ZAKAT_LISTING_OPEN`, `payment_settings_zakat_open()`, SGU11 and WP-13 are removed (rejected: A general fund tops it up; B out of the zakat only with a scholar's agreement; C no zakat on the site).
- D-76: **One fee line in the fine print** (user, round 2 Q1: "only keep the message at the bottom saying they take 5%"): `FEE_LINE` = "Go2Pay and payment processing take about 5% of every payment." It is the only fee number on our pages (amends D-33's "without numbers").
- D-77: **Donate page (P-73 approved with changes, user 2026-10-05, round 2 Q1).** (a) **No headings by default**, zakat slips included. (b) The board may type an optional **heading** per fund (`payment_items.heading`, up to 40 characters, placeholder "Ramadan"); it prints above that slip, and a run of slips next to each other with the same heading shares one heading. (c) **Order** (`donateOrder`, engineering): the approved order is kept as the sort (Zakat al-Fitr, Zakat al-Mal, season-tied funds, Sadaqah, General), then the board's position inside each group. A heading groups only slips that sit next to each other; the fund editor's preview shows where it lands. (d) **Short, plain wording** on every slip: rule lines and examples in Design → Categories; "About this fund" is one short sentence (limit stays 300, the box hint says "One short sentence"). (e) Tags, the intention line, the clock line (D-68) and the paper slips stay as approved (rejected: fixed headings as drawn).
- D-78: **HIJRI RULE (orchestrator resolution of the user's round 2 Q4 note: "keep hijri only on calendar or prayer and things like that coz no one really uses that date").** Hijri dates appear only with prayer times and on the calendar. In PR6: no Hijri date on Donate slips or the fund preview; the fund editor's "When it shows" and the Seasons screen show Gregorian dates; "Running again" shows the Gregorian year. The Hijri anchor (for example "starts on 1 Ramadan") stays the season's rule in the Seasons editor, and the Hijri adjustment stays on Prayer & iqamah. Supersedes D-48's "Gregorian beside every Hijri date".
- D-79: **Where a headed group ends (user, 2026-10-05, PR-C review, option A `grouping-A-line`).** On the Donate page a group with a heading ends with a thin line across the slips, so the slips after it do not read as part of it. No line after the last group (the fine print has its own).
- D-80: **Slips are never centred (user, 2026-10-05, PR-C review).** Every slip is left-aligned in the columns: a lone slip under a heading (Iftar under Ramadan) and a lone slip in the last row both sit in the left column at one column's width. Amended the same day (user): group headings ("Ramadan") are left-aligned too, on the slips' left edge; nothing in the slip area is centred.
- D-81: **A postponed event with no new date pauses its ticket (user, 2026-10-05, PR-C review; the recommended option, with the help text saying how it works).** Amends D-23. The event stays on the website with "Postponed: new date to be announced"; only **See price and buy ↗** is hidden, and the Give route answers "This has closed" for that ticket, until the board chooses **New date is known** and sets the Date (`moved_from` holds the old date). A postponed event with a known new date sells until that date is over. The help cards "Make a Go2Pay page for a ticket or size" and "Cancel or postpone an event" say so.
- D-82: **Event page buttons (user, 2026-10-05, PR-C review).** **See price and buy ↗** stays filled; **Add to Calendar** is an outlined button beside it (like **Sign up**). Without a ticket, Add to Calendar stays the page's filled main action.
- D-74: **Engineering choices (stated, not asked):** `CLOSING_SOON_DAYS = 3`; `ENDED_REMINDER_DAYS = 7`; Payments pages Go2Pay orders newest-first per product until older than the date range, within `GATEWAY_TIME_BUDGET_MS` and `MAX_ORDER_PAGES_PER_PRODUCT`; the Give route makes no Go2Pay call; `checkKey` refuses a too-broad key in production.

### Implementation notes (PR-A, engineering choices; no product change)

- Migration number `202610090001` (the number the plan first gave it; `202610080001` belongs to the daily check, PR #66). It also adds SGU09 (`self_money`) to `admins_guard` and `set_access`, starting from their PR3 versions, and starts `record_activity` from PR5a's version (urgent highlight kept).
- `PaymentsProvider` reads raw rows and leaves windows to the policy: `items()` (current items and the links of current items), `itemBySlug(slug)` → `{ found: { item, link } | null; unavailable }` (so Give can tell "closed" from "database down"), and `seasons()`. `loadDonatePage(now)` and `loadGiveTarget(slug, now)` in `payments/index.ts` compose them with the Hijri adjustment from prayer settings.
- `PaymentGateway` also has `mode` ("live" | "test" | "sample" | "off", for the TEST banner) and `checkoutUrl(productId)` (`go2pay.gd/<id>`, or `/checkout/<id>` with the fake gateway); `listOrders` answers `too_broad` on the live site and `unreadable` when Go2Pay's answer has an unexpected shape (a missing order would hide money). `FakeCheckout` (sample only) records a "Sample Donor" paid order.
- Wiring keeps the old `DONATION_URL` link as `donationLink: "link" | "off"` until WP-9 retires it; `payments` and `seasons` are "supabase" | "sample"; `paymentItemEditor()` follows `payments`.
- Review fixes before merge: visitors read only listed current items and their links (both the policies and the public adapters filter on `listed`), so a draft's Go2Pay product id is not public before it shows; Give and Donate are unchanged because `canPayNow` already requires `listed`. Re-pasting the item's own earlier product is refused as `link_used_before`, not `link_taken`. The zakat categories on Payments and in the slip order come from `CATEGORIES[c].restricted`.
- Board flags are codes (`paymentItemFlags`); the words stay with the screens (WP-6). A confirmed first day moves an unconfirmed last day by the same number of days (moon sighting moves the whole month). `orderDay` reads Go2Pay's `created` as Grenada time.

### Implementation notes (PR-B, engineering choices; no product change)

- Screens: `/admin/payments` (Money in), `/admin/payments/funds[/id]`, `/admin/payments/tickets[/id]`, `/admin/payments/export`, `/admin/seasons[/id]`; dashboard cards **Payments** and **Seasons**. Board reads in `src/lib/backend/admin-payments.ts`; form reading in `features/admin/payment-forms.ts`; screen words in `features/admin/payment-words.ts` (category names and rule lines only from `CATEGORIES`; other card lines keyed on `restricted` / `closesBeforeEidPrayer`).
- The slip preview is the fund form's **Preview** tab (`EditorTabs`, PR5a D-23: Edit | Preview tabs on every screen size; `fund-editor.png` predates that answer); it is a simple preview until Track B's `DonateSlips` exists. "Where it sits" lists the funds visitors see today through `donateOrder` and `donateGroups`, with this fund and its heading.
- A fund has an **Order number** box (`position`, used by `donateOrder`); a new item takes the next number.
  - Amendment (user, 2026-10-05; review-fixes PR-2, see the [PR3 contract](pr3-people-permissions-activity.md) amendment of that date): the **Order number** box is gone from the fund and ticket forms. The Funds list shows one dragged list per Donate-page group (`donateRank`: Zakat al-Fitr, Zakat al-Mal, "Funds with a season", Sadaqah, General, each under its heading when there is more than one group), because `donateOrder` puts the groups first; the Tickets list is one dragged list. **Save order** saves each list (`save_order`); a saved item keeps its number, a new one goes last.
- "Running again" (D-14): saving a season fund stores the current occurrence's Hijri year; a fund whose year is past shows the "Running again in (season) (Gregorian year)" tick, which asks "keep the same Go2Pay page" or "use a new one" (a new one must be pasted).
- The D-32 receipt text is `payments.receipt_note` of the `integrations` page text: a board field in **Pages → Leaving the site** (PR5b), with a suggested starter in `content/integrations.yaml` (it did not exist yet; wording listed for confirmation in the release checklist). PR5b's seed predates it, so on the live database it starts empty and the copy box links to Pages.
- Money in: `collectOrders` reads the products in parallel within `GATEWAY_TIME_BUDGET_MS`; any refused or unreadable page shows the problem and no totals; a partial read shows the notice, and the CSV is refused while partial. The "Season" filter offers each season's latest started occurrence (`latestStartedSpan`). The status filter narrows the counted statuses.
- "Used by (event)" on the Tickets screen arrives with WP-9 (PR-C), which adds `ticket_payment_item_id` to the event schema.
- Recent changes: area names, field names and the "Funds, tickets and seasons" filter for `payment_items`, `payment_item_links` and `seasons`; highlighted rows read "Go2Pay link", "Category locked" or "Season days".

### Implementation notes (PR-C, engineering choices; wording listed for confirmation in the release checklist)

- Next 16 streams every page under the root `loading.tsx`, so the Give route's `notFound()` ("This has closed") is sent with status 200 and `noindex`, and its `redirect()` reaches the browser inside the stream (`NEXT_REDIRECT`, followed client side). Same as every other page under that `loading.tsx`.
- A ticket is on sale only through a visible event: `loadGiveTarget` also checks that the event selling it is shown, not cancelled, not over and not postponed without a new date (`ticketOnSale`, D-23, D-81); a ticket no visible event sells shows "This has closed".
- `DONATION_URL` is no longer read; a value left in Vercel is ignored until the owner deletes it.
- The fake gateway's checkout is `/checkout/<id>` (a 404 unless the sample data is on). Its words carry no "sample" label, so the sandbox looks like the live site (review of 2026-10-05). The end-to-end tests open it but never press **Pay**, so the sample totals that `payments.spec.ts` reads stay fixed; paying is covered by `tests/payments-adapters.test.ts`.
- Review of 2026-10-05: the unused **Pages → Leaving the site → Notice** box (`payments.leaving_site_notice`) is removed; the page is now **Pages → Go2Pay receipt note** with only the receipt note, and has no Preview tab (no page shows it). The receipt note starts filled in: the PR5b page-text seed (`202610100001_page_texts.sql`) seeds it in place of the old notice text (project rule, 2026-10-05: no real data yet, so migrations are edited directly, with no add-on migration or backfill). The empty Donate page says "There are no open appeals right now."
- Amendment (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): `/donate`, `/donate/<slug>/give` and `/checkout/<id>` no longer export `dynamic = "force-dynamic"` (Cache Components). `/donate` and Home read "now" through `requestNow()`, so the slips are still worked out on each visit; the Give and checkout pages set `instant = false` and are worked out on each visit from their address. Payment actions call `publicDataChanged()`.

- Amendment (PR5c, 2026-10-06; final plan A3, `.plans/pr5-self-serve-content.md` PR5c, `.plans/answers-2026-10-05.md`): **season pages and merch, from the dashboard.** Edited in place in `202610090001_payments_seasons.sql` (no hosted data); `content/ramadan.yaml` and the merch collections in `content/merch.yaml` are gone.
  - **Seasons** gain `slug` (made once from the name by the `season_slug` trigger, "-2" when taken, never changed, never reused), `has_page`, `intro` (≤ 2,000), `schedule` (≤ 40 rows What / When / Where, `valid_season_schedule`), `sign_up_form` (a key of the sign-up forms list) and `photos` (≤ 12 `{src, alt}`, the first the cover, `valid_photo_list`). Ramadan starts with a page (the old YAML's text and photos). The page is `/ramadan` for Ramadan and `/seasons/<slug>` for every other season with a page (`/seasons/ramadan` goes to `/ramadan`; no page, unknown or archived: 404). It stays up all year (Q-10a/b): in its days it is labelled "Ramadan 2027"; outside them it says "Ramadan 2027 is expected to start around 8 Feb." (or "starts on Mon 8 Feb." once confirmed) and keeps its content labelled with the Gregorian year it last ran (`season-page.ts`). **No Hijri date on these pages** (D-31 as tightened by the final plan): the Tonight sheet shows today's ordinary date only. Confirmed days stay typed in the season form; there is no "Eid is tomorrow" button. Ramadan-month seasons (`RAMADAN_HIJRI_MONTH = 9`) show "Tonight" from the evening before the first fast to the last day: Iftar = Maghrib's start at the musallah pin, Tarawih = Isha's iqamah, "Night N" ("(expected)" while unconfirmed); nothing is typed twice. The page also lists the season's upcoming events (`events.season_id`, "Season (optional)" in the event form) and its open funds (this contract's slips, `loadSeasonFunds`). Any board member edits it on the season's screen (Public page, Edit | Preview).
  - **Merch** (D-9, D-27): `merch_collections` (name, Arabic name, quote, year, description, `era` current/past, order) and `merch_items` (collection, name, description, garment, colour, `photos`, order), both dragged into order (`save_order` lists `merch_collections`, `merch_items`), archived not deleted (an item with a current size cannot be archived: SGU16, `merch_items_archive_check`, as SGU08 for seasons), public read of current rows (an item also needs its collection current). A **size** is a priced item with `merch_item_id` and `size_label` (both or neither; priced, no season; one current size per label, `payment_items_one_size`), saved under the name "<item> · <size>" so Payments names it; it has its own hand-made Go2Pay product (P-72 B: no price, stock or Sold out on our pages). `/merch` shows the first current collection first, each item's photos (the shared photo viewer for uploads, D-21), details and "See price and buy ↗" with one button per open size; past collections say "Not for sale". Give sends a size to Go2Pay only while its item is in a current collection. Sizes never appear on the Tickets screen or in an event's ticket choice. Any board member edits merch (Merch screen; sizes from the item's screen, `/admin/merch/sizes/<id>?item=<item>`). The Merch page's opening is page text `merch` ([PR5b contract](pr5b-page-text-forms-reminders.md) amendment of this date).
  - Photos of a season with a page and of a current item in a current collection are public files; any season or item naming a file keeps it in use (`published_attachment`, `community_file_in_use` in `202610100001_page_texts.sql`).

## Board Self-Sufficiency Check

From the dashboard, any board member can:

- Make a fund: name, category (fixed rule shown), "About this fund", an optional heading (D-77), season or dates, "Show on the Donate page", and the Go2Pay link.
- Copy the exact Go2Pay title, description, donation-box caption and receipt note from the editor's copy box, make the product in Go2Pay, and paste its link back.
- See a live preview of the slip.
- Make ticket items (and merch in PR5), and choose an event's ticket.
- See which funds ended and still need closing in Go2Pay.
- Edit seasons and the Hijri adjustment.

Money holders also: read totals per fund and item, see givers' names and notes, download the CSV.

In Go2Pay, by hand (needs the Go2Pay login): make, edit and close products; price, stock, donation box, preset amounts; lower stock after an in-person sale; refunds. Each step has a help card: "Make a Go2Pay page for a fund", "Make a Go2Pay page for a ticket or size", "Sold one in person", "Close a fund in Go2Pay", "Refund in Go2Pay", "If a giver chose the wrong fund" (the fund tapped counts; contact the giver; refund so they can give again), "See payments", "Stopping all giving", "Seasons and moon sighting". The help cards say "sold in person" and name no other payment channel (ADR 0005).

**Empty state:** "Start with the general fund" fills the name "MSA & Musallah" and the category General; the board adds the link.

Deliberately not board-editable: the four categories, the two zakat rule lines and the fee line (fixed constants, ADR 0020). Headings are board text (D-77).

Remaining gaps, for the roadmap: merch (PR5), page text (PR5), activity-log filters (D-8), a refund button (D-40), a money book (parked).

## Design

```text
prayer_settings.hijri_adjustment ─┐
seasons ─► season-policy.resolveSeason ─(hijri.ts hijriSpan)─► SeasonDates
payment_items (kind, category, about, slug, listed, season, dates, first_shown_at, …)
payment_item_links (go2pay_product_id, payment_item_id, added_at)   events.ticket_payment_item_id
Board save ─► payment-actions ─► parseGo2PayLink ─► PaymentItemEditor ─► fund_category_lock (DB)
Board in Go2Pay (by hand) ─► product made / edited / closed; link pasted back
Visitor /donate ─► loadDonatePage(now) ─► DonatePageData ─► DonateSlips ─► <a target=_blank> /donate/<slug>/give
/donate/<slug>/give ─► itemBySlug ─► canPayNow (our dates only) ─► redirect https://go2pay.gd/<id>
                                                             └─► notFound() ─► CLOSED_GIVING_SIGNPOST (not-found page, status 200)
Money holder /admin/payments ─► gateway.checkKey ─► listOrders(each linked product) ─► paymentsReport
```

### Categories (fixed constants in `payment-policy.ts`)

| `category`      | Tag           | Fixed rule line (D-77 d)                     | "About this fund"                                 | Report                 |
| --------------- | ------------- | -------------------------------------------- | ------------------------------------------------- | ---------------------- |
| `zakat_al_fitr` | Zakat al-Fitr | "Goes to people in need before Eid prayer."  | Required (how it is passed on; amount per person) | Own line, never summed |
| `zakat_al_mal`  | Zakat al-Mal  | "Goes only to people who can receive zakat." | Required (how it is passed on)                    | Own line, never summed |
| `sadaqah`       | Sadaqah       | none                                         | Optional                                          | Unrestricted group     |
| `general`       | General       | none                                         | Optional                                          | Unrestricted group     |

**Example slips (round 2 wording; short, plain; no heading unless the board types one):**

| Slip title     | Tag           | Rule line                                  | About this fund (board's sentence, example) |
| -------------- | ------------- | ------------------------------------------ | ------------------------------------------- |
| Zakat al-Fitr  | Zakat al-Fitr | Goes to people in need before Eid prayer.  | US$10 per person in your household.         |
| Zakat al-Mal   | Zakat al-Mal  | Goes only to people who can receive zakat. | Passed on to people in need.                |
| Iftar          | Sadaqah       | none                                       | Helps pay for iftar at the Musallah.        |
| Sadaqah        | Sadaqah       | none                                       | Used where it helps most.                   |
| MSA & Musallah | General       | none                                       | Keeps the Musallah and the MSA running.     |

Fine print under the slips (D-31, D-76): the existing D-31 line, then "Go2Pay and payment processing take about 5% of every payment."

- Priced items are always `general` and never on `/donate`.
- The tag is text, so the category never depends on colour alone; zakat tags use a double border.
- `INTENTION_LINE` above all slips: "The fund you choose is your intention."
- Headings (D-77): none by default; a slip whose `heading` is not empty and differs from the slip before it prints that heading above itself.
- Zakat al-Fitr's window is capped by `ZAKAT_AL_FITR_CLOSE`, chosen by `CATEGORIES.zakat_al_fitr.closesBeforeEidPrayer`, never by a name.

### Lock

- `first_shown_at` is set by the trigger the first time a fund row is saved with `listed = true`.
- After that, `category` and `kind` can't change (SGU10 `fund_locked`). The slug never changes for any row.
- The editor shows the category cards disabled with "Locked since (date): givers have seen this category." Before the first listed save it asks: "Once this shows on the Donate page, its category can't change."

### Go2Pay link

- `parseGo2PayLink(text)`: trims; accepts `go2pay.gd/1650`, `https://go2pay.gd/1650`, `https://www.go2pay.gd/1650/`, with an optional `?…` or `#…`; returns the id (digits, 1–12, > 0) or the error "Paste the Go2Pay page link, for example go2pay.gd/557."
- A new link inserts a `payment_item_links` row (highlighted in Recent changes). Pasting a product id already used by another item is refused: "This Go2Pay page is already used by (item). Each fund or item needs its own Go2Pay page."
- A fund or item can't be listed without a link (`readyToList`).
- `go2payPageUrl(id)` = `https://go2pay.gd/${id}`; the URL is never stored.

### Copy box (`go2payCopyText(item)`, pure)

- Title: the name.
- Description and donation-box caption: "{TAG}. {rule line} {About this fund}" (rule line only for zakat).
- Receipt note: "{name} ({category label}). " + the D-32 text from `content/integrations.yaml`.
- Shown read-only in the editor with a Copy button per field; Go2Pay's maximum lengths (lower bounds title 118, description 152, receipt note 151, caption 75) are shown as counters; over-length text shows a warning, never a refusal.

### Window, visibility and closing soon

- `from = own ?? season.start ?? null`; `until = own ?? season.end (+1 day while expected, D-22; not zakat_al_fitr) ?? null`; zakat al-Fitr capped at the day before resolved 1 Shawwal.
- Public list: funds that are listed, have a link, and are open today.
- `closingSoon(window, today)`: `null`, or `{ daysLeft: 0 | 1 | 2 }` when `until - today < CLOSING_SOON_DAYS`.
- Board flags: "Shows with no end date", "Will never show", "Last year's date ignored", "Waiting for 'running again'", "Season dates unavailable", "No Go2Pay link", "Ended on (date) · close it in Go2Pay" (for `ENDED_REMINDER_DAYS`), "Locked since (date)".

### Give route (D-53)

- `src/app/donate/[slug]/give/page.tsx`: dynamic, `robots: noindex`, never prefetched; buttons are plain `<a target="_blank" rel="noopener">`.
- `itemBySlug`, then `canPayNow(item, window, today)`: `ok` → `redirect(go2payPageUrl(currentLinkId))`; `closed`, unknown or archived → `notFound()` rendering `CLOSED_GIVING_SIGNPOST` (the not-found page; status 200 under the streaming root `loading.tsx`, see the Give paragraph above); Supabase down → the signpost "Temporarily unavailable" ("Giving can't open right now. Please try again in a few minutes.", ways Donate and Home), no redirect.

### Payments (money holders; `payments-audit.png` from rev 6, with the categories above)

- Filters: season or dates (default last 30 days), category, fund or item, status.
- Boxes: Zakat al-Fitr and Zakat al-Mal (each its own box, "Never added to any other total"); Unrestricted (Sadaqah, General, season funds and sales) with one line per fund and item and a subtotal. No grand total.
- Table: Date (Grenada), Fund or item, Category, Order, Giver (screen only), Note, Gift (`subtotal`), Buyer paid (`customer_total`), Refunded, Status. Only `PAID`, `PARTIAL REFUND`, `REFUNDED`.
- CSV (`Cache-Control: no-store`, cells starting `= + - @` escaped): Date · Fund or item · Category · Go2Pay product · Order no. · Gift · Buyer paid · Refunded · Status · Note.
- Orders for a product linked earlier (an old link row) still count for that item.
- Banner when `checkKey` says `too_broad` (production refuses) or the key is `off`; a "TEST" banner for test keys.
- Fallback (D-64): per fund and item, "Open its orders in Go2Pay ↗" and the help card for Go2Pay's export.

### Seasons

Unchanged from rev 5: each side resolved separately with `hijriSpan`; a confirmed day applies within `BOARD_DATE_REACH_DAYS`; typed-date seasons end; "dates unavailable" when the adjustment can't be read; Eids resolve alone; screens show Gregorian dates only (D-78).

## Public Contract

Migration `supabase/migrations/202610090001_payments_seasons.sql` (not applied anywhere yet; rev 7 rewrites the draft):

```sql
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  hijri_month smallint check (hijri_month between 1 and 12),          -- null = typed calendar days
  hijri_first_day smallint check (hijri_first_day between 1 and 30),
  hijri_last_day smallint check (hijri_last_day between 1 and 30),    -- null = end of the month
  board_starts_on date, board_ends_on date,                            -- confirmed (Islamic) or typed (calendar) days
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((hijri_month is null) = (hijri_first_day is null)),
  check (hijri_last_day is null or (hijri_month is not null and hijri_last_day >= hijri_first_day)),
  check (hijri_month is not null or (board_starts_on is not null and board_ends_on is not null)),
  check (board_starts_on is null or board_ends_on is null or board_ends_on >= board_starts_on)
);
create unique index seasons_current_name on public.seasons (lower(name)) where archived_at is null;
-- starter rows (D-15): Ramadan (9, 1, null), Eid al-Fitr (10, 1, 1), Eid al-Adha (12, 10, 10)
create table public.payment_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('fund', 'priced')),                                     -- no default
  category text not null check (category in ('zakat_al_fitr', 'zakat_al_mal', 'sadaqah', 'general')),  -- no default
  about text not null default '' check (length(about) <= 300),
  heading text not null default '' check (length(heading) <= 40),                            -- D-77; empty = no heading
  price_text text check (price_text is null or length(price_text) <= 40),                    -- only if P-72 = A or C (recommended B: drop)
  sold_out boolean not null default false,                                                   -- only if P-72 = C (recommended B: drop)
  listed boolean not null default false, position integer not null,
  season_id uuid references public.seasons(id),
  season_year smallint check (season_year between 1400 and 1600),                            -- "running again" (D-14)
  shows_from date, shows_until date,
  first_shown_at timestamptz,                                                                -- set only by fund_category_lock
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind = 'fund' or category = 'general'),
  check (kind = 'fund' or heading = ''),                                                     -- headings are for Donate slips only
  check (shows_from is null or shows_until is null or shows_until >= shows_from)
);
create unique index payment_items_slug on public.payment_items (slug);                      -- all rows: never reused
create table public.payment_item_links (                                                    -- add-only; newest = current
  go2pay_product_id bigint primary key check (go2pay_product_id > 0),                       -- one item ever (D-17)
  payment_item_id uuid not null references public.payment_items(id),
  added_at timestamptz not null default now()
);
create index payment_item_links_item on public.payment_item_links (payment_item_id, added_at desc);
alter table public.events add column ticket_payment_item_id uuid references public.payment_items(id);
create unique index events_one_per_ticket_item on public.events (ticket_payment_item_id) where ticket_payment_item_id is not null;
```

- **`fund_category_lock()`** (`before insert or update` on `payment_items`): a changed `slug` raises SGU10; when `new.kind = 'fund'`, `new.listed` and old `first_shown_at` is null, sets `first_shown_at = now()`; when old `first_shown_at` is not null, keeps it and raises SGU10 if `category` or `kind` differ; on insert a client-sent `first_shown_at` is ignored.
- **Archive checks:** a season used by a current item can't be archived (SGU08).
- **Policies:** public read of current listed rows (listed items, links of current listed items, current seasons; an unlisted draft and its Go2Pay product id stay private); admin read of all; insert and update for `is_admin()` on items and seasons; insert only for `is_admin()` on links; no update or delete on links; no delete anywhere.
- **Triggers:** `touch_updated_at`, `archived_read_only`, `record_activity('id','full')` on items and seasons; `record_activity('go2pay_product_id','full')` on links. Highlight: link inserts, `first_shown_at`, season dates and anchors (D-18). `set_access` keeps SGU09.
- **Grants:** `select` to anon; `select, insert, update` to authenticated on items and seasons; `select, insert` on links. Header comment lists SGU08–SGU10. SGU07 (`money_link_guard`) and SGU11 (the old zakat gate, D-75) are not created.

Config: `RuntimeConfig.go2pay: "test" | "live" | "off"`, `go2payApiKey(config)` in a `WeakMap` (PR #58). Production accepts `g2p_live_…` or `off`; elsewhere `g2p_test_…` or `off`. No `CRON_SECRET`.

Wiring: `payments: "supabase" | "sample"`, `gateway: "go2pay" | "fake" | "off"`, `seasons: "supabase" | "sample"`. Production never gets sample or fake.

```ts
// src/lib/community/payment-policy.ts (fixed rules, ADR 0020)
export type Category = "zakat_al_fitr" | "zakat_al_mal" | "sadaqah" | "general";
export const CATEGORIES: Readonly<
  Record<
    Category,
    {
      tag: string;
      ruleLine: string | null;
      aboutRequired: boolean;
      closesBeforeEidPrayer: boolean;
      restricted: boolean; // restricted = own report box, never summed
    }
  >
>;
export const INTENTION_LINE = "The fund you choose is your intention.";
export const FEE_LINE =
  "Go2Pay and payment processing take about 5% of every payment."; // D-76
export const HEADING_MAX = 40; // D-77
export const CLOSING_SOON_DAYS = 3,
  ENDED_REMINDER_DAYS = 7,
  OWN_DATE_REACH_DAYS = 60,
  SEASON_RERUN_REMINDER_DAYS = 45,
  GATEWAY_TIME_BUDGET_MS = 8_000,
  MAX_ORDER_PAGES_PER_PRODUCT = 25,
  ZAKAT_AL_FITR_CLOSE = { hijriMonth: 10, hijriDay: 1, daysBefore: 1 };
export function parseGo2PayLink(
  text: string,
): { ok: true; id: number } | { ok: false; error: string };
export function go2payPageUrl(id: number): string;
export function slugFor(name: string, taken: ReadonlySet<string>): string;
export function readyToList(
  item,
  link,
): { ok: true } | { ok: false; missing: ("about" | "link")[] };
export function paymentItemWindow(
  item,
  season,
  eidAlFitrFirstDay: string | null,
): ItemWindow;
export function paymentItemVisible(item, link, window, event, today): boolean;
export function canPayNow(item, link, window, today): "ok" | "closed";
export function closingSoon(
  window: ItemWindow,
  today: string,
): { daysLeft: 0 | 1 | 2 } | null;
export function donateSlip(item, window, today: string): DonateSlip;
export function donateOrder(items, seasons): typeof items; // D-77 c: zakat al-Fitr, zakat al-Mal, season-tied, sadaqah, general, then position
export function donateGroups(slips: readonly DonateSlip[]): DonateGroup[]; // runs of equal non-empty heading
export function go2payCopyText(
  item,
  receiptNote: string,
): { title: string; description: string; caption: string; receiptNote: string };
export function paymentsReport(orders, items, links): PaymentsReport; // restricted categories in own boxes; no grand total
```

**The Track B data shape** (zod-derived types in `src/lib/community/payments.ts`; `DonateSlips` computes nothing):

```ts
export type DonateSlip = {
  slug: string; // "iftar"
  title: string; // "Iftar"
  category: Category; // tag style only; never branch on it for wording
  tag: string; // "Zakat al-Fitr" | "Zakat al-Mal" | "Sadaqah" | "General"
  ruleLine: string | null; // zakat categories only
  about: string | null; // board sentence
  heading: string | null; // D-77; null = none (the default)
  closingSoon: string | null; // "Closes today" | "Closes tomorrow" | "Closes in 2 days"; render with the clock icon
  giveHref: `/donate/${string}/give`; // target="_blank" rel="noopener"; never a Go2Pay URL
};
export type DonateGroup = { heading: string | null; slips: DonateSlip[] }; // D-77: null heading = no heading drawn; order from donateOrder
export type DonatePageData =
  | {
      state: "ready";
      intentionLine: string;
      groups: DonateGroup[];
      finePrint: string[];
    } // finePrint = [D-31 line, FEE_LINE]
  | { state: "empty"; finePrint: string[] }
  | { state: "unavailable" }; // "Giving details could not be loaded right now."
```

- Priced items are not on `/donate`. A ticket shows on its event page as `PricedItemButton { slug; title; priceText: string | null; soldOut: boolean; giveHref }` (`priceText` null and `soldOut` false unless P-72 = A or C; with the recommended B both fields are dropped and the button reads "See price and buy ↗").

```ts
// src/lib/integrations/payments/providers/contract.ts
export interface PaymentsProvider { items(input: { today; adjustment }): Promise<{ items; links; unavailable }>;
  itemBySlug(slug: string): Promise<{ item; link } | null>; }
export interface PaymentGateway {
  checkKey(): Promise<{ ok: true; scope: "payments_only" | "too_broad" } | { ok: false; reason: "off" | "unauthorized" | "unreachable" }>;
  listOrders(productId: number, page: number): Promise<{ ok: true; orders: Order[]; more: boolean } | { ok: false; reason }>; }
// src/lib/integrations/payments/index.ts
export function loadDonatePage(now: Date): Promise<DonatePageData>;
// src/lib/backend/providers/contract.ts
export interface PaymentItemEditor { listItems; readItem;
  saveItem → Outcome<"forbidden" | "fund_locked" | "missing_text" | "slug_taken" | "link_taken" | "link_used_before">;
  archiveItem; restoreItem; }
export interface SeasonEditor { listSeasons(view?); saveSeason → Outcome<"name_taken">;
  archiveSeason → Outcome<"in_use">; restoreSeason → Outcome<"name_taken">; }   // PR5 extends it
// src/features/system/NotFoundSignpost.tsx
export const CLOSED_GIVING_SIGNPOST: { title: string; body: string; ways: Way[] };
```

Routes: `/donate` (dynamic); `/donate/[slug]/give` (dynamic, noindex, `not-found.tsx`); `/admin/payments` (money in, money holders); `/admin/payments/funds[/id]`, `/admin/payments/tickets[/id]` (any admin); `/admin/payments/export` (money holders); `/admin/seasons[/id]`; `/checkout/[productId]` (sample only).

Actions (`payment-actions.ts`): save, archive and restore funds and priced items. Each runs `currentAdmin()`, zod (including `parseGo2PayLink`), `readyToList` when listed, then the port, then `revalidatePath("/", "layout")`. No gateway call.

## Private Implementation

The implementer may decide: the Go2Pay fetch and parse; how `hijriSpan` uses `firstOfMonth`; slug transliteration (ASCII, lowercase, hyphens, "-2" on a clash); CSV escaping; the Copy button; component split; fixtures: funds "MSA & Musallah" (general), "Iftar" (sadaqah, Ramadan), "Zakat al-Fitr" and "Zakat al-Mal" (listed, with About text), "Iftar" with the heading "Ramadan", one closed and one archived fund, one fund closing tomorrow; two event tickets; fake orders with "Sample Donor", one note, one partial refund, one unfinished attempt.

## Data and State Flow

- **Public:** `/donate` → `loadDonatePage(now)` → `seasonContext` → provider (`publicClient()`, 3 s, `no-store`) → zod → window and visibility → `donateOrder` → `donateSlip` → `donateGroups` (runs of the same optional heading, D-77) → `DonateSlips`.
- **Give:** `itemBySlug` → `canPayNow` → redirect, `notFound()`, or the unavailable signpost. No Go2Pay call.
- **Board:** actions write through the ports under RLS with the version check. Error mapping: `23505` on slug → `slug_taken` (regenerate, retry once); `23505` on link → `link_taken` (another item's product); `link_used_before` (this item's own earlier product: a product id is linked once, ever, so going back needs a new Go2Pay product); SGU10 → `fund_locked` ("The category is locked because givers have already seen this fund. Make a new fund to collect for something else."); SGU08 → `in_use`; `42501` → `forbidden`; no row → `conflict`.
- **Orders:** `/admin/payments` → `requireAdmin` + `canManageMoney` → `checkKey` → link rows of matching items → `listOrders` per product, newest first, stop when older than the range or at the time budget → filter by `localDate` → `paymentsReport`. Nothing cached; a partial read shows "Only part of the orders could be read; narrow the dates".
- **Activity:** every item, link and season change is logged; link inserts and the lock moment are highlighted; no personal data is logged.

## Failure Modes

| Situation                                                             | Expected behavior                                                                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase down on `/donate`                                            | `unavailable` state; the event page hides only the ticket button.                                                                                                                            |
| Old tab; fund closed since                                            | `/donate/<slug>/give` → 404 "This has closed" (D-53).                                                                                                                                        |
| Unknown slug                                                          | The same 404.                                                                                                                                                                                |
| Go2Pay down                                                           | Give still redirects; Go2Pay's page shows its own error. Payments shows "Go2Pay can't be reached right now".                                                                                 |
| Board pastes a non-Go2Pay link or a typo                              | Refused with the example.                                                                                                                                                                    |
| Board pastes a link already used by another item                      | Refused, naming the item.                                                                                                                                                                    |
| Board pastes a valid link to the wrong Go2Pay product                 | Cannot be detected with a payments-only key. Mitigations: the change is highlighted in Recent changes; the preview shows "Opens go2pay.gd/1650"; Payments shows the product number per line. |
| Fund ended on the site but still open in Go2Pay                       | Hidden on the site; the fund list shows "close it in Go2Pay" for 7 days; any payment via an old direct link appears on Payments with its date.                                               |
| Board edits a shown fund's category (or crafts the request)           | SGU10; the editor shows the lock message.                                                                                                                                                    |
| Two funds share a heading but are not next to each other in the order | The heading prints twice; the fund editor's preview shows it, and the help card says to give such funds the same category group (D-77).                                                      |
| Last item sold in person and online at once                           | Go2Pay sells the online one; the board refunds it in Go2Pay (D-66).                                                                                                                          |
| Production key is "Everything my account can do"                      | `checkKey` → `too_broad`; Payments refuses to read and says how to replace the key.                                                                                                          |
| Key revoked or wrong                                                  | Payments banner "The Go2Pay key doesn't work"; Give is unaffected.                                                                                                                           |
| Payments-only key can't read orders (WP-2)                            | The fallback screen (D-64) is built instead.                                                                                                                                                 |
| Many orders, no date filter                                           | Paged newest first, stopped at the range start or the time budget, with the partial-read notice.                                                                                             |
| Season data unavailable                                               | "Season dates unavailable"; affected sides stay closed.                                                                                                                                      |
| 8:30 PM on a last day                                                 | Still open (`localDate`); "Closes today" shows.                                                                                                                                              |
| Two editors                                                           | The version check gives a conflict.                                                                                                                                                          |

## Compatibility and Migration

- **Migration `202610090001_payments_seasons.sql`:** additive (three tables, starter seasons, a nullable events column, `fund_category_lock`, `create or replace` of `record_activity`). Applied after PR4's `202610060001` and PR5a's `202610070001_notices_events_handover.sql` (which took the old `202610070001` number and also redefines `record_activity` with the urgent-notice highlight: start from that version so the highlight is kept). PR7's `202610110001_musallah_location.sql` sorts after it and only attaches `record_activity(... 'full')` to its table (no highlight, PR7 E-4); the two do not depend on each other, so either apply order ends the same; not applied anywhere yet, so rev 7.1 edits the draft (adds `heading`; no zakat gate, D-75).
- **Starter rows:** seasons only. No fund row (it needs a Go2Pay link only the board has).
- **Safety:** old code never sends the new events column; new code without the migration shows the unavailable state.
- **PR5:** adds merch columns to `payment_items` (priced, `category = 'general'`), one item per size (D-67).
- **Env:** `GO2PAY_API_KEY` (PR #58, `off` until launch; live value = a "Take payments only" key). `DONATION_URL` removed in WP-9. No `CRON_SECRET`.
- **ADRs (WP-10):** 0019 "Go2Pay products made by the board, linked by the site, payments-only key"; 0020 rules; 0021 seasons.
- **Rollback:** a script in the WP-3 PR.

## Parallel Work and Merge Order

```yaml
WP-1: { status: "built, PR #58", extends: [runtime/config.ts, .env.example, owner-setup.md, tests/runtime.test.ts] }
WP-2: { extends: [docs/proposals/go2pay.md], depends_on: [WP-1], note: "user creates a payments-only TEST key; developer runs read-only checks; user sends the support email" }
WP-3: { creates: [supabase/migrations/202610090001_payments_seasons.sql, tests/payments-seasons-migration.test.ts], extends: [scripts/test-backend.ts], depends_on: [PR4 migration in repo, P-72 (recommended B, pending OK)] }
WP-4: { creates: [community/{payments,payment-policy,seasons,season-policy}.ts, payments/providers/{supabase,sample,go2pay,fake,off-gateway}.ts, backend/providers/{supabase,sample}-{payments,seasons}.ts], extends: [time/hijri.ts, contracts, payments/index.ts, runtime/{wiring,providers}.ts, demo/*, tests], depends_on: [WP-2 (gateway only), WP-3] }
WP-5: { creates: [app/admin/seasons/**, features/admin/{season-actions.ts,SeasonEditor.tsx}], depends_on: [WP-4] }
WP-6: { creates: [app/admin/payments/{funds,tickets}/**, features/admin/{payment-actions.ts,FundEditor.tsx,PricedItemEditor.tsx}], extends: [dashboard, activity.ts, help], depends_on: [WP-4] }
WP-7: { creates: [app/admin/payments/page.tsx, app/admin/payments/export/route.ts, features/admin/{PaymentsReport,PaymentsFilters}.tsx], extends: [help], depends_on: [WP-4, WP-2 result] }
WP-8: { creates: [app/donate/[slug]/give/{page,not-found}.tsx, app/checkout/[productId]/page.tsx], extends: [app/donate/page.tsx, DonateLetter.tsx, NotFoundSignpost.tsx (+ story), PrivacyLedger.tsx], depends_on: [WP-4, Track B DonateSlips (or placeholder)] }   # P-73 answered (D-77)
WP-9: { extends: [community/schema.ts, features/admin/{actions,fields}.ts, ContentEditor.tsx, backend/providers/{supabase,sample}.ts, app/calendar/[eventId]/page.tsx, app/page.tsx, GiveBand, app/ramadan, SupportBand, runtime/*, payments/providers/{link,off}.ts (deleted)], depends_on: [WP-6, WP-8] }
WP-10: { creates: [docs/adr/0019-*, 0020-*, 0021-*, docs/contracts/pr6-go2pay-payments.md], extends: [adr README, guides, architecture.md, roadmap.md, go2pay.md, release-checklist.md, e2e], depends_on: [WP-5..WP-9] }
WP-11: { creates: [docs/contracts/rules-audit.md (draft)], depends_on: [ADR 0020 accepted] }
```

- **Merge order:** WP-2 → WP-3 (then the staging apply) → WP-4 → WP-5 … WP-9 → WP-10. WP-11 is separate. (WP-13 was removed in rev 7.1, D-75.)
- **Parallel:** WP-5 to WP-8 can be written in parallel after WP-4; Track B builds `DonateSlips` now against `DonatePageData` and `donate-slips.png`.
- **Process:** one PR per WP against `integration`, each updating release-checklist **Unreleased**.

## Work Packages

### WP-1: `GO2PAY_API_KEY` (built in PR #58)

- Purpose: fail-fast, server-only key setting. Rev 7 changes only wording, done in WP-10: the owner guide and the config's `allowed` text name a **"Take payments only"** key for the live site.
- Depends on: nothing.
- Expected files: as in PR #58.
- Reuse: the `WeakMap` secret pattern.
- Required changes: none in this PR beyond PR #58.
- Must not: put the key on `RuntimeConfig`, log it, use `NEXT_PUBLIC_`.
- Tests: PR #58's.
- Done when: PR #58 is merged.

### WP-2: Go2Pay checks with a payments-only test key (human + developer, no code)

- Purpose: confirm what the live key can do before WP-4's gateway and WP-7's screen are written.
- Depends on: WP-1.
- Expected files: `docs/proposals/go2pay.md` (results, field names only, never values).
- Reuse: the rev 6 WP-2 results.
- Required changes:
  1. **User:** at https://go2pay.gd/integration-keys create a TEST key with "Take payments only" and paste it into `.env.local` yourself (the developer never sees it). Record the exact button and field names of Go2Pay's product form (for the help cards).
  2. **Developer**, with that key: `GET /auth/me` (does it show the scope?); `GET /orders?page=1`; `GET /orders?product_id=` (one hand-made product); `GET /orders/{id}`; confirm `note`, `subtotal`, `customer_total`, `refunded`, `status`, `created`, `pay_product` are present; `GET /products?page=1`, `GET /bank-accounts` and `GET /withdrawals` → expect 403.
  3. **User:** send `.plans/go2pay-support-email.md` from the address that owns the Go2Pay account.
- Must not: use the live key, make a payment, or print key values.
- Tests: none (human).
- Done when: `docs/proposals/go2pay.md` records each answer or "asked on (date)". **PLAN MISMATCH** if orders can't be read (then WP-7 builds the D-64 fallback), if products or bank accounts are readable (then the key is not what Go2Pay says), or if `note` is absent (then notes drop from Payments).

### WP-3: Migration and database tests (a human applies it to staging first)

- Purpose: the schema in Public Contract.
- Depends on: PR4's migration in the repo; P-72 (decides `price_text` and `sold_out`; drop the columns not chosen; with the recommended B both go).
- Expected files: `supabase/migrations/202610090001_payments_seasons.sql`, `tests/payments-seasons-migration.test.ts`, `scripts/test-backend.ts`.
- Reuse: `archived_read_only`, `touch_updated_at`, `record_activity`, `is_admin`, `can_manage_money`.
- Required changes: the SQL; starter seasons; header comment SGU08–SGU10; explicit revokes and grants.
- Must not: add delete policies, an update policy on links, a fund row, product price or stock columns beyond P-72, or touch production.
- Tests:
  - PGlite: the lock is set on the first listed save only; once set, changing `category` or `kind` raises SGU10 while name, about, dates and listed succeed; slug never changes or is reused; a zakat row can be listed; `heading` over 40 refused and non-empty only on funds; priced ⇒ general; a product id can't be linked to two items; archived rows read-only; season `in_use`.
  - Backend RLS: anon reads current listed rows; any admin writes items and links; nobody updates or deletes links; SGU09 and SGU10 through the API.
- Done when: both test sets pass and staging has the migration.

### WP-4: Ports, adapters, policies, Hijri span, wiring, sandbox data

- Purpose: everything the screens and pages call.
- Depends on: WP-2 (gateway shape only), WP-3.
- Expected files: see the effects block.
- Reuse: `hijri.ts` (`firstOfMonth`), `localDate`, `clock()`, `publicClient()`, `Outcome<R>`.
- Required changes: `hijriSpan`; `CATEGORIES`, `INTENTION_LINE`, `FEE_LINE`, constants with the exact wording in Design; `donateOrder`, `donateGroups` (D-77); `parseGo2PayLink`, `go2payPageUrl`, `slugFor`, `readyToList`, windows, visibility, `canPayNow`, `closingSoon`, `donateSlip`, `go2payCopyText`, `paymentsReport`; zod and Track B types; `loadDonatePage`, `PaymentsProvider`; the Go2Pay (`checkKey`, `listOrders` only), fake and off gateways; `PaymentItemEditor`, `SeasonEditor`, `FakeCheckout`, wiring, fixtures.
- Must not: read env or the clock in adapters or policies; write category wording outside `CATEGORIES`; branch on fund, heading or season names; call any Go2Pay endpoint other than `/auth/me`, `/orders`, `/orders/{id}` and the `/products?page=1` scope probe; store orders.
- Tests: `tests/hijri.test.ts`, `tests/season-policy.test.ts` (rev 5 cases); `tests/payment-policy.test.ts`: link parsing (valid forms, `go2pay.gd/0`, other hosts, `go2pay.gd.evil.com/1`, letters), each category's slip (round 2 wording, no Hijri date), `donateOrder` and `donateGroups` (no heading by default; a run of equal headings shares one; a split run repeats it), `readyToList` cases, zakat al-Fitr cap without D-22 grace, `closingSoon` at 3/2/1/0 days and Grenada-day edges, `paymentsReport` keeps both zakat boxes apart with no grand total and counts old links, attempts excluded, `go2payCopyText`, `slugFor`, `canPayNow`; the gateway over a stub fetch (403 probe → payments_only; 200 → too_broad; production refusal); CSV columns and escaping; the wiring matrix.
- Done when: `npm run check` passes.

### WP-5: Seasons screen (any admin)

- Purpose and changes: unchanged from rev 5 (`seasons-list.png`, `season-editor.png`), except dates are shown in Gregorian only (D-78); the anchor reads as a rule ("starts on 1 Ramadan").
- Depends on: WP-4.
- Expected files: `src/app/admin/seasons/**`, `src/features/admin/{season-actions.ts,SeasonEditor.tsx}`.
- Reuse: form helpers, `RecordActions`.
- Must not: add the season page (PR5) or write prayer settings.
- Tests: e2e confirm and clear a day and see funds move; the in-use refusal; axe light and dark.
- Done when: the tests pass.

### WP-6: Funds and tickets screens (any admin)

- Purpose: any board member makes funds and priced items and links them to Go2Pay products (`fund-editor.png`).
- Depends on: WP-4.
- Expected files: `src/app/admin/payments/{funds,tickets}/**`, `src/features/admin/{payment-actions.ts,FundEditor.tsx,PricedItemEditor.tsx}`.
- Reuse: form helpers, `ViewTabs`, `RecordActions`, the boxes layout (D-35).
- Required changes:
  - **About:** name, read-only Give link.
  - **Category:** four cards with the fixed line from `CATEGORIES`, no default; all disabled when locked.
  - **About this fund:** hint "One short sentence."; required for zakat ("How the MSA passes it on; for Zakat al-Fitr, the amount per person"). Placeholder per category from the example slips (D-77 d).
  - **Heading (optional):** one box, placeholder "Ramadan", hint "Leave empty for no heading." (D-77).
  - **When it shows:** listed, season, own dates, the resolved preview with Gregorian dates (D-78), and "Running again" (D-14) asking to confirm the link.
  - **Go2Pay page:** the copy box (D-71 texts with Copy buttons and length counters), a numbered "Make it in Go2Pay" mini-checklist linking the help card, the link field with its example, and earlier links read-only. The field's help says a Go2Pay page can be linked only once: to fix a wrong link, make a new Go2Pay product (wording to the user in PR-B). `link_taken` names the other item; `link_used_before` says it was this item's earlier page.
  - **Preview:** the slip, built by `donateSlip`.
  - **Tickets screen:** name, about, link, dates, "Used by (event)", and the P-72 fields only if A or C is chosen (recommended B: none).
  - **Funds list flags** from Design, including "Ended · close it in Go2Pay".
  - Help cards as listed in Board Self-Sufficiency.
- Must not: call Go2Pay; offer a slug field; edit a locked category; hardcode category wording; allow permanent delete.
- Tests: actions (bad link refused with the example; link used elsewhere refused; SGU10 mapped; heading over 40 refused; no gateway call on save); e2e (create a Sadaqah fund with a link, list it, see the slip with no heading; add the heading "Ramadan" and see it in the preview; list a Zakat al-Mal fund; try to change the category and see the refusal; archive and restore; a non-money admin can edit funds); axe.
- Done when: the tests pass.

### WP-7: Payments screen and CSV (money holders)

- Purpose: visibility of money in per fund and item (D-64).
- Depends on: WP-4 and WP-2's result (full screen if orders are readable, else the fallback).
- Expected files: `src/app/admin/payments/page.tsx`, `src/app/admin/payments/export/route.ts`, `src/features/admin/{PaymentsReport,PaymentsFilters}.tsx`.
- Reuse: `paymentsReport`, `localDate`.
- Required changes: per Design → Payments; help cards "See payments" and "If a giver chose the wrong fund".
- Must not: store, cache or log names or notes; put names in the CSV; sum zakat into anything; call Go2Pay from the browser; add a refund button.
- Tests: e2e (zakat boxes separate; unrestricted subtotal; a note visible and in the CSV; no names in the CSV; attempts hidden); non-money admins refused and the export returns 403; `too_broad` banner; axe.
- Done when: the tests pass.

### WP-8: Donate page, Give route, sandbox checkout, privacy text

- Purpose: givers see each fund's category before giving and reach Go2Pay only through the route.
- Depends on: WP-4, Track B's `DonateSlips` (placeholder until it lands). P-73 answered (D-77).
- Expected files: `src/app/donate/[slug]/give/{page,not-found}.tsx`, `src/app/checkout/[productId]/page.tsx`, `src/app/donate/page.tsx`, `DonateLetter.tsx`, `NotFoundSignpost.tsx` (+ story), `PrivacyLedger.tsx`.
- Reuse: `NotFoundSignpost`, `DonateLetter` (frame, seal, rubric, 3:92), `loadDonatePage`.
- Required changes: `/donate` becomes `force-dynamic` and renders `DonatePageData` (`donate-slips.png` layout, with D-77's headings and wording); `CLOSED_GIVING_SIGNPOST`; the Give page per Design; `PrivacyLedger` per D-31; remove the D-43 late-money line.
- Must not: put a Go2Pay URL in page HTML; compute wording in `DonateSlips`; show amounts on slips; prefetch Give.
- Tests: e2e (no headings by default; the fixture's "Ramadan" heading above Iftar only; slips in `donateOrder`; tags; zakat slips with their rule lines; the fee line in the fine print; no Hijri date on the page; "Closes tomorrow" on the fixture; a closed fund absent and its Give link 404 with Donate and Home; unknown slug 404; Give redirects to the fake checkout); axe light, dark and mobile.
- Done when: the tests pass.

### WP-9: Event tickets; Home and Ramadan bands; retire `DONATION_URL`

- Purpose: tickets use priced items; the old link goes away.
- Depends on: WP-6, WP-8.
- Expected files: see the effects block.
- Reuse: `isUpcoming`, `ticketOnSale` (D-23).
- Required changes: the ticket select lists unused current priced items for any admin (D-65); "Buy ticket" goes through `/donate/<slug>/give` and shows `PricedItemButton` per P-72; `loadGiveTarget` also takes the ticket's event on-sale state (D-23), so an old tab cannot buy a ticket for a cancelled or ended event; the bands per D-41; delete `donation(label)`, `link.ts`, `off.ts` and `DONATION_URL`.
- Must not: let a fund be chosen as a ticket.
- Tests: e2e tickets for any admin; the button disappears after the event; the bands in both states.
- Done when: the tests pass and the release note says "Owner: delete DONATION_URL in Vercel after this release."

### WP-10: ADRs, docs, roadmap

- Purpose: record the decisions and teach the board.
- Depends on: WP-5..WP-9.
- Expected files: `docs/adr/0019-*`, `0020-*`, `0021-*`, README index, guides, `architecture.md`, `roadmap.md`, `go2pay.md`, `release-checklist.md`, `docs/contracts/pr6-go2pay-payments.md`.
- Reuse: the ADR text below.
- Required changes: the ADRs; owner guide (payments-only key wording, migration, `DONATION_URL`, who holds the Go2Pay login); developer guide (payments-only test key by default; the D-73 full-access warning); board help cards (Board Self-Sufficiency); release checklist (key `off` until launch; after launch open one Give link and confirm no TEST banner; check one product's stock in Go2Pay); roadmap (PR5 merch per size, rules audit, D-8, refund button, money book).
- Must not: copy Go2Pay's images; name another payment channel.
- Tests: `tests/documentation.test.ts`.
- Done when: the docs tests pass.

**Proposed ADR 0019 text:**

> **Go2Pay products made by the board, linked by the site.**
>
> 1. Every fund and priced item links to its own Go2Pay product. The board makes, edits and closes products by hand in Go2Pay and pastes the link; the site validates it and stores only the id.
> 2. The live site uses a "Take payments only" key. It reads orders and nothing else; it can't reach products, bank accounts or withdrawals. A broader key is refused in production.
> 3. Each fund has one fixed category: Zakat al-Fitr, Zakat al-Mal (restricted, fixed rule lines, never added to other totals), Sadaqah or General (unrestricted). The category locks once shown. The site gives visibility (totals per fund), not spending control.
> 4. Orders are read live and never stored; no webhooks. Money holders see names and notes on screen; the CSV has notes, not names.
> 5. Visitors reach Go2Pay only through `/donate/<slug>/give`; closed or unknown slugs are a 404.
> 6. Supersedes ADR 0005's webhook/record bullet, ADR 0006's "payments are recorded" and ADR 0014's "payment order records".

**Proposed ADR 0020 text:**

> **Format rules, fixed product rules and changeable settings.**
>
> 1. Format and integrity checks (shape, length, type, references, ordering such as end ≥ start) live in zod schemas and database constraints.
> 2. Product rules that make sense and rarely change are named constants and functions in **one policy module per area** (`<area>-policy.ts`), never scattered through components or actions. A database copy exists only where RLS must enforce the rule, declared as a mirror.
> 3. Only rules likely to change become board-editable data (for example season dates). Not everything is a setting.
> 4. Validation stays sensible, not strict: no limit on future dates unless a real need appears.
> 5. Every default is a recorded decision and is shown where it applies; none is silent.
> 6. Security and legal rules (permissions, consent) stay in the database under their ADRs.
> 7. There is no universal rule object and no rules engine. Existing rules are classified by the rules-audit contract and moved in small PRs.

**Proposed ADR 0021 text:**

> **Seasons follow the Islamic calendar; the two Eids are seasons.**
>
> 1. A season is a named period anchored to the Islamic calendar (month, from day, until day) or, for other programmes, typed calendar dates.
> 2. Expected days are calculated by the site's one Hijri module (`src/lib/time/hijri.ts`, Umm al-Qura) with the board's Hijri adjustment, shown as "expected", and roll to the next year automatically. They are never stored.
> 3. The board confirms the first and last day when the moon sighting is announced; a confirmed day replaces the expected one for that year only and can be cleared.
> 4. Eid al-Fitr (1 Shawwal) and Eid al-Adha (10 Dhul Hijjah) are separate seasons, not part of Ramadan; each resolves on its own. Eid announcements still use Urgent notices (ADR 0015).
> 5. Funds and items reference a season and may also have their own dates; an item's own date replaces only that side of the season.
> 6. Supersedes ADR 0015's "Eid is not a season", its season "show from / show until" and its season "fund". Which seasons get a public page is decided in the PR5 contract.

### WP-11: Rules audit (separate contract, D-19)

- Purpose: classify existing rules.
- Depends on: ADR 0020 accepted.
- Expected files: `docs/contracts/rules-audit.md` (draft).
- Reuse: the rev 5 table.
- Required changes: the draft only.
- Must not: move rules in this PR.
- Tests: none.
- Done when: the draft exists.

WP-13 (open zakat) was removed in rev 7.1: P-58 is answered (D-75) and zakat funds are listable from the start.

## Implementation Constraints

- Do not call any Go2Pay endpoint that creates, edits or archives anything. Only `providers/go2pay.ts` calls go2pay.gd, and only `/auth/me`, `/orders`, `/orders/{id}` and the `/products?page=1` scope probe.
- Do not store, cache or log orders, names, emails, phones or notes. The CSV is built per request with `no-store`.
- Do not store Go2Pay price, stock or wording (except `price_text` if P-72 = A or C).
- Do not create a second Supabase client, service layer, Context/Provider or client store, a `funds` table, a headings table or a products table beyond `payment_item_links`.
- Do not write category wording outside `CATEGORIES`, and do not branch on fund, heading or season names.
- Do not add an unlock path for the category; do not add a zakat listing gate or a fee top-up line (D-75).
- Do not sum zakat into another total or show a grand total.
- Do not read `process.env` outside `config.ts`; never expose `GO2PAY_API_KEY`.
- Do not put payment URLs in page HTML; every Give and Buy goes through `/donate/<slug>/give`.
- Do not show amounts on fund slips; do not add stock or Sold out to funds.
- Do not add delete policies; do not print any fee number except `FEE_LINE` (D-76); do not show a Hijri date on any payment page or slip (D-78); do not run sample or fake code in production; do not name another payment channel.
- Do not make product choices.

## Worker Escalation Conditions

Emit PLAN MISMATCH when:

- WP-2 finds the payments-only key can't read orders (switch WP-7 to the fallback after the user is told), can read products or bank accounts, or orders lack `note`, `subtotal` or `status`.
- P-72 is unanswered when WP-3 starts.
- Next.js 16 can't render a segment `not-found.tsx` from `notFound()` in the Give page, or can't `redirect()` to an external URL there.
- Track B's `DonateSlips` needs a field not in `DonatePageData`.
- `hijri.ts`, the event form, `set_access`, `record_activity` or `NotFoundSignpost` changed upstream.
- Any change needs a secret, env variable, table or policy not listed here.

## Test Strategy

- **Unit:** runtime key rules (PR #58); `hijri.ts` spans and season policy; payment policy (link parsing, categories, `readyToList`, windows, zakat al-Fitr cap, `closingSoon`, `donateSlip`, `go2payCopyText`, `paymentsReport`, `slugFor`, `canPayNow`); gateway over a stub fetch (scope probe, paging, time budget); CSV; actions.
- **Database:** PGlite migration test (lock, slug, link uniqueness, heading, checks); `npm run test:backend` (RLS, SGU08–SGU10, no delete, highlight).
- **E2E** (`E2E_DEMO=true`): no headings by default, a board heading shown, tags, zakat slips listed, the fee line on `/donate`; closing-soon line; closed fund 404; unknown slug 404; category lock refusal; Payments keeps zakat apart and shows a note; CSV has notes and no names; tickets for any admin; permission refusals; axe light and dark on `/donate`, `/donate/x/give`, `/admin/payments`, `/admin/payments/funds`, `/admin/seasons`.
- **Manual TEST check** (developer computer, staging Supabase, payments-only test key; after WP-8):
  1. `.env.local` with `SITE_DEMO_MODE=false`, the staging values and `GO2PAY_API_KEY=g2p_test_…` (pasted by the user; never printed or committed).
  2. `npm run dev`; sign in at http://localhost:3000/admin as a staging admin.
  3. **Payments → Funds → Add:** name "Test sadaqah", category **Sadaqah**, About "Test". Copy the title and description from the copy box. In Go2Pay (test mode) make the product by hand, turn on the donation box, and copy its link. Paste `go2pay.gd/1234x` → refused with the example; paste the real link → accepted. Tick **Show on the Donate page**, read the warning, **Save**.
  4. Try to change the category: disabled. Change the name: saves; Recent changes highlights the link.
  5. Open http://localhost:3000/donate: the slip shows with no heading, the tag "Sadaqah", the intention line, no amount, and the fee line in the fine print. **Give** opens `/donate/test-sadaqah/give` in a new tab and lands on Go2Pay's TEST page.
  6. Pay with 4242 4242 4242 4242, 12/34, any code; type a note "test note".
  7. As a money holder, **Payments**, today: the order is under Unrestricted, "Test sadaqah", with the note; the CSV row has the note and no name. As a non-money admin, Payments is refused.
  8. Set "Show until" to tomorrow: the slip shows "Closes tomorrow" with the clock. Set it to yesterday: `/donate` no longer shows it; the old Give link shows the 404; the funds list shows "Ended · close it in Go2Pay".
  9. Make a Zakat al-Mal fund (About filled, its own Go2Pay test product) and list it: the slip shows "Goes only to people who can receive zakat." and no heading. Type the heading "Zakat" on it: the heading appears above it.
  10. Decline check: 4000 0000 0000 0002 is refused by Go2Pay.
- **Build:** a build without the key fails and names it; `grep -r "g2p_" .next/static` is empty.
- **Gate:** `npm run check`.

## Acceptance Criteria

- Any board member makes a fund or ticket, pastes a valid Go2Pay link (invalid or reused links are refused with a clear message), and sees it on the site at the right time.
- The site never creates, edits or archives a Go2Pay product, and the live key is a "Take payments only" key; a broader key is refused in production.
- The Donate page shows open funds as paper slips with no headings unless the board typed one (D-77), in the approved order, each with its category tag and short wording, zakat slips with their short rule line, the intention line "The fund you choose is your intention.", no amounts, no Hijri dates, and the fine-print line "Go2Pay and payment processing take about 5% of every payment."
- In the last 3 days before a fund closes, its slip shows the clock and "Closes …" line.
- Once shown, a fund's category can't change; the activity log shows when it locked and every link change.
- Zakat funds can be listed from the start; no slip says who covers the 5% (D-75).
- Money holders see live totals per fund and item, zakat on its own lines and never summed, givers' names and notes on screen, and a CSV with notes and no names, built on request and never stored (or the Go2Pay links, if WP-2 forces the fallback).
- Give opens `/donate/<slug>/give` in a new tab; closed and unknown slugs return the 404 with "This has closed".
- Seasons show their expected dates in Gregorian (worked out from the Hijri calendar, D-78), and the board confirms them.
- The sandbox works with a fake gateway; production never can. The manual TEST check passes.

## Open Risks or Escalations

- **Open decision:** P-72 (recommended B, approved by the user 2026-10-05; blocks WP-3 only for the `price_text`/`sold_out` columns). P-58 and P-73 are answered (D-75, D-77).
- **Unverified Go2Pay behaviour (WP-2 and the support email):** that a payments-only key reads orders (docs say yes); whether a donation-box product may cost 0; whether Go2Pay keeps fees on refunded orders; whether the 5% applies to the donation part (data says yes); payout timing; an orders date filter; product creation 500 with the test key.
- **Wrong-link risk:** with a payments-only key the site can't confirm a pasted link belongs to the MSA's account. Mitigated by the highlight in Recent changes and product numbers on Payments.
- **Two places to update** only if the user picks P-72 A (price) or C (price and Sold out); none with the recommended B.
- **Board effort moves into Go2Pay:** each new fund or size means making a product by hand. The copy box and help cards keep it to a few minutes.
- **Questions for the board, outside the website:** telling givers about the 5% in person (D-75); which scholar to follow; zakat al-Fitr as cash or food and the amount; who receives zakat and how fast; zakat outside Grenada.
- **Launch prerequisites, not code:** university approval of Go2Pay; Vercel Hobby non-commercial terms; who holds the Go2Pay login.
- **Track B dependency:** `DonateSlips` builds against `DonatePageData` now.
- **Register hand-offs** (unchanged from rev 5): PR4 C4, C5, J7, G5, G11, G12, G14, G15, H1, H3, H4; PR5 C6, C10, G1–G4, G6–G10, G13, J5, J11, J14, D3, H2, merch sizes (D-67); PR3 follow-up E8; Ops H5, H7, I1, I3–I7, I9, J9.
