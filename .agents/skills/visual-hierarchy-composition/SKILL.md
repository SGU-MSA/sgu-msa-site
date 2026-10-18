---
name: visual-hierarchy-composition
description: Sets visual hierarchy, spacing rhythm and surface depth for pages and sections, covering focal point, reading order, grouping and proximity, density, whitespace, elevation, shadows, borders, corner-radius nesting and dividers. Use when laying out or reviewing a page, hero, card grid or admin screen, when a layout feels flat, cluttered or inconsistent, or when deciding how surfaces separate. Not for token names or values (use design-token-architecture), breakpoints and fluid layout (use responsive-adaptive-systems), type scale (use advanced-typography-systems), palette and contrast (use color-systems-contrast-intelligence), or choosing between visual design options with the user (use designing-ui-components).
---

# Visual hierarchy and composition

Make the reading order obvious through size, weight, position, proximity and space before reaching for color or motion.

## In this repo

- Spacing, radius and section rhythm are tokens in `src/styles/tokens.css` (`--space-*`, `--radius-*`, `--section-y`, `--section-y-tight`, `--content-width`, `--content-gutter`). Light and dark change colour tokens only. Use them; propose a new token instead of a one-off value.
- Reuse the layout primitives in `src/shared/ui` (`Section`, `Container`, `PageHero`) before writing new wrappers.
- Board members write the content. Compose for real, variable-length text and missing photos, not ideal placeholder copy.
- Layout direction and look are design decisions. Present 2–3 options (mockups or screenshots) with a recommendation and let the user choose (project principle 2).

## Hierarchy

- One primary focal point per screen and one primary action per section. Squint test: blur the screen and the primary element still reads.
- Weight steps down predictably: primary, then secondary, then supporting. Never two equally loud calls to action.
- Proximity encodes relationship: related items sit tight (title + date), unrelated items are clearly separated.
- Size, weight and position carry hierarchy; color only reinforces it.
- Match the scan pattern to the content: Z for sparse landing sections, F for lists and text-heavy pages, one column for reading.
- Dense screens (admin tables, prayer timetables) still need one entry point and a clear reading flow.

## Spacing rhythm

- Every gap comes from the spacing scale; no 13px / 17px / 22px values.
- Space between groups is at least one scale step larger than space within a group.
- Vertical section rhythm uses `--section-y` / `--section-y-tight` so all routes share one grid.
- Every gap has a job: grouping, separation or emphasis.

## Surfaces and depth

- Pick one containment method per surface: background shift, border, or shadow. Do not stack a border and a heavy shadow on the same surface.
- Elevation follows interaction: page, card, sticky header, popover, dialog, toast. Use a named z-index token per layer; never `9999`.
- Shadow strength matches elevation; one named shadow per level.
- Nested radius: inner radius = outer radius − padding. Equal radii on nested boxes look pinched.
- Prefer whitespace as a divider; add a rule only where whitespace alone is ambiguous (dense lists, tables).
- Do not mix material metaphors (flat + heavy shadow + glass) on one page. Translucent surfaces need an opaque fallback (see sensory-motion-accessibility).

## Review checklist

- [ ] One clear focal point and primary action per screen or section
- [ ] Squint test passes
- [ ] Grouping matches meaning; group gaps larger than item gaps
- [ ] Spacing, radius and shadow values all come from tokens
- [ ] Holds up with long titles, empty optional fields and missing images
- [ ] Containment and elevation consistent with neighbouring sections

## Failure modes

- Every element equally emphasized, so nothing guides the eye
- Bold or color as the only emphasis
- Inconsistent gaps with no governing scale
- Pinched nested corners; z-index wars
- A visually dominant hero carrying low-priority content
