---
name: aria-complex-widget-accessibility
description: Applies ARIA roles, states, properties and live regions to custom interactive widgets such as dialogs, disclosure navigation, tabs, accordions, comboboxes, carousels, toasts and status messages, following the WAI-ARIA Authoring Practices and preferring native HTML first. Use when building or reviewing a custom widget, announcing dynamic updates like save confirmations, form errors or filter results, adopting a registry component, or fixing what a screen reader announces. Not for plain document structure (use semantic-document-architecture) or tab order, focus traps and shortcuts (use keyboard-navigation-systems).
---

# ARIA for complex widgets

First rule of ARIA: if a native element does the job, use it. ARIA changes what assistive technology hears, not how the element behaves.

## Native first

| Need | Use |
| --- | --- |
| Modal dialog | `<dialog>` opened with `showModal()` (focus containment, Escape and inert background built in) |
| Show/hide section, FAQ | `<details>`/`<summary>`, or a `<button aria-expanded aria-controls>` |
| Mobile nav menu | Disclosure button with `aria-expanded`; site navigation is **not** `role="menu"` |
| Choose one option | `<select>` or radio group |
| Toggle | `<button aria-pressed>` or `<input type="checkbox" role="switch">` |

Registry components (shadcn on Radix or Base UI) already implement these patterns. Verify them; do not layer extra roles on top.

## Required states

- `aria-expanded` always reflects reality (`false`, not absent, when closed).
- Tabs: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, one tab in the tab order (keyboard model in keyboard-navigation-systems).
- Combobox (ARIA 1.2): `role="combobox"` on the `<input>`, `aria-controls` the listbox, `aria-expanded`, `aria-activedescendant` for the highlighted option.
- Carousel: pause control, slide position ("3 of 5"), no auto-advance without a way to stop it.
- Dialogs and alertdialogs have an accessible name (`aria-labelledby` the title).

## Live regions

- Admin save confirmations and filter result counts: one persistent `role="status"` (polite) region whose text changes.
- Blocking errors (form failed to save): `role="alert"`, once; do not re-announce on every keystroke.
- The region must exist in the DOM before its text changes, or nothing is announced.
- Do not use `aria-live="assertive"` for routine updates.

## Names and descriptions

- Accessible names describe the action: "Delete event: Eid dinner", not "button".
- `aria-describedby` points at visible help or error text.
- `aria-hidden="true"` never goes on focusable or visible interactive content.

## Verify

- Axe in Playwright (frontend-testing-visual-qa) catches missing names and invalid roles.
- Then test manually with at least one screen reader: VoiceOver + Safari on iPhone or Mac, or NVDA + Firefox/Chrome on Windows. Listen for name, role, state and announcements.

## Failure modes

- `role="button"` on a div without keyboard handling
- `role="menu"` on the site navigation
- A status region created at the same moment as its message
- Extra ARIA added on top of a registry component that already had it
