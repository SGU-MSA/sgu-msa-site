---
name: motion
description: Implements web animation with CSS or the Motion library (motion/react, formerly Framer Motion) following the official Motion AI Kit guidance, covering when to use CSS versus Motion, React and vanilla JS API rules, AnimatePresence exits, layout and shared-element animations, reduced motion with MotionConfig, CSS linear() spring and bounce easings, and searching free Motion docs and examples through the motion MCP server. Use when writing or fixing an animation, transition, gesture, drag, scroll effect or exit animation, importing motion or framer-motion, generating a CSS spring, upgrading Motion, or looking up a Motion API. Not for deciding the project's motion language and timing tokens (use motion-system-orchestration) or diagnosing jank from a trace (use rendering-animation-performance). Paid Motion+ features are excluded.
license: MIT
compatibility: Docs search and easing generation need the free motion MCP server (https://mcp.motion.dev); the references work offline.
allowed-tools:
  - mcp__motion__search-motion-docs
  - mcp__motion__generate-css-easing
metadata:
  source: https://github.com/motiondivision/ai-kit/tree/main/plugins/motion/skills/motion
  vendored: "true"
  upstream-commit: d1c5c26f424adfd47c112d894e9d424b57338c7e
---

# Motion

Animation for the web, done properly. Vendored from the Motion AI Kit (see `NOTICE`); "Project notes" below are local additions.

-   [Animation best practices](references/best-practices.md): universal rules for performance, design, accessibility and the MotionValue API. Read for any animation work.
-   [CSS or Motion](references/css-or-motion.md): read first when adding animation; which tool fits each effect.
-   [Motion for React](references/react.md): imports (including Server Components), AnimatePresence, layout animations, height to `auto`, reduced motion, Radix.
-   [Vanilla JS](references/vanilla-js.md): `animate` syntaxes and easing names.
-   [Base UI](references/base-ui.md): animating Base UI components (used by some shadcn registries).
-   [Documentation and example search](references/docs-search.md): "What options does X have", "Show me an example of X", "Add a Motion UI accordion".
-   [CSS spring and bounce generation](references/css-spring.md): "Generate a CSS spring with a bounce of 0.3 over 0.3s", named easing curves.

## MCP tools

-   `mcp__motion__search-motion-docs({ platform, searchTerm })`: docs, examples and Motion UI; read the returned resource links. Details in docs-search.md.
-   `mcp__motion__generate-css-easing({ kind, duration, bounce })`: CSS `linear()` springs and bounces. Details in css-spring.md.

If the motion MCP server is unavailable: the references are self-contained, so use them directly. For API lookups fall back to the context7 server (library `motion`) or https://motion.dev/docs. Tell the user the server key `motion` in `.mcp.json` / `.codex/config.toml` is not connected (setup: https://motion.dev/docs/ai-kit). Do not hand-write a `linear()` spring from memory; use a plain `cubic-bezier()` from css-spring.md instead.

## Upgrading Motion

"Upgrade Motion", "migrate from framer-motion" and similar all resolve through documentation search; there is no separate tool.

1. **Read the installed version first.** Check `package.json` for `motion` or `framer-motion` before searching. The guides walk from one version to the next, so the starting point decides which sections apply.
2. Search for `upgrade` on the project's platform. For React that resolves to `react/react-upgrade-guide` (it includes a `## Framer Motion` section); for vanilla JS, `js/upgrade-guide`. Coming from GSAP, search `migrate from gsap`.
3. **Read the whole page and follow it in order. Do not summarise it.** Each section assumes the previous ones have been applied.
4. Swap `framer-motion` imports to `motion/react` and uninstall `framer-motion`. They must never both be installed.

## Free tier only

This project uses the free `motion` package and the free Motion MCP server only. Motion+ (MotionScore audits, source search, the visual transition editor, saved transitions and the `motion-plus` components such as `Carousel`, `Ticker`, `AnimateNumber`, `Typewriter`, `ScrambleText`, `Cursor`, `splitText`) is excluded.

-   Do not configure the Motion+ server, import from `motion-plus`, or install it. `import { Carousel } from "motion/react"` fails.
-   When search returns a gated item, name it, link its public demo, and build from free docs instead. Never reconstruct gated source.
-   For animation performance audits use rendering-animation-performance (Chrome DevTools traces) instead of MotionScore.

## Project notes

-   `motion` is a dependency since PR2 (design-foundation D-1), used by BlurFade, TasbihThreadView and the popover in `src/shared/ui`. Still prefer CSS per css-or-motion.md; a new animation library is a dependency decision recorded in a contract.
-   Timing and feel come from the project's motion language (motion-system-orchestration) and tokens (`--transition-fast`, `--transition-standard`, `--motion-reveal`). A mosque and student community site does not overshoot by default.
-   Server Components: plain `motion` elements via `import * as motion from "motion/react-client"`; hooks, `AnimatePresence` and `MotionConfig` belong in a `"use client"` leaf.
-   Reduced motion: CSS motion is already neutralized in `src/app/globals.css`, and one `<MotionConfig reducedMotion="user">` (`src/shared/layout/MotionRoot.tsx`) wraps the app and Storybook. Components that move content (BlurFade, the tasbih thread) also check `useReducedMotion()` and render static.
-   Never import from `framer-motion`.
