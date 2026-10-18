# 0027. Pages are edited by the Executive board

- Status: Accepted
- Date: 2026-10-06

## Context

[ADR 0007](0007-people-and-permissions.md) made every person with a login an equal admin for content, with two extra permissions ("manage people", "manage money"). In the third review the user asked that the words, photos and sections of the public pages be changed only by the elected leadership, while every board member keeps editing events, announcements, prayer times and the rest. [ADR 0025](0025-team-list-without-consent-records.md) made the Executive board a permanent group whose members hold one of five roles.

## Decision

- **Only people in the Executive board group edit Pages** (every page's text and sections, the sign-up forms, Site-wide, the Qur'an verses, the Go2Pay receipt note), while their People entry is current and their login is not turned off.
- **No new permission and no tick-box:** it follows People. Moving someone into or out of the Executive board gives or takes it at once.
- The database decides (`can_edit_pages()` and the row level security of `page_texts`); the dashboard hides Pages from everyone else, and warns "Nobody can edit pages: add an executive" while no Executive board member has a login.
- Decided by the user (review 3, 2026-10-05: "ONLY people in the Executive board group can edit pages; no tick-box"). Rejected: a third permission tick-box (one more thing to manage at every hand-over), and leaving Pages open to every admin.

## Consequences

- ADR 0007's "equal admins for content" no longer covers page text; everything else in it stands.
- At a hand-over, the new Executive board can edit pages as soon as People has them in that group with a login; the dashboard warning catches a board with nobody.
- The verse library is fixed ([ADR 0026](0026-fixed-quran-verse-library.md)): nobody writes it; choosing the verse of each place is page text, so only the Executive board does it.
