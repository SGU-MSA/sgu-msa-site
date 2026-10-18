---
name: core-web-vitals-optimization
description: Measures and improves page-load performance and Core Web Vitals (LCP, CLS, INP), covering image, font, video, embed and third-party script loading, priority hints, layout-shift prevention, client JavaScript size and performance budgets, with lab traces and real-user data. Use when a page loads slowly, content jumps while loading, taps feel laggy, large images or embeds are added, or before a release. Not for animation or scroll jank (use rendering-animation-performance), loading-state design such as skeletons (use state-input-flow-architecture) or server versus client rendering choices (use rendering-strategy-app-architecture).
allowed-tools:
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__emulate
  - mcp__chrome-devtools__performance_start_trace
  - mcp__chrome-devtools__performance_stop_trace
  - mcp__chrome-devtools__performance_analyze_insight
  - mcp__chrome-devtools__list_network_requests
---

# Core Web Vitals optimization

Targets at the 75th percentile of real visits: **LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms**. Measure with mobile throttling: a phone on mobile data is the hardest case to pass.

## Measure first

1. Lab, on a production build (`npm run build && npm start`; dev mode numbers are meaningless).
   - chrome-devtools MCP: `new_page` / `navigate_page` to the route, `emulate` a mid-range phone with CPU and network throttling, then `performance_start_trace` (with reload) → `performance_stop_trace` → `performance_analyze_insight` for the LCP breakdown, layout-shift culprits and long tasks. `list_network_requests` shows what loaded and in what order.
   - If the server is unavailable: Chrome DevTools Performance panel, or PageSpeed Insights for a deployed URL.
2. Field: `@vercel/speed-insights` is installed; real-user vitals are in the Vercel project dashboard. Lab passing while field fails means real devices or networks differ; trust the field.
3. Name the LCP element on each key page before changing anything.

## Images (usually the LCP)

- Use `next/image` (via `SafeImage` for content images) with an accurate `sizes`; never ship full-resolution phone photos.
- Board-uploaded images from Supabase Storage go through the image optimizer: the host must be allowed in `images` in `next.config.ts`; do not bypass it with a raw `<img>`.
- The LCP image: `loading="eager"` or `fetchPriority="high"` (Next 16 deprecated `priority`; `preload` exists but the docs prefer these). Never lazy-load it.
- Below-the-fold images stay lazy (the default).
- Always reserve space: `width`/`height`, or `fill` inside a parent with a set aspect ratio.

## Fonts

- Fonts load through `next/font/local` in `src/app/layout.tsx` with fallback metric adjustment. Keep it to the active design's display font plus the body font.
- No `font-display: block`.

## Layout shift (CLS)

- Reserve space for images, embeds and anything rendered after load.
- Banners such as the demo banner render on the server or have reserved height; never push content down after paint.
- Never insert content above what the user is reading.

## Responsiveness (INP)

- Keep click and input handlers short; move work to the server or break it up (`startTransition` for non-urgent UI updates).
- Smaller client components hydrate faster; see rendering-strategy-app-architecture.

## Video, maps and third parties

- Embeds (video, the OpenStreetMap location embed) use click-to-load facades or `loading="lazy"` iframes. The CSP in `next.config.ts` allowlists frame origins; adding one is a security review (frontend-security).
- Third-party scripts load through `next/script` with `afterInteractive` or `lazyOnload`, never blocking in `<head>`.

## Budgets

- Watch per-route JavaScript in the `next build` output; a route that jumps in size needs a reason.
- A new dependency in a client component must justify its weight.

## Checklist

- [ ] LCP element identified and prioritized
- [ ] Every image sized, responsive and optimized
- [ ] No layout shift from late content, fonts or banners
- [ ] Measured on a throttled production build

## Failure modes

- Lazy-loaded hero image
- Raw `<img>` of a 5 MB upload
- Announcement bar that pushes the page down after load
- Judging performance from `npm run dev`
