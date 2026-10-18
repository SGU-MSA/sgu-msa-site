# 0018. Design direction: Quiet Paper

- Status: Accepted
- Date: 2026-10-03

## Context

The six review themes (`courtyard`, `stone`, `commons`, `tide`, `journal`, `coastal`) were one layout with swapped colours, and the board did not take to any of them. D1 explored new directions on real content (prayer times, events, donate) with pictured options, Claude Design artboards and local prototypes. The full option history is in the [D1 contract](../contracts/d1-design-direction.md).

## Decision

- **Direction: Quiet Paper** (wabi-sabi + minimalism). Warm paper, ink type, generous space, paper sheets layered behind sections and photos, and a hand-drawn ink ring around the next prayer.
- **Themes: one design, light and dark.**
  - Dark is **Dusk** (warm charcoal, gold ring).
  - Light keeps two candidates until the board picks one: **Paper** (warm paper, black ink) and **Green Ink** (whiter paper, deep green ink).
  - The site follows the visitor's device setting until they tap a header **theme switch**. The switch is the Magic UI round button; the choice is remembered on that device, and the theme is applied before the page appears (no flash).
- **Type:** Instrument Serif (display), Instrument Sans (body), Amiri Quran (Arabic), Cormorant Garamond (fine spaced capitals).
- **Arabic reminders on every page, Arabic only:**
  - **Margin notes (hāshiya):** a short verse beside a section, matched to its purpose. Examples: 4:103 on Prayer, 5:2 on Events, 3:92 on Donate.
  - **Dhikr of the hour:** in the Home hero. Morning, after-prayer, Friday, evening or night remembrance, chosen from the same calculated prayer times.
  - **Tasbih thread:** 99 beads down the margin that fill as the visitor scrolls, with سبحان الله · الحمد لله · الله أكبر at each 33.
  - A small **"?"** toggletip beside each reminder opens its meaning, reference and source by tap, click or keyboard. Screen readers always get the meaning.
- **Respect rules:**
  - Scripture and dhikr are set level (never tilted), never placed behind or under other text, never shown as faint wallpaper, and never placed beside delete or trash controls.
  - Verse text comes from the Tanzil Uthmani text (via api.alquran.cloud), with meanings from Sahih International. Adhkar come from Hisn al-Muslim. Every string is reviewed by the board before launch.
- **Hijri date** sits with the prayer times. It reads English first ("22 Rabiʻ II 1448 AH") with the Arabic small beneath, beside a small ink moon. It is calculated with Umm al-Qura and moves to the next date at Maghrib.
- **Logo:** the official seal, as the crisp-text vector draft, recoloured through the theme's ink tokens.
- **Scope:** the public site is restyled first (roadmap PR2, then PR8). The dashboard is restyled after Track A's PR3–PR7 screens land.
- Decided by the user (D1, 2026-10-02 to 2026-10-03). Rejected:
  - Lantern Night, Clear Timetable, Campus Tiles, Arches & Spice, Dawn Light and Mashrabiya;
  - a "richer" layer of English ghost words and a word band;
  - tilted Arabic;
  - the SmoothUI sun–moon switch, whose third "follow my phone" step reads as a missed tap;
  - Higgsfield AI video backgrounds (paid; [ADR 0009](0009-free-tools-only.md)).

## Consequences

- PR2 replaces the six themes with one token set for light and dark.
  - It retires `src/config/design.ts`, `review.css`, `npm run review`, the `SITE_DESIGN` setting and its validation, and `tests/e2e/themes.spec.ts`.
  - It adds Storybook, free font packages, and free registry pieces: Magic UI theme toggler, blur-fade and noise texture, and the Animate UI Radix popover, with `motion` and `radix-ui`. These are subject to the PR2 contract's dependency decisions.
- Reminder text starts in content files. Making it board-editable is a roadmap gap for PR5 (self-serve content).
- A board **+1 / −1 day Hijri adjustment** belongs with the prayer settings (roadmap PR4), because local moon sighting can differ from the calculation.
- The board still picks one light palette (Paper or Green Ink); the other is then removed.

## Notes

- 2026-10-05: the MSA is a student club run by its board (user, answer to Q91). The review of every string before launch named above is done by the board.
