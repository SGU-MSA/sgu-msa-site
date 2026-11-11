# New board term and hand-over

**Who uses it:** the outgoing and incoming board; Term export is for board members with Manage people; the site owner for platform accounts. **Where:** Dashboard → **New board term** (`/admin/handover`, **Edit the steps**, each shared account), Dashboard → **Term export** (`/admin/term-export`), People. **Related:** [PR5a contract](../contracts/pr5a-notices-events-continuity.md) (D-5, D-27, E-23), [PR3 contract](../contracts/pr3-people-permissions-activity.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md), [ADR 0028](../adr/0028-board-how-to-in-one-handbook.md), [owner guide §13](../guides/owner-setup.md#13-ownership-handoff-and-turnover). Logins and roles: [logins and permissions](logins-and-permissions.md).

## Why it exists

Every year the whole board changes. Without a checklist, keys, passwords and dashboard access leave with the graduates. The website keeps the steps, who holds each shared account (by name only) and a download of the term's records, so the next board starts complete without a developer.

## User stories

### The hand-over checklist

- **US-TERM-1.** As the President, I want one checklist the outgoing and incoming board tick together, so that nothing is forgotten.
  - Acceptance: **New board term** shows each step with a tick box and its "Done on" day, and "N of M done"; a tick saves at once.
  - Acceptance: a step can link to a dashboard page ("Open People →").
  - Acceptance: the starter steps are Invite the new board, Turn off leaving members’ logins, Update the team list, Change shared passwords, Check content, and Tell the site owner who the new board is.
- **US-TERM-2.** As a board member, I want to reword, add, reorder and archive steps, so that the checklist fits how our board works.
  - Acceptance: **Edit the steps**: **Step**, **Details (optional)**, **Dashboard page (optional)** chosen from a list; drag ⠿ and **Save order**; **Archive step** and Restore under **Archived steps**.
- **US-TERM-3.** As the President, I want to start a new term, so that the incoming board begins from the top.
  - Acceptance: **Start a new term…** explains "Clears every tick, so the new board starts the checklist from the top. The steps and the shared logins stay, and Recent changes keeps who ticked what."; then "New term started. Every tick is cleared; the steps and the shared logins stay."

### Shared accounts

- **US-TERM-4.** As a board member, I want to record who holds each shared account and its 2-step phone, so that the next board knows whom to ask.
  - Acceptance: **Who holds each shared login** lists **Account**, **Holder**, **2-step phone** and **Last changed**; "Names only. Never passwords or codes."
  - Acceptance: **Holder** and **2-step phone** are picked from People ("Nobody yet" allowed); **Last changed** allows today or earlier only.
  - Acceptance: an account can be archived and restored under **Archived accounts**.

### Roles and logins at turnover

- **US-TERM-5.** As a board member with Manage people, I want to pass each Executive board role to the new holder, so that permissions and Pages move with the role.
  - Acceptance: giving a role to the successor ("Make (name) (role) instead?") moves the outgoing holder to the General board with no role title and turns their permissions off.
  - Acceptance: the incoming executive can edit Pages as soon as they are in the Executive board with a login.
- **US-TERM-6.** As a board member with Manage people, I want to turn off the logins of members who leave, so that only the current board can change the site.
  - Acceptance: **Deactivate login** (still on the team list) or **No longer on the team** (off About too); both sign them out everywhere.

### Term export

- **US-TERM-7.** As a board member with Manage people, I want to download one term's records and files, so that the club keeps its history after the website frees space.
  - Acceptance: type **Name of the term**, pick **From** and **To**, **Download zip**: spreadsheets for Events, Community news and Newsletters dated in the term (current and archived), People, Funds and Resources as they are today, plus every photo and PDF they use.
  - Acceptance: the zip is made while it downloads and never kept on the website.
- **US-TERM-8.** As a board member with Manage people, I want to free up the photo space of an exported term, so that the free 1 GB does not fill up.
  - Acceptance: **Free up space…** turns on only after that term's zip started downloading; it says how many files and MB go; **Remove files** stays off until "I opened the zip and can see the photos" is ticked.
  - Acceptance: only archived events, community news and newsletters from those days lose their files; the items stay archived with their words; a file anything else still uses is kept.

## Rules

- Any board member runs New board term: ticks, steps, shared logins (PR5a D-5). Every change is in Recent changes.
- The website never stores passwords or codes; holders are People names, so no new personal data is kept (PR5a D-27 d, [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md)).
- **Start a new term** changes only the ticks: logins, roles, permissions and People stay as they are (PR5a E-23).
- One holder per Executive board role; leaving the Executive board turns both permissions off and they are not remembered (PR3 amendment 2026-10-06; maintainer, 2026-11-10).
- Term export and Free up space are for Manage people holders and run as the signed-in person; Free up space cannot be undone (review fixes P5, user 2026-10-07, [release checklist](../release-checklist.md)).
- Step-by-step instructions live in the board handbook, "When someone leaves, or a new board starts" ([ADR 0028](../adr/0028-board-how-to-in-one-handbook.md)); the MSA Gmail, Supabase, Vercel and GitHub follow [owner guide §13](../guides/owner-setup.md#13-ownership-handoff-and-turnover).

## Edge cases

| Case                                                                   | What should happen                                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| The outgoing President holds the last Manage people                    | They hand their own role over last, after giving Manage people to an incoming executive; until then the guard refuses.  |
| An outgoing executive moved to the General board keeps an active login | Their login still edits content as a General board member; "Turn off leaving members’ logins" is the step that ends it. |
| A shared password is changed by one person and not passed on           | The list shows the holder and **Last changed**, so the board knows whom to ask; the website cannot recover it.          |
| A holder has since been deleted from People                            | Shown as "Former member"; pick a new holder.                                                                            |
| The MSA Gmail changes hands                                            | The successor checks both app passwords still exist and sends a test invite (owner guide §13 step 5).                   |
| Download fails because a list cannot be read                           | No zip: "The term could not be read. Check your connection and try again." with the boxes as they were.                 |
| A very large term                                                      | Export it in two shorter ranges (each download may run up to 5 minutes on the free plan).                               |
| **To** is before **From**                                              | Those days are greyed out; **Download zip** stays off with "To: choose the From day or a later one."                    |

## Known gaps

- The starter step "Change shared passwords" names the MSA Gmail but does not say that changing a Google account's password removes its app passwords, which stops invite, reset and warning emails until new ones are made (owner guide §10). The board can reword the step itself; no ticket yet.
- No term start date is stored and old **Last changed** days are not flagged (PR5a PR-C, engineering choice; see Open questions).

## Open questions

- Should the shared-login list flag a password not changed for a long time (for example since the last term)? No age rule was decided.
- Please approve the order of the 9 hand-over steps in the board handbook ("When someone leaves, or a new board starts"), as listed in the [release checklist](../release-checklist.md).
