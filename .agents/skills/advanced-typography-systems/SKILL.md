---
name: advanced-typography-systems
description: Builds and applies the type system, covering type scale and bounded clamp() sizes, line height, tracking, reading measure, font pairing, variable font axes, font loading and fallback metrics, and mixed-script text such as inline Arabic. Use when setting or changing fonts, headings, body text or labels, fixing font-related layout shift, laying out long-form reading, or adding Arabic text like a verse or du'a. Not for text color or contrast (use color-systems-contrast-intelligence), emphasis and layout (use visual-hierarchy-composition) or token naming (use design-token-architecture).
---

# Typography systems

One type ladder for every route; text should read as designed, not merely rendered.

## In this repo

- Fonts are self-hosted with `next/font/local` from `@fontsource-variable/*` woff2 files in `src/app/layout.tsx`. Each named design gets one display font (`--design-font-display`); all share DM Sans for body (`--design-font-body`). `tokens.css` exposes them as `--font-display` / `--font-body`, and `globals.css` maps them to Tailwind `font-serif` / `font-sans`.
- Add a font the same way. No Google Fonts `<link>`, no second loading mechanism. Choosing a typeface is a design decision: show 2–3 options rendered with real content and recommend one.
- Scale and rhythm tokens: `--type-display`, `--type-h1`…`--type-h3`, `--type-body`, `--type-small`, `--type-label`, `--tracking-display`, `--tracking-label`, `--leading-display`, `--leading-body`. Use them; extend the ladder rather than adding one-off sizes.
- `next/font` handles fallback metrics (`adjustFontFallback`). Display fonts use `preload: false` because only the active design's font renders.

## Rules

- Sizes in `rem` so browser zoom and user font settings work. Fluid sizes use `clamp()` with both bounds.
- Body line height 1.5–1.7; headings 1.0–1.3 (tighter as size grows).
- Display text gets slight negative tracking (`--tracking-display`); small uppercase labels get positive tracking (`--tracking-label`). Never one letter-spacing for everything.
- Reading measure 45–75 characters (`max-width: 65ch` on prose).
- Body text at least 16 px on phones; form inputs at least 16 px so iOS does not zoom on focus.
- No `font-display: block`; keep `swap` with adjusted fallbacks.
- Keep font files per page minimal: one display + one body family.
- Respect each font's real axis range (do not request weight 200 from a 400–700 font).
- Avoid all-caps paragraphs and decorative display faces for body copy.

## Arabic and mixed-script text

- Wrap Arabic in an element with `lang="ar" dir="rtl"` so screen readers switch voice and punctuation flows correctly.
- The bundled Latin subsets do not include Arabic glyphs; text falls back to a system font. Adding an Arabic face (and which one) is a design decision; ask.
- Give Arabic with diacritics more line height (about 1.8–2.0) so marks do not collide.
- Never letter-space, uppercase-transform or fake-italicize Arabic; tracking breaks letter joining.
- Pair an Arabic quotation with its translation and source in the same figure (see semantic-document-architecture).

## Checklist

- [ ] Sizes and spacing come from type tokens
- [ ] Headings and body use their own line heights and tracking
- [ ] Prose measure constrained
- [ ] No layout shift when the web font swaps in
- [ ] Arabic marked with `lang`/`dir` and renders legibly

## Failure modes

- `px` sizes that ignore user zoom
- A new font loaded by a second mechanism, doubling requests
- Full-width paragraphs on a 1440 px screen
- Letter-spaced or italicized Arabic
