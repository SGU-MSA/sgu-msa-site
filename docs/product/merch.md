# Merch

**Who uses it:** every board member (collections, items, sizes, photos and their Go2Pay links); the Executive board (the Merch page's opening words); board members with **Manage money** (merch money on Money in); visitors who buy. **Where:** Dashboard → **Merch** (collections, their items, each item's **Sizes**), **Pages → Merch**; the public Merch page (`/merch`) and each size's Give link (`/donate/<slug>/give`). **Related:** [PR6 contract](../contracts/pr6-go2pay-payments.md) (PR5c amendment of 2026-10-06; decisions marked "PR5" come from the PR5 plan it records), [ADR 0005](../adr/0005-payments-channel-policy.md), [ADR 0019](../adr/0019-go2pay-products-made-by-the-board-payments-only-key.md), [Donations and payments](payments.md).

## Why it exists

The MSA sells shirts and other items in yearly collections. Each year's board must be able to put a new collection on sale, retire an old one and keep the archive on show without a developer. Price and stock must live in one place (Go2Pay), so nothing goes out of date on the website (pr6 P-72 B).

## User stories

### Collections

- **US-MERCH-1.** As a board member, I want to add a collection and say whether it is on sale, so that this year's merch leads the page and older ones stay as an archive.
  - Acceptance: a collection has **Name**, an Arabic name, a quote, a year and a description, and **On sale now?** with "Yes: its sizes can be bought" or "No: shown as “Not for sale”" (PR5 D-27).
  - Acceptance: on `/merch` the first collection on sale leads under "Current collection"; the others follow in the board's dragged order, past ones marked "Not for sale".
  - Acceptance: **Archive collection** takes it off the Merch page with its items and sizes and says to close the sizes' products in Go2Pay too; it can be restored under Archived (ADR 0013).
- **US-MERCH-2.** As a member of the Executive board, I want to edit the Merch page's opening words, so that the page introduces this year's merch.
  - Acceptance: **Pages → Merch** edits the small heading, title, short description and note; a save shows on the next visit (ADR 0027).

### Items and photos

- **US-MERCH-3.** As a board member, I want to add an item with photos and details, so that buyers see what they are getting.
  - Acceptance: an item has its collection, **Name**, a description, a garment and a colour, and up to 12 photos; the first photo is the cover (PR5 D-27 c).
  - Acceptance: every photo needs a one-sentence description, so the page is readable without the pictures (PR5 D-9).
  - Acceptance: on `/merch` the item shows its photos, which open full size in the photo viewer, and its details **Garment**, **Colourway** and **Released** (PR5 D-21).
  - Acceptance: items are dragged into order; the item's **Preview** shows the Merch page with the item as typed.

### Sizes and Go2Pay links

- **US-MERCH-4.** As a board member, I want each size to have its own Go2Pay page, so that each size has its own stock and its own Sold out.
  - Acceptance: **Add a size** on the item's screen (after the item is saved) has **Size** ("Shown on its button on the Merch page."), **About this size (optional)**, **On sale**, **Show from**, **Show until** and the Go2Pay box, whose steps say "Set its price and how many are for sale." (pr6 D-67).
  - Acceptance: the size is saved as "(item) · (size)", for example "Shukr long-sleeve · M", so Money in and Recent changes name it.
  - Acceptance: a size label the item already has is refused: "Size: this item already has this size."
  - Acceptance: the Go2Pay link follows the payments rules: one page per size, ever; a link used elsewhere is refused, naming the other item (pr6 D-17).
  - Acceptance: sizes never appear on the Tickets screen or in an event's ticket choice.
- **US-MERCH-5.** As a visitor, I want one button per size, so that I buy the right one.
  - Acceptance: under each item on sale, "See price and buy ↗" heads one button per open size, in the board's dragged order; each opens that size's Go2Pay page in a new tab.
  - Acceptance: no price, stock or Sold out on our page; Go2Pay's page shows them before anyone pays (pr6 P-72 B).
  - Acceptance: a past collection's items show no buttons.

### Stock and selling in person

- **US-MERCH-6.** As a board member selling at a table, I want stock kept in one place, so that online buyers don't buy what we already sold.
  - Acceptance: stock is set and changed only in Go2Pay; after selling one in person, a board member lowers that size's stock in Go2Pay by hand (pr6 D-66).
  - Acceptance: any board member may change prices and stock; in Go2Pay, that is whoever the board gives the Go2Pay login to (pr6 D-65; PR5 D-27 b).
- **US-MERCH-7.** As the Treasurer, I want merch money counted with the other money, so that I can report it.
  - Acceptance: each size is its own line in the **Unrestricted** box on Money in, as General money (pr6 D-59, D-64).

## Rules

- Merch money is General money ("Merch money is General money …") (pr6 D-59).
- One Go2Pay product per size, made by hand by the board (pr6 D-58, D-67; PR5 D-27 a).
- Price, stock and Sold out live only in Go2Pay; our page shows "See price and buy ↗" (pr6 P-72 B). A description may mention a price in the board's own words.
- A size can be bought only while its item is in a collection on sale and the size itself is on sale (pr6 PR5c amendment).
- An item with a current size can't be archived: "Archive this item's sizes first." (pr6 PR5c amendment).
- Any board member edits merch; the Merch page's opening is page text edited by the Executive board (PR5 D-27 b, ADR 0027).
- Payments go through Go2Pay only; a sale made in person is described only as "sold in person" (ADR 0005).

## Edge cases

| Case | What should happen |
| --- | --- |
| The last shirt of a size sells in person and online at the same moment | Go2Pay sells the online one; the board refunds that buyer in Go2Pay (pr6 D-66, D-40). |
| A size sells out in Go2Pay | Only that size's button leads to Go2Pay's Sold out page; the other sizes still sell (pr6 D-67). |
| A buyer bought the wrong size | Exchanged in person (pr6 D-67). |
| A board member forgets to lower stock after an in-person sale | Go2Pay may sell one that no longer exists; the board refunds it in Go2Pay (pr6 D-66). |
| The price changes | Changed in Go2Pay only; nothing to update on the site (pr6 P-72 B). |
| A collection is switched to "No: shown as “Not for sale”" | Its buttons go; an old size link shows "This has closed". The board closes the sizes' products in Go2Pay. |
| An item has no open size | The item shows with no buttons. |
| The board archives an item that still has sizes | Refused: "Archive this item's sizes first." |
| Someone pastes the same Go2Pay link for two sizes | Refused, naming the size that already has it (pr6 D-17). |
| Go2Pay is down | The size button still leads to Go2Pay, whose page shows its own error. |
| Giving data can't be read | Items and photos still show, without size buttons. |
| Merch can't be read at all | "The collections can't be shown right now. Please try again in a few minutes." |
| Testing before launch | Go2Pay test payments never lower stock; on launch day a board member checks one real product's stock in Go2Pay (pr6 D-66). |

## Known gaps

- A sale made in person does not appear on Money in, which reads only Go2Pay orders; reporting it stays with the board (ADR 0005), and the Treasurer's money book is parked ([roadmap](../roadmap.md)). No ticket yet.

## Open questions

- Ended funds remind the board for 7 days to close their Go2Pay page (pr6 D-72). Sizes get no such reminder when their collection goes off sale or is archived; only the archive notes say it. Should they?
- The Merch screens' and page's wording ("On sale now?", "Current collection", the size form's words and others) is listed for approval in the [release checklist](../release-checklist.md), "Season pages and merch: new wording to approve". Is it approved?
- Should changing merch need **Manage money**? Today any board member can (PR5 D-27 b); see the same question in [Donations and payments](payments.md#open-questions).
