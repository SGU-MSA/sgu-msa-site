---
name: seo-metadata-structured-data
description: Implements technical SEO and link-preview metadata with the Next.js Metadata API, covering unique titles and descriptions, canonical URLs, Open Graph and social images, robots and noindex rules for demo or staging, sitemap.ts and robots.ts, and JSON-LD for the organization, events and other public content. Use when adding or changing a public route, making metadata follow board-edited content, fixing link previews in WhatsApp or social apps, or auditing SEO. Not for HTML structure and headings (use semantic-document-architecture) or rendering mode choices (use rendering-strategy-app-architecture).
allowed-tools:
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__lighthouse_audit
---

# SEO, metadata and structured data

Every public page is findable, previews well when shared, and describes itself from the same data it renders.

## In this repo

- Root `generateMetadata` in `src/app/layout.tsx`: `metadataBase` from `siteUrl` (`src/lib/site-config.ts`), title template `%s | <short name>`, Open Graph and Twitter defaults from `content/site.yaml`, and `noindex` whenever demo mode is on.
- `src/app/sitemap.ts` and `src/app/robots.ts` exist. The home page emits Organization JSON-LD (`src/app/page.tsx`) with `<` escaped.
- Check the installed Metadata API docs in `node_modules/next/dist/docs/` before using a field you have not used here.

## Rules

- Each route exports `metadata` or `generateMetadata` with a unique title (≤ 60 characters before the template suffix) and description (≈ 120–160 characters).
- Derive metadata from the same data the page renders: event pages from the event record, and so on. A board edit must update the title, description and preview image too (principle 1). Never hand-type a duplicate.
- Canonical URLs via `alternates.canonical`, resolved against `metadataBase`; one canonical per page.
- Open Graph images are 1200×630. An event's uploaded image can serve as its `og:image` (through the optimizer, absolute URL); otherwise use a route `opengraph-image` file or the site default.
- The sitemap includes database-backed public records (events, community pages) and must not list drafts, admin or demo routes.
- Demo, preview and staging deployments are `noindex`. Admin routes are never indexed.
- Do not block CSS, JS or images in `robots.ts`.
- Link text describes the destination ("Ramadan iftar schedule"), not "click here".

## Structured data (JSON-LD)

- Organization (already on the home page); consider schema.org `Mosque` / `PlaceOfWorship` for the prayer space page.
- `Event` for each public event: `name`, `startDate`/`endDate` with timezone offset, `location`, `eventStatus`, `eventAttendanceMode`, `organizer`. Add `offers` only for paid events, with the Go2Pay product link as `offers.url` and the real price in USD.
- Content must match what is visible on the page. Never add ratings, reviews or claims that are not on the page.
- Build the object from typed data and inject with `JSON.stringify(data).replace(/</g, "\\u003c")` in a `<script type="application/ld+json">`.

## Verify

- chrome-devtools MCP: `navigate_page` to the route, then `lighthouse_audit` for the SEO category (and accessibility). If the server is unavailable, run Lighthouse from Chrome DevTools or PageSpeed Insights on a deployed URL.
- Validate JSON-LD with the Schema.org validator or Google's Rich Results Test.
- Paste the URL into a chat app or a link-preview debugger to see the real card.

## Failure modes

- Every page titled with the site name only
- Event preview still showing an old title after the board edited it
- A staging deployment indexed by search engines
- Unescaped JSON-LD built from board-entered text
