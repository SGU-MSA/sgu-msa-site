---
name: rendering-animation-performance
description: Diagnoses and fixes runtime rendering jank, covering dropped frames, layout thrashing, expensive paints and blur effects, compositor-friendly animation properties, will-change and CSS containment, scroll handlers, long lists and main-thread work during scroll or animation. Use when scrolling or an animation stutters, a page feels heavy after it has loaded, or a performance trace shows long frames or forced reflows. Not for page-load metrics such as LCP and CLS (use core-web-vitals-optimization), deciding motion style or timing (use motion-system-orchestration) or Motion library usage (use motion).
allowed-tools:
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__emulate
  - mcp__chrome-devtools__performance_start_trace
  - mcp__chrome-devtools__performance_stop_trace
  - mcp__chrome-devtools__performance_analyze_insight
---

# Rendering and animation performance

Keep each frame under ~16 ms on a mid-range phone. Measure before and after every fix.

## Profile

- chrome-devtools MCP: `navigate_page` to the route, `emulate` with CPU throttling (4× or more), `performance_start_trace` (no reload), perform the scroll or interaction, `performance_stop_trace`, then `performance_analyze_insight` on the long frames, forced reflows or long animation frames it reports.
- If the server is unavailable: Chrome DevTools Performance panel with CPU throttling, plus Rendering → Paint flashing and Layer borders.
- Profile a production build; dev mode adds overhead.

## Rules

- Animate only `transform` and `opacity` (and `filter`/`clip-path` sparingly). Animating `width`, `height`, `top`, `left`, `margin` or `padding` runs layout every frame.
- Never `transition: all`.
- `will-change` only on elements about to animate, removed afterwards; never on many elements permanently.
- Batch DOM reads before writes. Reading `offsetHeight` or `getBoundingClientRect()` after a style write forces synchronous layout.
- Scroll effects: prefer `IntersectionObserver` or CSS (`position: sticky`, scroll-driven animations with a fallback) over `scroll` listeners. If a listener is unavoidable, make it `{ passive: true }` and update at most once per `requestAnimationFrame`.
- `backdrop-filter` and large blurs are expensive on phones, especially on sticky headers; test them throttled.
- Below-the-fold heavy sections can use `content-visibility: auto` with `contain-intrinsic-size` (without it, scrollbars jump).
- Long lists (admin tables): paginate or filter on the server first. Adding a virtualization library is a dependency decision.
- Heavy computation does not run in render or input handlers; move it to the server or defer it.

```css
/* Good: compositor-only, tokenized timing */
.card {
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}
.card:hover {
  transform: translateY(-2px);
}
```

## Checklist

- [ ] Trace recorded before and after, under CPU throttling
- [ ] Only compositor-friendly properties animate
- [ ] No forced reflows in scroll or animation paths
- [ ] Scroll work passive and frame-throttled

## Failure modes

- Height animation on an accordion with large content
- `will-change` left on dozens of cards
- A scroll listener that reads layout and writes styles each event
- Blurred translucent header that drops frames on phones
