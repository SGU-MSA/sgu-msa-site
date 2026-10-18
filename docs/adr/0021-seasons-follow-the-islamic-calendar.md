# 0021. Seasons follow the Islamic calendar; the two Eids are seasons

- Status: Accepted
- Date: 2026-10-05

## Context

[ADR 0015](0015-season-editor.md) planned a season with typed "show from / show until" dates, a fund, and Eid announced only as an urgent notice. Ramadan and the Eids move by about eleven days each Gregorian year and their exact days follow the moon sighting, so typed dates would need retyping every year. The user chose seasons anchored to the Islamic calendar, the two Eids as seasons, and funds that point to a season (PR6 contract, answer sheets of 2026-10-05). Full reasoning: [PR6 contract](../contracts/pr6-go2pay-payments.md).

## Decision

1. A season is a named period anchored to the Islamic calendar (month, from day, until day) or, for other programmes, typed calendar dates.
2. Expected days are calculated by the site's one Hijri module (`src/lib/time/hijri.ts`, Umm al-Qura) with the board's Hijri adjustment, shown as "expected", and roll to the next year automatically. They are never stored.
3. The board confirms the first and last day when the moon sighting is announced; a confirmed day replaces the expected one for that year only and can be cleared.
4. Eid al-Fitr (1 Shawwal) and Eid al-Adha (10 Dhul Hijjah) are separate seasons, not part of Ramadan; each resolves on its own. Eid announcements still use Urgent notices (ADR 0015).
5. Funds and items reference a season and may also have their own dates; an item's own date replaces only that side of the season.
6. Supersedes ADR 0015's "Eid is not a season", its season "show from / show until" and its season "fund". Which seasons get a public page is decided in the PR5 contract.

## Consequences

- Seasons are edited in **Seasons** on the dashboard; payment pages show their dates in Gregorian only (PR6 D-78).
- A season's days follow the board's Hijri adjustment, so one setting moves every Hijri date on the site.
- The rest of ADR 0015 (a general season editor, Ramadan first, tagged events) stands.
