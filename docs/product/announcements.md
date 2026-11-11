# Announcements

**Who uses it:** every board member with a login; visitors. **Where:** Dashboard → **Announcements** (`/admin/content/announcements`) and the Jumu'ah question in Prayer & iqamah; the urgent band under the menu on every public page, Home's notice strip, Community updates (`/community`, Home) and each announcement's page (`/community/announcements/<id>`). **Related:** [PR5a contract](../contracts/pr5a-notices-events-continuity.md), [PR4 contract](../contracts/pr4-dashboard-simplification-onboarding.md), [restyle contract](../contracts/restyle-public.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md); [Events](events.md), [News](news.md).

## Why it exists

The club needs to tell students things quickly: the Musallah is closed, Jumu'ah moves, Eid prayer is confirmed, a janazah is tonight. Some notices matter for an afternoon, some for a week. A board member, often on a phone and late at night, must post one, make it as loud as it deserves, and trust it to disappear on time.

## User stories

### Posting a notice

- **US-AN-1.** As a board member, I want to post a notice with a headline, a short summary and the full message, so that students get the news.
  - Acceptance: **Create new** opens **Headline**, **One-line summary** ("Shown on the homepage strip and in lists."), **Full message**, **How important is it?**, **Picture (optional)**, **Describe the picture**, **Link (optional)** and **Who can see it?** (PR4 D-7; PR5a D-1). Every box shows a grey example that is never saved (PR5a D-26).
  - With **Everyone on the website**, **Save** shows it in Community updates on the next page load, no deploy (ADR 0024).
  - **Show from** sets the first day it shows; a future day schedules it.
- **US-AN-2.** As a board member, I want to choose how loud a notice is, so that only real emergencies interrupt every page.
  - Acceptance: **How important is it?** offers three cards (PR5a D-1):
    - **Normal**: "In Community updates only."
    - **Featured**: "Also in the homepage notice strip." With no **Hide after (optional)** date it warns "Featured notices with no Hide after date stay on Home until you change them." but still saves (PR5a D-17).
    - **Urgent**: "On every page, under the menu." Needs **Hide at (exact time)**, "Required for Urgent. Grenada time."
- **US-AN-3.** As a board member, I want an urgent notice to end at an exact minute, so that "Musallah closed until 3 PM" is not still showing at 4 PM.
  - Acceptance: at **Hide at** the whole notice leaves the public site (band, Community updates and its page); it stays in the dashboard and in Recent changes (PR5a D-17). It ends at that minute even on a cached page (ADR 0024).
- **US-AN-4.** As a board member, I want to see the notice before I save, so that I catch mistakes.
  - Acceptance: the eye button opens a full-screen Preview of the real page with the unsaved values, at Desktop, Tablet or Phone width (PR5a D-32).
- **US-AN-5.** As a board member, I want to reuse an old notice, so that I do not retype the Eid announcement each year.
  - Acceptance: **Create from this announcement** opens a new form with the saved details and no date; the copy is Normal, not Featured or Urgent (review fixes P3; PR5a E-14).

### Urgent notices from other screens

- **US-AN-6.** As a board member changing one Friday's Jumu'ah, I want to post the urgent notice in the same step, so that I do not forget it.
  - Acceptance: a new or changed Friday change asks the required **Also show an urgent notice on every page?** with editable text ("No Jumu'ah at the Musallah this Friday (16 Oct)" or "… moves to …") and **Hide at** prefilled 30 minutes after that Friday's last iqamah (PR5a D-3, D-19; release checklist). Saving again unchanged asks nothing.
  - If the notice fails: "The Jumu’ah change is saved, but the urgent notice could not be posted. Post it from Announcements."
- **US-AN-7.** As a board member moving or cancelling a published event, I want the same offer, so that students hear about it (see [Events](events.md), US-EV-10).

### What visitors see

- **US-AN-8.** As a visitor, I want urgent news at the top of whatever page I am on, so that I cannot miss it.
  - Acceptance: a dark ink band under the menu on every public page, never on the dashboard (PR5a D-18, E-18): the label "Urgent", the headline and "Details →".
  - Two or more urgent notices rotate in one band, newest **Show from** first: arrows, dots and swipe; it moves on every 7 seconds until the visitor taps an arrow or a dot or swipes, then stops for that page; it waits while touched, hovered or focused; with reduced motion it never moves by itself; no pause button and no visible "1 of N" (PR5a D-16, D-30 and its amendment).
- **US-AN-9.** As a visitor, I want Home to show the one notice the board wants everyone to read this week.
  - Acceptance: a thin strip under Home's top shows the Featured notice's headline and its summary, or "Read the announcement →" (PR5a, `NoticeStrip`).

### Fixing and removing

- **US-AN-10.** As a board member, I want to end an urgent notice early, so that a wrong or finished notice stops at once.
  - Acceptance: choose **Normal** (or **Only the board (draft)**) and **Save**; the band loses it on the next page load. The Announcements list shows "Urgent now: N"; the editor lists the other current urgent notices with their end times (PR5a D-16).
- **US-AN-11.** As a board member, I want to archive an old notice, so that it leaves the site but is not lost.
  - Acceptance: **Archive** takes it and its picture off the website; **Restore** brings it back as an unpublished draft; only "manage people" holders delete it permanently, from Archived, by typing DELETE (ADR 0013).

## Rules

- Any board member with a login posts, changes and archives notices; no approval step (ADR 0007, ADR 0013).
- Priority is one of Normal, Featured or Urgent. An urgent notice is never also featured and has no **Hide after** date (PR5a D-1).
- **Hide at** must be later than now and on or after **Show from**; an urgent headline fits 80 characters, so the band keeps one height (PR5a D-1, D-16).
- No limit on how many urgent notices run at once, and no "one at a time" lock (PR5a D-16).
- Urgent changes are highlighted in Recent changes, labelled "Urgent notice" (PR5a D-17, E-25).
- The band's timing (7 seconds), the 80-character limit and the 30-minute Jumu'ah prefill are fixed by design; the prefill can be edited per notice (PR5a Board Self-Sufficiency Check).

## Edge cases

| Case                                                 | What should happen                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Urgent notice left on by mistake                     | It still ends by itself at **Hide at**. To end it now: **Normal** or draft, then **Save**.                                             |
| **Hide at** typed in the past                        | Refused: "Hide at: choose a time later than now." Typed text stays (PR5a D-1).                                                         |
| Fixing a typo in an urgent notice that already ended | Its old **Hide at** is in the past, so Save is refused until it is set to **Normal** or **Featured**, or given a new **Hide at**.      |
| Urgent headline over 80 characters                   | Refused: "Headline: urgent notices fit 80 characters; put the rest in the details."                                                    |
| Two Featured notices at once                         | Home's strip shows only the one with the newest **Show from** date; both stay in Community updates.                                    |
| Featured with no end left on for months              | It stays on Home; the editor warned when it was saved (PR5a D-17).                                                                     |
| Eid on a Friday                                      | The Eid notice and the Jumu'ah notice both rotate in the band (PR5a Design).                                                           |
| Two board members edit one notice                    | The second Save: "Someone else changed this; reload before trying again." Typed text stays.                                            |
| Session expires mid-edit                             | "Your session expired or access was removed. Sign in again." Nothing is saved; typed text stays.                                       |
| Bad connection at night on a phone                   | "Could not save. Check your connection and try again." Typed text stays; a chosen photo must be chosen again.                          |
| Database unreachable for visitors                    | No band shows; pages still load (PR5a Failure Modes).                                                                                  |
| Old link to an ended or archived notice              | Its page is not found; the rest of the site is unaffected.                                                                             |
| Arabic in the headline                               | Shown as typed in the band and lists; link-preview cards leave Arabic out (site essentials D-10).                                      |
| Visitor with reduced motion                          | Nothing moves by itself; arrows, dots and swipe still work, without sliding (PR5a D-30).                                               |
| New board term                                       | Old Featured or long urgent notices keep showing until someone changes them; "Urgent now: N" and the Featured warning show what is on. |

## Known gaps

None known.

## Open questions

- With two Featured notices, Home shows only the newest. The old Featured hint said "Only the newest one with this ticked shows." (release checklist, PR4); the Normal / Featured / Urgent cards dropped it. Should the **Featured** card say so again?
