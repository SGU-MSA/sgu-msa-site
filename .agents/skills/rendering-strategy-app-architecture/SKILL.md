---
name: rendering-strategy-app-architecture
description: Chooses where and when code runs in this Next.js 16 App Router site, covering Server versus Client Components, static versus dynamic rendering, caching and revalidation after admin edits, streaming with Suspense and loading.tsx, route and layout structure, server actions, proxy.ts and hydration mismatches. Use when adding a route or layout, fetching data, deciding on use client, making board edits appear on the public site without a rebuild, fixing hydration errors, or reducing client JavaScript. Not for metadata and structured data (use seo-metadata-structured-data), Core Web Vitals tuning (use core-web-vitals-optimization) or planning database, RLS or new admin capabilities (use planning-engineering-changes).
allowed-tools:
  - mcp__next-devtools__nextjs_docs
  - mcp__next-devtools__nextjs_index
  - mcp__next-devtools__nextjs_call
---

# Rendering strategy and app architecture

Server-render by default, ship the least client JavaScript, and make every board edit reach the public site without a developer.

## First, check the installed Next.js

This Next.js version differs from training data. Before using any routing, caching or rendering API, read the matching guide in `node_modules/next/dist/docs/`.

- With the next-devtools MCP server: `nextjs_docs` points at those docs; with `npm run dev` running, call `nextjs_index` to find the server, then `nextjs_call` with `get_errors`, `get_page_metadata` or `get_logs` to see real state.
- If the server is unavailable: read the docs folder directly and watch the `npm run dev` terminal output.

## In this repo

- Routes: `src/app`. Feature UI: `src/features/<feature>`. Server and data code: `src/lib` (`src/lib/backend` for Supabase server clients, `src/lib/content` for YAML loaders and zod schemas). Server-only modules start with `import "server-only"`.
- Request interception is `src/proxy.ts` (Next 16's replacement for `middleware.ts`).
- Admin server actions (`src/features/admin/actions.ts`) call `revalidatePath("/", "layout")` after writing.
- Two content sources: `content/*.yaml` (validated at build; changes need a deploy) and Supabase (editable in the admin dashboard).
- Dates and times use the mosque timezone (`TIMEZONE = "America/Grenada"` in `src/lib/community/schema.ts`) and the helpers in `src/lib/prayer` and `src/lib/validation`.

## Board self-sufficiency rules (principle 1)

- Board-editable data is read from the database at request time, or cached with an invalidation that the admin save triggers. Never bake it into the static build only.
- Every admin mutation revalidates what it changed. Prove it: edit in the dashboard, reload the public page, no rebuild.
- A new board-editable field is a planned change (planning-engineering-changes). Do not add YAML a board member cannot edit when the value is something they will want to change.

## Rendering rules

- Server Components by default; `"use client"` only on interactive leaves. Never fetch board data from the browser when a Server Component can.
- No waterfalls: start independent fetches together (`Promise.all`), and wrap slow independent sections in `<Suspense>`; use `loading.tsx` for whole-route loading.
- Hydration mismatches are bugs. Do not read `Date.now()`, `window` or the browser timezone during render; format times on the server in the mosque timezone, or render client-only values after mount.
- Server actions validate input with zod and re-check admin access (`currentAdmin()`) inside the action. Hiding a button is not authorization (see frontend-security).
- Secrets and service clients stay in `server-only` modules.
- Load heavy, client-only widgets with dynamic import so other routes do not pay for them.

## Choosing static or dynamic

| Data | Approach |
| --- | --- |
| Build-time YAML content | Static |
| Board-edited records (events, prayer settings, community) | Dynamic, or cached plus revalidation on save |
| Per-user or admin-only views | Dynamic, auth checked on the server |

Check the installed docs for the current caching directives before using them; they changed in Next 16.

## Checklist

- [ ] Read the installed docs for any API used
- [ ] Client components are leaves
- [ ] Board edits appear without a rebuild (verified)
- [ ] No hydration warnings in the dev console
- [ ] Server actions validate and authorize

## Failure modes

- `"use client"` at a layout, pulling a whole tree into the bundle
- Board edits visible only after a deploy
- Sequential awaits that could run in parallel
- Times that differ between server and client render
