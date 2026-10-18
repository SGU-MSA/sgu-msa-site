# Admin UX gate

Required for every change to the dashboard (`/admin`) or to anything the dashboard controls on the public site. Planning lists what it needs, building uses the shared pieces, review checks every heading of the Final QA checklist. Source: the user's review of 2026-10-06 (sections 24 and 26).

## Contents

- Why this gate exists
- The 12 rules
- Shared pieces to build with
- Final QA checklist
- Completion rule

## Why this gate exists

The board is non-technical. A feature is not done because the save works. Ask two questions: "Does it work?" and "Can a normal board member understand it, misuse it, get stuck in it, or create a wrong state?"

## The 12 rules

1. **Prevent invalid actions.** If the app already knows an input is wrong, don't let the board pick it: disable past dates when only future dates make sense, limit season dates to the allowed range, hide permission boxes the person can't assign, keep drag-and-drop inside valid places. Use drag and drop for order, never typed order numbers.
2. **Never show implementation details.** No regex, database errors, schema or table names, internal ids, stack traces, raw zod text or "interpreted as" logic. Every message says what to do next in plain words ("Please enter a valid email address.").
3. **Every visible control works.** If an action is unavailable: hide it, or disable it with a short reason. Show permission controls only to people who can use them. No "Coming soon" buttons.
4. **No empty noise.** An empty list gets one short line ("No changes yet.") or the section is hidden. No paragraphs explaining what would appear.
5. **State is obvious.** The board can always tell: unsaved, saving, saved, scheduled, published, archived, disabled. "Saved" is a short message that fades, never a permanent banner and never `?saved=1` in the address.
6. **Say where it appears.** Every editor states where the content shows on the public site (Event: Calendar and Home; Fund: Donate; Person: About; Prayer: Prayer page and Home).
7. **One format everywhere.** 12-hour AM/PM times, the same date format, the same button words, the same archive behavior. Never accept a library's default format (24-hour browser time boxes) when it conflicts.
8. **Warnings fix themselves.** A notice is worked out from the current state on every load, so it disappears once the problem is fixed. Problems can't be closed by hand; plain information can.
9. **Build it once.** Save state, validation messages, notifications, archive buttons, date limits, previews, permission checks and image display are shared. Never fix the same problem separately on each page.
10. **Preview shows the real page.** Preview uses the real public components and the unsaved changes, full width, with desktop, tablet and phone sizes. No second simplified look-alike.
11. **Archive means one clear thing.** For anything archivable, say: hidden publicly? still in the dashboard? editable? restorable? kept in History? deletable for good? Something already archived shows Restore, View and Delete permanently, never Archive again.
12. **Images fit their kind.** Portraits: a fixed, consistent crop. Flyers: shown whole, never cropped. Logos: contain. Banners and decoration: cover. Check on a phone.

Also: **dates and times** say what rule applies and what visitors will see (avoid an unclear "Today"); **permissions** are shown correctly in the screen and still enforced by the server and RLS; **no product decisions** - new wording or behavior not in the contract goes to the user and under "You or the founder must decide" in `docs/release-checklist.md`.

## Shared pieces to build with

Use these instead of writing your own (names, not paths; find them in `src/shared/ui` and `src/features/admin`):

- **The shared DateField / TimeField:** 12-hour display, HH:MM storage, each use declares its rule (future only, a range, or any), invalid days are disabled.
- **The shared save-state indicator:** Unsaved changes, Saving..., then a Saved message that fades.
- **The shared error map:** turns every validation failure into plain words; a test refuses messages with regex, schema names or technical text.
- **The shared "Appears on" registry:** one list that gives every editor its "Appears on ..." line.
- **The shared notifications bell:** count plus panel, computed from current state.
- **The shared archive actions:** buttons that follow the item's state (Archive, or Restore / View / Delete permanently).
- **The shared full-page preview:** the eye button, real public page, desktop / tablet / phone widths.
- **The shared image component's fit choice** and the existing short empty states.

If one of these is missing for your case, extend it in its owner; never add a page-only copy.

## Final QA checklist

Every heading must pass or be explained in the review. Tick each line.

**Usability**

- [ ] Every label is plain and understandable; the board knows what will happen.
- [ ] No unnecessary controls; no technical words; no demo, sample or example labels.

**Validation**

- [ ] Wrong input is prevented (disabled dates and options, hidden controls), not refused later.
- [ ] Any remaining error message is written for people.

**State**

- [ ] Unsaved, saving and saved are clear; Saved fades.
- [ ] Loading, empty and error states are handled and short.
- [ ] Archived items show the right actions; fixed warnings disappear.

**Permissions**

- [ ] Unavailable actions are hidden or disabled with a reason.
- [ ] The server action and RLS also enforce the rule.

**Consistency**

- [ ] 12-hour times and the standard date format; the shared fields are used.
- [ ] Shared components used; wording matches the rest of the dashboard.

**Public result**

- [ ] The editor says where the content appears.
- [ ] The preview matches the real page; the real public page renders correctly.

**Responsive**

- [ ] Screenshots of every changed screen and state (empty, error, unsaved, saving, saved, archived, disabled) in light, dark, desktop, phone (390 px), and tablet (768 px) where layout changes, looked at.
- [ ] Long text and large or small images checked.

## Completion rule

A dashboard feature is complete only when:

1. Valid actions are easy.
2. Invalid actions are hard or impossible.
3. Errors are understandable.
4. State is obvious.
5. Permissions are shown correctly.
6. The public result is predictable.
7. Empty, error and archive states are handled.
8. It follows the rules above and uses the shared pieces.
