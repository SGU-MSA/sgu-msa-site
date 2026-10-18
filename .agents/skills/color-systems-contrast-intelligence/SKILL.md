---
name: color-systems-contrast-intelligence
description: Designs and checks color use, covering palette roles, semantic status and category colors, WCAG contrast for every text, icon and focus-ring pairing in every design, color-blind safety, links in running text, and text placed over photos or user-uploaded images. Use when choosing or changing a color, adding a status or event-category color, checking contrast, or putting text on an image. Not for where color values are defined or how light and dark override them (use design-token-architecture), or forced-colors and reduced-transparency modes (use sensory-motion-accessibility).
---

# Color systems and contrast

Color reinforces hierarchy and meaning; it never carries meaning alone, and every pairing passes contrast in every design.

## In this repo

- Colours live only in `src/styles/tokens.css`: Quiet Paper semantic tokens (`--paper*`, `--ink`, `--muted`, `--rule`, `--ring`, `--on-ink-*`, `--status-*`, `--category-*`, `--overlay-strong`) for light (Green Ink, PR8 D-5) on `:root` and Dusk on `[data-theme="dark"]` ([ADR 0018](../../../docs/adr/0018-design-direction-quiet-paper.md)). A few legacy names (`--text-primary`, `--msa-gold`...) remain only for the dashboard sign-in form until its restyle; trust the semantic role, not the raw name.
- The site is light-only (`viewport.colorScheme = "light"`). Dark mode would be a product decision.
- Brand colors belong to the MSA and university. Agents verify contrast and propose compliant alternatives (2–3 swatches + recommendation); they do not pick brand colors.

## Contrast rules (WCAG 2.2 AA)

- Normal text 4.5:1; large text (24 px, or 18.66 px bold) 3:1.
- Icons that carry meaning, input borders, and focus indicators 3:1 against adjacent colors.
- Check every pairing in light (Green Ink) and dark (Dusk), including hover, focus and disabled states. Inverted bands (ink background, paper text) flip in Dusk: check both.
- Placeholder text and muted text (`--text-secondary`) are text: they must pass too.
- Links inside running text are distinguishable by more than color (underline, or 3:1 against body text plus a non-color cue on hover/focus).

## Meaning and safety

- Status (success, warning, error, info) always pairs color with an icon or text.
- Event-category colors (`--category-*`) always appear with the category label.
- Avoid red/green as the only distinction; the accent must not read as the error color.
- Saturated colors for accents only; large surfaces stay calm.

## Text over images

Board members upload any photo, so design for the worst case:

- Put text on a solid or scrim panel (`--overlay-strong`) rather than directly on the photo, or overlay a gradient strong enough for the brightest likely region.
- Re-check contrast at the lightest point under the text, not the average.

## New colors

- Generate new scales in OKLCH for perceptually even steps; keep existing values unless deliberately changing them.
- A new color becomes a semantic token before any component uses it (see design-token-architecture).

## Verify

`tests/e2e/theme.spec.ts` runs axe (including color-contrast) on every public page in light and dark at 390 and 1440 px against `npm run demo`; Storybook's a11y panel checks each primitive in both themes. Axe cannot judge text over images or states it never renders; check those manually with a contrast checker.

## Failure modes

- A pairing that passes in one design and fails in another
- Error state shown only as a red border
- Light text on an uploaded photo with no scrim
- Hard-coded hex values bypassing the semantic roles
