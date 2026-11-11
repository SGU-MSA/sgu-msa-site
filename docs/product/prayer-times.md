# Prayer and iqamah times

**Who uses it:** every board member with a dashboard login (equal admins, [ADR 0007](../adr/0007-people-and-permissions.md)); visitors. **Where:** Dashboard → **Prayer & iqamah**; Home, **Prayer & Musallah** (`/prayer`) and a season page's **Tonight** sheet. **Related:** [ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md), [PR4 contract](../contracts/pr4-dashboard-simplification-onboarding.md), [PR5a contract](../contracts/pr5a-notices-events-continuity.md) (Jumu'ah question), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0022](../adr/0022-daily-check-and-warning-emails.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md), [Prayer times explained](../guides/prayer-times.md). The pin that feeds the calculation: [Musallah location](musallah-location.md).

## Why it exists

Students check the site to know when the congregation prays, not only when a prayer begins. Begin times are worked out automatically; the board sets only iqamah and Jumu'ah, which change each term, in Ramadan and on odd days. A wrong or stale time means people miss jama'ah, so routine changes must be quick and safe for a new volunteer on a phone.

## User stories

### Routine iqamah changes

- **US-PRAYER-1.** As a board member, I want to change one prayer's iqamah for the new term (for example Isha), so that the new time shows from the term's first day.
  - Acceptance: on a 390 px phone, in **1. Daily iqamah**, I set Isha's time in 12-hour form (AM/PM, never a 24-hour clock) without a typing mistake being possible, set **Times start on** and **Times end on**, press **Save prayer settings** and see "✓ Saved", which fades.
  - Acceptance: before saving, the line under the box reads "Adhan 7:02 PM → Iqamah 8:00 PM today", from the same rule visitors get.
  - Acceptance: the next load of `/prayer` and Home shows the new time in the **Iqamah** column; nobody redeploys.
- **US-PRAYER-2.** As a board member, I want Fajr or Maghrib to follow the adhan by a number of minutes, so that nobody retypes it every week.
  - Acceptance: each prayer has a **Fixed time** / **After adhan** switch; After adhan takes whole minutes from 0 to 120; switching keeps what was typed on each side, and only the picked side is saved.
  - Acceptance: the line under the box moves with the calculated adhan ("Adhan 5:21 AM → Iqamah 5:41 AM today").
- **US-PRAYER-3.** As a board member, I want a warning before the iqamah times end, so that the site never goes blank silently over a break.
  - Acceptance: from 7 days before **Times end on** the dashboard bell says "Iqamah times end on Thu 15 Oct (in 7 days)"; after that date, "Iqamah times ended on Thu 15 Oct — update them" until a later date is saved; the daily check emails the MSA Gmail.

### Jumu'ah

- **US-PRAYER-4.** As a board member, I want to keep the weekly Jumu'ah as a short list of prayers, so that a second Jumu'ah is shown when we hold one.
  - Acceptance: **2. Jumu’ah (every Friday)** lists up to 4 prayers, each with **Khutbah** and **Iqamah**; iqamah times before the khutbah are greyed out; **+ Add a Jumu’ah prayer**, **Remove**, and drag ⠿ to reorder.
  - Acceptance: `/prayer` names them **First prayer**, **Second prayer**…; Home shows one line, "Jumu’ah, khutbah 12:45 PM, iqamah 1:00 PM; khutbah 1:45 PM, iqamah 2:00 PM".
- **US-PRAYER-5.** As a board member, I want to set or cancel this Friday's Jumu'ah only, so that visitors see the right time that week and the usual time after.
  - Acceptance: in **3. Changes for one date**, **+ Add a date**, pick the Friday (past days greyed out), write the **Reason (shown to visitors)** and choose **As usual**, **No Jumu’ah this week** or **Different time**.
  - Acceptance: **Different time** starts from the weekly prayers; I can change a time, remove one prayer to cancel only it, or add one; the last prayer has no **Remove**.
  - Acceptance: from the Saturday before until that Friday ends, `/prayer` shows "Changed this Friday, 17 October", that Friday's prayers, the reason and "Usually: …", or "No Jumu’ah this Friday, 10 October." and the reason; the next week returns to the weekly list by itself.
- **US-PRAYER-6.** As a board member, I want to be asked whether to also post an urgent notice, so that people who never open the Prayer page still hear about the change.
  - Acceptance: a new or edited cancelled or changed Friday asks **Also show an urgent notice on every page?** with **Yes** / **No** required; Save without an answer says "Also show an urgent notice?: choose Yes or No."
  - Acceptance: **Yes** shows **Notice text (you can change it)**, prefilled "No Jumu’ah at the Musallah this Friday (16 Oct)" or "Jumu’ah this Friday (16 Oct) moves to 1:15 PM" (80 characters at most), and **Hide at (exact time)**, prefilled 30 minutes after that Friday's last iqamah (the usual one when cancelled) and later than now.
  - Acceptance: after the save the notice shows under the menu on every public page until **Hide at**; saving the same Friday again asks nothing.

### One-day changes, mistakes and checking

- **US-PRAYER-7.** As a board member, I want one day's daily iqamah to differ, so that a special day does not change the rest of the term.
  - Acceptance: a date card's **Different iqamah for a daily prayer on this date** sets any prayer's time for that date; visitors see "Changed today: (reason)." under the times; the next day is back to normal by itself.
- **US-PRAYER-8.** As a board member, I want to fix a time I entered wrong, so that visitors see the right time within minutes.
  - Acceptance: I can correct the box and save, or open **History** (the last 20 changes) → **Restore the version before this change**, see **Restore this version?** with the settings it brings back, and confirm or **Cancel**.
  - Acceptance: a restore is itself listed in History and **Recent changes**; it never moves the musallah pin; every prayer change in Recent changes says who changed what, from what to what, and is highlighted.
- **US-PRAYER-9.** As a board member, I want to see what visitors will see before saving, so that I catch mistakes before they go live.
  - Acceptance: each prayer's line shows today's adhan and iqamah from what is typed, including the dates and today's one-date change ("No iqamah today. Starts Tue 20 Oct", "Iqamah 5:45 AM today (one-date change)"); the screen says **Appears on:** Prayer & Musallah, Home. A full preview is a Known gap.
- **US-PRAYER-10.** As a board member, I want my typing kept when something is wrong, so that I never enter everything twice.
  - Acceptance: a wrong box turns red with one line under it; Save shows "Some boxes need fixing." and moves to the first red box; a refused save keeps everything typed; leaving with unsaved changes asks **Leave without saving?** (**Save** / **Discard** / **Keep editing**).

### Visitors

- **US-PRAYER-11.** As a visitor, I want today's begin and iqamah times and the next prayer, so that I can plan to pray in congregation.
  - Acceptance: Home and `/prayer` show a **Prayer / Begins / Iqamah** table in 12-hour time (Sunrise for information only), the next prayer ringed with **Next** (tomorrow's Fajr after Isha), and "Begins: calculated for the Musallah (Muslim World League · Standard Asr · America/Grenada)"; no account or device location needed.
  - Acceptance: a prayer with no current iqamah shows "—", never an old time as if current.

## Rules

- Begin times: Muslim World League (Fajr 18°, Isha 17°) with Standard (Shafi'i) Asr, at the one musallah pin, for each Grenada date. Not board-editable; a change is a founders' decision made by a developer with a new ADR ([ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md)). The maintainer checked them against mobile prayer apps on 2026-10-05.
- Iqamah is the board's decision; no outside approver ([PR7 D-13](../contracts/pr7-single-pin-map.md)). Each prayer is Fixed time or After adhan, never both (PR4 D-2, D-14 and its 2026-10-05 amendment).
- Which iqamah shows: a one-date change, else minutes after the adhan, else the fixed time. Fixed times and the weekly Jumu'ah show only between **Times start on** and **Times end on**; both dates are then required, the end not before the start ([guide](../guides/prayer-times.md)).
- One-date changes: today or later, one card per date, a reason of at most 250 characters shown to visitors (PR4 D-5), at most 20 cards. Jumu'ah choices appear only on a Friday.
- Jumu'ah: up to 4 prayers, iqamah after khutbah, one room so no place (PR4 D-16; review fixes P2 in the [release checklist](../release-checklist.md)). The question and its prefill follow PR5a D-3 and D-19.
- Reminders from 7 days before **Times end on**, and after it until fixed (PR4 D-12 and amendment; [ADR 0022](../adr/0022-daily-check-and-warning-emails.md)).
- A save shows on the next page load; an open Home or Prayer tab refreshes about once a minute ([ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md)).
- **Term changes:** the board updates **1. Daily iqamah** and the two dates; After adhan prayers follow the season by themselves.
- **Ramadan:** its dates are a season ([ADR 0021](../adr/0021-seasons-follow-the-islamic-calendar.md)); its iqamah is set here like any term, and the **Tonight** sheet reads Maghrib's begin time and the Isha iqamah from here. The Hijri date is calculated (Umm al-Qura) and not set by the board (review fixes P2).
- **Daylight saving does not apply:** Grenada keeps Atlantic Standard Time (UTC−4) all year and every time uses `America/Grenada`; nothing changes twice a year.

## Edge cases

| Case | What should happen |
| --- | --- |
| A time in the wrong format | The time control allows only real times; an unfinished one says "choose a valid time"; minutes outside 0–120 say "Fajr iqamah: use whole minutes after the adhan, from 0 to 120." |
| Iqamah before its begin time (Isha 8:00 AM instead of PM) | The line shows "Adhan 7:02 PM → Iqamah 8:00 AM today"; nothing refuses it today (Known gaps). |
| Jumu'ah iqamah before its khutbah | Earlier times greyed out; a save says "Jumu’ah iqamah (second prayer): choose a time after the khutbah." |
| An overnight Isha | Not real here: Isha begins around 7 PM all year, and 120 minutes after it stays before midnight. After Isha the next prayer is tomorrow's Fajr. |
| Jumu'ah on a holiday or break | **No Jumu’ah this week** with the reason; if Eid falls on a Friday, the Eid notice and the Jumu'ah notice take turns in the urgent band. |
| A Friday change entered weeks ahead | Saved now; visitors see it from the Saturday before that Friday. |
| Two editors at once | The later save says "Could not save. Reload to get the latest schedule before editing."; the typed text stays on screen to copy. A pin move never blocks a prayer save. |
| Session expires mid-edit | "Your session expired or access was removed. Sign in again."; the typed text stays. |
| Stale times on the public site | Saved settings are cached until any board save, which clears them; After adhan times and the next prayer are worked out on each visit. |
| Database unreachable | Public: "Prayer start times are temporarily unavailable.", fixed iqamah still shows, After adhan hides. Dashboard: no form, so nothing is saved over unknown values. |
| Times end over a break | Iqamah shows "—" and the weekly Jumu'ah hides; the bell and email remind the board. |
| A page left open during a release | "This page is out of date. Reload it and try again." |
| The same date twice | "Changes for one date: use each date only once." |
| A stored prayer with both kinds | Both boxes show with "Fajr iqamah: pick Fixed time or After adhan, not both."; a save or a restore is refused until one is picked. |

## Known gaps

No tickets are filed for these yet.

- The maintainer reports the screen is very hard to use. It is one long form with **Save prayer settings** at the end; one Friday's change takes about seven steps (add a date, date, reason, choice, times, notice answer, Save), all measured against US-PRAYER-1 and US-PRAYER-5.
- No full preview of the public prayer block before saving ([admin UX gate](../../.agents/skills/reviewing-engineering-changes/references/admin-ux-gate.md) rule 10; "Not built, please decide" in the [release checklist](../release-checklist.md#needs-your-confirmation)).
- Nothing checks that an iqamah comes after its begin time.
- One schedule at a time: next term or Ramadan cannot be prepared ahead; moving **Times start on** into the future hides today's fixed times at once. Twenty one-date cards cannot cover a 30-day month ([roadmap](../roadmap.md), D0 item #68, not scheduled).
- Past one-date changes stay listed until removed by hand and count towards the 20.
- Removing or undoing a Friday change leaves its urgent notice up until **Hide at**; it must be archived in Announcements.
- Visitors read "Valid 2026-10-01 through 2026-12-15 · Grenada time", not the site's date format; History's list shows stored 24-hour times ("05:20 → 05:30").
- The dashboard's load error says "Check database setup and reload." (admin UX gate rule 2).

## Open questions

1. Should Prayer & iqamah get a full preview of Home and `/prayer` before saving (release checklist: "People, Prayer & iqamah and Tickets have no Preview")?
2. When an iqamah is before its begin time, should the save refuse it, warn, or allow it?
3. Should the board be able to prepare the next schedule (new term, Ramadan) ahead of time (D0 #68)?
4. Should past one-date changes clear themselves, or stay until removed?
5. When a Friday change is removed or set back to **As usual**, should the screen offer to hide the urgent notice it posted?
6. Still to confirm from review fixes P2: at most 4 Jumu'ah prayers, and whether a changed Friday may add a prayer.
7. One date and time format in **Restore this version?** (release checklist, Review 3 D, options a, b or c).
