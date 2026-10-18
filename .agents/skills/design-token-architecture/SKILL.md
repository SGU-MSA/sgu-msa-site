---
name: design-token-architecture
description: Owns the design token system and light/dark theming, covering where color, type, spacing, radius, shadow, z-index and motion values live in src/styles/tokens.css, the Quiet Paper semantic tokens and the few legacy aliases left for the dashboard, how tokens map into Tailwind 4 theme utilities, how light (Green Ink) and dark (Dusk) override tokens through the data-theme attribute, and keeping brand values changeable in one place. Use when adding or renaming a token, removing hardcoded values, adjusting light or dark values, wiring a token into Tailwind, or preparing a value to become board-editable. Not for choosing palette colors or checking contrast (use color-systems-contrast-intelligence), type scale values (use advanced-typography-systems) or component variants (use component-api-design).
---

# Design token architecture

Every visual value has exactly one home, and components only consume semantic tokens.

## Layers in this repo

One design, Quiet Paper, in light and dark ([ADR 0018](../../../docs/adr/0018-design-direction-quiet-paper.md)).

1. **Semantic tokens** in `src/styles/tokens.css`, the only home of values: colour (`--paper`, `--paper-light`, `--paper-deep`, `--band`, `--ink`, `--muted`, `--rule`, `--ring`, `--thread`, `--on-ink-*`, `--shadow`, `--photo-filter`, `--seal-*`, `--focus-ring`, `--selection`, `--on-selection`, `--status-*`, `--category-*`, `--overlay-strong`), fonts (`--font-display`, `--font-body`, `--font-arabic`, `--font-lux`), `--type-*`, `--space-*`, `--radius-*`, `--section-y*`, `--transition-*`, `--motion-reveal` and the `--z-*` scale.
2. **Themes are token overrides on `<html>`**: light (Green Ink, the board's pick, PR8 D-5) on `:root`; Dusk on `[data-theme="dark"]`. The root layout's pre-paint script sets `data-theme` and `data-theme-choice` from `localStorage` `msa-theme` or the device; `ThemeToggle` writes the same attributes. No theme context, provider or store.
3. **Legacy aliases**: PR8 removed them from every public page. Six remain in one marked block (`--msa-gold`, `--msa-gold-light`, `--text-primary`, `--text-secondary`, `--border-subtle`, `--design-on-accent`) only because the dashboard sign-in form reads them; they go with the dashboard restyle. Never use them in new code. An alias is computed once on `<html>`, so it does not follow a scope that re-points tokens (the ink band in `src/shared/ui/page.module.css`); swapping one for its semantic token is only value-identical outside such scopes.
4. **Tailwind bridge**: `@theme inline` in `src/app/globals.css` mirrors tokens as utilities (`bg-paper`, `text-ink`, `border-rule`, `font-serif`...). Add a mapping there instead of arbitrary values like `bg-[#eee8dc]`.

## Rules

- Components use semantic tokens (or the mapped utilities), never literal hex/px values, never `dark:` variants and never `[data-design]` selectors (retired in PR2).
- Light and dark differ only through token values. A component that needs an `if (dark)` is a defect; add or adjust a token instead and check contrast in both themes.
- Follow the existing names. Do not start a parallel scheme such as `--color-primary-500`.
- Add a token only for a deliberate design knob or a value used in two or more places. Token sprawl is as harmful as hardcoding.
- Stacking uses the `--z-*` scale (base, raised, sticky, popover, dialog, skip-link), never literal numbers.
- Values that must live outside CSS stay in sync with `tokens.css` and say so: `themeColor` in `src/app/layout.tsx` and the favicon colours in `src/app/icon.svg`.
- Every token change is checked in Storybook's **Foundations/Tokens** page in light and dark.

## Board self-sufficiency

Values a board member may reasonably want to change (brand accent, the light palette) must stay single-sourced tokens, so a future admin setting can override them, for example as server-rendered custom properties on `<html>` from a validated database value. Whether to expose a value in the dashboard is a product decision: list it as an option and plan it with planning-engineering-changes; do not build it unasked.

## Other modes

`forced-colors`, `prefers-contrast` (which strengthens `--rule`) and reduced motion belong to sensory-motion-accessibility. A new theme or palette is a product decision (ADR 0018 keeps exactly light and dark).

## Quick checks

```bash
# Literal colors outside the token files (review each hit)
grep -rnE "#[0-9a-fA-F]{3,8}\b" src --include=*.tsx --include=*.css | grep -v "src/styles/tokens.css"
# Retired theming that must not come back
grep -rnE "data-design|dark:" src --include=*.tsx --include=*.css
# Arbitrary Tailwind values that should be tokens
grep -rnE "\b(bg|text|border|p|m|gap|rounded)-\[" src --include=*.tsx
```

## Failure modes

- Hex values in components that ignore the theme
- Two names for the same role (`--primary-color` next to `--accent`)
- A component that needs an `if (dark)` to look right
- New code reading a legacy alias (`--msa-gold`) instead of the semantic token (`--ring`)
- Spacing values that match no step on the scale
