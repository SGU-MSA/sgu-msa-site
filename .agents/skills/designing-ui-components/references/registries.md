# Component registries

Configured in `components.json` (repo root). Free tiers only. URLs come from
the official shadcn registry index (`https://ui.shadcn.com/r/registries.json`).

| Namespace     | Site           | Strength                                 | License (verify per item)                    |
| ------------- | -------------- | ---------------------------------------- | -------------------------------------------- |
| `@magicui`    | magicui.design | Animated accents, marquees, text effects | MIT                                          |
| `@smoothui`   | smoothui.dev   | Subtle microinteractions                 | MIT                                          |
| `@unlumen-ui` | ui.unlumen.com | Animated primitives (free slugs only)    | Free-tier license: use and modify, no resale |
| `@animate-ui` | animate-ui.com | Animated Radix-style primitives          | MIT + Commons Clause: use freely, no resale  |
| `@react-bits` | reactbits.dev  | Text effects, backgrounds, showpieces    | MIT + Commons Clause: use freely, no resale  |

Commons Clause and the Unlumen terms allow use inside a site but forbid
selling or redistributing the components themselves. Whether those terms
are acceptable is the user's call; ask before the first install from these.

## Rules

- Paid tiers are excluded: Magic UI Pro, Unlumen UI Pro, Motion+. Unlumen
  serves free and Pro items from one URL; a Pro slug asks for a license key
  or fails with 401/403. Never add a key or header to `components.json`.
- React Bits items come in four variants; use the `-TS-TW` one
  (TypeScript + Tailwind), e.g. `@react-bits/BlurText-TS-TW`.
- Some React Bits items pull heavy libraries (`gsap`, `three`, `ogl`).
  Any new dependency is a user decision: record it in the feature
  contract's Decisions; write an ADR only if it affects several features
  or is hard to reverse (ADR 0001).
- Animate UI writes to `src/components/animate-ui/...` regardless of
  aliases. Move the files into `src/shared/ui/` after install and fix the
  imports, or ask the user before keeping a second folder.

## Before the first install (one-time, user decision)

Nothing from shadcn is installed yet. Registry items import `cn` from
`@/lib/utils`, which does not exist. The first install therefore also needs
`npx shadcn@latest add utils` (adds `src/lib/utils.ts` and the `cn` npm
package; the classic alternative is `clsx` + `tailwind-merge`). Most items
also add `motion`; some add `class-variance-authority` or Radix packages.
Show the `--dry-run` output and let the user approve the dependencies.

## Commands

```bash
npx shadcn@latest info                        # confirm aliases and CSS path
npx shadcn@latest search @smoothui -q "tabs"  # search one registry
npx shadcn@latest view @magicui/marquee        # inspect files and deps
npx shadcn@latest add @magicui/marquee --dry-run   # preview, writes nothing
npx shadcn@latest add @magicui/marquee --diff      # compare with local copy
```

`components.json` uses `rsc: true`, `tsx: true`, Tailwind 4 (empty
`tailwind.config`), CSS at `src/app/globals.css`, and aliases
`ui -> @/shared/ui`, `components -> @/shared`, `utils -> @/lib/utils`,
`hooks -> @/shared/hooks`. Changing any of these is an ADR.
