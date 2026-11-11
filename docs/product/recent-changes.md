# Recent changes (the activity log)

**Who uses it:** every board member with a login that is not turned off; the site owner sees their own SQL changes there too. **Where:** Dashboard → **Recent changes** (`/admin/activity`), the **History** list on Prayer & iqamah and on each page in Pages, and the bell's "Prayer settings changed recently" line. **Related:** [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [PR3 contract](../contracts/pr3-people-permissions-activity.md) (D-4, D-5, D-27, D-29), [PR5a contract](../contracts/pr5a-notices-events-continuity.md) (filters), [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md) (page History).

## Why it exists

Every board member can change the site, and prayer times and money changes go live at once with no approval step. When something looks wrong, the board must be able to see who changed what and when, and put it back, without a developer and without arguing from memory.

## User stories

### Seeing what changed

- **US-LOG-1.** As a board member, I want a list of every change, newest first, so that I can see what happened while I was away.
  - Acceptance: each entry says who (their People name), when (Grenada time, "Oct 3, 2026, 2:15 PM") and what ("Edited event", "Archived People entry"), with the changed fields before → after.
  - Acceptance: 25 entries a page; **Older changes** and **Newest changes**; "No changes yet." when empty.
- **US-LOG-2.** As the President, I want to filter by person, kind and days, so that I can answer "who moved Isha?" quickly.
  - Acceptance: **Who** (Everyone, each person who has or had a login, Site owner), **What** (Everything, Prayer & iqamah, Events, Announcements, News, Newsletters, People and logins, New board term, Pages, Funds, tickets and seasons, Merch), **From** and **Until**, then **Show**.
  - Acceptance: the filters stay in the address, so a filtered list can be shared; **Clear filters**; "No changes match these filters."
- **US-LOG-3.** As the Treasurer, I want money-sensitive changes to stand out, so that I notice them without reading everything.
  - Acceptance: highlighted entries carry a label: "Prayer change", "Urgent notice", "Go2Pay link", "Category locked", "Season days".
- **US-LOG-4.** As a board member, I want to be told when prayer settings changed in the last 7 days, so that I can check the Prayer page is right.
  - Acceptance: the bell shows "Prayer settings changed recently" with who and when, linking to Recent changes; it can be closed with ×, and a newer change shows again.

### Putting things back

- **US-LOG-5.** As a board member, I want to restore an earlier version of the prayer settings or a page's text, so that a mistake is undone in one step.
  - Acceptance: **History** lists the last 20 changes; **Restore the version before this change** opens a confirmation with a preview (**This version**), then **Restore** or **Cancel**.
  - Acceptance: a restore deletes nothing: it is a new entry, "Restored to the version of (time)", which can itself be undone.

### Trust in the record

- **US-LOG-6.** As a board member with Manage people, I want access changes recorded, so that a dispute about who gave whom a permission can be settled.
  - Acceptance: invites, permission changes, deactivation, reactivation and removed logins appear under **People and logins**.
- **US-LOG-7.** As the site owner, I want my emergency SQL changes to show as mine, so that the board sees them.
  - Acceptance: changes with no signed-in board member show as "Site owner".

## Rules

- **Add-only:** no board member, the app, the secret key or the database owner can change or delete an entry; the database refuses ("Recent changes is add-only: entries cannot be changed or removed.") ([ADR 0013](../adr/0013-activity-log-archive-and-history.md)).
- Entries are written by the database itself on every save, so no screen can forget to log (ADR 0013).
- Every board member whose login is not turned off sees every change (PR3 D-4). A deactivated login sees nothing.
- **What is logged:** events, announcements, community news, newsletters, prayer settings, the musallah pin, People, groups and dashboard access, New board term steps and shared logins, page text, funds, tickets, Go2Pay links, seasons, merch collections and items, and Lists (PR3, PR5a, PR5b, PR5c, PR6, PR7, review fixes P3). Free up space shows as an edit of each archived item it changed.
- **Personal values are never stored:** for People, only which fields changed (Name, Photo show as changed, without values); the actor is kept as an account id and named from People when read, so a person deleted for good leaves no name behind and shows as "Former member" (PR3 D-5, D-27, D-29).
- Content, prayer settings and page text keep full before → after rows, so History can restore them (PR3 D-5, review 3 D).
- Saving with nothing changed adds no entry (PR3 D-28, D-30).
- Entries are kept with no time limit; removal by age is not built and would need a new ADR (PR3 D-5).

## Edge cases

| Case                                                             | What should happen                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Someone asks "who changed this?" about a person deleted for good | Their past entries stay, shown as "Former member"; they are no longer in the **Who** list. |
| An old prayer version no longer passes today's rules             | Restore is refused with the usual prayer message; nothing changes.                         |
| The log cannot be read                                           | "Recent changes could not be loaded. Check your connection and reload."                    |
| People names cannot be read                                      | "Names could not be loaded; some entries show without a name. Reload to try again."        |
| A board member wants a wrong entry removed                       | Not possible; the next save or a restore adds a correcting entry.                          |

## Known gaps

- Lists (Dashboard → Lists) changes are logged but have no **What** choice and show a plain name ("Edited list options"); no ticket yet.
- Not recorded: sign-ins, password resets, **Change email** (kept by Supabase Auth; see [logins and permissions](logins-and-permissions.md)), Term export downloads and the nightly warning emails (the daily check writes nothing, daily-check D-7).

## Open questions

- How long should Recent changes and deactivated logins be kept? [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md) leaves this to the board; today both are kept until a person is deleted for good.
- The Restore box mixes three date and time formats: (a) keep, (b) the dashboard format everywhere (recommended in the [release checklist](../release-checklist.md)), or (c) the public page's format everywhere?
