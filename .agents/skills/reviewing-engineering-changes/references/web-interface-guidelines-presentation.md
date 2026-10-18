<!-- Vendored: https://github.com/vercel-labs/web-interface-guidelines
     path: AGENTS.md (lines 66-156)
     commit: 434b7f91364665f2f733b310ec54809bf8f37937
     license: MIT, Copyright (c) 2025 Vercel Labs; see ../NOTICE
     Vendored: edit only the Project notes section. -->

## Contents

- Animation, Layout, Content & Accessibility, Content Handling, Performance, Dark Mode & Theming, Hydration, Design
- Project notes

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven; autoplay only for muted, non-essential loops
- MUST: Autoplay motion >5s alongside other content has pause, stop, or hide controls
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

## Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- SHOULD: `translate="no"` on brand names, code tokens, & identifiers to prevent garbled auto-translation
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Media has captions/transcripts/descriptions as applicable; controls are keyboard-operable; decorative media hidden from assistive tech
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

## Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`
- SHOULD: `<video autoplay muted loop playsinline>` over animated GIF; provide still/reduced-motion alternative
- SHOULD: Short non-essential loops include a Safari H.264 MP4 `<picture>` source, `prefers-reduced-motion` media condition, and still fallback

## Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

## Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)

## Project notes

Local text (the only part of this file that may be edited). How the rules above map to this stack; the first half of the guidelines is in [web-interface-guidelines-interactions.md](web-interface-guidelines-interactions.md).

- Motion is installed (`motion/react` through `src/shared/layout/MotionRoot.tsx`: `LazyMotion` plus `MotionConfig reducedMotion="user"`). CSS first; durations come from `--transition-fast`, `--transition-standard` and `--motion-reveal` (`motion-system-orchestration`, `motion`).
- Colours and both themes come from `src/styles/tokens.css` (Quiet Paper, Green Ink and Dusk, ADR 0018). `colorScheme` and `themeColor` are set in `src/app/layout.tsx`.
- Fonts are self-hosted with `next/font/local` (CSP `font-src 'self'`), so `preconnect` and manual font preload do not apply.
- Conflict: the contrast gate is WCAG 2 AA in both themes (`color-systems-contrast-intelligence`). APCA may be checked in addition but never replaces it.
- Conflict: "Locale-aware dates/times" does not apply. Dates and times are formatted on the server in `America/Grenada`, in English, to stay hydration-safe and match the musallah's clock (`rendering-strategy-app-architecture`).
- "Virtualize lists > 50" applies only when profiling shows a problem. Lists here are short and there is no `virtua` dependency.
- Copy follows the board's plain-language sentence case. Vercel's Title Case copywriting rules are not vendored.
