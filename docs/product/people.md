# People and team groups

**Who uses it:** every board member with a dashboard login; visitors read the result. **Where:** Dashboard → **People** (`/admin/people`, a person's page, **Edit groups**), the About page's team list. **Related:** [PR3 contract](../contracts/pr3-people-permissions-activity.md), [ADR 0007](../adr/0007-people-and-permissions.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [ADR 0025](../adr/0025-team-list-without-consent-records.md), [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md). Logins and permissions: [logins and permissions](logins-and-permissions.md).

## Why it exists

The board changes every year. One People list, kept by the board itself, decides who is on the About page and who may have a dashboard login, so no developer edits a file when the team changes. It holds as little personal data as possible: name, role, group, the "Show on public page" choice and, for executives, an optional photo.

## User stories

### Keeping the team list

- **US-PEOPLE-1.** As a board member, I want to add a person with a name, a group and a role, so that the team list matches the real board.
  - Acceptance: **Add a person** opens a form with **Name**, **Group**, and **Role** (Executive board: one of President, Vice President (Brothers), Vice President (Sisters), Treasurer, Secretary) or **Role title (optional)** (other groups: free text with suggestions).
  - Acceptance: a new person goes last in their group; the Executive board is always listed by role, President first, with no drag handle.
  - Acceptance: a login is not needed; the person can exist with "No login".
- **US-PEOPLE-2.** As a board member, I want to reorder people and groups by dragging, so that About shows them in the order the board wants.
  - Acceptance: drag ⠿ (or arrow keys on the handle), then **Save order**; no order numbers are typed.
- **US-PEOPLE-3.** As a board member, I want to add, rename, reorder and archive the board's own groups on **Edit groups**, so that new teams (for example a Musallah team) appear without a developer.
  - Acceptance: the Executive board and the General board always exist: "This group is always kept: it cannot be renamed or archived."
  - Acceptance: a group is archived only when nobody current is in it, and can be restored under **Archived groups**.
  - Acceptance: each group has the tick box "New people in this group start with “Show on public page” ticked".

### What visitors see

- **US-PEOPLE-4.** As an executive, I want the About page to show the Executive board in tiers with photos, so that students know who leads the club.
  - Acceptance: tiers are the President; the two Vice Presidents; the Treasurer and the Secretary. An executive with no photo still shows.
  - Acceptance: the Executive board is always listed; it has no "Show on public page" box.
- **US-PEOPLE-5.** As a General board member, I want to choose whether my name appears online, so that I am not listed against my wishes.
  - Acceptance: everyone outside the Executive board has **Show on public page**; ticked people appear under **View all** by name and role only, never with a photo.
  - Acceptance: unticking it removes them from About on the next visit.

### Photos

- **US-PEOPLE-6.** As a board member, I want to add or replace an executive's photo from a phone, so that the About page looks complete.
  - Acceptance: only Executive board members have a photo box; the save and the database refuse a photo for anyone else ("Only Executive board members have a photo on the About page.").
  - Acceptance: an executive with no photo shows "No photo yet" on People and a closable line in the notifications bell.
  - Acceptance: a HEIC photo the browser cannot open stops the save with the HEIC line; typed text stays.
- **US-PEOPLE-7.** As a board member, I want to take a photo down at once when someone asks, so that we respect their wishes.
  - Acceptance: **Remove photo** deletes the file for good and changes nothing else; it also works for archived people.

### Someone leaves

- **US-PEOPLE-8.** As a board member with Manage people, I want to mark someone **No longer on the team**, so that they leave About and the dashboard in one step.
  - Acceptance: they come off About, their login is turned off and they are signed out on every device; the entry and its history stay under **Archived**.
  - Acceptance: any board member may restore them; a restored person's login stays off until someone with Manage people reactivates it.
- **US-PEOPLE-9.** As a board member with Manage people, I want to delete an archived person for good, so that a privacy request is honoured.
  - Acceptance: from **Archived**, type DELETE; their photo and their login account are deleted too; Recent changes keeps no names.

## Rules

- Any board member may add and edit People entries and groups; only login, permissions and permanent delete need Manage people (PR3 D-6, D-7, D-8).
- Moving someone into or out of the Executive board, or changing an executive's role, needs Manage people; others see **Group** and **Role** locked with the reason (PR3 amendment 2026-10-06; SGU15).
- Each Executive board role has one current holder (PR3 amendment 2026-10-06, "keep it simple"); handing a role over is in [logins and permissions](logins-and-permissions.md).
- "Show on public page" alone decides who outside the Executive board is listed; no consent records are kept ([ADR 0025](../adr/0025-team-list-without-consent-records.md)).
- The Executive board is always listed, and only it has photos (review fixes P4, user 2026-10-07, [release checklist](../release-checklist.md)).
- Someone moved out of the Executive board keeps their photo hidden, not deleted; it shows again if they come back (review follow-ups, user 2026-10-07).
- Archive instead of delete; permanent delete only from Archived, typed DELETE, Manage people holders ([ADR 0013](../adr/0013-activity-log-archive-and-history.md), PR3 D-6).
- Archiving someone with an active login needs Manage people, because it turns their login off (PR3 D-12; database `people_archive_access`).
- Recent changes says which People fields changed, never the name or photo values (PR3 D-5).

## Edge cases

| Case                                                     | What should happen                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A person asks to come off the website                    | Outside the Executive board: untick **Show on public page**. A photo: **Remove photo**. Either works at once.                                       |
| An executive asks not to be listed                       | Today the Executive board is always listed; the board can remove the photo but not the name (see Open questions).                                   |
| Someone graduates mid-term                               | Give their role to the successor (the role question moves them to the General board), then **No longer on the team** when they leave the team list. |
| The group a person was in was archived                   | The form says "This person's group was archived; choose a new one." and never picks one silently.                                                   |
| Restoring an executive whose role someone else now holds | Refused: "Someone else holds this person's Executive board role now. Move that person out of the role first, then restore."                         |
| Archiving a group that still has people                  | Refused: only an empty group can be archived; only an archived, empty group can be deleted (Manage people, typed DELETE).                           |
| Two board members edit the same person at once           | The second save is refused: "Someone else changed this; reload before trying again."                                                                |
| People cannot be loaded on About                         | The team block is left out; no "to be confirmed" text.                                                                                              |

## Known gaps

- Someone moved out of the Executive board keeps their manually typed role (for example "President") in their new group, so About could show two "President"s; nothing warns (no ticket yet; see Open questions).
- A hidden photo of a former executive still appears on **Photos** as "Person: (name)" and in the Term export zip (no ticket yet; see Open questions).

## Open questions

- When someone is moved out of the Executive board by hand, should their **Role** box be cleared, or kept with a warning? ([release checklist](../release-checklist.md), "Executive board permissions and shared words")
- A former executive's hidden photo on **Photos** and in the Term export: A keep as is, B label it "(hidden while not in the Executive board)", or C also leave it out of the zip?
- Where should the executive photo nudge show: A all three places, B only People and the form, C only the bell?
- Should **Advisors/Faculty** start with "Show on public page" unticked again?
- [ADR 0025](../adr/0025-team-list-without-consent-records.md) says the board takes a person off the page on request, but the Executive board is now always listed. How should an executive's request not to be named online be handled?
- Does the old faculty-advisor sentence come back on About (founder's decision)?
