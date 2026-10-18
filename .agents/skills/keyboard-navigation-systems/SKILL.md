---
name: keyboard-navigation-systems
description: Makes every interaction work from the keyboard alone, covering logical tab order, visible focus-visible styles, the skip link, focus placement when dialogs open and close or views change, Escape behavior, roving tabindex for composite widgets and safe keyboard shortcuts. Use when building menus, dialogs, drawers, tabs, admin editors or any custom control, or when focus gets lost, trapped, hidden or jumps unexpectedly. Not for ARIA roles and announcements (use aria-complex-widget-accessibility) or focus-ring color and contrast (use color-systems-contrast-intelligence).
---

# Keyboard navigation

Everything reachable and operable with Tab, Shift+Tab, Enter, Space, arrows and Escape, with focus always visible.

## In this repo

- The root layout renders a skip link to `#main-content` as the first focusable element. Keep it first and visible on focus.
- Focus color is the `--focus-ring` token. Restyle focus with `:focus-visible`; never remove the outline without a replacement.
- Next.js announces client-side route changes itself; do not add a second announcer. Manage focus deliberately for in-page view changes (filters, admin step changes, items removed from a list).

## Rules

- Tab order follows DOM order. Never use positive `tabindex`; only `0` (focusable) and `-1` (programmatic focus).
- Focus indicators have at least 3:1 contrast against the background in every design and are not hidden by sticky headers (`scroll-margin-top` on targets).
- Dialogs: prefer native `<dialog>` with `showModal()`. On open, focus the first meaningful control (or the dialog title); on close, return focus to the trigger. Escape closes the topmost layer only.
- Hand-rolled focus traps re-query focusable elements on every Tab (content changes while open) and are a last resort.
- Composite widgets (tabs, toolbars, radio groups, listboxes) are one Tab stop; arrows move inside (roving tabindex).
- When an item is deleted or a panel closes, move focus to a sensible neighbour, never to `<body>`.
- Custom shortcuts must not override browser or screen-reader keys and must be documented in the UI. Single-key shortcuts need a way to turn them off (WCAG 2.1.4).
- Hover-only menus also open with Enter/Space and close with Escape.

```ts
// Roving tabindex: one tab stop, arrows move within the group
function onKeyDown(e: React.KeyboardEvent, index: number, items: HTMLElement[]) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
    : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const next = (index + step + items.length) % items.length;
  items.forEach((el, i) => (el.tabIndex = i === next ? 0 : -1));
  items[next].focus();
}
```

## Verify

Unplug the mouse: complete the task (open the nav, read an event, submit a form, edit and save in the admin dashboard) with the keyboard only. Watch where focus lands after every open, close, save and delete. Playwright `page.keyboard` can script the critical paths (frontend-testing-visual-qa).

## Failure modes

- Focus disappears into the page behind an open dialog
- Focus lost to `<body>` after deleting an item
- Outline removed with no `:focus-visible` replacement
- Focused element hidden under the sticky navigation
- Radio group where every option is a separate Tab stop
