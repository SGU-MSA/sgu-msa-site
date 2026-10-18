---
status: approved
mode: full
---

# PR7: Single-pin map (implementation contract)

**Approved: user answers 2026-10-05** (`.plans/answers-2026-10-05.md`, round 1 Q46–Q55 and round 2 Q5, "yes go with recommended"). Every product decision is answered; nothing in PR7 waits for the user. Delivered as two PRs against `integration`: **PR-A** (this contract copied here, WP-1, WP-2, WP-3) and **PR-B** (WP-4, WP-5, WP-7). WP-6 is written only after the PR7 release is live (Compatibility and Migration step 6).

Read again on `origin/integration` @ dbfeb66 for PR-A: `202610070001` is PR5a's `notices_events_handover` migration (it re-creates `record_activity`; PR6's payments migration is not merged yet), so WP-1 takes `202610110001`, after every file in the folder and the parallel drafts, and still never touches `record_activity`.

Workflow checklist: [x] 1 Scope · [x] 2 Inspect · [x] 3 Capability/owner · [x] 4 Duplication · [x] 5 Sources of truth · [x] 6 Reuse · [x] 7 Beyond happy path · [x] 8 Product decisions (P-1–P-10 answered or decided 2026-10-05 as D-4–D-15; P-4 = 3 + campus names with a dot and small tag, approved by the user 2026-10-05) · [x] 9 Parallel work · [x] 10 Contract · [x] 11 Validate

Revision 1 (2026-10-04), written while the user was away.

**Revision 3 (2026-10-05, answer sheet 2, Q5):** the user said "no satellite please" and liked 1 (standard), 2 (light grey), 3 (Quiet Paper) and 3 + campus names most, and asked which we think is best (the sheet's tick said 1). Satellite options 4, 5 and 5 + campus names are dropped, and with them Esri, `ESRI_BASEMAP_KEY`, the Esri CSP host and privacy line, the owner's Esri account step, and the "Map / Satellite" switch (D-14). P-4 now chooses among the user's four; our recommendation is 3 + campus names with the dot and a small "SGU Musallah" tag, **approved by the user 2026-10-05**.

**Revision 2 (2026-10-05): the user's answers folded in** (`.plans/answers-2026-10-05.md`, Q46–Q55; Q-numbers point at `.plans/questions-for-user.md`):

- The pin is moved in a **"Musallah location" section inside Prayer & iqamah** (Q46 B), by **dragging only** (Q47 C). The pin keeps its own table and its own Save, so a prayer History restore never moves it.
- The public map **loads by itself when the box scrolls into view** (Q48, decided by us as a performance choice); the "Show the map" button is gone and the privacy page wording changes.
- **Map look is still open** (Q49): the user wants street and building names, a small dot (no big ink circle, small or no label). Satellite was ruled out in rev 3 (D-14). Options with real tiles: `.plans/mockups/pr7-styles/`.
- **Strict Grenada check** with a stated box that covers Grenada, Carriacou and Petite Martinique (Q52). Directions: pin only, no Google place link (Q51 A). `maplibre-gl` approved (Q55, decided by us). Google listing: claim it after asking SGU (Q54 A).

Mockups (real OpenFreeMap tiles in Quiet Paper colours; HTML + PNG): `.plans/mockups/pr7/`

- `public-map-light-desktop.png`, `public-map-dark-desktop.png`, `public-map-light-phone.png`, `public-map-dark-phone.png`: the "Find us on campus" box after the map is shown.
- `public-map-before-tap-light-phone.png`: superseded (the map now loads by itself when scrolled into view, D-6).
- `directions-apple-vs-other.png`: an iPhone shows Apple Maps and Google Maps; an Android phone shows Google Maps only.
- `pin-editor-light.png`, `pin-editor-dark.png`: the pin editor as first drawn (own screen, coordinates box). Superseded in layout by D-4/D-5 (a section inside Prayer & iqamah, drag only); the map part stays as drawn until P-4 is answered.
- `pin-section-light.png`, `pin-section-dark.png` (+ `pin-section.html`): the decided editor, a "Musallah location" section inside Prayer & iqamah, drag only, small dot (D-4, D-5; the map look follows P-4).
- Map look options (P-4, Q49), real tiles at the pin: `.plans/mockups/pr7-styles/` (`liberty-*`, `positron-*`, `paper-*`, `paper-campus-*`, desktop and phone, plus `index.html`). The `satellite-*`, `hybrid-*` and `eox-*` pictures are history only (D-14).

## Capability

**One board-managed musallah location** (a single stored pin) that is the only source for:

1. the public map;
2. the Apple Maps and Google Maps directions links;
3. the coordinates used by the fixed prayer calculation (ADR 0017).

It replaces the `MUSALLAH_LOCATION_CONFIRMED` / `MUSALLAH_LATITUDE` / `MUSALLAH_LONGITUDE` settings, the OpenStreetMap iframe, and the latitude and longitude boxes on the Prayer & iqamah screen.

## Requested Behavior

From the user's D0 decision D20 (`.plans/d0-board-task-inventory.md` rows #49, #50, #6; roadmap PR7 row), ADR 0009, ADR 0017, the PR4 contract and the user's message of 2026-10-04:

- **One pin, nothing else.** No route video (already removed in the cleanup) and no other points of interest (D20 rejected wudu, parking and halal-food pins).
- **Board-editable.** Any admin moves the pin from the dashboard, with no developer and no redeploy. Every change is in Recent changes.
- **Single source.** The pin feeds the map, the directions and the prayer start times. The `MUSALLAH_*` settings are retired.
- **Device-aware Get directions.** Apple devices (iPhone, iPad, Mac) show **both** an Apple Maps and a Google Maps button. Every other device shows Google Maps only.
- **Free tools.** MapLibre GL JS with OpenFreeMap tiles (ADR 0009). No API key, no account, no Google Maps embed, no satellite (D-14).
- **Look (P-4, decided: 3 + campus names).** Street and nearby building names visible, a small dot for the pin (no big ink circle; a small label or none), in light and dark; no satellite (D-14). Shared components (`ButtonLink`, tokens) as before.
- **Database clean-up.** Drop the retired prayer columns (`confirmed`, `method`, `madhab`, `adjustments`, unused since PR4) together with `latitude`/`longitude` (PR4 contract, Compatibility and Migration step 3).
- **Starting pin (new fact, 2026-10-04).** The musallah is on Google Maps as **"MSA Mosque"** (https://maps.app.goo.gl/Sqtt3nAs21LQZPWn6): 12.0025521, -61.7723834; Google place ID `ChIJ10hHVwAhOIwRu8X9MFT4N0k`. It has no website, and its photos are not of the mosque. These coordinates are the starting pin (source: the user). They go on the release checklist for the board to confirm on site.
- **Owner/board guide** for fixing the Google listing: claim it, verify it, add the website and hours, add correct photos, report wrong ones, or use Suggest an edit without claiming. See Appendix A.

**Non-goals:**

- Search or geocoding in the editor.
- More than one pin.
- Showing the visitor's own location.
- Walking routes drawn on our map (the map apps do this).
- Google or Apple map embeds.
- Changing the prayer calculation method (ADR 0017).
- Restyling the rest of the dashboard (Track B).

**Acceptance criteria given by the user:** the D20 bullets above.

## Existing System Evidence

Read on `origin/integration` (6fcc29b). The main checkout currently holds another session's uncommitted PR6 WP-1/WP-2 changes, so those files are cited by symbol and not edited here.

- `src/lib/maps/providers/contract.ts` `PlacesProvider.musallahEntrance()`, `Place`: a read port that already says "PR7 adds the board-edited pin behind this same port". Results carry `unavailable` and `provenance`.
- `src/lib/maps/providers/config.ts` `createConfigPlacesProvider`: the only adapter. It serves `RuntimeConfig.musallahEntrance`.
- `src/lib/maps/location.ts` `directionsLinks`:
  - Google: `https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`;
  - Apple: the legacy `https://maps.apple.com/?daddr=lat,lng&dirflg=w`;
  - an OpenStreetMap iframe URL.
- `src/lib/maps/index.ts` `musallahDirections()`: called only by `src/features/prayer/LocationMap.tsx`.
- `src/features/prayer/MapEmbed.tsx`: the client "Find us on campus" box. It has a click-to-load iframe, the placeholder "Your entrance pin goes here", and **both** links on every device.
- `LocationMap` is used in three places: `src/app/prayer/page.tsx` (Find the Musallah aside), `src/features/prayer/VisitSection.tsx` (home page "Your first visit") and `src/app/contact/page.tsx` (via `ContactCallingCard` `map` prop). The story is `src/features/contact/ContactCallingCard.stories.tsx`, which renders `MapEmbed`.
- `src/lib/runtime/config.ts`:
  - parses `MUSALLAH_LOCATION_CONFIRMED`, `MUSALLAH_LATITUDE` and `MUSALLAH_LONGITUDE` into `musallahEntrance`;
  - the `allowed` table lists the example values `12.0012` and `-61.7765`;
  - mirrors: `.env.example` lines 38–40, `README.md` line 19, `docs/guides/owner-setup.md` Required variables and §11, and the `docs/release-checklist.md` Settings section.
- `src/lib/runtime/wiring.ts` `Wiring.places: "config"`; `src/lib/runtime/providers.ts` `placesProvider()`.
- **Prayer coordinates today:**
  - `src/lib/prayer/calculate.ts` `calculatePrayers(settings, now)` reads only `settings.latitude`/`settings.longitude` and returns [] when either is null.
  - `src/lib/prayer/congregation.ts` `congregationTimes(settings, now)` calls it again internally for "after adhan" iqamah.
  - `calculatePrayers` is also called by `src/app/page.tsx:50`, `src/app/prayer/page.tsx:38` and `src/features/admin/actions.ts` `calculationProblem`. `congregationTimes` is called by `src/lib/community/managed.ts` `managedPrayer` and `src/app/admin/prayer-times/page.tsx` `today`.
  - So **the map and the prayer calculation use two different coordinate sources today** (env vs the `prayer_settings` row): the D0 audit finding #6.
- `src/lib/community/schema.ts`: `prayerSettingsObject.latitude/longitude` use the private `coordinate(field, limit)` helper (box-named refusals), and `emptyPrayer` holds nulls. `src/lib/prayer/congregation.ts` `prayerFormText`/`prayerFormValues` post `latitude`/`longitude`. `src/features/admin/actions.ts` `prayerFields` and `calculationProblem` cover the same fields.
- `src/features/admin/PrayerEditor.tsx` lines 395–430: the closed section "Musallah location for prayer times (until the map pin)" (PR4 D-3).
- `supabase/migrations/202609090001_community.sql` `prayer_settings`: `confirmed`, `latitude`, `longitude`, `method`, `madhab`, plus the check `not confirmed or (...)`. `202609110001_prayer_adjustments.sql` adds `adjustments`. `202610060001_prayer_simplification.sql` says "PR7's contract migration drops them".
- `supabase/migrations/202610050002_activity_log.sql` `record_activity(key, 'full'|'changes')` sets `highlight` only for `prayer_settings`. PR6's draft migration `202610070001_payments_seasons.sql` replaces `record_activity` (`.plans/pr6-go2pay-payments.md`), so PR7 must not touch that function.
- `src/lib/community/activity.ts`: `areaNames` (no entry for a location area yet). `fieldNames.latitude/longitude` already exist ("Latitude", "Longitude").
- `src/lib/backend/providers/contract.ts` `ContentEditor` (`readPrayer`, `savePrayerSettings` with `updated_at` versions, `Outcome`). Adapters: `supabase.ts`, `sample.ts`; sandbox state in `src/lib/demo/store.ts`, `demoPrayer` in `src/lib/demo/fixtures.ts` (12.05, -61.75, "a regional test").
- `next.config.ts` CSP: `connect-src 'self'`, `frame-src https://www.openstreetmap.org`, `img-src 'self' data: blob:`; no `worker-src`, so it falls back to `script-src 'self' …`.
- Shared UI: `src/shared/ui/ButtonLink.tsx` (`outline` variant, external arrow, `safeHref`), `src/shared/ui/InkRing.tsx` `InkRing`, `src/styles/tokens.css` (the only colour home). The admin uses the plain `.admin-shell`, `.content-card` and `.button-primary` styles in `src/app/globals.css`.
- Dashboard links: `src/app/admin/dashboard/page.tsx` cards. Tours: `src/features/admin/tour/steps.ts` `TourId`. Help: `src/features/admin/help-pictures.ts` + `npm run help:pictures`.
- Tests that touch this: `tests/places.test.ts`, `tests/runtime.test.ts` (coordinates), `tests/community.test.ts` and `tests/review.test.ts` (coordinates on prayer settings), `tests/prayer-migration.test.ts` (PGlite), `scripts/test-backend.ts` (RLS on local Supabase), `tests/e2e/demo.spec.ts`.
- Nothing installs MapLibre yet: no `maplibre-gl` in `package.json`. The current npm version is `maplibre-gl` 6.12.0, BSD-3-Clause, ESM only, with the worker set through `setWorkerUrl`.
- Live database rows (staging/production `prayer_settings.latitude/longitude`) and the Vercel `MUSALLAH_*` values were **not inspected**. No hosted connection was made and no `.env*` file was read. See "Prayer time effect" under Design.

## Owner

`src/lib/maps` owns the musallah location: the port, the adapters, the URL building and the region rule. Its data shape lives with the other dashboard-managed shapes in `src/lib/community/schema.ts` (AGENTS.md: zod schemas live there). Board writes go through the existing `ContentEditor` port and `src/features/admin/actions.ts` (the content save owner). The prayer calculation (`src/lib/prayer`) becomes a **consumer** of the place and stops owning coordinates. The shared map drawing (`PinMap`) lives in `src/shared/ui` because the public box (`src/features/prayer`) and the dashboard editor (`src/features/admin`) both use it. The editor is a section of the Prayer & iqamah screen (D-4) but keeps its own form, action and row.

## Source of Truth

| Rule or state                                             | Authority                                                                                                                                  | UX mirrors                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the musallah is                                     | New singleton row `public.musallah_location` (id = 1): `latitude`, `longitude`, `updated_at` (no Google place column, D-8)                 | `musallahPinSchema` (zod) refuses before the write                                                                                                        |
| Coordinates are numbers in range and inside Grenada (D-9) | Postgres `check` constraints on the table                                                                                                  | zod refinements with box-named messages; the region box is one named constant `GRENADA_BOUNDS` in `src/lib/maps/place.ts`, mirrored once in the migration |
| Who may change it                                         | RLS: `public_read` (select, anon + authenticated); `admin_insert` and `admin_update` (`is_admin()`); no delete grant                       | `currentAdmin()` in the action                                                                                                                            |
| Two editors saving at once                                | `updated_at` version check in the adapter                                                                                                  | "Someone else saved…" message                                                                                                                             |
| History of changes                                        | Existing `record_activity('id','full')` trigger, add-only log                                                                              | Recent changes feed (`areaNames.musallah_location`)                                                                                                       |
| Prayer starts' coordinates                                | The same row, read through `PlacesProvider`                                                                                                | none; `PrayerSettings` no longer has coordinates                                                                                                          |
| Prayer method                                             | `prayerCalculation` constant (ADR 0017), unchanged                                                                                         | none                                                                                                                                                      |
| Which directions buttons a device sees                    | The fixed D20 rule, as the pure function `isAppleDevice(userAgent)` in `src/lib/maps/device.ts` (critic: no touch-point argument, see E-6) | none                                                                                                                                                      |
| Map colours (only if P-4 = Quiet Paper recolour)          | New `--map-*` tokens in `src/styles/tokens.css` (light and dark)                                                                           | `PinMap` reads them at runtime; no colour values in TypeScript                                                                                            |
| Map style and tile source                                 | One constant per chosen style in `src/lib/maps/style.ts` (P-4)                                                                             | CSP `connect-src` lists exactly OpenFreeMap's host; the privacy page names it                                                                             |
| Campus building names (only if P-4 = 3 + campus names)    | OpenStreetMap, copied by our server at most once a day (no database table)                                                                 | none                                                                                                                                                      |
| Starting value                                            | The migration's seed row (the user's Google place coordinates, 2026-10-04)                                                                 | the release checklist "Needs your confirmation"                                                                                                           |

## Reuse and Duplication Analysis

- **Reused unchanged:**
  - `PlacesProvider` (the port, now with a stored-pin adapter);
  - `currentAdmin()`, `KeptFormState`/`keepTyped`/`issuesOf`, `FormMessages`, the `updated_at` version check and `Outcome`;
  - `revalidatePath("/", "layout")`;
  - `record_activity` (unchanged function, one new trigger);
  - `ButtonLink` (outline variant) for the directions buttons;
  - the Prayer & iqamah screen (`src/app/admin/prayer-times/page.tsx`) and its tour, `help-pictures.ts`;
  - `safeHref` via `ButtonLink`.
- **Extended:**
  - `ContentEditor`: `readMusallahPin()` and `saveMusallahPin(place, version)` on both adapters, as `readPrayer`/`savePrayerSettings` do;
  - `directionsLinks()`: new URL formats, no `embed`;
  - `Wiring.places`: `"supabase" | "sample"`;
  - `managedPrayer()`: adds `starts` from the pin;
  - `calculatePrayers` and `congregationTimes` signatures;
  - `activity.ts` `areaNames`;
  - `tokens.css`: `--map-*`;
  - `next.config.ts` CSP.
- **Moved, not copied:** the private `coordinate()` helper in `schema.ts` now serves `musallahPinSchema` and leaves `prayerSettingsObject`.
- **Removed:**
  - `createConfigPlacesProvider` and `RuntimeConfig.musallahEntrance` with the three variables;
  - `MapEmbed`'s iframe and placeholder;
  - the OpenStreetMap `frame-src`;
  - the Prayer screen's coordinate section;
  - `PrayerSettings.latitude/longitude`;
  - `demoPrayer` coordinates.
- **Searched and not found:**
  - "maplibre", "openfreemap", "leaflet": no map library yet;
  - "userAgent", "isApple", "navigator.platform" in `src`: no device detection to reuse;
  - "geocod", "nominatim": none, and none added;
  - "worker-src": not in the CSP;
  - a second places reader: none (only `musallahDirections`).
- **Duplicate risk avoided:**
  - Prayer coordinates and map coordinates become one row; the env and DB copies end.
  - `calculatePrayers` runs once per request in `managedPrayer`, not again in each page.
  - The region box is defined once in TypeScript and mirrored once in SQL, with a test asserting the two agree.

## New Abstractions

1. **`musallah_location` table + `musallahPinSchema`.** Responsibility: the one stored pin. Why not the existing owner: `prayer_settings` is the prayer screen's row. Keeping the pin there would make a prayer History restore move the pin, and would make the Prayer save and the pin save refuse each other on the shared `updated_at`. The roadmap and the PR4 contract already plan to drop `latitude`/`longitude` from it. Consumers: `PlacesProvider` adapters, `ContentEditor` adapters. Public API: table columns + zod type `MusallahPin`.
2. **`PinMap` (`src/shared/ui/PinMap.tsx`, client).** Responsibility: draw one MapLibre map centred on one point, in the P-4 look, with a small dot marker. The point can be dragged (editor), with the mouse, a finger, or the arrow keys when the dot has focus (engineering: keyboard access for a drag-only control, WCAG 2.1.1). It reports `onMove`/`onError`. Why shared: two features need it, and it carries no feature knowledge. Variation isolated: the MapLibre dependency, the tile source, its worker, the light/dark style switch and the attribution. Public API: `{ center: Place; label: string | null; draggable?: boolean; onMove?(place): void; onUnavailable?(): void; className?: string }`. Private: the style builder (`paperStyle(layers, palette)` only if P-4 = Quiet Paper recolour), theme observer, worker URL.
3. **`isAppleDevice` (`src/lib/maps/device.ts`).** A pure function for the D20 rule, so it is tested once and not repeated in components.
4. **`GRENADA_BOUNDS` and `inGrenada(place)` (`src/lib/maps/place.ts`).** The D-9 box, used by the zod schema (authority before the write), the editor (the dot can't be left outside; a drop outside shows the D-9 line) and mirrored once in SQL, with a test that the two agree.

No new Context, provider, global store, hook library or service layer.

## Product Decisions Required

Answered or decided 2026-10-05 (user's words in `.plans/answers-2026-10-05.md`):

- [x] P-1. Where does the board change the pin? (Q46)
      Decision: D-4
- [x] P-2. How does a board member set the pin? (Q47)
      Decision: D-5
- [x] P-3. When does the public map load? (Q48: the user called it a performance question; decided by us)
      Decision: D-6
- [x] P-5. Directions buttons: wording, order and travel mode (Q50)
      Decision: D-7
- [x] P-6. Link the directions to the Google place "MSA Mosque"? (Q51)
      Decision: D-8
- [x] P-7. Refuse a pin outside Grenada? (Q52)
      Decision: D-9
- [x] P-8. Wording for the new states (Q53)
      Decision: D-10
- [x] P-9. The Google listing "MSA Mosque" (Q54)
      Decision: D-11
- [x] P-10. The map package `maplibre-gl` (Q55: the user is not familiar with it; decided by us)
      Decision: D-12

Answered after a second round with pictures:

- [x] **P-4. What does the map look like?** (Q49, asked again in answer sheet 2 Q5) The user: show street names and nearby building names, no big circle and no large "SGU Musallah" text, **no satellite** (D-14); liked 1, 2, 3 and 3 + campus names the most and asked which we think is best (the sheet's tick said 1).
      Options (the user's shortlist; real free OpenFreeMap tiles at the musallah pin, no key, no account; pictures in `.plans/mockups/pr7-styles/`, side by side in `overview-desktop.png`): 1. standard street map (`liberty-*`; street names, shop and café names with icons, busier); 2. light grey street map (`positron-*`; street names, no building names); 3. Quiet Paper, the site's own colours (`paper-*`; street names, shop names as text); 3 + campus names (`paper-campus-*`; 3 plus halls and dorms such as Charter Hall, Superdorm 3, Founders Library from OpenStreetMap). The pin: the dot with a small "SGU Musallah" tag (`paper-campus-phone.png`), or the dot alone (`paper-campus-dot-only-phone.png`).
      Recommendation: **3 + campus names, dot with a small tag**, approved by the user 2026-10-05. It is the only one of the four that shows the campus building names the user asked for (the free tiles drop plain building names, so 1, 2 and 3 never show "Charter Hall"), it matches the site's paper colours in light and dark, and it needs no key or account. The small tag tells a first-time visitor what the dot is. Cost recorded for the build: `paperStyle()` and `--map-*` tokens, plus one server route that copies the named buildings from OpenStreetMap at most once a day (Next cache, nothing stored in our database). If the user prefers less to build, 1 is the plain fallback (no recolouring, no route). The Musallah itself is not in OpenStreetMap; our dot marks it.
      Decision: 3 + campus names — the site's paper colours with street names and campus building names from OpenStreetMap, small dot with a small "SGU Musallah" tag, no satellite; only a collapsed ⓘ map-data credit (D-15) (user, 2026-10-05: "yes go with recommended").

## Decisions

Recorded from the user (not new questions):

- D-1: One musallah pin only, no points of interest, no video; device-aware Get directions (Apple devices: Apple Maps and Google Maps; others: Google Maps only); the pin is board-editable and the single source for the map and prayer coordinates; `MUSALLAH_*` retired (user, D0 decision D20, 2026-10-03; options rejected: points of interest, route video).
- D-2: Map stack MapLibre + OpenFreeMap (user, ADR 0009, 2026-10-02; options rejected: paid map tools).
- D-3: Starting pin = the Google place "MSA Mosque", 12.0025521, -61.7723834 (Google place ID `ChIJ10hHVwAhOIwRu8X9MFT4N0k`, recorded for reference only, not stored, D-8), to be confirmed by the board on the release checklist (user, 2026-10-04; options rejected: none offered).
- D-4: The pin is moved in a "Musallah location" section **inside Prayer & iqamah** (where the latitude and longitude boxes are today). It keeps its own table, form, Save button and version, so saving prayer times and moving the pin never block each other, and a prayer History restore never moves the pin (user, 2026-10-05, Q46 B "im leaning B"; rejected: its own dashboard screen).
- D-5: The pin is set by **dragging only** (mouse or finger); no coordinates box. Engineering, stated: the dot also moves with the arrow keys when it has keyboard focus (about 2 m per press, 20 m with Shift), so the control works without a mouse (WCAG 2.1.1) (user, 2026-10-05, Q47 C; rejected: paste one line, two boxes).
- D-6: The public map **loads by itself when the "Find us on campus" box comes near the screen** (an `IntersectionObserver` with a 200 px margin); MapLibre's code is fetched only then, so pages whose box is never reached load nothing extra; no "Show the map" button. The privacy page says so (D-10). Engineering decision (the user, 2026-10-05, Q48: "B (Or C, this seems like a performance concern, not really a product decision)"; rejected: load on tap, load always).
- D-7: Directions: a small heading "Get directions", then "Apple Maps" and "Google Maps" (Apple first on Apple devices; others see only Google Maps), walking directions (user, 2026-10-05, Q50 A by "all recommended").
- D-8: Directions route to the pin only; no Google place link and no `google_place_id` column. A link can be added later, after the listing is cleaned (user, 2026-10-05, Q51 A).
- D-9: A pin outside Grenada is refused. The box: latitude **11.95 to 12.531**, longitude **−61.85 to −61.37**. It covers the main island (Point Salines −61.80, the south coast about 11.98), Carriacou (12.436–12.530, −61.500 to −61.420) and Petite Martinique (12.511–12.527, −61.395 to −61.378), and leaves out Petit St. Vincent (12.533–12.540, Saint Vincent and the Grenadines) and Union Island (12.58). Extents checked on OpenStreetMap (Nominatim), 2026-10-05. One constant `GRENADA_BOUNDS`, mirrored once in SQL. Refusal: "The pin must be in Grenada. Drag it back onto the SGU campus." Not a board setting (user, 2026-10-05, Q52: "must be in grenada only, check coordinates properly"; rejected: warn only, no check).
- D-10: Wording approved (Q53 A by "all recommended") with the changes the other answers force: no "Show the map" button; the note under the box becomes the privacy line "The map loads from OpenFreeMap as you scroll to it. The written directions work without it." the pin label follows P-4; the editor is the section title "Musallah location" inside Prayer & iqamah with the intro "Drag the dot to the musallah entrance. This one pin is used for the map on the website, the Apple Maps and Google Maps directions, and the prayer start times.", button "Save location", success "Musallah location saved."; no dashboard card. Unchanged: "The map can't be loaded right now. Please use the written directions.", "The map can't be shown right now.", "Prayer start times are temporarily unavailable." The privacy page (`PrivacyLedger.tsx`, "Optional map") is rewritten to: "Map. When you scroll to the "Find us on campus" box, your browser loads map pictures from OpenFreeMap (tiles.openfreemap.org). Like any website, OpenFreeMap sees your internet address. We send it nothing else, and it sets no cookies. The written directions work without the map."
- D-11: The board claims the Google listing with the mosque Gmail **after asking SGU** whether the MSA may manage it, and agrees the name to show (Appendix A) (user, 2026-10-05, Q54 A by "all recommended").
- D-12: `maplibre-gl` approved: it is the free, open-source (BSD-3-Clause) program that draws a zoomable, draggable map in the browser from free map tiles, with no key or account (ADR 0009 already allows "MapLibre with OpenFreeMap"). Engineering decision (user, 2026-10-05, Q55 "not familiar with these libraries"; rejected: a static picture). Installed: `maplibre-gl` 6.12.0 (exact), PR-B.
- D-13: No outside approver role anywhere in this plan: the board decides; the MSA is a student club (user, 2026-10-05, answers Q91).
- D-14: **No satellite** (user, 2026-10-05, answer sheet 2 Q5: "no satellite please"). Options 4, 5 and 5 + campus names are dropped, and with them the Esri account, the `ESRI_BASEMAP_KEY` setting, the Esri CSP host, the Esri privacy line, the owner-setup step and the "Map / Satellite" switch. Every remaining option uses OpenFreeMap only (rejected: 4, 5, 5 + campus names).
- D-15 (user, 2026-10-05): map credits: no MapLibre logo and no long credit text; only the required map-data credit as a small collapsed ⓘ button (MapLibre `AttributionControl({compact:true})`, collapsed by default) showing "© OpenStreetMap contributors · OpenFreeMap" when tapped. This replaces the "attribution always visible" line in WP-4 and the Design attribution text.
- D-16: The note under the map ("The map loads from OpenFreeMap as you scroll to it. The written directions work without it.", D-10) is removed (user, 2026-10-05, review 3 A-3). The Privacy page still explains the map.

Engineering choices made by the planner (not product decisions; say if you disagree):

- E-1: A new singleton table `musallah_location`, not the `prayer_settings` columns (see New Abstractions 1). Still right with D-4: the section sits on the prayer screen, the data does not.
- E-2: No "confirmed" switch. The seeded pin shows publicly from the release, and the board confirms it on the release checklist before the Release PR. This removes the env-variable gate without a silent default: the value has a named source (the user).
- E-3: The pin has no restore button. Recent changes shows every old and new value; the board drags the dot back. Prayer-settings History is unchanged. ADR 0013 lists version history for prayer settings, page text and seasons only.
- E-4: The log entry is not highlighted, because that would need a change to `record_activity`, which PR6 is also replacing. Moving the pin shifts prayer starts by seconds (see Design), not minutes.
  (critic) ADR 0013 says prayer-time changes are highlighted to everyone, and a moved pin also moves where visitors are sent. Once PR6's `record_activity` is in `integration`, whichever later migration re-creates it (PR5a-WP1 under its D-17, or a one-line PR7 follow-up) adds `musallah_location` to the highlight list, keeping every earlier rule. Until then, Recent changes still lists every move.
- E-5: Apple directions use Apple's current unified URL `https://maps.apple.com/directions?destination=<lat>,<lng>&mode=walking`, **not** the legacy `?daddr=…&dirflg=w` the task text suggested. Apple's documentation lists the unified URLs for iOS 18.4 / macOS 15.4 and later. An Apple engineer recommends them in a forum thread reporting that `daddr=lat,long` stopped working on iOS 18.4 (sources in Appendix B). Older Apple devices still get the Google button next to it.
- E-6: Device detection runs in the browser after the page loads (`useSyncExternalStore`, server snapshot = "not Apple"), so pages stay cacheable and there is no hydration mismatch. Before detection and without JavaScript, the Google button alone shows, which is the "other devices" rule. Apple = the user agent contains iPhone, iPad or iPod, or says Macintosh (this covers iPadOS, which reports itself as a Mac, and macOS). (critic) Because a Mac and an iPad both count as Apple, the touch-point count adds nothing: the function takes only the user agent.
- E-7: The map uses `cooperativeGestures` on the public site, so a phone scrolls the page and two fingers move the map. The editor turns it off.
- E-8: Two migrations: an additive one (applied before the Release PR) and the column drop (applied only after the Release PR is live). See Compatibility and Migration.
- E-9: The sandbox pin uses the same Google place coordinates, so help pictures show the real campus. `demoPrayer` loses its regional test coordinates.
- E-10: In-view loading (D-6) skips the map when the browser reports Save-Data; the box then shows the written directions and buttons only, with "Map hidden to save data." (one line, from `system-text`/the fixed messages). Keeps campus data plans small.
- Amendment (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): the musallah pin is cached (`musallahPin`, `"use cache"`, tag `musallah-pin`) until a board save expires it, so the map, the directions and the prayer starts still use one read that never disagrees. `/api/campus-names` calls `connection()` and is answered per request, as before (Next's data cache still keeps OpenStreetMap's good replies for a day).

## Board Self-Sufficiency Check

- **Move the pin:** yes. Dashboard → Prayer & iqamah → "Musallah location" section (D-4), drag the dot, Save. Any admin can do it, it is logged, and the website updates at once with no redeploy. Help: a new "Move the musallah pin" card with a picture on `/admin/help` (`help-pictures.ts`) and extra steps in the Prayer & iqamah "Show me how" tour.
- **Prayer coordinates:** follow the pin automatically. No second place to edit.
- **Directions links:** built from the pin, with nothing to edit separately (D-8).
- **Map look and tile provider:** developer-only by design, chosen once by the user (P-4). They are design tokens and constants, not board content (ADR 0018). This is not a gap. **Building names** on the map come from OpenStreetMap; the board can add a missing name there for free (help card line).
- **Region rule (D-9):** a fixed safety rule (named constant), not a board setting, by design.
- **Google listing:** done on Google with the mosque Gmail (Appendix A), not in our dashboard. (critic) The steps live in an in-app help card on `/admin/help` (the board's step-by-step home), with one pointer line in the owner guide.
- **Retired:** the owner no longer edits `MUSALLAH_*` in Vercel. The board guide's "Change the map pin for the musallah entrance → Site owner" row (`docs/guides/board.md` line 37) is removed.

## Design

```text
Board ─► /admin/prayer-times › "Musallah location" section (PinEditor + PinMap draggable; its own form)
        └─ saveMusallahPinAction (currentAdmin, musallahPinSchema, region, calculation check, version)
              └─ contentEditor().saveMusallahPin ─► public.musallah_location (RLS, check constraints)
                                                     └─ trigger record_activity ─► activity_log (Recent changes)
Visitor ─► page (server) ─► placesProvider().musallahEntrance() ─► same row (public_read)
            ├─ MusallahMap (client): box near the screen (IntersectionObserver) ─► import() PinMap (MapLibre + the P-4 tiles)
            │                         Get directions: isAppleDevice ? [Apple, Google] : [Google]
            └─ managedPrayer(): settings + place ─► calculatePrayers(place, now) ─► starts ─► congregationTimes(settings, starts, now)
```

**Directions URLs** (`directionsLinks(place)`, pure):

- Google: `https://www.google.com/maps/dir/?api=1&destination=12.0025521%2C-61.7723834&travelmode=walking` (no place ID, D-8). Google's documentation: `api=1` is required, `destination` can be coordinates, `destination_place_id` needs `destination`, `travelmode` values include `walking`, and no API key is needed.
- Apple: `https://maps.apple.com/directions?destination=12.0025521%2C-61.7723834&mode=walking` (E-5).
- Built with `URL`/`URLSearchParams` (encoding per Google's rules), and rendered through `ButtonLink` (opens in a new tab, `safeHref`).

**Prayer time effect of switching to the pin.** Measured with the repo's `adhan` and the fixed MWL + Standard Asr calculation over all 366 days of 2026:

| From                                                       | Distance to the Google pin | Largest change to any start (unrounded) | Days where a displayed minute changes (any prayer)     |
| ---------------------------------------------------------- | -------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Sandbox coordinates 12.05, -61.75 (`demoPrayer`)           | 5.81 km                    | 12 seconds                              | 166 of 366 (always by exactly 1 minute, from rounding) |
| Example coordinates 12.0012, -61.7765 (owner guide, tests) | 472 m                      | 2 seconds                               | 31 of 366 (1 minute)                                   |

Rule of thumb near St. George's: every kilometre east or west moves all starts by about 2 seconds, and north–south moves them less. "After adhan" iqamah times follow the starts by the same amount. Any location on campus therefore gives the same times to within a minute. The **stored production and staging values were not read** (no hosted connection; no `.env*` read). Before WP-1 is applied, the owner runs this read-only query in each project's SQL Editor. It prints only the distance, not the stored numbers:

```sql
select case when latitude is null or longitude is null then 'no stored coordinates (prayer starts are hidden today; the pin turns them on)'
  else round(6371000 * 2 * asin(sqrt(power(sin(radians(12.0025521 - latitude) / 2), 2)
    + cos(radians(latitude)) * cos(radians(12.0025521)) * power(sin(radians(-61.7723834 - longitude) / 2), 2))))::text || ' metres from the Google pin' end as result
from public.prayer_settings where id = 1;
```

Under 20 km means at most about a minute's change on some days. More than that means the stored value was not the musallah: the board confirms the pin before release. If the row has no coordinates, prayer starts currently show "Prayer start times will appear once the Musallah location is set." and **start appearing** with the release. That is a visible change for the release checklist.

**Public box (`MusallahMap`, replaces `MapEmbed`).**

- The heading "Find us on campus" is unchanged.
- With a pin, the box reserves the map's space (18rem tall, no layout shift) and loads `PinMap` when the box comes within 200 px of the screen (D-6; Save-Data skips it, E-10), with ~~the attribution the chosen tiles require (OpenFreeMap: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap")~~ only the collapsed ⓘ map-data credit (D-15), zoom buttons, no compass; the Get directions buttons (`ButtonLink variant="outline"`) show from the start.
- With `unavailable`, it shows the D-10 unavailable text and no buttons. The placeholder "Your entrance pin goes here" is gone, because there is always a pin.
- The map region is `role="region"` with an `aria-label` that includes the place name. The marker is decorative (`aria-hidden`), because the buttons and written directions carry the information.
- Reduced motion: no fly or ease animations.

**Map look (P-4: 3 + campus names).** Marker for every option: a small solid dot (ink in light, paper-light in dark, 12 px with a 2 px contrasting edge), no ink ring; label per P-4 (none, or small text beside the dot). Street and building names stay on. If P-4 = Quiet Paper:

- `paperStyle()` sets paint colours by layer type and id pattern (background, water, park/landcover, building, roads, road casings, labels and halos). Colours come from the new tokens `--map-water`, `--map-park`, `--map-building`, `--map-road`, `--map-casing`, `--map-label`, plus `--paper` and `--paper-light`, in `:root` and `[data-theme="dark"]`.
- A `MutationObserver` on `<html data-theme>` re-applies them when the theme switch is used.
- An unknown layer keeps OpenFreeMap's positron colour, which stays readable.
- If P-4 = Liberty or Positron: OpenFreeMap's own style URL per theme (Positron light / Dark, or Liberty in both), no recolouring, no `--map-*` tokens.
- If P-4 = 3 + campus names (recommended): a route handler `src/app/api/campus-names/route.ts` (GET, public, no secrets) asks OpenStreetMap's Overpass service for named buildings within `CAMPUS_NAMES_RADIUS_M = 600` of the pin and returns a small GeoJSON (name and centre only). It is cached for `CAMPUS_NAMES_REFRESH_S = 86_400` with the Next 16 route-handler caching checked in `node_modules/next/dist/docs/` at WP time; when OpenStreetMap fails, the last good copy keeps showing, and with none the map shows without campus names (no error). `PinMap` adds them as one symbol layer in italic `--map-label` text. Visitors' browsers fetch only our own route (CSP `connect-src 'self'`), so OpenStreetMap never sees visitors.

**Pin editor (D-4, D-5).**

- A "Musallah location" section on `src/app/admin/prayer-times/page.tsx`, below the prayer form, replacing the closed coordinates `<details>`: the D-10 intro, `PinMap draggable` (cooperative gestures off), "Try Google Maps directions ↗" and "Try Apple Maps directions ↗" (built from the saved pin), its own Save button and `FormMessages`. It is a separate `<form>` (`PinEditor`), so the prayer form and the pin never share a version or a Save.
- Dragging (or the arrow keys on the focused dot) writes two hidden inputs `latitude`, `longitude` (6 decimals, about 10 cm); there is no text box. A drop outside `GRENADA_BOUNDS` snaps the dot back and shows the D-9 line.
- Plain admin styling (Track B restyles later).

**Prayer screen.** The closed coordinates section is removed; the pin section above takes its place.

## Public Contract

- **Table** (migration `supabase/migrations/<next free timestamp>_musallah_location.sql`; (critic) the timestamp is chosen when WP-1 is written, after every file then in the folder: **`202610110001`**):
  - `public.musallah_location(id integer primary key default 1 check (id = 1), latitude double precision not null check (latitude between -90 and 90), longitude double precision not null check (longitude between -180 and 180), updated_at timestamptz not null default now())`;
  - `check (latitude between 11.95 and 12.531 and longitude between -61.85 and -61.37)` (D-9, `GRENADA_BOUNDS`);
  - RLS `public_read` (select to anon, authenticated using (true)) `admin_insert` (for insert to authenticated with check `(select public.is_admin())`) and `admin_update` (for update to authenticated using/with check `(select public.is_admin())`), separate so no policy covers delete;
  - grants: select to anon; select, insert, update to authenticated (no delete);
  - triggers: `updated_at` (`touch_updated_at`), `activity` (`record_activity('id','full')`);
  - seed `insert … values (1, 12.0025521, -61.7723834)`.
- **Migration** `supabase/migrations/<next free timestamp>_drop_retired_prayer_columns.sql` ((critic) written only after the PR7 release is live, see WP-6): `alter table public.prayer_settings drop column confirmed, drop column method, drop column madhab, drop column adjustments, drop column latitude, drop column longitude;`.
- **zod** (`src/lib/community/schema.ts`): `musallahPinSchema = z.object({ id: z.literal(1), latitude: coordinate("Latitude", 90) non-null, longitude: coordinate("Longitude", 180) non-null })` with the region refinement (D-9) from `GRENADA_BOUNDS`. `type MusallahPin`. `prayerSettingsObject` loses `latitude`/`longitude`.
- **Port** `src/lib/maps/providers/contract.ts`: `Place = Readonly<{ latitude: number; longitude: number }>`. `PlacesProvider.musallahEntrance(): Promise<{ place: Place | null; unavailable: boolean; provenance }>`. `place` is null only when `unavailable`.
- **Board port** `ContentEditor`: `readMusallahPin(): Promise<{ pin: MusallahPin; version: string } | null>`; `saveMusallahPin(pin: MusallahPin, version: string): Promise<WriteResult>`.
- **Server action** `saveMusallahPinAction(previous: KeptFormState, form: FormData): Promise<KeptFormState>` in `src/features/admin/actions.ts`. Fields: `latitude`, `longitude` (hidden, written by the drag, D-5) and `version`.
- **Pure functions:**
  - `directionsLinks(place): { google: string; apple: string }`;
  - `isAppleDevice(userAgent: string): boolean` (critic: touch points dropped, E-6);
  - `paperStyle(layers, palette)` (only if P-4 = Quiet Paper);
  - `GRENADA_BOUNDS = { south: 11.95, north: 12.531, west: -61.85, east: -61.37 }` and `inGrenada(place)` (D-9);
  - the style URL constant(s) for the P-4 choice (OpenFreeMap: `https://tiles.openfreemap.org/styles/<name>`).
- **Prayer:**
  - `calculatePrayers(place: Place | null, now: Date)`;
  - `congregationTimes(settings: PrayerSettings, starts: Starts, now: Date)`;
  - `managedPrayer()` also returns `starts` and `startsUnavailable` (true when the pin read is unavailable).
- **Route:** none new; the section lives on `/admin/prayer-times` (D-4), behind the admin layout's `requireAdmin` as today.
- **Runtime config:** `RuntimeConfig.musallahEntrance` and the three `MUSALLAH_*` variables are removed. Leftover values in Vercel are ignored (unknown variables are not read).
- **CSP** (`next.config.ts`):
  - `connect-src 'self' https://tiles.openfreemap.org` (the campus-names route is same-origin);
  - remove `frame-src https://www.openstreetmap.org` (no frames remain, so set `frame-src 'none'`);
  - `worker-src 'self'` explicit (the MapLibre worker is served from our origin);
  - `img-src` unchanged (`data: blob:` already allowed).

## Private Implementation

The implementer decides:

- private helper names and the exact layer-id patterns in `paperStyle`;
- how the MapLibre worker file is served from our origin (`new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url)` under Turbopack, or a copy step into `public/`), as long as it is same-origin, works in `next build` and needs no CSP `blob:`;
- marker markup;
- form layout details inside the approved picture;
- test fixture details;
- whether `MusallahMap` loads `PinMap` with `next/dynamic` or `import()` when the box comes into view (D-6 requires that the MapLibre code is **not** in the page's first JavaScript).

## Data and State Flow

- **Public read:**
  - `placesProvider()` (cached per request) → Supabase adapter `from("musallah_location").select("*").eq("id", 1).maybeSingle()` with the publishable client → `musallahPinSchema` → `Place`.
  - An error or invalid row gives `{ place: null, unavailable: true }`, logged once with `console.error` (the same as the other adapters).
  - The sample adapter reads the demo store, so sandbox edits show up.
- **Pages:**
  - `LocationMap` (server) passes `{ place, links }` to `MusallahMap` (client).
  - `managedPrayer()` reads `getPrayerSettings()` and `placesProvider().musallahEntrance()` in parallel, computes `starts` once, and passes them to `congregationTimes`.
  - `src/app/page.tsx` and `src/app/prayer/page.tsx` use `starts` from `managedPrayer()` instead of calling `calculatePrayers` themselves.
  - `ramadan/page.tsx` keeps using `managedPrayer()`.
- **Board write:**
  - `saveMusallahPinAction`: `currentAdmin()` → parse (zod + region) → `calculationProblem(place, dates)` (12 ordered starts today and on every saved exception date) → `contentEditor().saveMusallahPin(pin, version)` (update `where id = 1 and updated_at = version`) → on success `revalidatePath("/", "layout")` and redirect to `/admin/prayer-times?pin=saved#musallah-location`.
  - `savePrayerAction` keeps `calculationProblem`, now with the stored pin.
- **Caching:** public pages already render per request or revalidate on board saves (`revalidatePath("/", "layout")`, `LiveRefresh`). No new cache.
- **Client:** the map loads only in the browser. Tiles, style, glyphs and sprites come from `tiles.openfreemap.org`. Our server never contacts OpenFreeMap.

## Failure Modes

| Situation                                       | Behaviour                                                                                                                                                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase unavailable (public)                   | Map box: P-8 unavailable text, no buttons. Prayer: starts hidden with "Prayer start times are temporarily unavailable." (not the "location is set" text); iqamah fixed times still show; "after adhan" iqamah hides, as with no starts today. |
| Supabase unavailable (dashboard)                | "The musallah location could not be loaded. Check your connection and reload." No form is shown, so nothing can be saved over an unknown value.                                                                                               |
| New code before WP-1's migration is applied     | Same as unavailable (the table is missing). Honest, no crash. The release checklist requires WP-1 before the Release PR.                                                                                                                      |
| OpenFreeMap down or blocked                     | `PinMap` `error` event → "The map can't be shown right now." The directions buttons still work (they need only the pin).                                                                                                                      |
| Old browser without WebGL                       | MapLibre throws on create → the same text, with buttons.                                                                                                                                                                                      |
| Stale version (two editors)                     | `conflict` → "Someone else saved the location first. Reload to see it, then try again." The typed value is kept.                                                                                                                              |
| Session expired mid-edit                        | Existing `sessionExpired` refusal; the typed value is kept.                                                                                                                                                                                   |
| Double submit                                   | The Save button is disabled while pending; the version check makes a repeat save a conflict, not a second change.                                                                                                                             |
| Invalid input                                   | Only possible from a forged or stale post (no text box): zod refuses with the D-9 line or "Musallah location: drag the dot to set the pin."                                                                                                   |
| Dot dropped outside Grenada                     | It snaps back to its last place in Grenada and the D-9 line shows; nothing is posted                                                                                                                                                          |
| Save-Data on, or the box never reached          | MapLibre is not downloaded; buttons and written directions show (E-10, D-6)                                                                                                                                                                   |
| Pin gives no prayer starts                      | Cannot happen inside Grenada, but the same calculation check as today refuses the save.                                                                                                                                                       |
| Deployment skew                                 | An old Prayer page still posts `latitude`/`longitude`: `prayerFormValues` no longer reads them, so they are ignored. An old public page has no new server actions.                                                                            |
| Old prayer History versions holding coordinates | The restore schema strips unknown keys; coordinates are ignored, never written (a test covers this).                                                                                                                                          |
| Device detection wrong (unusual browser)        | Worst case, an Apple user sees Google only, or another user also sees Apple (which opens Apple Maps on the web). Both still reach the musallah.                                                                                               |

## Compatibility and Migration

1. **WP-1 migration `<timestamp>_musallah_location.sql` (additive).**
   - Creates the table, RLS, grants and triggers, and seeds the user's pin. Old code ignores the table.
   - Apply order: run the distance query above on staging, apply to staging, check (`scripts/test-backend.ts` passes; the Table Editor shows one row), then apply to production, all **before** the Release PR that ships PR7.
   - Rollback: `drop table public.musallah_location;` (old code does not use it). The activity entries stay (add-only).
2. **Code release (WP-2–WP-5).**
   - Reads the pin and stops reading and writing `prayer_settings.latitude/longitude`. The columns stay in the database and are ignored (`select *` + zod stripping, the same as PR4 did for the retired columns).
   - Rolling back the code (Vercel Instant Rollback to the previous build) still works, because the old columns and env variables still exist.
3. **WP-6 migration `<timestamp>_drop_retired_prayer_columns.sql`.**
   - Applied by a human **only after** the Release PR with PR7 is live in production and checked (staging first).
   - Dropping a column also drops the multi-column check `not confirmed or (...)`; a PGlite test proves the table is left with only valid checks.
   - Old activity log entries keep their snapshots (jsonb, unaffected).
   - After this step, rolling the code back to before PR7 is no longer possible, as the release checklist says.
4. **Env clean-up.** After step 3, the owner deletes `MUSALLAH_LOCATION_CONFIRMED`, `MUSALLAH_LATITUDE` and `MUSALLAH_LONGITUDE` from Vercel (Production and Preview) and developers delete them from `.env.local`. Leftovers are harmless (not read), so the order is not critical.
5. **No change** to `record_activity`, `valid_prayer_exceptions` or `hijri_adjustment`. PR6's migration `202610070001` is independent, and PR7's timestamps sort after it.
6. (critic) **Migration order.** Migrations are applied by hand in timestamp order (edge I3). A drop file written now with an early timestamp would sit before PR5's or later migrations that production gets first, so it would be applied out of order. WP-6's file is therefore created and merged only after the PR7 release is live, with the next free timestamp at that time. Each migration's release-checklist entry carries a read-only check query (edge I3), such as `select count(*) from public.musallah_location;` (expect 1).

## Parallel Work and Merge Order

```yaml
WP-1:
  creates: [supabase/migrations/<next free timestamp>_musallah_location.sql, tests/musallah-location-migration.test.ts]
  extends: [scripts/test-backend.ts]
  shared_contract_changes: [new table public.musallah_location, RLS public_read/admin_insert/admin_update]
  depends_on: []   # D-8, D-9 answered
  potential_conflicts: [PR6 WP-3 also extends scripts/test-backend.ts]
WP-2:
  consumes: [WP-1 table]
  extends: [src/lib/maps/**, src/lib/community/schema.ts, src/lib/backend/providers/{contract,supabase,sample}.ts, src/lib/demo/{store,fixtures}.ts, src/lib/runtime/{config,wiring,providers}.ts, .env.example, README.md]
  creates: [src/lib/maps/providers/supabase.ts, src/lib/maps/providers/sample.ts, src/lib/maps/place.ts, src/lib/maps/device.ts, src/lib/maps/style.ts]
  shared_contract_changes: [Place, PlacesProvider, ContentEditor.readMusallahPin/saveMusallahPin, musallahPinSchema, RuntimeConfig minus musallahEntrance]
  potential_conflicts: [PR6 WP-1/WP-2 (merged, #58) edited config.ts, wiring.ts, providers.ts, .env.example, tests/runtime.test.ts, tests/places.test.ts]
  depends_on: [WP-1 merged (contract), PR6 WP-1/WP-2 merged into integration (done, #58)]
WP-3:
  consumes: [placesProvider, Place]
  extends: [src/lib/prayer/{calculate,congregation}.ts, src/lib/community/{schema,managed,activity}.ts, src/features/admin/{actions,PrayerEditor}.tsx, src/app/{page,prayer/page,ramadan/page,admin/prayer-times/page}.tsx]
  depends_on: [WP-2]
WP-4:
  consumes: [directionsLinks, isAppleDevice, Place]
  creates: [src/shared/ui/PinMap.tsx, src/shared/ui/PinMap.stories.tsx, src/features/prayer/MusallahMap.tsx, src/app/api/campus-names/route.ts (only if P-4 = 3 + campus names)]
  extends: [package.json (maplibre-gl), src/features/prayer/{LocationMap.tsx,prayer.module.css}, src/styles/tokens.css, next.config.ts, src/features/contact/ContactCallingCard.stories.tsx, src/features/privacy/PrivacyLedger.tsx (critic)]
  removes: [src/features/prayer/MapEmbed.tsx]
  depends_on: [WP-2, P-4 (look and label only; loading, buttons, privacy text can start)]
WP-5:
  consumes: [PinMap, saveMusallahPin, GRENADA_BOUNDS]
  creates: [src/features/admin/PinEditor.tsx]
  extends: [src/app/admin/prayer-times/page.tsx, src/features/admin/actions.ts, src/features/admin/tour/steps.ts (prayer tour), src/features/admin/help-pictures.ts, public/admin-help/*]
  depends_on: [WP-3 (actions.ts and the prayer screen, single owner per batch), WP-4 (PinMap)]
WP-6:
  creates: [supabase/migrations/<next free timestamp>_drop_retired_prayer_columns.sql]
  extends: [tests/prayer-migration.test.ts]
  depends_on: [WP-3 merged (no reader of the columns), PR7 Release PR live (critic: migration order)]
WP-7:
  extends: [docs/roadmap.md, docs/architecture.md, docs/guides/{owner-setup,board,prayer-times,developer}.md, docs/release-checklist.md, src/app/admin/help/page.tsx (critic: Google listing card)]
  depends_on: [WP-1..WP-6]
integration_owner: planner
```

Merge order: WP-1 → WP-2 → WP-3 → WP-4 → WP-5 → WP-6 → WP-7. WP-4 can be built in parallel with WP-3 (disjoint files) and merges after it. `src/features/admin/actions.ts` is changed by WP-3 first, then WP-5.

**(critic) Cross-plan conflicts with PR5 (`.plans/pr5-self-serve-content.md`), whichever merges second rebases:**

- PR5a-WP6 (Jumu'ah question) and PR7 WP-3/WP-5 all edit the Prayer & iqamah screen (`PrayerEditor.tsx`, `src/app/admin/prayer-times/page.tsx`) and `savePrayerAction`/`calculationProblem` in `actions.ts` (D-4 puts the pin section there). One owner per batch.
- PR5a-WP2 adds `activityKinds` groups in `activity.ts`. Whichever lands second puts `musallah_location` in a group (recommended: next to Prayer & iqamah) so the Recent changes filter can find pin moves.
- PR5b moves `managedPrayer`'s notices into the `prayer` page-text document. If PR7 lands first, "Prayer start times will appear once the Musallah location is set." is gone (there is always a pin) and must not be seeded; PR7's new "temporarily unavailable" line goes into that document if PR5b lands first.
- PR5b's `musallah` document holds the written directions, and PR5b-WP4 may extract `VisitSection`. If PR5b lands first, the "Find us on campus" heading and the D-10 note line are page text too (button names and error lines stay fixed labels, as PR5 treats buttons). Note: after PR5b the written directions also come from Supabase, so "written directions work without the map" still holds, but not when Supabase is down (PR5's documented fallback shows instead).
- Migration timestamps: both plans take the next free timestamp at WP time (step 6).

**Can start while the user is away (no open question blocks it):**

- WP-1, WP-2 and WP-3 in full (no open question); WP-4 except the look and label (P-4); WP-5 with a placeholder look.
- The WP-6 test can be drafted; (critic) the migration file itself waits for the release (Compatibility and Migration step 6).

Only the map look waits for P-4.

## Work Packages

### WP-1: Database: the musallah location row

- Purpose: store the one pin with RLS, history and the user's starting value.
- Depends on: nothing open (D-8, D-9).
- Expected files: `supabase/migrations/<next free timestamp>_musallah_location.sql`, `tests/musallah-location-migration.test.ts` (PGlite, the same style as `tests/prayer-migration.test.ts`), `scripts/test-backend.ts`.
- Reuse: `public.touch_updated_at()`, `public.is_admin()`, `public.record_activity('id','full')`, and the RLS policy wording of `prayer_settings`.
- Required changes: the table exactly as in Public Contract; seed row; header comment naming this contract, the seed source (the user, 2026-10-04) and "board confirms on the release checklist".
- Must not: modify `record_activity`, `prayer_settings`, or any PR6 table; add a delete grant or delete policy; add a "confirmed" column (E-2).
- Tests:
  - PGlite: the seed row exists; out-of-range and out-of-Grenada values are refused (Petit St. Vincent 12.536, -61.384 refused; Petite Martinique 12.52, -61.385 and Carriacou 12.48, -61.45 accepted); `id = 2` is refused; an update writes one activity entry with before/after.
  - Local Supabase (`scripts/test-backend.ts`): anon can select but not update; an admin can update; nobody can delete.
- Done when: both test suites pass and the migration applies after `202610060001` and the PR6 draft.

### WP-2: Place port, board port and retiring the env settings

- Purpose: serve the stored pin to pages and the dashboard; one URL builder; remove `MUSALLAH_*`.
- Depends on: WP-1 (contract); PR6 WP-1/WP-2 merged (#58).
- Expected files:
  - `src/lib/maps/{providers/contract.ts, providers/supabase.ts, providers/sample.ts, location.ts, place.ts, device.ts, style.ts, index.ts}`; delete `src/lib/maps/providers/config.ts`;
  - `src/lib/community/schema.ts` (`musallahPinSchema`; move `coordinate` usage); `src/lib/maps/place.ts` (`GRENADA_BOUNDS`, `inGrenada`);
  - `src/lib/backend/providers/{contract.ts, supabase.ts, sample.ts}`; `src/lib/demo/{store.ts, fixtures.ts}`;
  - `src/lib/runtime/{config.ts, wiring.ts, providers.ts}`; `.env.example`; `README.md` line 19;
  - `tests/places.test.ts`, `tests/runtime.test.ts`, `tests/editor.test.ts`.
- Reuse: the supabase public client used by `src/lib/community/providers/supabase.ts`; the `readPrayer`/`savePrayerSettings` adapter code paths (version check, `Outcome`); `placesConformance` in `tests/places.test.ts`.
- Required changes:
  - `directionsLinks` per Design (E-5); no `embed`.
  - `musallahDirections()` returns `{ place, links, unavailable, provenance }`.
  - `planWiring` sets `places: "supabase"` with live data and `"sample"` with sample data.
  - `config.ts` drops the three variables, their `allowed` rows and the `musallahEntrance` field.
  - The sample store holds `{ pin, version }`, seeded with the D-3 coordinates (E-9).
- Must not:
  - create a second Supabase client;
  - read `process.env` outside `config.ts`;
  - keep a fallback to env coordinates;
  - invent a default pin in code (the sample pin lives only in `src/lib/demo`);
  - import adapters outside `providers.ts`.
- Tests:
  - the conformance suite for the Supabase-shaped memory adapter and the sample adapter;
  - `directionsLinks` exact URLs (special-character encoding; no place ID);
  - `isAppleDevice` for iPhone, iPad (desktop "Macintosh" UA), Mac, Chrome and Firefox on iPhone (`CriOS`, `FxiOS`), Android, Windows, Linux and an empty UA;
  - `inGrenada` at the box edges and for the D-9 places; a test that `GRENADA_BOUNDS` equals the numbers in the migration's check;
  - `runtime.test.ts`: a configuration without `MUSALLAH_*` is valid, and leftover values are ignored;
  - the `ContentEditor` sample save/conflict.
- Done when: `npm run check` passes and no file mentions `MUSALLAH_` outside docs history (`grep -rn MUSALLAH_ src tests .env.example README.md` is empty).

### WP-3: Prayer starts from the pin

- Purpose: one coordinate source; the calculation runs once per request.
- Depends on: WP-2.
- Expected files:
  - `src/lib/prayer/calculate.ts`, `src/lib/prayer/congregation.ts`;
  - `src/lib/community/{schema.ts, managed.ts, activity.ts}`;
  - `src/features/admin/{actions.ts, PrayerEditor.tsx}`;
  - `src/app/page.tsx`, `src/app/prayer/page.tsx`, `src/app/ramadan/page.tsx`, `src/app/admin/prayer-times/page.tsx`;
  - `src/lib/demo/fixtures.ts` (`demoPrayer` without coordinates);
  - `tests/community.test.ts`, `tests/review.test.ts`, `tests/prayer-today.test.ts`, `tests/activity.test.ts`.
- Reuse: `prayerCalculation`, `calculationProblem`, `KeptFormState`, `prayerFields` (minus coordinates).
- Required changes:
  - `calculatePrayers(place, now)` and `congregationTimes(settings, starts, now)` as in Public Contract.
  - `managedPrayer` returns `starts` + `startsUnavailable`; pages use them, and the D-10 unavailable text replaces the "location is set" line when `startsUnavailable`.
  - `prayerSettingsObject`, `emptyPrayer`, `prayerFormText`, `prayerFormValues` and `prayerFields` lose `latitude`/`longitude`.
  - `calculationProblem(place, dates)` is used by both saves.
  - The PrayerEditor coordinate `<details>` is removed (WP-5 adds the pin section in its place).
  - `areaNames.musallah_location = "musallah location"`.
- Must not:
  - read coordinates from `prayer_settings`;
  - call `calculatePrayers` in a page;
  - change `prayerCalculation`;
  - change the iqamah precedence;
  - remove `fieldNames.latitude/longitude` (old log entries use them).
- Tests:
  - the existing MWL test cases now pass a `Place`;
  - no starts without a place;
  - `startsUnavailable` wording;
  - restoring a pre-PR7 History version that contains coordinates saves without them;
  - a Prayer form post with stray `latitude` is accepted and ignored;
  - a Recent changes line for a location update reads "Edited musallah location: Latitude …".
- Done when: `npm run check` passes and the sandbox shows the same starts on home and `/prayer`.

### WP-4: Public map (P-4 look) with device-aware directions

- Purpose: replace the iframe box with the pinned MapLibre map and the D20 buttons.
- Depends on: WP-2; P-4 for the look and label only.
- Expected files:
  - `package.json`/lockfile (`maplibre-gl`, D-12; exact version recorded in Decisions when added);
  - `src/shared/ui/PinMap.tsx` + `PinMap.stories.tsx` (light and dark, loaded and error states);
  - `src/features/prayer/MusallahMap.tsx`, `src/features/prayer/LocationMap.tsx`, `src/features/prayer/prayer.module.css`; delete `MapEmbed.tsx`;
  - `src/features/contact/ContactCallingCard.stories.tsx`;
  - `src/styles/tokens.css` (`--map-*` only if P-4 = Quiet Paper; the dot colours either way; label contrast ≥ 4.5:1);
  - `next.config.ts` (CSP);
  - `src/features/privacy/PrivacyLedger.tsx` "Optional map": today it names OpenStreetMap and the button "Load OpenStreetMap map"; it becomes the D-10 paragraph (loads as you scroll, names OpenFreeMap), or the privacy page becomes false;
  - `tests/e2e/demo.spec.ts`.
- Reuse: `ButtonLink` (outline), tokens via `getComputedStyle`, `.map`/`.mapLabel` styles. No `InkRing` around the pin (the user asked to remove the big circle).
- Required changes:
  - Design → Public box and Map look.
  - D-6: MapLibre code loaded only when the box comes into view (not on Save-Data, E-10); space reserved so nothing jumps.
  - ~~Attribution always visible.~~ Only the collapsed ⓘ map-data credit (D-15).
  - `cooperativeGestures` on (E-7).
  - Buttons: Google always; Apple only when `isAppleDevice` (E-6), Apple first.
  - Remove `frame-src` OpenStreetMap; add `connect-src` OpenFreeMap; add `worker-src 'self'`.
  - Only if P-4 = 3 + campus names: the campus-names route and its layer (Design → Map look).
- Must not:
  - add a Google or Apple map embed, a second map library, a satellite layer or any API key (D-14);
  - read the user agent on the server;
  - hardcode colours in TypeScript;
  - add a geolocation request (the `Permissions-Policy` `geolocation=()` stays);
  - load MapLibre on pages without the box.
- Tests:
  - unit `paperStyle` against a fixture of positron layer ids (only if P-4 = Quiet Paper);
  - only if P-4 = 3 + campus names: the route over a stubbed Overpass reply (names and centres only; an OpenStreetMap failure keeps the last copy or returns an empty list, never a 500 to the map);
  - e2e (Playwright devices "iPhone 15" and "Pixel 7"): iPhone shows two buttons with the exact URLs, Pixel shows one; scrolling to the box renders a canvas with no CSP violation in the console (network allowed in that one test, otherwise mocked); a page where the box is never scrolled to downloads no MapLibre file;
  - axe in light and dark;
  - Storybook stories build.
- Done when: the three pages show the box like the approved pictures in light and dark, at 390 px and 1280 px.

### WP-5: Pin section in Prayer & iqamah

- Purpose: any admin moves the pin without a developer.
- Depends on: WP-3 (shared `actions.ts` and prayer screen), WP-4 (`PinMap`).
- Expected files:
  - `src/app/admin/prayer-times/page.tsx` (the section), `src/features/admin/PinEditor.tsx`;
  - `src/features/admin/actions.ts` (`saveMusallahPinAction`);
  - `src/features/admin/tour/steps.ts` (new steps in the prayer tour; ≤ 25 words per step);
  - `src/features/admin/help-pictures.ts` + `public/admin-help/*.webp` (via `npm run help:pictures`);
  - `tests/tour.test.ts`, `tests/help-pictures.test.ts`, `tests/e2e/demo.spec.ts`.
- Reuse: `FormMessages`, `keepTyped`/`issuesOf`, `currentAdmin`, `calculationProblem`, `PinMap` (draggable), `GRENADA_BOUNDS`, `directionsLinks` (the "Try … directions" links).
- Required changes: Design → Pin editor; the action as in Data and State Flow; success notice per D-10.
- Must not:
  - add a delete or "clear pin" control, or a coordinates text box (D-5);
  - merge the pin into the prayer form or its version;
  - store anything in `localStorage` except the tour flag pattern already used;
  - add a new auth helper;
  - write through anything but `contentEditor()`.
- Tests:
  - e2e (sandbox): drag, save, then the public `/prayer` box and buttons use the new pin and Recent changes lists it;
  - saving prayer times while the pin was moved in another tab: both saves succeed (separate versions);
  - a drop outside Grenada snaps back with the D-9 line; a forged post outside Grenada is refused;
  - a conflict message with two tabs;
  - keyboard-only: focus the dot, move it with the arrow keys, save.
- Done when: a board member can complete "Move the musallah pin" from the help card alone.

### WP-6: Drop the retired prayer columns

- Purpose: finish the PR4 clean-up.
- Depends on: WP-3 merged; (critic) written and merged only after the PR7 Release PR is live (Compatibility and Migration step 6).
- Expected files: `supabase/migrations/<next free timestamp>_drop_retired_prayer_columns.sql`, `tests/prayer-migration.test.ts`.
- Reuse: the PGlite harness.
- Required changes: the single `alter table` in Public Contract, plus a header comment: "Apply only after the Release PR with PR7 is live in production."
- Must not: touch `exceptions`, `hijri_adjustment`, the activity log or any other table.
- Tests: the columns are gone; an existing row survives; saves and the activity trigger still work; no check constraint references a dropped column.
- Done when: the PGlite suite passes with all migrations in order.

### WP-7: Docs, release checklist and owner guide

- Purpose: keep docs true and short; give the board the Google listing steps.
- Depends on: WP-1–WP-6.
- Expected files and changes:
  - `docs/roadmap.md`: PR7 status.
  - `docs/architecture.md`: `pl --> plConfig` becomes the stored pin; prayer reads the pin.
  - `docs/guides/owner-setup.md`: §11 rewritten as "Confirm the musallah pin" (dashboard, no env); remove the `MUSALLAH_*` rows from Required variables; one line pointing to the in-app help card below.
  - (critic) `src/app/admin/help/page.tsx`: a text help card "Google Maps listing" with the Appendix A steps 1–7 (D-11: claim, after asking SGU); and one line in "Move the musallah pin": building names come from OpenStreetMap, where anyone can add a missing one. AGENTS.md makes in-app Help the board's only step-by-step source, and the board, not the site owner, runs the listing with the mosque Gmail. No pictures of Google's screens (they change, and PR5 has the same rule).
  - `docs/guides/board.md`: remove the "map pin → Site owner" row.
  - `docs/guides/prayer-times.md`: one pin.
  - `docs/guides/developer.md`: if it mentions the env map settings.
  - `docs/release-checklist.md` Unreleased:
    - What changed;
    - How to test (iPhone and Android buttons, dark mode, dashboard drag/paste);
    - Settings: WP-1 before the Release PR, WP-6 after it, then delete the three variables;
    - Needs your confirmation: the D-3 starting pin (walk to the entrance, compare, drag if needed), the distance query result, "prayer starts appear" if no coordinates were stored, the P-4 look, and E-1–E-10.
- Must not: add a new guide file; edit an accepted ADR; put board step-by-step steps in the owner guide (critic). ADR 0012's mention of `MUSALLAH_LOCATION_CONFIRMED` was an interim example, so no superseding ADR is needed. If the user wants a record, that is a new ADR, their decision.
- Tests: `tests/documentation.test.ts` (links, caps), `tests/agent-config.test.ts`.
- Done when: `npm run check` passes and the checklist lists every human step in order.

## Implementation Constraints

- Do not keep any reader of `MUSALLAH_*` or of `prayer_settings.latitude/longitude` after WP-3.
- Do not add a Google Maps or Apple MapKit embed, a satellite layer, an API key, a geocoding service or a paid tool (ADR 0009, D-14).
- Do not detect the device on the server or with a request header. Do not show the Apple button on non-Apple devices.
- Do not store visitor data. The map's only request to our server is the campus-names list (only if P-4 = 3 + campus names; no visitor data in it); it sets no cookies; no analytics events.
- Must not modify `record_activity` (PR6 replaces it) or any PR6 file beyond the merge-order rebase.
- Must not put colour values in TypeScript. `--map-*` tokens live only in `src/styles/tokens.css`.
- Must not create a second Supabase client, auth helper, global store or Context.
- Must not hand-write a second copy of the pin shape: zod in `schema.ts` + the migration only.
- Must not hide the written directions. They stay the primary accessible route.
- Must not apply migrations to hosted databases. A human does this, staging first, WP-6 only after release.

## Worker Escalation Conditions

Stop and emit `PLAN MISMATCH` when:

- PR6 has changed `config.ts`/`wiring.ts`/`providers.ts` so that the places wiring no longer fits;
- `maplibre-gl` 6.x cannot run its worker same-origin under Turbopack/`next build` without `blob:` in the CSP or a new build tool;
- OpenFreeMap needs a key or blocks requests;
- the PGlite or local Supabase tests show the drop migration breaks a constraint the plan does not cover;
- a page other than the three known ones renders `LocationMap`;
- `tests/agent-config.test.ts` or the doc caps cannot fit the owner-guide section;
- any P-decision a WP depends on is still open when that WP starts;
- the help-picture sandbox cannot drag a MapLibre marker deterministically (move it with the arrow keys for the picture instead);
- the chosen P-4 tiles need a key or account beyond what P-4 recorded, a card, or terms that do not fit a free, non-commercial club site.

## Test Strategy

- **Unit (`node --test`, `npm run check`):**
  - `directionsLinks`, `isAppleDevice`, `inGrenada`, `paperStyle` (if P-4 = Quiet Paper);
  - `musallahPinSchema` (range, region);
  - `calculatePrayers(place, now)` MWL fixtures;
  - `congregationTimes` with given starts;
  - `managedPrayer` unavailable path;
  - activity wording;
  - config without `MUSALLAH_*`;
  - the places conformance suite;
  - the tour and help-picture lists.
- **Database:** PGlite migration tests for WP-1 and WP-6; `scripts/test-backend.ts` RLS on local Supabase (anon read-only, admin update, no delete).
- **End to end (Playwright, sandbox):**
  - iPhone vs Pixel buttons and exact URLs;
  - scrolling to the box renders a map (no CSP errors); no MapLibre download when the box is not reached;
  - the Prayer & iqamah pin section: drag → save → public box + prayer starts + Recent changes;
  - conflict;
  - session expiry;
  - axe light and dark on `/prayer`, `/contact`, `/` and `/admin/prayer-times`.
- **Storybook:** `PinMap` light/dark/error; `ContactCallingCard` with the new box.
- **Manual (release checklist):**
  - real iPhone: both buttons open walking directions to the pin;
  - real Android: Google only;
  - Mac Safari: both;
  - Windows Chrome: Google only;
  - theme switch recolours the map;
  - the Google button opens walking directions to a dropped pin at the musallah (no place name, D-8).

## Acceptance Criteria

- On an iPhone, iPad or Mac, the "Find us on campus" box on the home page, `/prayer` and `/contact` shows **Apple Maps** and **Google Maps** buttons. On Android or Windows it shows only **Google Maps**. Each opens walking directions to the same pin.
- When the box scrolls into view, the map loads by itself and shows the pin as a small dot on the chosen P-4 map, with street and building names, in light and in dark, with the required attribution.
- A board member opens Dashboard → Prayer & iqamah → Musallah location, drags the dot, presses Save location, and within a minute (on the next page load) the public map, both buttons and the prayer start times use the new pin. Recent changes shows who moved it, from where to where.
- No `MUSALLAH_*` setting is needed in Vercel or `.env.local`; a deploy without them succeeds.
- Prayer start times on the live site differ from the day before the release by at most one minute (given the distance query result under 20 km), or appear for the first time if no coordinates were stored.
- After WP-6, the `prayer_settings` table no longer has `confirmed`, `method`, `madhab`, `adjustments`, `latitude` or `longitude`, and the Prayer & iqamah screen still saves and restores.
- The release checklist names the starting pin's source (the user, 2026-10-04) and asks the board to confirm it on site.

## Open Risks or Escalations

- In-view loading (D-6) means every visitor who scrolls to the box contacts OpenFreeMap (privacy page updated, D-10) and downloads about 250 KB of map code once; Save-Data visitors are spared (E-10).
- PR6 WP-1/WP-2 touch the same runtime files. They are merged into `integration` (#58, a7eff4a), so WP-2 rebases on them; no wait remains.
- The starting pin is Google's spot for "MSA Mosque", not a surveyed entrance. The board must confirm it on site (release checklist).
- Production `prayer_settings` coordinates are unknown to the planner. The owner's distance query decides whether the release visibly changes prayer starts.
- Apple's unified URLs need iOS 18.4 / macOS 15.4 or later. Older Apple devices may open Apple Maps without the route, but the Google button is beside it (E-5).
- OpenFreeMap is a free community service with no service-level promise. If it goes down, the directions buttons and written directions still work (Failure Modes).
- MapLibre 6 worker setup under Turbopack is unverified (escalation condition).

## Appendix A: Owner and board guide: the Google listing "MSA Mosque" (free)

This is the answer to "how, and if, we can set it up". **Yes, for free.** Google lets the people who run a place claim its listing. Then they can add the website, hours and real photos, and ask Google to remove photos that are not of the place. Use the **mosque Gmail**, so the listing stays with the MSA when the board changes. Google's own steps are cited in Appendix B. Google changes button names from time to time, so if a button looks different, look for the nearest match.

**Decide first (D-11):**

- Check with SGU, or whoever manages the room, that the MSA may manage the listing.
- Agree the name Google should show. Google asks for the name on the real-world sign, so it could be "MSA Mosque", "SGU Musallah" or another.

1. **Claim it** (computer). Sign in to Chrome with the mosque Gmail. Open https://maps.app.goo.gl/Sqtt3nAs21LQZPWn6. In the panel on the left, click **Claim this business**, then **Manage now**. On a phone: Google Maps app → search "MSA Mosque" → **About** → **Claim this business** → **Manage now**. If Google says someone else already manages it, click **Request access**; the current manager has to answer.
2. **Verify it.** Google picks the method itself: a phone call or text, email, a video recording, a live video call, or a postcard. You cannot choose. For a video, film in one take: the sign or entrance, the inside of the musallah, and something only the managers can do, such as unlocking the door or opening a storage cupboard. Google says its review can take **up to 5 business days**. While waiting, do not change the address.
3. **Add the website** (after the site address is final; today it is a launch blocker in the owner guide). Search "MSA Mosque" on Google while signed in → **Edit profile** → **Contact** → **Website** → paste the site address → **Save**.
4. **Hours.** **Edit profile** → **Hours** → set when the musallah is open (the board confirms these; the site lists them as "to be confirmed"). Use **Special hours** for Eid, exams or closures. For **Jumu'ah**, Google has no "prayer times" box. Put one line in the **Description** (up to 750 characters), such as "Jumu'ah every Friday. Current khutbah and iqamah times: (site address)/prayer". This keeps times in one place (our dashboard) and stops the Google listing going out of date.
5. **Add real photos.** Search the listing → **Photos** → **Add photos** (JPG or PNG, 10 KB to 5 MB, at least 720 × 720 pixels recommended). Add the entrance, the prayer hall and the wudu area. Follow the photography guide (`docs/guides/photography.md`): no faces without permission. Set a **cover photo** (Photos → **Add a cover photo**). Add the **logo** only once branding is approved (README: branding not yet approved).
6. **Remove the wrong photos.** Managers cannot delete other people's photos, but they can ask Google to: listing → **Photos** → **View all photos** → open a wrong photo → **Report a problem** (bottom right) → choose **"Not a photo or video of the place"** → **Submit**. Do this once per photo; repeat reports slow the review. Google says it takes several business days. Photos the MSA uploaded itself can be deleted directly: open the photo → **Delete**.
7. **Check the pin.** If Google's pin is not on the entrance: **Edit profile** → **Location** → drag the pin → **Save**. Then drag our dot to the same spot (Prayer & iqamah → Musallah location) so both match.
8. **No-claim alternative.** Any signed-in Google account can open the listing → **Suggest an edit** → **Change name or other details** → website, hours, location → **Send**, and can report each wrong photo (open photo → **More** (⋮) → **Report a problem**). Google reviews each suggestion; there is no guarantee, and no one can remove photos reliably this way.
9. **Optional: Apple Maps.** Apple's free **Apple Business** (formerly Business Connect, https://businessconnect.apple.com) lets the MSA claim the Apple Maps place card in the same way (sign in with an Apple Account → find the place → verify → add photos, hours and website). Our Apple button routes to our pin either way.

## Appendix B: Sources (checked 2026-10-04)

- Google Maps URLs (directions, `api=1`, `destination`, `destination_place_id`, `travelmode`, no key, 2,048-character limit): https://developers.google.com/maps/documentation/urls/get-started
- Apple unified Maps URLs (`/directions?destination=…&mode=walking`, iOS 18.4 / macOS 15.4+): https://developer.apple.com/documentation/mapkit/unified-map-urls
- Apple forum, `daddr=lat,long` regression and the recommendation to adopt unified URLs: https://developer.apple.com/forums/thread/784030
- OpenFreeMap quick start (styles positron, liberty, bright, dark, fiord; no key; required attribution; host `tiles.openfreemap.org`): https://openfreemap.org/quick_start/
- MapLibre GL JS (CSP directives, `setWorkerUrl`, v6 ESM): https://maplibre.org/maplibre-gl-js/docs/
- Add or claim a Business Profile (free; Claim this business → Manage now; request access): https://support.google.com/business/answer/2911778
- Verification methods (Google chooses; up to 5 business days): https://support.google.com/business/answer/7107242
- Edit your Business Profile (Edit profile, website, hours, special hours, 750-character description): https://support.google.com/business/answer/3039617
- More hours: https://support.google.com/business/answer/9876800
- Manage photos (add, cover, logo, delete own; JPG/PNG 10 KB–5 MB, 720 px): https://support.google.com/business/answer/6130714
- Report inappropriate photos (owners cannot delete customer photos; "Not a photo or video of the place"; several business days): https://support.google.com/business/answer/6130451
- Add, remove and report photos in Google Maps (anyone): https://support.google.com/maps/answer/2622947
- Suggest edits to a place: https://support.google.com/maps/answer/7084895
- Guidelines for representing your business (real-world name): https://support.google.com/business/answer/3038177
- Apple Business Connect introduction (free): https://www.apple.com/newsroom/2023/01/introducing-apple-business-connect/
