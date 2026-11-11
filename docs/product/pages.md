# Pages, sign-up forms and Qur'an verses

**Who uses it:** people in the Executive board group with a working login; visitors. **Where:** Dashboard → **Pages** (`/admin/pages`, one screen per page at `/admin/pages/<page>`), **Sign-up forms**, **Site-wide**, **Qur’an verses** (`/admin/pages/verses`); every public page's words, photos and sections, the header and footer, and each page's verse. **Related:** [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md), [restyle contract](../contracts/restyle-public.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md), [ADR 0026](../adr/0026-fixed-quran-verse-library.md), [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md); [Photos and uploads](photos.md), [Lists](lists.md).

## Why it exists

Every year a new board wants to reword the welcome, update the FAQ, open a volunteer form or change the email in the footer. None of that should need a developer (ADR 0002). Because these words speak for the whole club, only the elected Executive board changes them (ADR 0027).

## User stories

### Changing a page

- **US-PG-1.** As an Executive board member, I want to change the words and photos of any public page, so that the site says what this year's board wants.
  - Acceptance: **Pages** lists Home, About, Prayer & Musallah, Events page, Community page, Resources, Get involved, Sign-up forms, FAQ, Contact, Support, Go2Pay receipt note, Site-wide, Merch and Qur’an verses, each with "Last saved by … on …" or "Starter text, not changed yet." (PR5b D-6, D-22).
  - Each page opens as its top (always first) and its sections; **Edit** opens a section's boxes, **Close** folds them. Every box shows a grey example that is never saved (PR5b D-26).
  - **Save page** puts the change on the website on the next page load, no deploy (ADR 0024).
- **US-PG-2.** As an Executive board member, I want to hide, show and reorder sections of a page, so that the page fits what the club is doing now.
  - Acceptance: untick **Show this section on the page** to hide one ("Hidden"); its words are kept. Drag ⠿ (or the arrow keys) to reorder; **Save page** saves the order (PR5b review 3 B amendment). A band section is "Always last on the page."
  - A section whose content comes from elsewhere says so: "Its content comes from …" (another screen) or "Its words are fixed: ask the site owner to change them."
- **US-PG-3.** As an Executive board member, I want words that show on two pages to be edited once, so that they never disagree.
  - Acceptance: a shared section is labelled "Shared · also on (pages)" on every page that shows it; editing it on any of them changes it everywhere (PR5b shared text, option A).
- **US-PG-4.** As an Executive board member, I want to see the whole page before saving, so that I know how it will look.
  - Acceptance: the eye button opens the real page with the typed words at Desktop, Tablet or Phone width, scrolled to the section opened last; **Preview the page** switches to the other pages that show shared words (PR5a D-32; PR5b review 3 B, option A).
  - When the save would be refused, the Preview lists the same problems instead of the page (PR5b E-15).
- **US-PG-5.** As an Executive board member, I want to undo a bad save, so that a mistake is never permanent.
  - Acceptance: **History** under each page shows the last 5 changes, then **Show more**; **Restore the version before this change** asks "Restore this version?" with a preview of the page as it would be, then puts it back with "The earlier text is back on the website. Photos replaced since then stay as they are now." (PR5b D-12, E-8 and review 3 D amendment). The restore is itself in History and Recent changes.

### Sign-up forms

- **US-PG-6.** As an Executive board member, I want to paste each Google Form's link and open or close it, so that students sign up only while we are taking names.
  - Acceptance: **Sign-up forms** lists each form with **Form**, **Link**, **Open** and **Short description**, and "Shows on: (page)" (PR5b D-7, D-13). A short Google Forms how-to sits beside the list (PR5b D-13, D-25).
  - Only Google Forms links are accepted: "Sign-up link: use a Google Forms link (docs.google.com/forms/… or forms.gle/…)." (PR5b D-25).
  - A closed form, or one with no link, shows no button on the site (PR5b E-16; review fixes P3, no "coming soon").
  - Answers stay in the board's Google account; the site stores none (ADR 0014).

### FAQ and site-wide details

- **US-PG-7.** As an Executive board member, I want to add, reword, reorder and remove FAQ questions, so that new students find answers.
  - Acceptance: Pages → FAQ → **Questions**: **+ Add …**, **Remove**, drag ⠿ to reorder; **Save page** saves the order too. Home's **Common questions** shows the same questions, labelled shared (PR5b review-fixes PR-2 and option A amendments).
- **US-PG-8.** As an Executive board member, I want to change the club's name, tagline, email and social links in one place, so that the header, footer and link previews follow.
  - Acceptance: Pages → **Site-wide** (**Organisation**, **Social links**, **Search engines**); "Appears on: every page" (PR5b D-22; site essentials).
- **US-PG-9.** As an Executive board member, I want to switch the Support page on or off, so that it shows only when SGU offers the service.
  - Acceptance: Pages → Support → **Show the Support page on the website** (PR5b D-22; restyle D-10: off today).

### Qur'an verses

- **US-PG-10.** As an Executive board member, I want to choose the verse each place shows, without typing Qur'an text, so that the text is always exact.
  - Acceptance: **Qur’an verses** shows each place with its verse (Arabic, meaning, name) and **Change verse** / **Choose a verse** / **No verse**. **Find a verse in the library** takes a verse number ("94:5"), a surah number ("94") or a word in English or Arabic typed without harakat; **Use this verse** sets it; **Save verse choices** saves (ADR 0026).
  - Visitors see the whole verse on one line, with its reference and "Translation: Saheeh International" in its "?" tip (ADR 0026; PR5b E-18). Preview, History and Restore work as on any page.

## Rules

- Only people in the Executive board group, whose People entry is current and whose login is not turned off, edit Pages, Sign-up forms, Site-wide, Qur’an verses and the Go2Pay receipt note. The database decides; there is no tick-box. Moving someone into or out of the Executive board gives or takes it at once (ADR 0027).
- Everyone else does not see the Pages card; the Pages screens send them back to the dashboard, and help says "Only people in the Executive board can change pages." (PR5b review 3 B).
- Text shows as typed, with no HTML or formatting; links go to a page of this site, a file under `/documents/`, or an `https://` address (social links may also be `mailto:`) (PR5b Design).
- At most 3 new photos per save: "Add up to 3 new photos per save, then save again." (PR5b Failure Modes).
- A required box left empty is refused on that box, and **Save page** shows "Some boxes need fixing."; an empty optional box hides that part of the page. In a hidden section an empty required box is allowed, except a photo or a choice (PR5b review 3 B).
- The verse library is fixed: about 1,655 whole verses short enough for one line; nobody can add or change one. Long verses such as 2:255 cannot be chosen (ADR 0026).
- Developer-only, by decision: the menu and footer links, the logo, the privacy page, the dhikr of the hour and the tasbih, and fixed system wording (PR5b D-22, E-11; ADR 0026).

## Edge cases

| Case                                                                    | What should happen                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two Executive members save the same page                                | The second: "Someone else changed this; reload before trying again." Typed text stays (PR5b Failure Modes).                                             |
| A save that also changes shared words                                   | The page and every shared text it changed save together, or none do (PR5b dashboard polish amendment).                                                  |
| Session expires mid-edit                                                | "Your session expired or access was removed. Sign in again." Nothing is saved.                                                                          |
| Bad connection on Save                                                  | "Could not save. Check your connection and try again." Typed text stays; chosen photos must be chosen again ("Choose the photos again before saving."). |
| Page opened before a site update, saved after                           | "This page is out of date. Reload it and try again."                                                                                                    |
| A required box emptied by mistake                                       | Refused; nothing falls back to old text (PR5b Failure Modes).                                                                                           |
| Restoring a version that would show a section with empty required boxes | Refused: "(Section): fill in its required boxes before showing it."                                                                                     |
| A wrong save noticed next week                                          | History → Restore. Restore never deletes a photo or a log entry (PR5b review 3 D).                                                                      |
| Long text                                                               | Each box has its own limit (for example 400 characters for a note) and says so when refused.                                                            |
| Arabic text                                                             | Typed Arabic shows as typed; Qur'an text is never typed, only chosen (ADR 0026).                                                                        |
| A page photo is also used elsewhere                                     | Replacing it here leaves the other place unchanged; the Photos screen refuses to delete a file still in use ([Photos and uploads](photos.md)).          |
| Hand-over to a new Executive board                                      | Each new member can edit Pages as soon as People has them in the Executive board with a login; outgoing members lose it when moved out (ADR 0027).      |
| Database unreachable                                                    | Visitors see the starter text; the editor says "This page's text could not be loaded. Check your connection and reload." (PR5b Failure Modes).          |
| A sign-up form's link is wrong                                          | Untick **Open** and **Save page**: the button is gone on the next page load; fix the link, then open it again.                                          |

## Known gaps

- **Donate's opening words are not in Pages** yet: the Donate page does not read them, so Pages → Donate stays hidden until it does (PR5b E-19; roadmap PR6 row). No ticket yet.
- **"Nobody can edit pages: add an executive" never shows.** The bell shows it only to people who can manage people, and only Executive board members with a login can hold that permission, so whenever someone could see it, someone can edit Pages (ADR 0027; release checklist, notifications bell). No ticket yet.

## Open questions

- Who should see the "Nobody can edit pages" warning, so that it can actually appear (for example every board member, or the site owner's email)?
- **Support verse:** "Verse on each page" has a Support place, but the Support page draws no verse. Show it on `/support`, or remove the place? (release checklist "Needs your confirmation", PR5b Support verse).
- **Starter verses:** approve the pre-filled verse of each place, or name another (release checklist, review 3 E).
