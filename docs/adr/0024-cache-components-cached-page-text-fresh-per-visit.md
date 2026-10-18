# 0024. Cache Components: page text cached until a board save; fresh data streamed per visit

- Status: Accepted
- Date: 2026-10-05

## Context

The user's second demo review found pages slow (review-2 plan, PR-C). Every public route was `force-dynamic` ([PR5a contract](../contracts/pr5a-notices-events-continuity.md) E-1): the root layout waited for the database before sending anything, page text, verses, prayer settings and the musallah pin were read again on every visit, and each page carried about 100 KB of inline seal artwork. The board must still see a save on the next page load ([ADR 0002](0002-product-principles.md)), and an urgent notice must end at its exact minute. Next 16 replaces the old route settings with Cache Components (`"use cache"`, `cacheTag`, `cacheLife`; the installed `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`).

## Decision

- **Cache Components on** (`cacheComponents: true`). No route exports `dynamic`, `revalidate` or `fetchCache` (Next forbids them).
- **Cached until a board save:** page text, the verse library, prayer settings and the musallah pin (`cacheLife("max")`, one tag each in `publicCacheTags`, `src/lib/runtime/public-cache.ts`); a read that fell back because the database could not be reached is kept a few minutes only. Announcement rows: about a minute, filtered by the clock on every visit. The footer year: an hour.
- **Fresh per visit:** everything else (events, news, newsletters, the team, funds and tickets, anything that depends on "now"), read after `requestNow()` / `connection()`, streamed into the page behind the root `loading.tsx`; the urgent band in its own `<Suspense>`.
- **Every board save** calls `publicDataChanged()`: `updateTag` on every public tag (read-your-own-writes), then `revalidatePath("/", "layout")`.
- **The dashboard and address-based pages** (`/calendar/[eventId]`, `/community/[kind]/[id]`, Give, checkout) set `instant = false`: they are worked out on each visit, as before.
- **Off Vercel Production** (a developer's computer) built pages are kept in memory by `src/lib/runtime/local-page-cache.mjs` (`cacheHandler`), because Next's file cache compares two clocks that drift apart under WSL and could keep a page from before a save. Vercel keeps the pages in production.
- **Rejected:** keeping `force-dynamic` with `unstable_cache` (the older model, replaced by `"use cache"` in Next 16); `revalidateTag(tag, "max")` after a save (serves the old text once); finer per-save tags (saves are rare; a missed tag would show old text).

## Consequences

- Next keeps the last 3 visited pages in the browser, hidden (React `<Activity>`), for **Back**: their state (and a form's typed text) survives a return, and their HTML stays in the document, so browser code looks only at shown elements and e2e tests use visibility-aware locators. A dashboard page opened by a link starts over (`boardPage`, keyed on `useRouter().bfcacheId`), so text discarded in "Leave without saving?" never returns.
- A new data read must either be per visit (`requestNow()` first, never `clock().now()` before it: a `new Date()` in a page built ahead of time fails the live build) or cached with a tag that `publicDataChanged()` expires ([developer guide](../guides/developer.md#data-caching-and-time)).
- Next's development "instant navigation" check runs only where a page sets `instant` (`experimental.instantInsights.validationLevel: "manual-warning"`), so the sandbox shows no badge the live site never has.
- On Vercel Hobby, cached reads mean fewer Supabase queries per visit; cached entries start fresh after each deploy.
