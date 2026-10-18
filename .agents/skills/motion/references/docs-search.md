# Documentation and example search

The Motion Codex finds the official Motion API documentation, working code
examples, and Motion UI components and sections.

Call it **before** implementing any non-trivial animation: drag, sliders,
reveals, gestures, scroll animations, layout animations, `useTransform` and
more. It is at least worth checking whether an example already exists. Then
build from the result rather than writing from memory.

This project uses only the free **Motion** MCP server (key `motion`,
`https://mcp.motion.dev`, no account). It carries `search-motion-docs` and
`generate-css-easing`. The paid Motion+ server and its tools
(`search-motion-source`, `save-transition`, `open-transition-editor`) are not
used.

## 1. Search

```
search-motion-docs({ platform, searchTerm })
```

-   **platform** (required): exactly one of `"js"`, `"react"`, `"vue"`. This
    project uses `"react"` (and `"js"` for vanilla code).
-   **searchTerm** (required): the component or concept to find, e.g.
    `accordion`, `useSpring`, `scroll`, `drag`, `AnimatePresence`, `stagger`,
    `hero`.

### Search by concept, not by the word "animation"

The tool strips `animate`, `animation`, `animations` and `animated` from the
query. A search of only those words returns "too generic". Search the _thing_
being animated or the _API_ needed:

-   ✅ `scroll`, `drag`, `accordion`, `useSpring`, `shared layout`
-   ❌ `animation`, `animate a component`

Matching is fuzzy and typo-tolerant. Minimum 2 characters.

## 2. Return type

A short set of adaptation rules, followed by MCP **resource links** and, where
content is gated, a metadata block instead.

-   Up to **3 docs** first, for API and option lookups:
    `motion://docs/{platform}/{id}`. Available to everyone.
-   Up to **5 examples**: `motion://examples/{platform}/{id}`.
-   **Motion UI** (`platform: "react"` only): components and sections,
    `motion://ui/react/{id}`. Each is **multi-file**: the source, its
    transitive Motion UI dependencies, and `motion.theme.ts`.

**Read each relevant resource link to get the actual doc, example or Motion UI
source.** Docs come first because they answer API questions.

If nothing matches, broaden the term and search again; results are capped and
fuzzy, not exhaustive.

## When a result is gated (Motion+)

Some examples and Motion UI items come back as a metadata block (title,
description, APIs, public demo link) instead of source. That content requires
a paid Motion+ subscription, which this project does not use.

-   **Tell the user what exists and link the public demo** (pages on
    `examples.motion.dev` and `motion.dev/ui/...` run the real thing).
-   **Do not reconstruct the source from the description.** A paraphrase of
    code you cannot see will not be the thing the user was shown.
-   Build what was asked from the free docs and the best-practices references.
-   Never import from `motion-plus` and never install it.

## 3. Implement

Follow the adaptation rules embedded in the response, plus:

-   Adapt colours, fonts and styling to this project: design tokens from
    `src/styles/tokens.css`, Tailwind utilities where the surrounding code uses
    them.
-   **Ask before adding a package.** `motion` is not yet a dependency of this
    project; adding it is a recorded decision.
-   **Never import from `framer-motion`**, only from `motion`. Migrate any
    existing `framer-motion` imports.
-   **Motion UI (free items):** paste and adapt **every file** in the resource.
    Do not use the shadcn CLI or a Motion UI registry entry for this path. If
    `motion.theme.ts` already exists, preserve it. Map shadcn-style semantic
    tokens to the project's tokens. Preserve the animation structure and
    reduced-motion behaviour.
-   Choose sensibly for the context: no bouncy springs on serious content.
