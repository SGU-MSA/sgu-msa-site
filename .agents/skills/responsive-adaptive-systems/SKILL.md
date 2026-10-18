---
name: responsive-adaptive-systems
description: Makes layouts adapt across viewport widths and heights, input types and zoom levels, using content-driven breakpoints, container queries, bounded clamp() sizing, touch-target sizing, hover-free alternatives, dynamic viewport units and content priority on small screens. Use when building or fixing a layout that breaks on phones, tablets or wide screens, when a component sits in containers of different widths, when tables or uploaded images overflow, or when touch and mouse need different affordances. Not for type scale values (use advanced-typography-systems), spacing tokens (use design-token-architecture) or visual emphasis (use visual-hierarchy-composition).
---

# Responsive and adaptive systems

Layouts should break where the content breaks, not at device names.

## In this repo

- Styling is Tailwind 4 utilities plus plain CSS in `src/styles/*.css`. Tailwind 4 ships default breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) and built-in container queries (`@container`, `@sm:`, ...). Follow what the surrounding file uses; do not add a second breakpoint system.
- Page width and gutters come from `--content-width` and `--content-gutter`; sections from `--section-y`.
- `html` has `min-width: 20rem`: design down to 320 CSS px.
- Board members upload photos of any size and aspect ratio and write text of any length. Layouts must survive both.

## Rules

- Phone layouts are first-class designs, not desktop columns stacked vertically. Decide what moves, shrinks or collapses and why.
- Prefer container queries for components that appear in different-width slots (cards in a grid vs a sidebar).
- Fluid values use `clamp(min, preferred, max)` with both bounds; never unbounded `vw`.
- Use `dvh`/`svh` instead of `100vh` for full-height areas (mobile address bars).
- Touch targets: at least 24×24 CSS px (WCAG 2.2 AA), 44×44 preferred for primary controls.
- Anything revealed on hover must also work without hover: `@media (hover: none)` or always-visible affordances.
- No horizontal page scroll at 320 px or at 200% zoom.
- Images: reserve space with `aspect-ratio` (or `fill` + sized parent with `next/image`) and choose `object-fit` deliberately; uploaded portrait photos must not blow up a landscape slot.
- Wide tables (prayer timetables, admin lists): either restructure into stacked rows on small screens or use a labelled scroll container with a visible scroll cue. Never let a table widen the page.
- Long words and URLs from content: `overflow-wrap: anywhere` on user-supplied text blocks.

```css
.event-list {
  container-type: inline-size;
}
@container (min-width: 36rem) {
  .event-card {
    display: grid;
    grid-template-columns: 12rem 1fr;
    gap: var(--space-lg);
  }
}
@media (hover: none) {
  .event-card__actions {
    opacity: 1;
  }
}
```

## Verify

Check at 320, 390, 768, 1024, 1280 and 1440+ px widths, in portrait and landscape on a tablet width, and at 200% browser zoom. Use real content, including the longest title in `content/` and an empty optional field. Playwright `page.setViewportSize` is the scripted route (see frontend-testing-visual-qa).

## Failure modes

- Breakpoints at device widths instead of where the content breaks
- Critical content hidden on mobile instead of redesigned
- `100vh` hero cut off behind the mobile address bar
- Hover-only actions with no touch or keyboard path
- Media queries on a component that lives in variable-width containers
- Only testing with lorem ipsum at exact breakpoint widths
