# Photos and uploads

**Who uses it:** every board member with a login; the Executive board for page photos; visitors. **Where:** every photo box in the dashboard (events, announcements, community news, people, Pages, merch, season pages), the newsletter file box, and Dashboard → **Photos** (`/admin/photos`). **Related:** [PR5a contract](../contracts/pr5a-notices-events-continuity.md) (photo library amendment, D-4, D-21, D-28, D-29), [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md), [ADR 0013](../adr/0013-activity-log-archive-and-history.md), [ADR 0014](../adr/0014-no-stored-member-data-forms-as-links.md), [ADR 0025](../adr/0025-team-list-without-consent-records.md), [ADR 0009](../adr/0009-free-tools-only.md), [photography guide](../guides/photography.md), [admin UX gate](../../.agents/skills/reviewing-engineering-changes/references/admin-ux-gate.md); [People](people.md), [Pages](pages.md).

## Why it exists

Real photos of the Musallah, events and the team make the site feel like the club. Board members take them on phones, often large HEIC files, on campus Wi-Fi. Uploading must just work, the free storage (about 1 GB) must not fill up unseen, and a photo someone wants taken down must be removable (ADR 0009, ADR 0013).

## User stories

### Uploading

- **US-PH-1.** As a board member, I want to upload a photo straight from my phone, so that I do not have to resize it first.
  - Acceptance: the photo is made smaller on the phone before upload (longest side 1,600 px, turned upright) with no message about it; **Save** waits while that happens; the server checks it again and stores it (PR5a D-4, D-28).
  - The box says "JPEG, PNG, or WebP; maximum 3 MB." Only a real problem shows a line, for example "This photo could not be made smaller on this device. If it is over 3 MB, take a screenshot of it or share it as JPEG."
- **US-PH-2.** As a board member with an iPhone or Android photo in HEIC format, I want a clear answer when it cannot be used, so that I know what to do.
  - Acceptance: iPhone and iPad browsers turn HEIC into JPEG by themselves (checked by hand on real devices: the release checklist's device table, PR5a E-27). A browser that cannot open HEIC stops the save with "This photo is in HEIC format, which this browser can't open. Share it from the phone as JPEG (or take a screenshot), then choose it again." Nothing is uploaded and typed text stays (PR5a D-29). No converter is added.
- **US-PH-3.** As a board member, I want to describe each picture, so that people using screen readers know what it shows.
  - Acceptance: **Describe the picture** ("One sentence, for people using screen readers.") is required once an item has a picture: "Describe the picture: write one sentence about the picture for people who cannot see it." (PR4 D-7).
- **US-PH-4.** As a board member, I want to reuse a photo already on the site, so that I do not upload the same file twice.
  - Acceptance: **Choose from uploaded photos** on every photo box opens "Uploaded photos", each named by where it is first used; clicking one uses that stored file ("Chosen from uploaded photos."), with **Undo**; nothing is uploaded again (PR5a photo library amendment).

### Seeing and freeing space

- **US-PH-5.** As a board member, I want to see every uploaded file and where it is used, so that I know what is safe to remove.
  - Acceptance: **Photos** lists every photo and PDF, newest first, with its picture (a PDF shows a file icon), "Uploaded (day) · (size)" and **Used on:** with a link to each event, announcement, community news, newsletter, person, page, season page or merch item that uses it; archived ones are marked "(archived)"; otherwise "Not used anywhere" (PR5a photo library amendment).
  - On top: "Space used: … of 1 GB (…%)" with a bar; from 80% full, "Space is running out. Delete photos and PDFs nothing uses." The bell lists photo space too (daily check).
- **US-PH-6.** As a board member, I want to delete a file nothing uses, so that space is freed.
  - Acceptance: **Delete** shows only on a file nothing uses and asks "Delete this file?" ("Nothing on the website uses it. Once deleted, it can't be brought back."). The server checks again; a file in use is refused: "This file is still used somewhere, so it can't be deleted. Reload to see where." (PR5a photo library amendment).
- **US-PH-7.** As a board member who can manage people, I want to clear a finished term's photos after keeping a copy, so that space never runs out.
  - Acceptance: **Term export** downloads a term's records with their photos and PDFs as a zip; **Free up space** then removes only the files of archived items from those days, after the tick "I opened the zip and can see the photos". The items stay in Archived with their words; files another item still uses stay (term export, review fixes P5).

### Privacy

- **US-PH-8.** As a board member, I want a photo to be private until its item is public, so that drafts and archived items do not leak.
  - Acceptance: visitors reach a file only while an item they can see uses it; archiving an item takes its picture off the website; board members see every file through the dashboard only (PR5a photo library amendment; ADR 0013).
- **US-PH-9.** As a board member who can manage people, I want to remove a photo for good when someone asks, so that we respect their wish.
  - Acceptance: archive the item, then in the Archived tab delete it permanently by typing DELETE; its picture is deleted too unless another item uses it; the delete is logged (ADR 0013). A person's photo is handled in [People](people.md).

## Rules

- Any board member uploads and deletes unused files; page photos are uploaded only by the Executive board (ADR 0027); only "manage people" holders delete permanently or free up a term's space (ADR 0013; term export).
- Each upload is at most 3 MB. Photos are JPEG, PNG or WebP; newsletters may also be PDF. The site stores photos as WebP (PR5a Source of Truth; [photography guide](../guides/photography.md)).
- At most 3 new photos per save of a page; up to 12 photos on a merch item or a season page (photo limits).
- No photo-consent records or tick-boxes on events, posts, news or merch (PR5a D-21; ADR 0025). The board checks permission before uploading recognisable people, as the [photography guide](../guides/photography.md) asks.
- A full-size viewer opens merch photos only (PR5a D-21). Images fit their kind: portraits a fixed crop, flyers shown whole, logos contained (admin UX gate rule 12).
- Every public picture except the logo can be changed from the dashboard (PR5a photo library amendment).

## Edge cases

| Case                                                  | What should happen                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Photo over 3 MB that the phone cannot shrink          | The line above asks for a screenshot or JPEG; the server refuses anything over 3 MB: "Each upload must be 3 MB or smaller."                  |
| HEIC on Android or desktop Chrome                     | The save stops with the HEIC line; nothing is uploaded (PR5a D-29).                                                                          |
| Save refused for another box after a photo was chosen | The photo must be chosen again: "Choose the … again before saving."; typed text stays.                                                       |
| Bad connection while uploading                        | "Could not save. Check your connection and try again."; typed text stays and the photo must be chosen again.                                 |
| Four new photos in one page save                      | "Add up to 3 new photos per save, then save again."                                                                                          |
| Deleting a photo an archived item uses                | Not offered: it is still used. Free it through Term export or a permanent delete.                                                            |
| A replaced photo                                      | The old file is removed once nothing names it; a file still used elsewhere stays.                                                            |
| History restore of a page                             | Words come back; photos replaced since then stay as they are now (PR5b E-8).                                                                 |
| Photos screen cannot read every list                  | It says "Photos could not be loaded. Check your connection and reload." rather than showing a file as unused (PR5a photo library amendment). |
| Storage nearly full                                   | The 80% warning and the bell line appear and go away by themselves once space is freed (admin UX gate rule 8).                               |
| Nothing uploaded yet                                  | "No photos or PDFs uploaded yet."                                                                                                            |

## Known gaps

- The [photography guide](../guides/photography.md)'s "Putting them on the site" section is out of date: it says homepage and editorial photos need a developer, but since the photo library change every public picture except the logo is changed from the dashboard (PR5a photo library amendment). No ticket yet.

## Open questions

- An event, announcement or news post with a picture has no **Remove** for it: the board can replace the picture, or archive the whole item. Should these boxes get a remove choice, as page photo boxes have ("Remove photo")?
