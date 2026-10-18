---
name: component-api-design
description: Designs and governs reusable React components, covering props and defaults, variants and sizes, full interaction-state coverage, composition with children, server versus client boundaries, override rules, naming consistency, deprecation, and reuse-before-create checks so the shared UI stays consistent. Use when creating or changing a component in src/shared or src/features, adding a variant or prop, reviewing components for consistency, or deciding whether to extend an existing component instead of writing a new one. Not for choosing a visual design or pulling components from shadcn or Magic UI registries (use designing-ui-components), ARIA roles (use aria-complex-widget-accessibility) or token values (use design-token-architecture).
---

# Component API design and consistency

Components should be easy to use correctly, hard to misuse, and look like they came from one system.

## In this repo

- Shared primitives: `src/shared/ui` (`ButtonLink`, `Container`, `Section`, `PageHero`, `SafeImage`, `FormCta`, `Meta`, `SiteIcon`, ...) and `src/shared/layout`. Feature components: `src/features/<feature>`. Search both before creating anything (principle 3: never duplicate).
- React 19: `ref` is an ordinary prop; new components do not need `forwardRef`.
- Server Components by default. Add `"use client"` only to the interactive leaf; props crossing into a client component must be serializable.
- Style with tokens via Tailwind utilities or the semantic classes in `src/styles/*.css`, matching the file you are in. Light and dark differ only through token values (`data-theme` on `<html>`), never component branches or `dark:` variants. Every shared component gets a Storybook story in both themes.
- Text a board member may want to change comes from validated data (zod schemas), never hardcoded in a component.

## Props

- Every prop is typed; use string unions (`variant: "primary" | "secondary"`) rather than `string`.
- Optional with sensible defaults wherever possible. Booleans are positive and default to `false` (`loading`, not `notLoading`).
- Callbacks are named `on<Event>` (`onSelect`, `onDismiss`).
- Spread native attributes onto the root element and merge `className` (do not replace it), so callers can add `aria-*`, `data-*` and test hooks.
- Prefer composition (`children`) over configuration-heavy props. More than ~8 props usually means two components.
- Links navigate, buttons act: `ButtonLink` for navigation, `<button>` for actions; never a clickable `div`.
- Changes are additive: add props with defaults; rename or remove only with a migration of every caller.

## Consistency across components

- One vocabulary: `variant`, `size`, `leadingIcon`/`trailingIcon`, `disabled`, `loading`. Not `kind` on one and `type` on another.
- Size scales line up: a small button and a small input share height so they sit together in forms.
- Every interactive component covers default, hover, `:focus-visible`, active, disabled, loading and error where relevant (motion details in motion-system-orchestration).
- Every content component handles empty, very long and missing-image content (`SafeImage` already falls back).
- Names are predictable: `Dialog` not `Modal2`, one `Card` with variants rather than five card components.

## Extend, compose or create

1. Can existing components be composed to do it? Compose.
2. Is it the same component with a different look or size? Add a variant.
3. Many call sites override the same style? That is a missing variant; add it.
4. Only then create a new component, named and placed beside its peers.

Shared CSS modules in `src/shared/ui` wrap every selector in `:where()` (zero specificity), and the element defaults in `globals.css` do too, so a page's own module class always overrides a shared one whatever order the stylesheets load in. Keep that when adding a shared module; never rely on import order.

Deprecate by migrating callers in the same change, or record the follow-up in the feature contract. Never leave two live versions.

## Checklist

- [ ] Searched `src/shared` and `src/features` for an existing component
- [ ] Props typed, defaulted and consistent with siblings
- [ ] Server component unless interaction requires client
- [ ] All interaction and content states handled
- [ ] No hardcoded board-editable text, hex values or arbitrary sizes

## Failure modes

- A near-duplicate of an existing component
- Swallowed native props, so callers cannot add `aria-label`
- `"use client"` on a whole page tree for one toggle
- Variant names that differ between components
