# Product requirements (PRDs)

A PRD says **what** a feature must do for the people who use it, and why: user stories, acceptance criteria and edge cases. A [feature contract](../contracts/README.md) says **how** one change is built, and links the PRD it serves ([ADR 0036](../adr/0036-prds-define-what-contracts-define-how.md)).

- One file per feature area: `docs/product/<feature>.md`. The board member is the main reader in mind: a non-technical student volunteer, often on a phone, who changes every year.
- A PRD describes the product as it should be. Where the site falls short today, the PRD says so under **Known gaps** with a link to the ticket, instead of quietly describing the gap as intended.
- Product decisions are the maintainer's ([ADR 0002](../adr/0002-product-principles.md)). A PRD records them and links the ADR or contract decision; it never invents one. An open question goes under **Open questions** until the maintainer answers it.
- Acceptance lines describe outcomes a board member can check, not widgets. Screen, box and button names are quoted so readers can find today's screen; a redesign the maintainer approves may change them without changing the story.
- Change a PRD in the same pull request that changes the behaviour it describes.

## Template

Copy this shape for a new PRD.

```markdown
# <Feature name>

**Who uses it:** <board roles, visitors>. **Where:** <dashboard screens and public pages>. **Related:** <contracts, ADRs>.

## Why it exists

<2-4 lines: the problem for the club, in plain words.>

## User stories

### <Story group, e.g. "Adding an event">

- **US-<AREA>-1.** As <a board member | the Treasurer | the President | a visitor>, I want <goal>, so that <reason>.
  - Acceptance: <observable result, one per line, testable on the site>.

## Rules

<Product rules the feature enforces (who may do what, limits, dates), each with its source: ADR, contract decision or maintainer quote.>

## Edge cases

| Case | What should happen |
| --- | --- |
| <e.g. two board members edit the same event at once> | <expected behaviour> |

## Known gaps

<Where the site does not yet meet a story or edge case, with a ticket link. "None known" if none.>

## Open questions

<Questions only the maintainer can answer. "None" if none.>
```

## PRDs

<!-- index: one line per PRD, added with each PRD -->
- [Daily check, warning emails and the notifications bell](daily-check.md): Nightly check, warning emails and the bell: what each warning asks the board to do.
- [Prayer and iqamah times](prayer-times.md): Daily iqamah, Jumu'ah, one-date changes, History and what visitors see.
- [Musallah location](musallah-location.md): The single musallah pin, the map and directions.
- [Donations and payments](payments.md): Funds and zakat rules, tickets, Go2Pay pages, the Donate page and Money in.
- [Merch](merch.md): Collections, items, sizes as Go2Pay products, stock and in-person sales.
- [Seasons](seasons.md): Ramadan and Eid seasons, their days, public pages and seasonal funds.
- [People and team groups](people.md): People entries, team groups, the public team list and photos.
- [Dashboard logins and permissions](logins-and-permissions.md): Invites, Manage people and Manage money, Pages editing, sign-in and passwords.
