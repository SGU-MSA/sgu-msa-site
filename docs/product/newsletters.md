# Newsletters

**Who uses it:** every board member with a login; visitors. **Where:** Dashboard → **Newsletters** (`/admin/content/newsletters`); the Newsletter archive on the Resources page (`/resources`), whose heading and note are edited in Pages → Resources. **Related:** [PR4 contract](../contracts/pr4-dashboard-simplification-onboarding.md), [PR5a contract](../contracts/pr5a-notices-events-continuity.md), [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md); [Pages](pages.md), [Photos and uploads](photos.md).

## Why it exists

The board sends a newsletter each month or term, made in Canva, Google Docs or similar. The site keeps every issue in one archive, so new students can catch up and the club keeps a record. Putting an issue up must take a minute: a name, a date and the file or its link.

## User stories

### Adding an issue

- **US-NL-1.** As a board member, I want to add an issue with its name and date, so that visitors can tell the issues apart.
  - Acceptance: **Create new** opens **Issue name**, **Issue date**, **Short description (optional)**, **The newsletter** and **Who can see it?** (PR4 D-7, design C). Every box shows a grey example that is never saved (PR5a D-26).
  - With **Everyone on the website**, **Save** lists it in the Newsletter archive on the next page load, newest first, with no deploy.
- **US-NL-2.** As a board member, I want to upload the newsletter itself, or link to where it already lives, so that I use whatever the newsletter was made in.
  - Acceptance: **The newsletter** offers "Upload a PDF or an image (max 3 MB)" or "Link to it (https://…)" (PR4 design C; lists migration: an image is stored as WebP).
  - The archive's button reads "Open PDF", "View image" or "Visit link" to match.
  - Every issue needs one of them, draft or not: "The newsletter: choose a PDF or an image, or add a link."
- **US-NL-3.** As a board member, I want to see the archive row before I save, so that I catch mistakes.
  - Acceptance: the eye button opens a full-screen Preview of the real Resources page with the unsaved issue, at Desktop, Tablet or Phone width (PR5a D-32).

### Reading the archive (visitors)

- **US-NL-4.** As a visitor, I want past issues in one list, so that I can open any of them.
  - Acceptance: each row shows the issue's date, its name, its short description and its button (PR5a E-20). Only issues with a file or a link are listed, so no row is without a button.
  - The archive's heading and note are page text (Pages → Resources → **Newsletter archive**, edited by the Executive board; PR5b shared text, option A), and the board can hide that section of the page.
  - With no issue yet, the archive says "Newsletter editions will be listed here."

### Changing and removing

- **US-NL-5.** As a board member, I want to replace an issue's file with a corrected one, so that visitors get the right version.
  - Acceptance: with a file attached the box says "A PDF is attached; choose a file to replace it." (or "An image is attached; …"); choosing a new file and **Save** replaces it.
  - Switching to **Link to it** says "Saving takes the attached file off this issue." and does so on **Save**, because otherwise the file would still be what visitors open (release checklist, PR4).
- **US-NL-6.** As a board member, I want to archive an issue posted by mistake, so that it leaves the site but is not lost.
  - Acceptance: **Archive** takes the issue and its file off the website and moves it to the Archived tab; **Restore** brings it back as an unpublished draft; only "manage people" holders delete one permanently, from Archived, by typing DELETE, and its file goes too unless another item uses it (ADR 0013).

## Rules

- Any board member with a login adds, edits, archives and restores issues; changes go live at once and are in Recent changes (ADR 0007, ADR 0013).
- An issue shows from its **Issue date**, while published and not archived. Issues have no **Hide after** date; saving an old issue clears one (PR4 D-15).
- Uploads are at most 3 MB each: PDF, JPEG, PNG or WebP (photo limits; [Photos and uploads](photos.md)). A link must start with `https://`.
- The site keeps no mailing list and sends no newsletter email: the archive only lists issues (ADR 0014).

## Edge cases

| Case                                        | What should happen                                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Newsletter PDF over 3 MB                    | The upload is refused: "Each upload must be 3 MB or smaller." Share it from Google Drive and choose **Link to it**, or export a smaller PDF.                                                                  |
| Issue dated in the future                   | It stays off the archive until that day, then appears by itself.                                                                                                                                              |
| **Upload a PDF** chosen but no file picked  | Refused: "The newsletter: choose a PDF or an image, or add a link."                                                                                                                                           |
| Link to a shared Google Drive file          | Accepted (any secure link); the button reads "Visit link".                                                                                                                                                    |
| Two board members edit one issue            | The second Save: "Someone else changed this; reload before trying again." Typed text stays.                                                                                                                   |
| Session expires or connection drops on Save | "Your session expired or access was removed. Sign in again." or "Could not save. Check your connection and try again." Typed text stays; the file must be chosen again ("Choose the … again before saving."). |
| Long issue name                             | **Issue name** up to 160 characters; **Short description** up to 500.                                                                                                                                         |
| Database unreachable                        | The archive says "Newsletters are temporarily unavailable. Please try again shortly."; the rest of Resources still shows.                                                                                     |
| Same file used by another item              | Deleting this issue for good keeps the file; the Photos screen shows where it is still used ([Photos and uploads](photos.md)).                                                                                |
| New board term                              | Old issues stay as the club's record. A "manage people" holder's Term export downloads a term's newsletters with their files; **Free up space** can then remove the files of archived issues.                 |

## Known gaps

- The archive prints each issue's date as stored ("2026-10-01"), not in the site's usual date format ("1 October 2026"), against the admin UX gate's "one format everywhere" rule ([admin UX gate](../../.agents/skills/reviewing-engineering-changes/references/admin-ux-gate.md), rule 7). No ticket yet.

## Open questions

None.
