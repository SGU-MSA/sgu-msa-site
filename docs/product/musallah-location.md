# Musallah location

**Who uses it:** every board member with a dashboard login (equal admins, [ADR 0007](../adr/0007-people-and-permissions.md)); the Executive board for the written directions ([ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md)); visitors. **Where:** Dashboard → **Prayer & iqamah** → **Musallah location**; the **Find us on campus** box on Home, **Prayer & Musallah** (`/prayer`) and Contact. **Related:** [PR7 contract](../contracts/pr7-single-pin-map.md), [ADR 0009](../adr/0009-free-tools-only.md), [ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md), [ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md), [Prayer and iqamah times](prayer-times.md).

## Why it exists

New students, parents and guests need to find a small musallah on a large campus. One pin, set by the board, gives a map, walking directions in the phone's own map app, and the place the prayer begin times are worked out for. One pin means the three can never disagree, and no developer is needed if the entrance moves.

## User stories

### Setting the pin

- **US-PIN-1.** As a board member, I want to move the musallah pin from my phone, so that the map, the directions and the prayer times follow the real entrance.
  - Acceptance: on a 390 px phone, in **Musallah location** I drag the dot with one finger, press **Save location** and see "✓ Saved", which fades.
  - Acceptance: on the next page load, the public map, both directions buttons and the prayer begin times use the new pin; nobody redeploys.
  - Acceptance: **Recent changes** shows who moved it, and the old and new place.
  - Acceptance: saving the pin and saving prayer settings never block each other, and a prayer **History** restore never moves the pin (PR7 D-4).
- **US-PIN-2.** As a board member, I want to try the directions, so that I know they lead to the door.
  - Acceptance: **Try Google Maps directions ↗** and **Try Apple Maps directions ↗** open walking directions to the saved pin in a new tab.
- **US-PIN-3.** As a board member, I want the screen to stop me putting the pin somewhere wrong, so that visitors are never sent off campus.
  - Acceptance: a dot dropped too far from the SGU campus jumps back with "The pin must be on or near the SGU campus. Drag it back onto the campus." and nothing is saved.
  - Acceptance: the server and the database refuse such a pin too, whatever the page sent.
- **US-PIN-4.** As a board member, I want to undo a pin I moved by mistake, so that one slip does not misdirect visitors.
  - Acceptance: a moved but unsaved dot is not on the site; leaving the page asks **Leave without saving?** (PR4 D-7 amendment).
  - Acceptance: after a mistaken save, **Recent changes** shows the earlier place, and I drag the dot back and save (no restore button, PR7 E-3).
- **US-PIN-5.** As a board member using a keyboard, I want to move the dot without a mouse, so that the control works for everyone.
  - Acceptance: after clicking the dot, the arrow keys move it about 2 m per press (20 m with Shift); a screen reader hears "Pin moved, not saved yet."

### Visitors

- **US-PIN-6.** As a visitor, I want to see where the musallah is on campus, so that I can find it the first time.
  - Acceptance: **Find us on campus** shows a map in the site's paper colours, light and dark, with street names and campus building names (Charter Hall, Founders Library…), a small dot and a small "SGU Musallah" tag; no satellite.
  - Acceptance: the map loads by itself as the box scrolls near the screen; on a phone one finger scrolls the page and two fingers move the map.
  - Acceptance: the only credit is a small collapsed ⓘ that shows "© OpenStreetMap contributors · OpenFreeMap" when tapped.
- **US-PIN-7.** As a visitor, I want directions in the map app I already use, so that my phone walks me there.
  - Acceptance: under **Get directions**, an iPhone, iPad or Mac shows **Apple Maps** then **Google Maps**; every other device shows **Google Maps** only; both give walking directions to the same pin.
- **US-PIN-8.** As a visitor on a slow plan or an old phone, I want directions even without the map, so that I am never stuck.
  - Acceptance: with Save-Data on the box says "Map hidden to save data." and downloads no map; if the map fails it says "The map can’t be shown right now."; either way the buttons and written directions still show.

## Rules

- One pin only: no other points (wudu, parking, food), no route video, no search box, never the visitor's own location (PR7 D-1, non-goals).
- The pin is the single source for the map, the directions and the prayer begin times (PR7 D-1; [ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md)). Moving it anywhere on campus shifts begin times by seconds, not minutes (PR7 Design).
- Any board member can move it, in its own section with its own **Save location** (PR7 D-4). Dragging only, no coordinate boxes (D-5).
- **Grenada bounds:** a pin must be inside latitude 11.95 to 12.531 and longitude −61.85 to −61.37: the main island, Carriacou and Petite Martinique, not Petit St. Vincent or Union Island (PR7 D-9). A fixed safety rule, not a board setting.
- **Near campus:** since review fixes P4 the pin must also be within about 1.5 km of the starting pin, checked in the browser, the server and the database ([release checklist](../release-checklist.md), review fixes P4; size and centre still to confirm).
- Starting pin: Google's "MSA Mosque" place, 12.0025521, −61.7723834, given by the maintainer; a board member confirms it at the entrance (PR7 D-3).
- Free tools only: MapLibre with OpenFreeMap tiles; no key, no account, no Google or Apple embed, no satellite ([ADR 0009](../adr/0009-free-tools-only.md); PR7 D-2, D-12, D-14). Look: the site's colours plus campus names (PR7 P-4).
- The map loads only when its box comes near the screen, and never with Save-Data (PR7 D-6, E-10). The Privacy page says that OpenFreeMap sees the visitor's internet address (D-10).
- Directions go to the pin, walking, with no link to the Google place (PR7 D-7, D-8).
- The pin is cached until a board save, which clears it ([ADR 0024](../adr/0024-cache-components-cached-page-text-fresh-per-visit.md); PR7 amendment).
- The written directions are page text in **Pages → Prayer & Musallah**, edited by the Executive board ([ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md)). A missing building name is added on OpenStreetMap and shows within a day.
- The Google listing is claimed on Google with the MSA Gmail after asking SGU, outside the dashboard (PR7 D-11); the steps live in the handbook ([ADR 0028](../adr/0028-board-how-to-in-one-handbook.md)).

## Edge cases

| Case | What should happen |
| --- | --- |
| Pin moved by mistake while scrolling the editor | Nothing changes publicly until **Save location**; leaving asks **Leave without saving?**; a saved slip is undone by dragging back (Recent changes shows the old place). |
| Dot dropped far away (zoomed out) | It jumps back to its last allowed place with the campus line; nothing is posted. |
| Two editors at once | The later save says "Someone else saved the location first. Reload to see it, then try again." |
| Session expires mid-edit | "Your session expired or access was removed. Sign in again."; nothing is saved. |
| Pin cannot be read (public) | The box says "The map can’t be loaded right now. Please use the written directions." with no buttons; prayer begin times say "Prayer start times are temporarily unavailable." |
| Pin cannot be read (dashboard) | "The musallah location could not be loaded. Check your connection and reload." with no form, so nothing is saved over an unknown place. |
| Map fails in the editor (OpenFreeMap down, no WebGL) | "The map can’t be shown right now."; the pin cannot be moved until the map works (drag only, D-5). |
| Older Apple device (before iOS 18.4) | Apple Maps may open without the route; the Google Maps button beside it still works (PR7 E-5). |
| Device guessed wrongly | Worst case an Apple user sees Google only, or another device also sees Apple Maps on the web; both reach the pin. |
| Stale pin on the public site | A save clears the cached pin; the next load uses the new one. |

## Known gaps

No tickets are filed for these yet.

- A pin move is not highlighted in **Recent changes**, although it moves where visitors are sent and changes prayer times; ADR 0013 highlights prayer changes, and PR7 E-4 planned to add the pin later.
- The **Show me how** step "Save location" still says "A dot dropped outside Grenada jumps back.", but the rule is now about 1.5 km from campus.

## Open questions

1. Is the pin circle right: about 1.5 km around 12.0025521, −61.7723834 (release checklist, review fixes P4: "Say if another centre or size is better")?
2. Has a board member confirmed on site that the starting pin is at the musallah entrance (release checklist, PR7 D-3)?
3. Once the Google listing "MSA Mosque" is claimed and corrected (D-11), should the directions also link the Google place (D-8 says it can be added later)?
