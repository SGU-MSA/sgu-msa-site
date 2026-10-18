# 0013. Activity log, archive instead of delete, and version history

- Status: Accepted
- Date: 2026-10-03

## Context

Board members are equal admins ([ADR 0007](0007-people-and-permissions.md)) and changes to prayer times or money publish immediately. Mistakes and disputes must be visible and recoverable without a developer ([ADR 0002](0002-product-principles.md)).

## Decision

- **Activity log:** every change to managed data is recorded by database triggers (who, what, when, before → after). The log is add-only: no role, admin or the app can update or delete entries. All admins see a "Recent changes" feed; changes to prayer times and money are highlighted to everyone.
- **Publish and notify:** changes go live immediately; there is no approval step.
- **Archive instead of delete:** normal removal archives an item (hidden publicly, listed under Archived, restorable). Events and announcements have **Duplicate** to start a new draft from an old one.
- **Version history:** prayer settings, page text and seasons keep previous versions that can be restored.
- **Permanent delete** exists only for privacy cases (e.g. withdrawn photo consent): from the Archived tab, typing DELETE, and it is logged.

## Consequences

- Managed tables gain archive and history support, and RLS must forbid writes to the log for every role.
- Storage files of archived items are kept until a permanent delete.
- Email notifications can be added later, once auth email delivery works.
