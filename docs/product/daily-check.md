# Daily check, warning emails and the notifications bell

**Who uses it:** whoever holds the MSA Gmail (reads the emails), every board member (the bell), board members with Manage people (access warnings), the site owner (setup, turning it off). **Where:** the MSA Gmail inbox; the bell at the top of every dashboard page; the dashboard pages each warning links to. **Related:** [ADR 0022](../adr/0022-daily-check-and-warning-emails.md), [daily-check contract](../contracts/daily-check-notifications.md) (D-2 to D-18, stage 2 amendment), [ADR 0009](../adr/0009-free-tools-only.md), [owner guide §10](../guides/owner-setup.md#the-daily-check-warning-emails-to-the-msa-gmail).

## Why it exists

Some problems appear only because time passes: iqamah times run out, an Eid date is still "expected", a closed fund's Go2Pay page keeps taking money. Nobody saves anything when that happens, so the site looks every night, emails the club's shared inbox only when something needs fixing, and shows the same list in the dashboard until it is fixed.

## User stories

### Warning emails

- **US-CHECK-1.** As the President, I want one short email to the MSA Gmail only when something needs fixing, so that the board is warned before visitors are affected and is not flooded.
  - Acceptance: no email on a night when all is well; at most one email a night, listing every due warning.
  - Acceptance: subject "SGU MSA website: 1 thing needs attention" (or "N things need attention"); each line has its tag ([Prayer], [Seasons], [Go2Pay], [Photos]), what is wrong, one sentence of consequence and "Fix it:" with the dashboard link.
- **US-CHECK-2.** As a board member, I want each problem emailed at most twice, so that the same warning does not arrive every day.
  - Acceptance: email 1 when the problem starts; one last call if it is still not fixed (1 day before a deadline, or 3 nights after email 1 when there is none); then the bell only, until fixed.
  - Acceptance: a missed night is caught up the next night; a step already sent is never sent again.
- **US-CHECK-3.** As a board member, I want the warnings in one shared inbox, so that they survive board turnover.
  - Acceptance: the email goes from the MSA Gmail to itself; the website stores no email address. Whoever holds the Gmail can forward a topic with a Gmail filter on its tag, or share the inbox.

### The bell

- **US-CHECK-4.** As a board member, I want a bell on every dashboard page with what needs attention, so that I see it while I work.
  - Acceptance: the bell shows a count (red while any problem is listed) and opens **Notifications**: **Needs attention** first, then **For your information**; empty: "Nothing needs attention."
  - Acceptance: the list is worked out on every page load from the current state, so a fixed problem is gone on the next page; problems cannot be closed by hand.
  - Acceptance: information lines ("Prayer settings changed recently", "Add a photo of (name), (role)") have × to close them in this browser.
- **US-CHECK-5.** As a board member with Manage people, I want to be warned when the club risks losing control of its own dashboard, so that I fix it in time.
  - Acceptance: "Only 1 active person can manage people. Give a second person Manage people." while fewer than two hold it; with none, "No active person can manage people. Ask the site owner to give Manage people to two board members."
  - Acceptance: "Nobody can edit pages: add an executive" while no Executive board member has a login (a safety net).

### What each warning means

- **US-CHECK-6.** As a board member, I want to know what each warning asks of me, so that I can act without a developer.
  - Acceptance, **Prayer:** "Iqamah times end on (day) (in 7 days)": set new times on Prayer & iqamah before then, or the website stops showing iqamah times. From 7 days before; after the day, "Iqamah times ended on (day) — update them" stays in the bell.
  - Acceptance, **Seasons:** "(season)’s first day is still “expected” on (date)": confirm the day once the moon is announced. From 3 days before until that day.
  - Acceptance, **Go2Pay:** "“(fund)” ended on (day): close its Go2Pay page": close it in Go2Pay, because old shared links still take payments. While the fund or ticket list shows it as ended (7 days).
  - Acceptance, **Seasons:** "“(fund)” is waiting for “Running again”": tick it, or the fund or ticket stays closed this season. From 45 days before the season.
  - Acceptance, **Photos:** "Photo space is 82% full (820 MB of 1 GB)": delete photos and PDFs nothing uses on Photos. At 80%, and again at 95%.
- **US-CHECK-7.** As the Treasurer, I want the Go2Pay warning to reach me, so that an ended fund stops taking money.
  - Acceptance: the [Go2Pay] tag lets the Gmail holder forward those lines to the Treasurer.

### Owner control

- **US-CHECK-8.** As the site owner, I want warnings off until the MSA Gmail is ready, and a way to stop them, so that the site launches without it.
  - Acceptance: with both Gmail settings `off`, nothing is emailed and every board member's bell shows "Warning emails are off: set up the MSA Gmail".
  - Acceptance: Vercel → Settings → Cron Jobs → Disable stops the nightly check.

## Rules

- One nightly check at 01:00–01:59 Grenada time on Vercel's free plan; one policy feeds both the email and the bell, so they never disagree ([ADR 0022](../adr/0022-daily-check-and-warning-emails.md)).
- Email only when something needs attention, at most two per problem (contract D-2, D-13); only the live site sends; previews and developers' computers never do; developers never receive warnings (D-10).
- No personal data, amounts or names in the email; nothing is written to board content, Recent changes or Go2Pay (D-5, D-7).
- No email when the database is down; Supabase emails its account holder if the project pauses (D-16).
- Timings and wording are fixed in code: changing them is a developer change, an accepted gap on the [roadmap](../roadmap.md) (D-4).
- The manager and Pages-editor lines show only to Manage people holders, who can fix them (review fixes P1 choice, [release checklist](../release-checklist.md)).

## Edge cases

| Case                                             | What should happen                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gmail refuses the app password or times out      | Nothing is recorded, so the next night tries again; the bell still lists everything. The board is not told by email (the contract dropped a "Gmail broken" warning). |
| Part of the facts cannot be read (database slow) | That night sends nothing and catches up the next; the bell shows what it could read.                                                                                 |
| A problem is fixed after email 1                 | No last call; the line leaves the bell on the next page load.                                                                                                        |
| iqamah times get a new end date                  | A new problem, with a fresh pair of emails.                                                                                                                          |
| Photo space passes 95% after the 80% emails      | A new problem at 95%.                                                                                                                                                |
| Vercel runs the check twice in one night         | Rarely one duplicate email; never a lost one.                                                                                                                        |
| A General board member opens the bell            | Sees the daily-check problems and information, not the Manage people or Pages-editor lines.                                                                          |

## Known gaps

- Whether Gmail applies a forwarding filter to an email the account sent to itself, and whether the first email lands in Spam, have not been checked on the live site (owner test, [release checklist](../release-checklist.md)); the fallback is shared access to the inbox.

## Open questions

- Should a board member without Manage people see a line such as "Ask a board member with Manage people to …" when the manager or Pages-editor warning applies, and in which words?
- Confirm which Gmail account sends and receives the warnings, and that its holder is fine receiving them nightly.
