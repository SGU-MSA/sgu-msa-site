# Seasons

**Who uses it:** every board member (seasons, their days and their public pages); visitors during Ramadan, the Eids and the board's own programmes. **Where:** Dashboard → **Seasons** (list, each season's screen with **Public page**, Edit | Preview), the event form's **Season (optional)**, the fund form's **Season**; the public pages `/ramadan` and `/seasons/<name>`. **Related:** [ADR 0015](../adr/0015-season-editor.md), [ADR 0021](../adr/0021-seasons-follow-the-islamic-calendar.md), [PR6 contract](../contracts/pr6-go2pay-payments.md) (Seasons, and the PR5c amendment of 2026-10-06; decisions marked "PR5" come from the PR5 plan it records), [Donations and payments](payments.md).

## Why it exists

Ramadan is the MSA's busiest month, and Ramadan and the two Eids move about eleven days earlier every year and follow the moon sighting. Typed dates would need retyping each year. A season works its days out from the Islamic calendar, the board confirms them when the moon is sighted, and the season's page, events and funds follow by themselves (ADR 0021).

## User stories

### Season days

- **US-SEASON-1.** As a board member, I want Ramadan, Eid al-Fitr and Eid al-Adha to be ready every year without typing dates, so that a new board doesn't have to look them up.
  - Acceptance: the Seasons list starts with Ramadan (1 Ramadan to the end of the month), Eid al-Fitr (1 Shawwal) and Eid al-Adha (10 Dhul Hijjah) (pr6 D-15; ADR 0021).
  - Acceptance: each shows **This year** in ordinary (Gregorian) dates with the badge **expected**; after a season ends, next year's days appear by themselves (ADR 0021).
  - Acceptance: the days follow the Hijri date setting on **Prayer & iqamah**, so one setting moves every season (ADR 0021).
- **US-SEASON-2.** As a board member, I want to confirm the first and last day when the moon sighting is announced, so that the site uses the real days.
  - Acceptance: under **Confirm when the moon sighting is announced**, **First day (confirmed)** and **Last day (confirmed)** accept only days near the expected one ("Choose a day from … to …"); an empty box means the expected day (pr6 D-12).
  - Acceptance: confirming only the first day moves the last day with it; clearing a box goes back to the expected day.
  - Acceptance: the list badge changes to **confirmed**, and Recent changes highlights the change (pr6 D-18).
  - Acceptance: a confirmed day applies to this year only (ADR 0021).
- **US-SEASON-3.** As a board member, I want to add our own programme as a season, so that its page and funds appear for the right days.
  - Acceptance: **Add a season** offers **Where its dates come from**: **The Islamic calendar** (**Month**, **From day**, **Until day** or "End of the month") or **Days I type** (**First day**, **Last day**) (ADR 0021).
  - Acceptance: a typed-days season is over after its last day ("Over: type new days to run it again").
  - Acceptance: the season's rule reads in plain words, for example "Starts on 1 Ramadan, until the end of Ramadan" or "Days typed by the board"; no Hijri date is shown (pr6 D-78).
- **US-SEASON-4.** As a board member, I want a season that funds still use to be safe from archiving, so that no fund loses its days.
  - Acceptance: archiving a season a fund or ticket uses is refused: "Move or archive the funds and items that use this season first." (pr6 SGU08).
  - Acceptance: the Seasons list shows **Used by** for each season.

### The season's page

- **US-SEASON-5.** As a board member, I want to give a season its own public page, so that students find the programme in one place.
  - Acceptance: **Give this season its own page on the website** makes the page; Ramadan's is `/ramadan`, any other is `/seasons/<name>`, made once from the name and never changed (pr6 PR5c amendment).
  - Acceptance: the board fills **Introduction (optional)** (a blank line between paragraphs), **Schedule** (up to 40 rows of What / When / Where (optional)), **Sign-up form (optional)** and **Photos (optional, up to 12)**, the first being the cover.
  - Acceptance: **Preview** shows the real page with the unsaved changes; a save shows on the next visit.
  - Acceptance: Ramadan starts with a page; the list's **Public page** column shows which seasons have one.
- **US-SEASON-6.** As a visitor, I want the page to say "Ramadan" and ordinary dates only, so that I'm not confused by Hijri dates.
  - Acceptance: during the season the page is labelled with the name and the year, "Ramadan 2027", never "Ramadan 1448 AH" (PR5 D-31; pr6 D-78).
  - Acceptance: no Hijri date appears anywhere on a season page; the Tonight panel shows today's ordinary date (pr6 PR5c amendment).
- **US-SEASON-7.** As a visitor, I want the page all year, so that I know when the next season starts.
  - Acceptance: outside the season the page says "Ramadan 2027 is expected to start around 8 Feb.", or "Ramadan 2027 starts on Mon 8 Feb." once confirmed (PR5 Q-10a/b).
  - Acceptance: it keeps the content of the last run, labelled with that year ("Ramadan 2026").
- **US-SEASON-8.** As a student in Ramadan, I want tonight's iftar and tarawih times on the page, so that I don't have to work them out.
  - Acceptance: a season in the month of Ramadan shows **Tonight** from the evening before the first fast to the last day: Iftar at Maghrib, Tarawih at Isha's iqamah, from Prayer & iqamah; nothing is typed twice (PR5 D-26).
  - Acceptance: it shows "Night 14", or "Night 14 (expected)" while the days are not confirmed; Eid eve shows no night number.
- **US-SEASON-9.** As a board member, I want the season's events listed on its page, so that I enter each event once.
  - Acceptance: the event form's **Season (optional)** ("The season’s page lists this event, for example the Ramadan page.") puts the event under **Events** on the season's page while it is upcoming.

### Seasonal funds

- **US-SEASON-10.** As a board member, I want a fund to follow its season's days, so that Iftar opens and closes with Ramadan without retyping dates.
  - Acceptance: a fund with a **Season** shows while the season runs; a **Show from** or **Show until** typed on the fund replaces only that side (pr6 D-11; ADR 0021).
  - Acceptance: while the season's last day is still expected, its funds stay open one extra day, except Zakat al-Fitr, which closes the day before Eid al-Fitr (pr6 D-22, D-30).
  - Acceptance: the season's open funds show on its page under **Support (season name)**, with the intention line and the Go2Pay notice, and on the Donate page; they show nowhere once closed (pr6 PR5c amendment; review fixes P4).
  - Acceptance: one Iftar fund serves all of Ramadan, not one per night (pr6 D-63).
- **US-SEASON-11.** As a board member, I want a season fund to wait for my OK before it runs again next year, so that last year's Go2Pay page isn't reused by accident.
  - Acceptance: after its season ends, the fund shows "Waiting for “Running again”", and from 45 days before the next season "…: the season starts soon" (pr6 D-14).
  - Acceptance: ticking "Running again in Ramadan 2027" asks **Keep the same Go2Pay page (reopen it in Go2Pay first)** or **Use a new Go2Pay page (paste its link below)** (pr6 D-14).
  - Acceptance: Money in's **Season** filter offers each season's latest run, for example "Ramadan 2026 (18 Feb – 19 Mar)" ([Donations and payments](payments.md)).

## Rules

- Seasons follow the Islamic calendar or typed days; expected days are worked out, never stored (ADR 0021).
- The board confirms days from the moon sighting; a confirmed day must be within 5 days of the expected one (pr6 D-12).
- The two Eids are seasons of their own, not part of Ramadan; an Eid announcement is still an Urgent notice (ADR 0021, ADR 0015).
- Hijri dates appear only with prayer times and on the calendar; season pages and season screens use ordinary dates. "just write ramadan" (user, PR5 D-31; pr6 D-78).
- There is no "Eid is tomorrow" button; the board types confirmed days in the season form (pr6 PR5c amendment).
- Any board member edits seasons and their pages (pr6 D-65; pr6 PR5c amendment).
- A season used by a fund or ticket can't be archived; seasons are archived, never deleted (pr6 SGU08, ADR 0013).

## Edge cases

| Case | What should happen |
| --- | --- |
| The moon is sighted a day later than expected | The board types the confirmed first day; the last day moves with it; season funds, the Tonight panel and the page follow. |
| Ramadan's length (29 or 30 days) is not known until the moon sighting | The board confirms the last day. Until then, season funds stay open one extra day so they don't close early (pr6 D-22). |
| Last year's confirmed day is still saved | It counts only for last year: this year uses the expected day, and the season form opens with the box empty (pr6 D-12). |
| Zakat al-Fitr after Eid | Closed the day before the resolved Eid al-Fitr, confirmed or expected (pr6 D-30). See [Donations and payments](payments.md). |
| Eid al-Fitr is confirmed a day earlier than expected | The board confirms Eid al-Fitr's day; Zakat al-Fitr's close moves with it (pr6 D-30). |
| The Hijri date setting can't be read | Seasons show "Dates unavailable"; their funds stay closed ("Season dates unavailable") rather than open on a guessed day (pr6 Failure Modes). |
| A season's page can't be read | "Temporarily unavailable": "This page can't open right now. Please try again in a few minutes." |
| A season has no page, or is archived, or the address is wrong | Not found. `/seasons/ramadan` goes to `/ramadan`. |
| A season's days move, but its events keep their own dates | Events are not moved; the board edits them. |
| A season fund from last year is still linked to its old Go2Pay page | It stays hidden until **Running again** is ticked and the board chooses the page (pr6 D-14). |
| Two board members edit the same season | The second save is refused: "Someone else changed this; reload before trying again." |

## Known gaps

None known.

## Open questions

- Seasons have no History with Restore (only archive and restore). Should they get one, like Prayer & iqamah? ([release checklist](../release-checklist.md), "Review 3, D: seasons have no History")
- The live site's starter Ramadan schedule still says "To be confirmed" in its four rows. Should a database update remove them, or does the board type the times or delete the rows? ([release checklist](../release-checklist.md), "Please decide (found in review)" (c))
- The PR5 plan (D-26) gave a checklist of a season's events after its days move; the approved contract and the site don't include it. Is it still wanted?
- The season page wording (**Schedule**, **Events**, **Photos**, **Tonight**, **Support (season name)**, the **Public page** box and others) is listed for approval in the [release checklist](../release-checklist.md), "Season pages and merch: new wording to approve". Is it approved?
