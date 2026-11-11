# Community news

**Who uses it:** every board member with a login; visitors. **Where:** Dashboard → **Community news** (`/admin/content/news_posts`); Community updates (`/community`), Home's community updates and each post's page (`/community/news_posts/<id>`). **Related:** [PR4 contract](../contracts/pr4-dashboard-simplification-onboarding.md), [PR5a contract](../contracts/pr5a-notices-events-continuity.md), [restyle contract](../contracts/restyle-public.md), [site essentials](../contracts/site-essentials.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md); [Announcements](announcements.md), [Photos and uploads](photos.md).

## Why it exists

After an event the board wants to say thank you, show a few photos and keep a record of the club's year. News is the calm side of Community updates: stories, not alerts. It must be as easy as a social media post, from a phone, with no developer.

## User stories

### Writing a post

- **US-NW-1.** As a board member, I want to write a post with a headline, a summary and the story, so that students can read what the club has been doing.
  - Acceptance: **Create new** opens **Headline**, **One-line summary**, **Full story**, **Date** ("A future date publishes it on that day."), **Picture (optional)**, **Describe the picture**, **Link (optional)**, **Pin to the top of Community updates**, **More options** (with **Hide after (optional)**) and **Who can see it?** (PR4 D-7, design C). Every box shows a grey example that is never saved (PR5a D-26).
  - With **Everyone on the website**, **Save** shows it in Community updates on the next page load, with no deploy (ADR 0024).
- **US-NW-2.** As a board member, I want to add a photo from my phone, so that the post looks like the event did.
  - Acceptance: the photo is made smaller on the phone before upload, silently (PR5a D-4, D-28); **Describe the picture** is required once there is a picture: "Describe the picture: write one sentence about the picture for people who cannot see it."
  - **Choose from uploaded photos** reuses a photo already on the site, without uploading it again (PR5a photo library amendment). See [Photos and uploads](photos.md).
- **US-NW-3.** As a board member, I want to write a post now and have it appear later, so that I can prepare it ahead.
  - Acceptance: a future **Date** keeps the post off the site until that day, then it appears by itself.
- **US-NW-4.** As a board member, I want to see the post page before I save, so that I catch mistakes.
  - Acceptance: the eye button opens a full-screen Preview of the real post page with the unsaved values, at Desktop, Tablet or Phone width (PR5a D-32).
- **US-NW-5.** As a board member, I want to keep one post at the top for a while, so that an important story is seen first.
  - Acceptance: **Pin to the top of Community updates** puts it first in Community updates and on Home (PR4 design C). **Hide after (optional)**, under **More options**, takes it off the site after that day; **More options** opens by itself when it has a date (release checklist, PR4).

### Reading news (visitors)

- **US-NW-6.** As a visitor, I want the club's news and notices in one place, so that I do not miss anything.
  - Acceptance: Community updates is a front page: the top update (pinned first, then newest) is the lead story, then the rest, newest first; each is marked "Community news" or "Announcement" (restyle D-4). Home shows the first three, in the same order.
  - A post's page shows its photo, the story in paragraphs (a blank line starts a new one), a **Learn more** button when it has a link, and its Qur'an verse (Pages → Qur’an verses).
- **US-NW-7.** As a visitor, I want a shared post link to preview well in WhatsApp, so that friends click it.
  - Acceptance: the card shows the club's short name, "Community news", the headline and the summary (site essentials Design).

### Fixing and removing

- **US-NW-8.** As a board member, I want to take a post down that was published by mistake, so that it is off the site at once.
  - Acceptance: **Only the board (draft)** and **Save**, or **Archive**: off the website on the next page load.
- **US-NW-9.** As a board member, I want to archive old posts, so that the page stays current but the history is kept.
  - Acceptance: **Archive** takes the post and its picture off the website and moves it to the Archived tab; **Restore** brings it back as an unpublished draft; only "manage people" holders delete one permanently, from Archived, by typing DELETE (ADR 0013).

## Rules

- Any board member with a login writes, edits, archives and restores posts; changes go live at once with no approval step (ADR 0007, ADR 0013). Every change is in Recent changes.
- A post shows from its **Date** to its **Hide after** day, while published and not archived (the database decides; PR5a Source of Truth).
- Text shows as typed: no formatting, links or HTML inside the story (PR5b Design).
- Links must start with `https://`: "Link: use a secure web address (starting with https://)."
- No Hijri dates on posts (restyle D-11). Post photos open no full-size viewer and have no consent features (PR5a D-21).
- Posts cannot be urgent or featured on Home's strip: that is what [Announcements](announcements.md) are for (PR4 design C; PR5a D-1).

## Edge cases

| Case                                       | What should happen                                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two posts pinned                           | Both sit at the top, newest first, above the rest.                                                                                                                                 |
| **Hide after** before **Date**             | Refused: "Hide after: choose the item's date or a later one."                                                                                                                      |
| Picture without a description              | Refused on **Describe the picture**; typed text stays.                                                                                                                             |
| Two board members edit one post            | The second Save: "Someone else changed this; reload before trying again." Typed text stays.                                                                                        |
| Session expires while writing a long story | "Your session expired or access was removed. Sign in again." Nothing is saved; typed text stays on screen.                                                                         |
| Bad phone connection on Save               | "Could not save. Check your connection and try again." Typed text stays; the photo must be chosen again.                                                                           |
| Leaving the page with unsaved text         | "Leave without saving?" with **Save**, **Discard**, **Keep editing**.                                                                                                              |
| Very long story                            | Up to 20,000 characters; **Headline** up to 160; **One-line summary** up to 500. The list shows the summary, or the start of the story when there is no summary.                   |
| Arabic in the headline or story            | Shown on the site as typed; the link-preview card leaves Arabic out (site essentials D-10).                                                                                        |
| Photo of a person who asks to be removed   | Archive the post, then a "manage people" holder deletes it permanently (ADR 0013). See [Photos and uploads](photos.md).                                                            |
| Old link to an archived or hidden post     | Its page is not found ("Update not found"); the rest of the site is unaffected.                                                                                                    |
| Database unreachable                       | Community updates says "Some updates are temporarily unavailable. Please try again shortly." and keeps what did load.                                                              |
| Nothing published yet                      | Community updates shows the board's own empty line (Pages → Community page → **Updates list**).                                                                                    |
| New board term                             | Old posts stay as the club's record; Term export (by "manage people" holders) downloads a term's posts and photos, then **Free up space** can remove the photos of archived posts. |

## Known gaps

None known.

## Open questions

None.
