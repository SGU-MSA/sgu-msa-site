---
name: cross-browser-error-resilience
description: Keeps the site working across browsers and partial failures, covering feature detection and @supports fallbacks, Safari and iOS quirks, progressive enhancement, Next.js error.tsx, global-error and not-found boundaries, retries for transient failures, partial rendering when one data source fails, and tolerance for missing or malformed board content. Use when using newer CSS or browser APIs, a bug appears only in Safari, Firefox or on iOS, adding error boundaries, or handling an unavailable Supabase, Storage or third-party service. Not for user-facing error copy and state design (use state-input-flow-architecture) or security issues (use frontend-security).
---

# Cross-browser and error resilience

A failure in one part should degrade that part, not the page. Every supported browser gets a working site.

## Browser baseline

Tailwind 4 already requires Safari 16.4+, Chrome 111+ and Firefox 128+; treat that as the floor. Changing it is a product decision. Test in WebKit (Safari or Playwright `webkit`), not only Chromium; every iPhone browser runs on WebKit.

## In this repo

- `src/app/error.tsx` and `src/app/not-found.tsx` exist; there is no `global-error.tsx` (root layout failures fall back to the built-in page). Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` before writing a boundary: Next 16.2 added an `unstable_retry` prop, and `reset` only re-renders without refetching.
- The backend may be down (pages show "temporarily unavailable", never sample data; ADR 0012). Public pages must still render with fallbacks.
- `SafeImage` already substitutes a placeholder for missing images. Reuse it.

## Error boundaries

- Add `error.tsx` at a route segment when one feature's failure should not take down its siblings; keep the root boundary as the last resort.
- Error UI says what failed, offers retry, and keeps navigation usable (copy rules in state-input-flow-architecture).
- Log on the server with enough context to debug; never show stack traces to visitors.

## Partial rendering and bad data

- Fetch independent sources independently; if events fail, the prayer times still render (Suspense boundaries or per-section try/catch with a fallback).
- Validate board and external data with zod at the boundary. One malformed record is skipped and logged, not a crashed page.
- Third parties (Go2Pay links, maps, video) degrade to a plain link with a description.
- Retry only idempotent reads, a few times with backoff. Never auto-retry a payment or a write.
- Non-critical failures (analytics, speed insights) stay silent to the user.

## Feature detection

- `@supports` in CSS and capability checks in JS (`"startViewTransition" in document`); never user-agent sniffing.
- Ship the baseline first; enhance when supported (container queries, `:has()`, view transitions, scroll-driven animations).

## Safari and iOS traps

- `position: sticky` silently fails when an ancestor has `overflow: hidden` or `auto`.
- `100vh` includes the browser chrome on iOS: use `dvh`/`svh`.
- Non-ISO date strings (`"2026-10-02 18:00"`) parse as Invalid Date: use ISO strings with an offset or the existing helpers in `src/lib/community/schema.ts` and `src/lib/prayer`.
- `backdrop-filter` may need the `-webkit-` prefix for the baseline versions; check before relying on it.
- Inputs under 16 px font size trigger zoom on focus.

## Checklist

- [ ] Works in WebKit and Chromium at phone width
- [ ] One failing data source leaves the rest of the page usable
- [ ] Malformed or missing board content renders a fallback
- [ ] Error boundaries offer retry and keep navigation
- [ ] Modern features wrapped in `@supports` or capability checks

## Failure modes

- Whole page replaced by an error because one optional section failed
- Sticky nav that works in Chrome and scrolls away in Safari
- Event times showing "Invalid Date" on iPhones
- Auto-retried form submission creating duplicates
