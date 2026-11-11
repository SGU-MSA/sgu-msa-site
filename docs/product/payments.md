# Donations and payments

**Who uses it:** every board member (funds and tickets); the Treasurer, the President and other board members with **Manage money** (Money in); visitors who give or buy a ticket. **Where:** Dashboard → Payments (**Money in**, **Funds**, **Tickets**), the event form's **Ticket (optional)** box; the public Donate page (`/donate`), each Give link (`/donate/<slug>/give`) and event pages. **Related:** [PR6 contract](../contracts/pr6-go2pay-payments.md), [ADR 0005](../adr/0005-payments-channel-policy.md), [ADR 0019](../adr/0019-go2pay-products-made-by-the-board-payments-only-key.md), [ADR 0020](../adr/0020-format-rules-product-rules-and-settings.md), [Go2Pay notes](../proposals/go2pay.md), [Merch](merch.md), [Seasons](seasons.md).

## Why it exists

The MSA collects zakat, sadaqah, general donations and ticket money, and must report it to the university. Each board changes every year, so any board member must be able to open a fund or sell a ticket without a developer, and the Treasurer must see what came in. The site gives visibility (who gave how much to what), not spending control (pr6 D-59). Go2Pay is the only payment channel (ADR 0005).

## User stories

### Funds

- **US-PAY-1.** As a board member, I want to add a fund with its name, category, a short sentence, an optional heading, its dates and its Go2Pay link, so that people can give to it without a developer.
  - Acceptance: **Payments → Funds → Add a fund** shows four category cards (Zakat al-Fitr, Zakat al-Mal, Sadaqah, General) with none chosen; the fund can't be saved until one is picked (pr6 D-29, D-59).
  - Acceptance: **Show on the Donate page** can't be saved without a Go2Pay link ("Go2Pay page link: paste it before ticking Show.").
  - Acceptance: the **Preview** tab shows the Donate page with this fund in its place, as typed.
  - Acceptance: with no funds yet, **Start with the general fund** fills in "MSA & Musallah" and General; the board adds the link.
- **US-PAY-2.** As the Treasurer, I want zakat kept apart from all other money, so that it only goes to people who may receive it.
  - Acceptance: the Zakat al-Fitr card reads "Goes to people in need before Eid prayer.", Zakat al-Mal "Goes only to people who can receive zakat.", both "Its own total on Payments, never added to other money." (pr6 D-59, D-77 d).
  - Acceptance: a zakat fund can't show until **About this fund** says how the MSA passes it on (for Zakat al-Fitr, the amount per person) (pr6 D-30, D-70).
  - Acceptance: Zakat al-Fitr closes by itself at the end of the Grenada day before Eid al-Fitr ("Closes by itself the day before Eid al-Fitr.") (pr6 D-30).
  - Acceptance: Sadaqah and General cards read "The board may use it where it is needed."; no other spending rule exists (pr6 D-59).
- **US-PAY-3.** As a visitor, I want a fund's category never to change after I have seen it, so that my gift keeps the intention I gave it with.
  - Acceptance: after the first save with Show ticked, the category cards are greyed out with "Locked since (day)" and "Givers have seen this category, so it can't change. To collect for something else, make a new fund." (pr6 D-61).
  - Acceptance: name, About, heading, link, season and dates stay editable; every change is in Recent changes, the lock moment highlighted (pr6 D-18).
- **US-PAY-4.** As a board member, I want a fund to close by itself and to be reminded to close its Go2Pay page, so that nobody gives to something that is over.
  - Acceptance: the day after **Show until**, the slip is gone and its Give link shows "This has closed" with **Donate** and **Home** (pr6 D-52, D-53).
  - Acceptance: for 7 days the Funds list shows "Ended on (day) · close it in Go2Pay" (pr6 D-72).
  - Acceptance: each fund on the Funds list says "On the Donate page now" or "Not on the Donate page: (reasons)" (review fixes P4).
  - Acceptance: **Archive fund** removes it from the Donate page and stops its Give link; it can be restored under Archived (ADR 0013).

### Go2Pay links

- **US-PAY-5.** As a board member, I want to make each Go2Pay page by hand from texts the site gives me, so that the website never needs a key that can reach products or bank details.
  - Acceptance: the box **Go2Pay page (you make it by hand)** shows **Title**, **Description and donation caption** and **Note shown on receipt**, each with **Copy** and "(n) / (limit) characters"; text over Go2Pay's limit gets a warning, never a refusal (pr6 D-58, D-71).
  - Acceptance: its steps say to turn on the donation box, set the price to the smallest amount Go2Pay accepts (US$1) and choose preset amounts (pr6 D-71).
  - Acceptance: `go2pay.gd/1650`, `https://go2pay.gd/1650` or `https://www.go2pay.gd/1650/` is accepted and shows "✓ Opens go2pay.gd/1650"; anything else is refused with "Paste the Go2Pay page link, for example go2pay.gd/557." (pr6 D-58).
- **US-PAY-6.** As the Treasurer, I want each Go2Pay page to belong to one fund or ticket only, ever, so that totals never mix.
  - Acceptance: a link another item uses is refused: "This Go2Pay page is already used by (item). Each fund or item needs its own Go2Pay page." (pr6 D-17).
  - Acceptance: the item's own earlier link is refused: "This Go2Pay page was linked here before. A Go2Pay page can be linked only once: make a new product in Go2Pay and paste its link."
  - Acceptance: earlier links are listed under the box, and their payments still count for the item; a new link reads "Replaces go2pay.gd/…; the change is highlighted in Recent changes." (pr6 D-18).

### Tickets

- **US-PAY-7.** As a board member running an event, I want to sell tickets through the event's page, so that people can pay before they come.
  - Acceptance: **Payments → Tickets → Add a ticket** has the name, **About this ticket (optional)**, **On sale**, **Show from**, **Show until** and the Go2Pay box, whose steps say "Set its price and how many are for sale." (pr6 D-65, D-66).
  - Acceptance: the event form's **Ticket (optional)** lists unused tickets; a ticket another event sells is refused (pr6 WP-9).
  - Acceptance: the event page shows **See price and buy ↗** with no price; Go2Pay's page shows the price and Sold out (pr6 P-72 B).
  - Acceptance: the button goes away when the event ends, is cancelled, archived, unpublished, or postponed with no new date (pr6 D-23, D-81).

### The Donate page

- **US-PAY-8.** As a visitor, I want each open fund as a slip with its category, so that I choose where my gift goes.
  - Acceptance: each slip shows its name, category tag, rule line (zakat only), the board's sentence and **Give on Go2Pay ↗**, which opens a new tab; no amount is shown (pr6 D-49).
  - Acceptance: "The fund you choose is your intention." sits above the slips (pr6 D-62).
  - Acceptance: slips run Zakat al-Fitr, Zakat al-Mal, funds with a season, Sadaqah, General, then in the board's dragged order (pr6 D-77 c).
- **US-PAY-9.** As a board member, I want headings only where we type one, so that the page stays plain.
  - Acceptance: no slip has a heading by default, zakat included; **Heading (optional)** (up to 40 characters) prints above that slip (pr6 D-77).
  - Acceptance: neighbouring slips with the same heading share one heading; a headed group ends with a thin line; slips and headings sit on the left (pr6 D-79, D-80).
- **US-PAY-10.** As a visitor, I want to know before I give that I leave for Go2Pay and that about 5% goes to fees, so that nothing surprises me.
  - Acceptance: above the funds: "Payments are made on Go2Pay, an outside service. About 5% goes to fees.", the only fee number on the page (pr6 D-76, moved by review fixes P4).
  - Acceptance: the fine print at the bottom: "Payments are handled by Go2Pay, an independent payment service not affiliated with the SGU MSA. This website doesn't store your payment details." (pr6 D-31).
  - Acceptance: no slip says who covers the 5%; zakat slips carry no fee or top-up line (pr6 D-75).
- **US-PAY-11.** As a visitor, I want to see when a fund closes soon, so that I give in time.
  - Acceptance: in its last 3 days a slip shows a clock and "Closes in 2 days", "Closes tomorrow" or "Closes today"; no email is sent (pr6 D-68).
  - Acceptance: no Hijri date appears on slips or the fund preview (pr6 D-78).
  - Acceptance: with nothing open: "There are no open appeals right now." and **Contact the MSA**.

### Money in

- **US-PAY-12.** As the Treasurer, I want live totals per fund and ticket for any days or season, so that I can report to the board and the university.
  - Acceptance: **Payments → Money in** shows a box each for Zakat al-Fitr and Zakat al-Mal ("Never added to any other total.") and an **Unrestricted** box with the subtotal "Unrestricted money in"; there is no grand total (pr6 D-64).
  - Acceptance: filters **Season**, **From**, **Until**, **Category**, **Fund or ticket**, **Status**; the default is the last 30 days (pr6 D-39).
  - Acceptance: **Season** offers each season's latest started run, for example "Ramadan 2026 (18 Feb – 19 Mar)", and replaces the days.
  - Acceptance: only paid, partly refunded and refunded payments count; unfinished attempts are hidden (pr6 D-64).
  - Acceptance: each line lists its Go2Pay page numbers, earlier links included.
- **US-PAY-13.** As a giver, I want my name seen only by the board members who handle money, and never kept, so that my giving stays private.
  - Acceptance: **Every payment** lists date, fund or ticket, category, order, **Giver**, **Note**, **Gift**, **Buyer paid**, **Refunded**, **Status**; names are read from Go2Pay on opening and never stored (pr6 D-2, D-3).
  - Acceptance: a board member without Manage money sees only "Only for board members who can manage money" and links to Funds and Tickets.
  - Acceptance: only Executive board members can have Manage money, and nobody can turn it on for themselves (pr6 D-18).
- **US-PAY-14.** As the Treasurer, I want the same rows as a CSV, so that I can match a Go2Pay payout and give records to the university.
  - Acceptance: **Download CSV** uses the same filters; columns Date, Fund or item, Category, Go2Pay product, Order no., Gift, Buyer paid, Refunded, Status, Note; never a name (pr6 D-39).
  - Acceptance: the file is made on click and not kept on the website; it opens safely in a spreadsheet.
  - Acceptance: when the read is partial or Go2Pay can't be read, no file is given and the reason is shown instead.

### Key and test mode

- **US-PAY-15.** As the President, I want the site to use only a "Take payments only" Go2Pay key and to say clearly when the key is wrong, so that the website can never reach the MSA's bank details.
  - Acceptance: Money in explains each problem: key off ("The Go2Pay key is off on this website …"), too broad ("Replace the Go2Pay key with a “Take payments only” key …"), not working, Go2Pay unreachable, or an answer the site doesn't understand.
  - Acceptance: on the live site a too-broad key shows no totals; on a developer's computer it only warns (pr6 D-73, D-74).
  - Acceptance: a test key shows "TEST key: this computer reads Go2Pay with a test key. Developers only. Orders shown are real."; Go2Pay test payments carry a **Test** badge.
  - Acceptance: Give links keep working whatever the key does (pr6 D-74).

## Rules

- Go2Pay is the only channel. No other channel or recipient appears on any page, screen or document, and nothing hides money from university reporting (ADR 0005).
- Four fixed categories. Only Zakat al-Fitr and Zakat al-Mal are restricted; Sadaqah and General are unrestricted and the board uses them as it sees fit. Visibility only, no per-fund spending rules (pr6 D-59, ADR 0019).
- Tickets and merch are always General money (pr6 D-59).
- The category locks the first time a fund is shown (pr6 D-61).
- One Go2Pay page per fund, ticket or size, ever (pr6 D-17). The board makes, edits and closes pages by hand; the site never changes Go2Pay (pr6 D-58).
- Price, stock, the donation box and preset amounts live only in Go2Pay (pr6 D-71, P-72 B).
- Go2Pay's 5% is lost; nobody makes it up, also on zakat, and the page says so (pr6 D-75, D-76).
- Donate headings are off by default (pr6 D-77).
- Any board member edits funds, tickets and links; Manage money opens Money in and the CSV only (pr6 D-65).
- Orders are read live and never stored; names stay on screen, notes may go in the CSV (pr6 D-2, D-3, D-39).
- Refunds are made in Go2Pay only (pr6 D-40).
- The live site takes a live "Take payments only" key or `off`, and stays `off` until launch (pr6 D-28).

## Edge cases

| Case | What should happen |
| --- | --- |
| A board member pastes a typo or a non-Go2Pay link | Refused with "Paste the Go2Pay page link, for example go2pay.gd/557." |
| A valid link to the wrong Go2Pay product is pasted | The site can't tell with this key. The editor shows "✓ Opens go2pay.gd/…", Recent changes highlights the change, and Money in shows page numbers. To fix it, make a new product in Go2Pay and paste that link (pr6 D-17, D-58). |
| A link another fund or ticket already uses | Refused, naming the other item (pr6 D-17). |
| A fund closes tomorrow | Its slip shows the clock and "Closes tomorrow" (pr6 D-68). |
| A visitor opens the Donate page at 8:30 PM on the last day | Still open, with "Closes today": days follow the Grenada calendar. |
| Someone tries to give Zakat al-Fitr after Eid | The slip is gone and the Give link says "This has closed". A payment through an old direct Go2Pay link still shows in the Zakat al-Fitr box with its date (pr6 D-30, D-72). |
| The board hands out Zakat al-Fitr before Go2Pay pays out | The board pays from cash set aside and repays itself from the payout, as its About sentence says (pr6 D-69). |
| A giver chose the wrong fund | The fund tapped counts. The board contacts the giver and refunds in Go2Pay so they can give again (pr6 help steps, now in the handbook). |
| A refund | Made in Go2Pay. Money in shows "Partly refunded" or "Refunded" and the refunded amount (pr6 D-40). |
| The last ticket sells in person and online at the same moment | Go2Pay sells the online one; the board refunds it in Go2Pay (pr6 D-66). |
| Go2Pay is down | Give still sends visitors to Go2Pay, whose page shows its own error. Money in says "Go2Pay can't be reached right now. Try again in a few minutes." |
| Money in can read only part of the orders | "Only part of the orders could be read; narrow the dates." and **Download CSV** gives no file (pr6 D-74). |
| A board member without Manage money opens Money in or the CSV link | The screen explains who can open it; the CSV is refused. |
| A test key is put on the live site | The live site refuses to start and names the setting (pr6 D-28). |
| The key is revoked | "The Go2Pay key doesn't work. Ask the site owner to make a new “Take payments only” key."; Give is unaffected. |
| The database can't be read | Donate says "Giving details could not be loaded right now."; Give says "Temporarily unavailable" and sends no one to Go2Pay. |
| A visitor's old tab gives to a fund that has closed | "This has closed" (pr6 D-53). |
| Two funds share a heading but are not next to each other | The heading prints twice; the fund's Preview shows it (pr6 D-77). |
| A fund ended on the site but is still open in Go2Pay | Hidden on the site; the Funds list reminds the board for 7 days (pr6 D-72). |
| The board must stop all giving at once | Untick every fund and ticket, then close their pages in Go2Pay (pr6 D-46). |
| Two board members edit the same fund | The second save is refused: "Someone else changed this; reload before trying again." |

## Known gaps

- With the payments-only key the site can't confirm that a pasted link is one of the MSA's own Go2Pay pages, nor read a price or stock (ADR 0019); the highlights above only reduce the risk. No ticket yet.
- "US$1" as Go2Pay's smallest price is unverified; someone with the Go2Pay login must check it ([release checklist](../release-checklist.md), "PR6 smallest Go2Pay price"). No ticket yet.
- Go2Pay has not answered whether it keeps its fees on a refund, when it pays out, or whether orders can be filtered by date ([Go2Pay notes](../proposals/go2pay.md)).
- No refund button, no Recent changes filter for money, and no money book for the Treasurer: roadmap follow-ups, not scheduled ([roadmap](../roadmap.md); pr6 D-8, D-40).
- The handbook describes Go2Pay's product form in general words until someone with the Go2Pay login writes down its real button names ([release checklist](../release-checklist.md), "PR6 owner steps to confirm").

## Open questions

- The Go2Pay notice now sits above the funds instead of the fee line in the fine print (review fixes P4). Is this placement confirmed? ([release checklist](../release-checklist.md), "Review fixes P4: the Go2Pay notice")
- While no fund is shown, the Home band says "Giving details are being finalized.". Keep it, or use "There are no open appeals right now." there too?
- Should changing funds, tickets and merch need **Manage money**? Today any board member can (pr6 D-65); it would be a new rule.
- Should the site say anything about Zakat al-Fitr paid after the close through an old direct Go2Pay link? Today it simply appears in the Zakat al-Fitr box with its date.
