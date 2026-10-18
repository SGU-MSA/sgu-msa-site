# 0025. Team list without consent records; two permanent groups

- Status: Accepted
- Date: 2026-10-05

## Context

[ADR 0014](0014-no-stored-member-data-forms-as-links.md) made listing a person on the public team page, and showing their photo, depend on a recorded written consent (a date and how it was given), each checked by the database. In the second demo review the user found the consent boxes a burden for a student club whose team is the elected board itself, and asked for them to go. The same review asked for a fixed Executive board order and for the board's two core groups to always exist.

## Decision

- **No consent records.** People entries no longer store listing or photo consent dates or methods, and nothing checks them. "Show on public page?" (answered per person, [ADR 0007](0007-people-and-permissions.md)) alone decides who is listed; a listed person's photo shows whenever one is uploaded. The board still takes a person or a photo off the page on request ("No", or **Remove photo**, which also works for archived people), and the privacy page says so.
- **Two permanent groups.** The Executive board and the General board always exist: the database refuses to rename, archive or delete them. The board adds, renames, orders, archives and (when nobody is in it) deletes its own groups.
- **The Executive board is listed by role**: President, Vice President (Brothers), Vice President (Sisters), Treasurer, Secretary. Everyone in it holds one of these roles (a database check); the other groups keep the order the board drags.
- Everything else in ADR 0014 stands.
- Decided by the user (review 2, 2026-10-05: "remove consent completely", "Executive board and General board must always exist", "the Executive board must follow a fixed order"). Rejected: keeping consent optional (the boxes would still be there), a tick-box consent (rejected in ADR 0014 already).

## Consequences

- The four consent columns and their checks were removed from the People migration in place (no hosted database held real data); the activity log no longer has consent fields to hide.
- Who may be listed is a board judgement, not a database rule; the help and the privacy page describe it that way.
- A new admin added by the site owner from the SQL editor starts in the General board, because the Executive board needs a role.
