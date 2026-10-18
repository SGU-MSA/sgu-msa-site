# Prayer times: explain this to the founder

## The short version

**Prayer starts are automatic. Congregation is the mosque’s decision.** Visitors do not need an account or to share their device location. The website is configured for the mosque, not wherever the visitor happens to be.

| Information | Who determines it? | How often does someone enter it? |
| --- | --- | --- |
| Fajr, sunrise, Dhuhr, Asr, Maghrib, Isha starts | Adhan calculation library: Muslim World League, Standard Asr, at the musallah pin | Never: calculated automatically for each date |
| Daily iqamah | Board/religious lead: per prayer, a fixed time (such as 12:30) or minutes after the adhan (such as 20), with **Times start on** and **Times end on** | Fixed times when they change; "after adhan" follows the starts automatically |
| Change for one date | Board: a reason (shown to visitors) and a different iqamah for that date, or, on a Friday, no Jumu'ah or that Friday's own Jumu'ah prayers (change or cancel any of them) | Only for that date |
| Jumu’ah prayers, each with a khutbah and iqamah time, up to 4 in order (the musallah is one room) | Board supplies actual arrangements | When arrangements change |
| Hijri date | Calculated (Umm al-Qura); not set by the board (review fixes P2) | Never |

**How it works since roadmap item PR4: keep it simple.** Phones already show prayer times, so the site uses **Muslim World League** with **Standard (Shafi'i) Asr**, which matches Muslim Pro and IslamicFinder for St. George's within 0–2 minutes. It is fixed in the code ([ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md)); the board cannot change it. If the founders ever want a different method or madhab, a developer changes it once. Dashboard → **Prayer & iqamah** keeps only the daily iqamah (each with a live "Adhan → Iqamah today" line), the weekly Jumu'ah prayers and changes for one date; there are no method, madhab, minute-correction or "leadership confirmed" controls. Since PR7 the start times are calculated at the one musallah pin, which also feeds the map and the directions; it is stored on its own, not with the prayer settings ([PR7 contract](../contracts/pr7-single-pin-map.md)). Step-by-step help: the board handbook (`handover/SGU-MSA-Website-Handbook.docx`), section 2.7, and the **Show me how** tour on Prayer & iqamah.

The hosted database needs the clean database files installed (staging first; [release checklist](../release-checklist.md), "Supabase: wipe and install the clean database"). Without them the public prayer block shows as temporarily unavailable and prayer saves fail.

## Is this an API?

No external prayer API is currently used. The website runs the maintained [Adhan JavaScript library](https://github.com/batoulapps/adhan-js) on the server. That is still automatic: its inputs are the date, the coordinates and the fixed calculation settings. A prayer API generally performs comparable calculations remotely and returns the result.

Local calculation needs no API key, daily upload, network request or service subscription. There is no API outage to recover from. It does not independently verify mosque practice: a religious lead still approves the iqamah times. If the mosque later requires an authoritative external timetable/provider, keep that as an alternative calculation provider behind the calculation module; do not rewrite the public UI or mix provider data with congregation scheduling.

## What the founder needs to decide

1. The method and Asr convention are decided (Muslim World League, Standard Asr; [ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md)) and were checked against mobile prayer apps on 2026-10-05. The founders only need to speak up if they want a different madhab.
2. Where exactly is the musallah? One pin serves both the map and the calculation.
3. Does iqamah stay at a fixed clock time or follow the prayer start by an interval? This can differ by prayer.
4. Who changes exceptional dates, closures and Ramadan arrangements? Who checks the result?
5. What are the actual Jumu’ah khutbah and iqamah times?
6. Who reviews the congregation schedule before its expiry? Automatic calculation does not remove the need for a responsible schedule owner.

## Examples — not real SGU times

- “Fajr iqamah is 20 minutes after Fajr begins” can follow the calculated time automatically every day.
- “Isha iqamah is at 8:00 pm” is a fixed congregation schedule; it must not be labeled as the calculated Isha start.
- “Only on one specified date, congregation will be at a different time” is a change for one date. It never changes the next day.
- “No Jumu’ah this Friday: mid-term break” is a change for one Friday; visitors see it from the Saturday before until that Friday ends, with the reason.

All sample values are illustrative, not religious recommendations or the mosque’s actual schedule. The demo mode is for design review and must never be used as a source of worship times.

## How visitors see it

The site shows today’s calculated starts, the next prayer and a separate congregation schedule. Sunrise is displayed for information but is not counted as the next obligatory prayer. Times use `America/Grenada`, not the visitor’s or server’s local timezone. The next-prayer calculation includes the following day, so it works after Isha.

When the pin cannot be read (for example the database is unreachable), the starts are replaced by "Prayer start times are temporarily unavailable." and iqamah times set as minutes after the adhan hide. When the iqamah times pass **Times end on** they are hidden, not presented as current; the dashboard reminds the board from 7 days before that date and keeps reminding after it until someone updates them. Public pages refresh operational content; a board edit does not require a deployment.

## What to say on the call

> The website can calculate daily prayer starts automatically without buying an API. We use the calculation that is normal for Grenada (Muslim World League, Standard Asr). We can separately configure your congregation schedule to use fixed times or approved intervals after the starts, and allow exceptions for particular dates. You retain control through the board dashboard. We are not asking you to enter six prayer times every day.

Precedence is: a time set for this date, then minutes after the adhan, then the fixed time. **Remove this date** removes a change. Invalid or out-of-order calculated results are not displayed.

For configuration and admin provisioning, use [the owner setup guide](owner-setup.md). Check that both prayer migrations are applied before telling the board the screen is ready.
