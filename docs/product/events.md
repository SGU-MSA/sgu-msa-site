# Events

**Who uses it:** every board member with a login; visitors. **Where:** Dashboard → **Events** (`/admin/content/events`); the Events page (`/calendar`), each event's page (`/calendar/<id>`), its calendar file (`/calendar/<id>/ics`), Home's week and season pages. **Related:** [PR5a contract](../contracts/pr5a-notices-events-continuity.md), [PR4 contract](../contracts/pr4-dashboard-simplification-onboarding.md), [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md), [restyle contract](../contracts/restyle-public.md), [site essentials](../contracts/site-essentials.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md); [Lists](lists.md) (categories and terms), [Announcements](announcements.md).

## Why it exists

Iftars, halaqas and socials are planned, moved and cancelled all term, often at short notice. Students check on their phones. A board member must add, move or cancel an event from a phone, with no developer, and visitors (and their saved calendars) must see the change at once.

## User stories

### Adding an event

- **US-EV-1.** As a board member, I want to add an event with its name, days, times and place, so that students know what, when and where.
  - Acceptance: **Create new** on Events opens a form with **Event name**, **Start date**, **Start time (optional)**, **End date (optional)**, **End time (optional)**, **Place**, **Category (optional)**, **Term (optional)**, **What is it about?**, **Picture (optional)**, **Describe the picture**, **Sign-up link (optional)**, **Ticket (optional)**, **Season (optional)**, **Is it still happening?** and **Who can see it?** (PR4 D-7; PR5a D-20 amendment).
  - Every box shows a grey example that is never saved (PR5a D-26).
  - No start time means all day ("All day"); no end date means it ends on the start day (PR5a D-20 amendment).
  - Times are Grenada time and show as 12-hour AM/PM everywhere (restyle D-8).
  - With **Everyone on the website**, **Save** puts it on the Events page and Home's week on the next page load, with no deploy (ADR 0024).
- **US-EV-2.** As a board member, I want to keep an unfinished event as a draft, so that nobody sees it before it is ready.
  - Acceptance: **Only the board (draft)** keeps it off the website; the Events list marks it "Draft" (PR4 D-7).
  - A published event needs a place: "Place: add where it happens, or save as a draft."
- **US-EV-3.** As a board member, I want to see the event page before I save, so that I catch mistakes.
  - Acceptance: the eye button opens a full-screen Preview of the real event page with the unsaved values, at Desktop, Tablet or Phone width (PR5a D-32).
- **US-EV-4.** As a board member, I want to attach our Google Form, so that students can sign up without the site storing their answers.
  - Acceptance: the event page shows a "Sign up →" button that opens the form in a new tab; the form is never embedded (ADR 0014; PR5b D-7).
  - Any link that is not `docs.google.com/forms/…` or `forms.gle/…` is refused with "Sign-up link: use a Google Forms link (docs.google.com/forms/… or forms.gle/…)." (PR5b D-25).
- **US-EV-5.** As a board member, I want to start this year's event from last year's, so that I do not retype it.
  - Acceptance: **Create from this event** opens a new form with the saved details and no date, headed "Started from “…”. Choose the date." The copy is Scheduled and has no ticket (ADR 0013 Duplicate; review fixes P3; PR5a E-14).

### Finding events (visitors)

- **US-EV-6.** As a visitor, I want the coming events beside a month view, so that I can plan my week.
  - Acceptance: event cards grouped by month beside a mini month that is always open (restyle D-1); tabs **Upcoming events** and **Past events**; an event stays under Upcoming until its end has passed.
  - Category buttons and the **Term** list come from [Lists](lists.md) and show only options with events in the tab shown; switching tabs resets the choice to All (release checklist, review fixes P3).
- **US-EV-7.** As a visitor, I want to add an event to my phone's calendar, so that I get a reminder.
  - Acceptance: **Add to Calendar** opens the calendar file on iPhone, iPad and Mac, Google Calendar on Android, and a menu **Google Calendar** / **Outlook** / **Apple or other (file)** on other computers (PR5a D-20 amendment).
- **US-EV-8.** As a visitor, I want a shared event link to show a useful preview in WhatsApp, so that friends know what it is.
  - Acceptance: the card shows the title, date and place; a cancelled event shows "Cancelled: …" (site essentials D-1, D-11). MSA events with a place carry Google event data on the live site (site essentials D-3).

### Changing plans

- **US-EV-9.** As a board member, I want to cancel an event and say why, so that nobody turns up for nothing.
  - Acceptance: **Is it still happening?** → **Cancelled**, with **Reason (required for Cancelled)**, at most 250 characters (PR5a D-2, D-20).
  - Cards, the event page and Home's week strike the title through and show "Cancelled: (reason)" in words, not colour alone; the event stays listed until its date passes and its page stays up (PR5a D-20).
  - Its calendar file says cancelled, with "Cancelled: " before the title, and keeps the same address and calendar ID, so re-adding replaces the old entry (PR5a D-2, E-8).
- **US-EV-10.** As a board member, I want to move an event to a new date and tell everyone, so that the change is not missed.
  - Acceptance: changing **Start date** of a published event, or cancelling it, asks the required **Also post an announcement?** with editable text ("… moves to Sat 31 Oct" or "Cancelled: …") and **Hide at** prefilled with the end of the event's day (the earlier of the old and new day). **Yes** posts an urgent notice; **No** posts nothing (PR5a D-20 amendment).
  - If the notice fails: "The event is saved, but the announcement could not be posted. Post it from Announcements."
- **US-EV-11.** As a board member, I want to mark an event postponed before the new date is known, so that students know it is not cancelled.
  - Acceptance: **Postponed** shows "Postponed: new date to be announced" and keeps the old date; the calendar file says tentative; ticket sales pause until it is Scheduled again (PR5a D-20 amendment; PR6 D-81). Postponing alone asks no announcement question.
- **US-EV-12.** As a board member, I want to undo a cancel or postpone, so that a mistake is easy to fix.
  - Acceptance: any event can be set back to **Scheduled** at any time (PR5a D-20).

### Taking an event down

- **US-EV-13.** As a board member, I want to archive an old or wrong event, so that it leaves the site but is not lost.
  - Acceptance: **Archive this item** → **Archive** takes the event and its picture off the website and moves it to the Archived tab; its address shows "This event is no longer listed" with links to Events and Home (ADR 0013; PR5a Design).
  - **Restore** brings it back as an unpublished draft: "Restored as an unpublished draft. Check it, then publish it again when it is ready."
- **US-EV-14.** As a board member who can manage people, I want to delete an archived event for good in a privacy case, so that it is really gone.
  - Acceptance: only from the Archived tab, by typing DELETE; logged; its picture is deleted too unless another item uses it (ADR 0013).

## Rules

- Any board member with a login adds, edits, archives and restores events; only "manage people" holders delete permanently (ADR 0007, ADR 0013).
- Every change is in Recent changes, add-only (ADR 0013). Changes go live at once; there is no approval step (ADR 0013).
- The end comes after the start; an end time needs a start time (PR5a D-20 amendment). No limit on future dates (ADR 0020).
- Hijri dates never show on events (restyle D-11). Event photos open no full-size viewer and have no consent features (PR5a D-21).
- Each event sells at most one ticket, and each ticket belongs to one event (PR6 WP-9). Payments are Go2Pay only (ADR 0005).
- No recurring or scheduled events (PR5a non-goals; roadmap #72). There is no whole-calendar subscription feed: each event has its own calendar file.

## Edge cases

| Case                                         | What should happen                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overnight event (10 PM to 3 AM)              | **End date** the next day plus **End time**; the card reads "10:00 PM – Sat 17 Oct, 3:00 AM"; it stays Upcoming until 3 AM (PR5a D-20 amendment).                          |
| End before start                             | Refused on the box: "End date: choose the start date or a later one." or "End time: choose a time after the start time."                                                   |
| Event typed with a past date                 | Allowed: past events are kept as history and listed under Past events (release checklist P1a).                                                                             |
| Two board members edit the same event        | The second Save is refused: "Someone else changed this; reload before trying again." What they typed stays on screen (PR5a Failure Modes).                                 |
| Session expires mid-edit                     | "Your session expired or access was removed. Sign in again." Typed text stays; nothing is saved (PR5a Failure Modes).                                                      |
| Bad phone connection on Save                 | "Could not save. Check your connection and try again." Typed text stays; a chosen photo must be chosen again (PR5a Failure Modes).                                         |
| Leaving with unsaved changes                 | "Leave without saving?" with **Save**, **Discard**, **Keep editing** (review 2; release checklist).                                                                        |
| Published by mistake                         | Choose **Only the board (draft)** and **Save**: it leaves the site at once. Chat apps may keep an old link preview for days (site essentials).                             |
| Cancelled after students saved it            | Re-adding the calendar file replaces their entry. Copies added through the Google or Outlook link do not update by themselves (PR5a Failure Modes).                        |
| Postponed, then the new date is known        | Set the new **Start date** and **Scheduled**; Save asks **Also post an announcement?** for a published event (PR5a D-20 amendment).                                        |
| Old link to an archived or unknown event     | "This event is no longer listed", with links to Events and Home; its calendar file is not found (PR5a Design).                                                             |
| Very long name                               | **Event name** holds up to 160 characters; the link-preview card shortens it with "…" (site essentials).                                                                   |
| Arabic in the name or description            | Shown on the site as typed; the link-preview card leaves Arabic out, because the card cannot draw it (site essentials D-10).                                               |
| A category or term the event uses is renamed | The event shows the new name at once; an option in use cannot be deleted (see [Lists](lists.md)).                                                                          |
| Database unreachable                         | The Events page shows its "temporarily unavailable" state; the dashboard says "Content could not be loaded. Check your connection and reload."                             |
| New board term                               | **Create from this event** copies last year's events; add the new term in [Lists](lists.md); a "manage people" holder's Term export keeps a copy of the old term's events. |

## Known gaps

None known.

## Open questions

- A postponed event with no new date keeps its old date, so once that day passes it drops from **Upcoming events** into **Past events**. Should it stay under Upcoming until the board sets a new date or cancels it?
- Which days should an event's **Start date** box allow? Past days are open today (release checklist "Needs your confirmation", review fixes P1a).
