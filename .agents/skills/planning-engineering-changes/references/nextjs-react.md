# Next.js and React in this repo

Next.js 16 App Router, React 19, TypeScript, Tailwind 4. This Next.js differs from training data: confirm APIs in `node_modules/next/dist/docs/` (or `mcp__next-devtools__nextjs_docs`) before planning around them.

## Layers and ownership

| Layer | Path | Owns |
| --- | --- | --- |
| Routes | `src/app/**/page.tsx`, `layout.tsx` | Composition, params, page-level `requireAdmin()` redirects |
| Features | `src/features/<feature>/` | Workflows and UI for one feature; admin mutations in `src/features/admin/actions.ts` |
| Shared UI | `src/shared/ui`, `src/shared/layout` | Presentation reused across features |
| Domain and data | `src/lib/**` | Schemas, rules, ports and adapters, backend access, integrations |
| Runtime | `src/lib/runtime/**` | Validated configuration, server clock, adapter choice, the composition point (ADR 0012) |
| Request proxy | `src/proxy.ts` | Session cookie refresh and `no-store` headers for `/admin/*` (this is not an authorization layer) |

Lint enforces the direction: `src/lib` and `src/shared` never import routes or features; feature `.tsx` never imports `@/lib/backend/*`, providers or `@supabase/*`; feature and shared `.tsx` never import `@/lib/runtime/*`; only `src/lib/runtime/providers.ts` imports adapters; only `src/lib/runtime/config.ts` reads `process.env`.

## Classify state before choosing a tool

| State | Default home |
| --- | --- |
| Local UI (open/closed, tab) | `useState` in the component |
| Form | Native `<form action>` + `useActionState` (see `ContentEditor.tsx`) |
| URL / navigation (filters, month) | Search params |
| Server data (records, prayer settings) | Server Components reading `src/lib/community/queries.ts` |
| Session / admin identity | `currentAdmin()` / `requireAdmin()` in `src/lib/backend/server.ts` (they ask `adminAuth()`) |
| Editorial copy | `content/*.yaml` via `getX()` in `src/lib/content` (`EditorialSource` port; developer-edited) |
| Deployment settings and site policies | `runtimeConfig()` and `deploymentProfile()` in `src/lib/runtime`, read by lib functions and routes; never `process.env`, never a default |
| Board-editable settings | Supabase rows (board-edited through `/admin`) |

Server data is not global client state: never copy it into a client store or Context. A Provider/Context is not a default; justify what it owns, its lifetime, its subtree, and why props, imports or server data do not suffice.

## Components and hooks

- Pages compose capabilities and render state; business decisions live in `src/lib` (for example `isVisible`, `calculatePrayers`).
- Hooks are for React-facing behavior. Pure domain logic is a plain function that is testable with `tsx --test`.
- Component reuse test: is it the same concept, do the copies change together, is the shared API simpler than the copies, is the responsibility coherent? Otherwise keep it local.
- Model UI states as unions (`ready | unconfigured | unavailable`), not boolean combinations.
- Keep wire/DB and UI representations separate only where semantics differ.

## Server actions

- A server action is a public POST endpoint. Page-level `requireAdmin()` does not protect the actions on that page. Every mutating action calls `currentAdmin()` itself and returns a friendly error when it is null.
- Parse every `FormData` with the zod schema that owns the shape; never trust hidden inputs.
- Reuse the optimistic concurrency pattern: hidden `version` = `updated_at`, passed to `contentEditor().saveRecord(kind, row, version)`; a `conflict` result means "someone else changed this".
- Return only what the UI needs (`EditorState`), never raw rows or errors from Supabase.
- After a successful write, revalidate (`revalidatePath("/", "layout")` today) so the public site updates without a redeploy. Changing the caching model is an ADR-level decision.
- Deployment skew: old clients may call action IDs that no longer exist; plan user-facing recovery copy when changing action signatures.
- Thin actions write only through `contentEditor()` (ADR 0012 rule 6). A new write operation is a new `ContentEditor` method (or a new port) with a sample adapter, never a direct Supabase client call; do not add service layers on top.

## Data access

- Reads go through lib functions over the composition point's ports: `community/queries.ts` and `managed.ts` (`ContentProvider`), `getX()` (`EditorialSource`), `loadDonatePage`/`loadGiveTarget` (`PaymentsProvider`), `donationDestination` (`DonationLinkProvider`, until PR6 WP-9), `musallahDirections` (`PlacesProvider`). Do not create a second Supabase client or a data path that bypasses the ports or timeouts; a new source is a new adapter (developer guide, "Adding an adapter").
- Protected board reads go through `src/lib/backend/admin-content.ts` (over `contentEditor()`).
- Branch on data (`provenance`, `unavailable`, `state`) or on `deploymentProfile()` fields, never on demo mode or env.
- Frontend authorization (hiding a button) is a UX mirror; Supabase RLS and server checks enforce.

## Routing and rendering

- Routes are an architectural boundary: adding `/admin/<area>` means a dashboard card, board steps under "Handbook notes" in the PR body (the handbook is the only how-to, ADR 0028), and `requireAdmin()`.
- `/admin/*` is `private, no-store`; public pages must render an honest unavailable state if Supabase fails.
- New routes appear in `src/app/sitemap.ts` only when public.
- A prerendered page resolves its adapters at build time. Moving it to a database or Go2Pay adapter means request-time rendering plus revalidation from its save action.

## Contract changes

- Evolve additively: new optional fields first, then readers, then make required.
- Consider deployed clients, CDN/ISR caches and version skew when renaming fields or actions.

## Tests

- Unit tests: `tests/*.test.ts` with `node:test` via `npm test`. Each port has a conformance suite (`provider`, `editorial`, `payments`, `places`, `editor`); a new non-network adapter runs it.
- End-to-end: `tests/e2e/*.spec.ts` with Playwright (`npm run test:e2e`), including axe accessibility checks.
- Full gate: `npm run check` (lint, typecheck, unit tests, format check).
