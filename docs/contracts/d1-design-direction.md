---
status: done
mode: light
---

# D1: Design direction

## Capability

The site gets one chosen visual direction (palette, type, shapes, imagery, motion personality, logo colors) for the PR2 design-system foundation. D1 produces evidence for the choice (artboards, prototypes, a picture board) and records the user's pick; it ships no production UI.

## Requested Behavior

- Shortlist 4–5 **new** directions (narrowed to two by the user, D-5) for a calm, welcoming, dignified campus musallah (`applying-design-styles`). The six old `data-design` themes (`courtyard`, `stone`, `commons`, `tide`, `journal`, `coastal`) and restyles of them are never offered.
- Explore every shortlisted direction in Claude Design: Home plus one inner page, with real site content (prayer times, upcoming events, donate). No `/design-sync`.
- Build the 2–3 finalists as local prototype routes on the throwaway branch `design/d1-prototypes` (worktree `.claude/worktrees/d1`, never merged; ADR 0016), using free registry components (shadcn / Magic UI / Motion MCPs, ADR 0009).
- Make a picture board: phone (390 px) and desktop (1440 px) screenshots of every finalist via chrome-devtools, for the user to walk the board through on a laptop.
- Logo: the teal seal from `~/Grenada/archive/logo-work/B.svg`, recolored per direction (its `ink` / `mint` / `cream` classes).
- The user picks; the pick is recorded as an ADR and in `docs/release-checklist.md` through a small PR into `integration`.
- Non-goals: tokens or components in `src/` on `integration` (that is PR2), dashboard restyle (PR8), dark mode, content or copy changes, final logo files and favicon (PR2).

## Existing System Evidence

- `src/config/design.ts` `designs`, `selectedDesign()`: the six discarded review themes; root `data-design` attribute set in `src/app/layout.tsx`.
- `src/styles/tokens.css`, `design.css`, `review.css`: current tokens and per-theme overrides (reference only: what didn't work).
- `src/shared/layout/SiteChrome.tsx`: wraps every route in Navbar/Footer, so prototype routes need their own shell.
- `content/home.yaml`, `content/site.yaml`, `content/prayer.yaml`: real copy, nav and photography for the artboards and prototypes.
- `src/lib/prayer/calculate.ts`, `congregation.ts`: real prayer times (MWL + Standard Asr, ADR 0017).
- `src/lib/demo/fixtures.ts`, `src/lib/community/providers`: sample events (demo mode, no database).
- `src/lib/integrations/payments.ts` `resolvePaymentDestination`: the donate destination (Go2Pay only, ADR 0005).
- `components.json`: free registries `@magicui`, `@smoothui`, `@unlumen-ui`, `@animate-ui`, `@react-bits`.
- `public/images/**`: existing site photography.

## Owner

Track B, D1 (`docs/roadmap.md`). Prototype code is owned by the throwaway branch only; the decision is owned by the new ADR.

## Source of Truth

- The chosen direction: the new ADR (indexed in `docs/adr/README.md`); `docs/roadmap.md` D1 status.
- Real content in prototypes is read from the existing loaders above, never re-typed copies (except Claude Design artboards, which receive pasted real copy).
- Screenshots: ignored `artifacts/d1/` folder; picture board at `artifacts/d1/board.html`.

## Product Decisions Required

- [x] Which inner page do the directions show next to Home?
      Options: Prayer (times, Jumu'ah, find the musallah); Calendar / Events; Donate
      Recommendation: Prayer — the most-used page and the hardest layout (a dense timetable); Home already carries events and donate.
      Decision: D-1
- [x] How will you show the picture board to the board?
      Options: a local page in the browser on your laptop (works offline, nothing published); a private claude.ai link you can share; a PDF
      Recommendation: local page on the laptop — no internet needed in the room, nothing published.
      Decision: D-2
- [x] Checkpoints: may I pause for your OK at the shortlist (before Claude Design) and again to pick the 2–3 finalists (before building)?
      Options: yes, both checkpoints; only the finalists checkpoint; no checkpoints, show everything at the end
      Recommendation: both — each step costs real time, and you decide every design choice.
      Decision: D-3
- [x] Claude Design artboards are private pages on your claude.ai account (only public site content, no personal data). OK?
      Options: yes; no, use local HTML mockups instead
      Recommendation: yes — it is what you asked for and stays private unless you share it.
      Decision: D-4

## Decisions

The direction is recorded in [ADR 0018](../adr/0018-design-direction-quiet-paper.md).

- D-1: Inner page is Prayer (user deferred to the recommendation, 2026-10-02; options rejected: Calendar / Events, Donate).
- D-2: Picture board is a local page opened on the laptop (chosen by the user, 2026-10-02; options rejected: private claude.ai link, PDF).
- D-3: Two checkpoints: user approves the shortlist before Claude Design, and picks the 2–3 finalists before building (chosen by the user, 2026-10-02; options rejected: finalists only, none).
- D-4: Claude Design artboards as private claude.ai pages (chosen by the user, 2026-10-02; option rejected: local HTML mockups).
- D-5: Explore two directions in Claude Design: Quiet Paper (wabi-sabi + minimalism) and Lantern Night (restrained Art Deco + Islamic geometry), each with a hint of Luxury typography for Arabic and Islamic messages and layered backgrounds (chosen by the user, 2026-10-02, over two rounds; rejected: Clear Timetable, Campus Tiles, Arches & Spice, Dawn Light, Mashrabiya; variants A2, A3, B2, B3 kept as ideas only).
- D-6: Build both directions as local prototypes for the picture board (chosen by the user, 2026-10-03). Copy, including Arabic and Islamic text, is not fixed: prototypes keep today's real copy; new wording is offered as options later (user, 2026-10-03).
- D-8: User leans to Quiet Paper (board to confirm) and asked for a richer background: ghost/watermark Arabic type that is large, tilted and faded, parallax layers, a scroll-velocity word band and paper grain, from free registries, built as a second "rich" version beside the current one (user, 2026-10-03; rejected: Higgsfield, a paid AI video tool, under ADR 0009). Background words are Arabic virtue words, not Quran verses or Allah's name, pending board confirmation, because some guidance discourages purely decorative use of the Quran.
- D-7: Quiet Paper is the chosen direction, committed now and built for real; board to confirm (user, 2026-10-03; rejected: Lantern Night and all earlier directions).
- D-9: Reminders: all three concepts (hāshiya margin notes, dhikr of the hour, tasbih thread), Arabic only, meaning behind a "?" toggletip; text from AlQuran Cloud (Uthmani) / Sahih International and Hisn al-Muslim; the board to confirm. Scripture and dhikr are always set level, never tilted (user, 2026-10-03; rejected: English ghost words and band; tilted Arabic).
- D-10: Light and dark themes with a header switch. Dark = Dusk. Light = Paper **and** Green Ink both kept until the board picks one (amended by PR8 D-5: the board picked Green Ink; Paper is removed). Theme switch: **A, the Magic UI round button** (one tap flips light/dark; follows the device until tapped). Chosen by the user after a live A/B test on 2026-10-03. Rejected: B, the SmoothUI sun–moon cycle; its third "follow my phone" step looked like a missed tap.
- D-11: Hijri date (Umm al-Qura) with the prayer times, English first and Arabic small beneath, advancing at Maghrib, with a small ink moon. A board ±1 day adjustment is a roadmap gap for Track A's prayer settings (user idea, 2026-10-03).

## Board Self-Sufficiency Check

D1 changes nothing the board edits; it is a one-time choice made by the user with the board. The chosen palette and logo colors become tokens in PR2. Whether the board may later change colors from `/admin` is a question for the PR2 contract (not decided here).

## Implementation Constraints

- Do not offer, adapt or start from the six discarded themes or their tokens.
- Do not run `/design-sync` or the DesignSync tool.
- Do not merge, or open a PR for, `design/d1-prototypes`; do not touch the main checkout's branch.
- Prototype routes live under `src/app/d1/<direction>/` with their own layout and styles scoped to that subtree; they must not change existing routes, `tokens.css` or `src/config/design.ts`.
- Paid or license-keyed registry items (Magic UI Pro, Motion+, Unlumen Pro) are excluded; registry installs on the throwaway branch need no dependency ADR (code is never merged), but list them in the ADR's Consequences for PR2.
- Payments copy names Go2Pay only; no other channel, recipient or "give elsewhere" link.
- Events in prototypes come from demo fixtures and are labelled sample data; prayer times are real calculations.
- Never touch Supabase or read `.env*`; run prototypes with `npm run demo`.

## Test Strategy

- Prototypes: `npm run demo`, then chrome-devtools screenshots at 390 and 1440 px; Lighthouse accessibility (mobile) on each finalist's Home; console clean; text contrast WCAG AA; `prefers-reduced-motion` gives a static page.
- Decision PR (ADR + release checklist + roadmap): `npm run check`, `reviewing-engineering-changes`.

## Acceptance Criteria

- You saw 4–5 new directions in Claude Design, each with Home and the inner page and real content.
- 2–3 finalists run locally at `/d1/<direction>` and `/d1/<direction>/<inner page>`, recolored seal logo included.
- `artifacts/d1/board.html` opens on your laptop with phone and desktop screenshots per finalist and a plain-language note on each.
- The chosen direction is an accepted ADR, `docs/roadmap.md` marks D1 Done, and `docs/release-checklist.md` Unreleased mentions it.
