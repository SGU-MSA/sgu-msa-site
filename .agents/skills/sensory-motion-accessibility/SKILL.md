---
name: sensory-motion-accessibility
description: Ensures the interface respects sensory needs and user preferences, covering prefers-reduced-motion, prefers-contrast, prefers-reduced-transparency, forced-colors (Windows High Contrast), information not conveyed by color alone, target sizes, reflow at 320 px and 200 percent zoom, text spacing and flashing limits. Use when adding animation, translucency, custom checkboxes or icons, status indicators or charts, or when auditing accessibility beyond markup. Not for designing motion timing (use motion-system-orchestration), palette and contrast ratios (use color-systems-contrast-intelligence) or keyboard focus behavior (use keyboard-navigation-systems).
---

# Sensory and motion accessibility

The same content must work for people who reduce motion, raise contrast, force system colors, zoom, or cannot distinguish colors.

## In this repo

- `src/app/globals.css` neutralizes animations, transitions and smooth scrolling under `prefers-reduced-motion: reduce`. Design CSS gates entrance motion behind `prefers-reduced-motion: no-preference`. New motion follows the same opt-in pattern.
- Icons render through `SiteIcon`; keep them on `currentColor` so they follow forced colors.

## Reduced motion

- Non-essential motion (entrance reveals, parallax, auto-advancing carousels, decorative loops) is removed or replaced with a short opacity change.
- Essential motion (a progress indicator) may stay but slows down and never flashes.
- Never rely on an animation finishing to reveal content: with motion off, content must be visible immediately.

```css
.reveal {
  opacity: 1;
}
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    animation: fade-up var(--transition-standard) both;
  }
}
```

## Contrast, transparency and forced colors

- `prefers-contrast: more` and `prefers-reduced-transparency: reduce`: translucent or blurred surfaces become opaque, and muted borders and text strengthen.
- `forced-colors: active`: the system replaces colors. Keep a `1px solid transparent` border on cards, buttons and inputs so their edges show; use system color keywords (`CanvasText`, `ButtonText`, `Highlight`) for custom controls; use `forced-color-adjust: none` only where a custom control would otherwise disappear.
- Background images carrying meaning disappear in forced colors; provide text.

## Color and other cues

- No information by color alone: status, required fields, event categories and selected states also use text, icons, shape or weight.
- Disabled controls differ by more than opacity (cursor, text, or a pattern).

## Size, zoom and reflow

- Targets at least 24×24 CSS px (WCAG 2.2 AA); 44×44 preferred for primary controls.
- At 320 px width (equivalent to 400% zoom) content reflows to one column with no horizontal scroll, except data tables.
- Text survives 200% zoom and increased letter, word and line spacing without clipping (no fixed heights on text containers).

## Flashing

Nothing flashes more than three times per second, regardless of motion settings.

## Verify

Toggle the preferences in Chrome DevTools Rendering (emulate reduced motion, contrast, forced colors) or the OS settings, and check each designed page. Axe catches only some of this.

## Failure modes

- Content stuck at `opacity: 0` when animations are disabled
- Custom checkbox invisible in Windows High Contrast
- Required fields marked only in red
- Fixed-height cards that clip text at 200% zoom
