<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SGU MSA site — agent instructions

Canonical instructions for every coding agent (Claude Code reads this via `CLAUDE.md`; Codex reads it directly). Human guides: maintainers → [developer guide](docs/guides/developer.md#working-with-ai-agents); board → the handbook `handover/SGU-MSA-Website-Handbook.docx`.

## Principles (see [ADR 0002](docs/adr/0002-product-principles.md), [ADR 0005](docs/adr/0005-payments-channel-policy.md))

1. **Board self-sufficiency.** Anything a board member may want to change must be doable from the admin dashboard — no code edit, no redeploy. Prefer dashboard-managed data over hardcoded or YAML config.
2. **Agents never make product or design decisions.** Offer 2–3 options with a recommendation (pictures when visual); the user decides.
3. **Plan before code; never duplicate.** Find and reuse the existing owner of a concept before adding anything.
4. **One source of truth** for every contract: feature contracts in `docs/contracts/`, data shapes in zod schemas + Supabase migrations.
5. **Pictures over text** for anything a board member reads.
6. **Payments: Go2Pay only.** No other channel or recipient appears in code, dashboard or current docs; never build anything that hides money from university reporting.
7. **Design for change.** Keep board-owned choices configurable through the dashboard; reuse existing ports and isolate real variation with focused abstractions.
8. **$0 spending ceiling.** Never enable a paid plan, add-on or overage without a new explicit user decision; check billing controls before enabling services.

## Agent SOP

1. Use `managing-project-work` before substantive work and before finishing: link/reuse a GitHub ticket, update the Project/milestone, explain scope and keep the user informed. Read `docs/adr/README.md` (then `docs/roadmap.md`, `docs/architecture.md`) before planning; accepted ADRs bind you. Tickets track execution; the roadmap summarizes scope ([ADR 0029](docs/adr/0029-tracked-work-and-zero-spend.md)).
2. Plan non-trivial work with the `planning-engineering-changes` skill: draft in `.plans/<feature>.md`, validate with `node scripts/validate-plan.mjs <file>` (`--light` for small changes). Trivial fixes skip the contract but not the checks.
3. Ask the user every product/design question; record the answer in the contract's `Decisions` section or a new ADR. Approved contracts live in `docs/contracts/<feature>.md`.
4. Implement only the approved contract. If the repo contradicts it, stop and emit `PLAN MISMATCH` (Expected / Observed / Impact / Files) instead of improvising.
5. Follow [ADR 0032](docs/adr/0032-delegated-implementation-and-human-merge.md): a capable planner specifies work; a lower-cost implementer writes code; a separate capable reviewer verifies the final diff and tests; the maintainer reviews and merges. Do not merge under the superseded standing permission. Run `npm run check`, then review the diff with the `reviewing-engineering-changes` skill. Add your entry to **Latest changes** in `docs/release-checklist.md` (what changed, how to test, settings, anything needing confirmation; tell the user about new confirmation items). Branch from and open PRs against `main` (fill in `.github/pull_request_template.md`); merging publishes. Use a temporary `integration/<feature>` branch only for several dependent PRs ([ADR 0033](docs/adr/0033-pull-requests-merge-to-main.md)).
6. Shared staging MCP supports read/write; writes must stay within the authorized task and approved contract. Production connections must be project-local and Git-ignored; connection tests or production operations require explicit user authorization. Never read or print `.env*` values or secrets. Schema changes are new additive migration files dated after the baseline (`supabase/migrations/202610150001`-`202610150004` are never edited), applied by a human, staging first, with the user's OK.

Use the shared roles in [.agents/roles/planner.md](.agents/roles/planner.md), [implementer.md](.agents/roles/implementer.md) and [reviewer.md](.agents/roles/reviewer.md). Delegate product, test and tooling code; planners/reviewers may write process docs and run diagnostics. Each handoff names the issue, approved contract, base revision, allowed files, acceptance tests and stop conditions. Native client agent files only select a model and reference these roles. Fixes return to the implementer; review is repeated before human handoff.

## Where things live

| Concern                                                                                                                                                                                                                                                                                                                    | Owner                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Routes and pages                                                                                                                                                                                                                                                                                                           | `src/app/**` (public pages, `admin/**`, `media/[name]`)                                                                        |
| Feature UI + admin server actions                                                                                                                                                                                                                                                                                          | `src/features/<area>/**` (`admin/actions.ts` = content save/archive/restore/sign-in; `people-actions.ts`, `access-actions.ts`) |
| Configuration (the only `process.env` reader), server clock, adapter choice, composition point                                                                                                                                                                                                                             | `src/lib/runtime/**`                                                                                                           |
| Supabase clients, `currentAdmin`/`requireAdmin`, upload checks, password rule, board ports (`ContentEditor`, `AdminAuth`, `PeopleEditor`, `ActivityLog`, `PaymentItemEditor`, `SeasonEditor`, `MerchEditor`, `OrderEditor`; `AccountInviter` and the daily check's `WarningLedger`: the only secret-key holders, ADR 0022) | `src/lib/backend/**`                                                                                                           |
| Dashboard-managed data: schemas + `ContentProvider` port                                                                                                                                                                                                                                                                   | `src/lib/community/**` (zod `schema.ts`)                                                                                       |
| Sample fixtures and the local sandbox store (sample adapters only)                                                                                                                                                                                                                                                         | `src/lib/demo/**`                                                                                                              |
| YAML starter text and developer-owned parts (the live site reads page text from the dashboard)                                                                                                                                                                                                                             | `content/*.yaml`, read through the `EditorialSource` port in `src/lib/content/**`                                              |
| Prayer times, maps (`PlacesProvider`), calendar, payments (`PaymentsProvider`, `PaymentGateway`: the only Go2Pay caller)                                                                                                                                                                                                   | `src/lib/prayer`, `src/lib/maps`, `src/lib/calendar`, `src/lib/integrations`                                                   |
| Shared UI primitives and layout                                                                                                                                                                                                                                                                                            | `src/shared/ui`, `src/shared/layout`                                                                                           |
| Design tokens; one design, light and dark (`data-theme` on `<html>`)                                                                                                                                                                                                                                                       | `src/styles/tokens.css` (values), `src/styles/design.css`, `src/app/globals.css`                                               |
| Database schema, RLS, storage rules                                                                                                                                                                                                                                                                                        | `supabase/migrations/**`                                                                                                       |
| Session refresh for `/admin/*`                                                                                                                                                                                                                                                                                             | `src/proxy.ts`                                                                                                                 |

Data sources sit behind ports (`<capability>/providers/contract.ts`). Only `src/lib/runtime/providers.ts` imports adapters, only `src/lib/runtime/config.ts` reads `process.env` (no defaults), and code never asks "is this the demo?" ([ADR 0012](docs/adr/0012-ports-adapters-and-fail-fast-configuration.md)). New data source: [Adding an adapter](docs/guides/developer.md#adding-an-adapter).

## Commands

`npm run dev` · `npm run check` (lint + typecheck + unit tests + format; the PR gate) · `npm run build` · `npm run test:e2e` · `npm run storybook` / `npm run build-storybook` (shared UI in light and dark) · `npm run agents:sync` (after editing `.mcp.json`).

## Skills

- Skills live only in `.agents/skills/<name>/SKILL.md`; `.claude/skills` and `.codex/skills` are compatibility symlinks. Both clients read the same rules and skills; client-specific files are adapters, never independent policy sources. Each `description` says when to use the skill.
- Start with: `managing-project-work` (tracking), `planning-engineering-changes` (before code), `reviewing-engineering-changes` (before a PR), `designing-ui-components` (any new or restyled UI), `rendering-strategy-app-architecture` (server/client; board edits appear without a rebuild), `frontend-testing-visual-qa`, `frontend-security`.
- Vendored skills (`motion` from Motion's AI Kit; `applying-design-styles`, authored by the maintainer) carry `metadata.vendored: "true"` and a `NOTICE`; edit only their "Project notes" sections.
- Size budgets (tested in `tests/agent-config.test.ts`): this file ≤ 150 lines, SKILL.md ≤ 200 (vendored ≤ 500), references ≤ 150.

## Design SOP

- Any new or restyled page, section, admin screen or component: follow `designing-ui-components` (audit → pictured options → user picks → free registry component → adapt to tokens → verify).
- A dashboard feature is not done until it passes the [admin UX gate](.agents/skills/reviewing-engineering-changes/references/admin-ux-gate.md).
- Reuse `src/shared/ui` and `src/styles/tokens.css` first; new UI must work in light and dark (`data-theme`; ADR 0018) and gets a Storybook story in both.
- Registries are free only, configured in `components.json`. Always `--dry-run` first. A new dependency needs the user's approval, recorded in the feature contract's Decisions; write an ADR only if it affects several features or is hard to reverse ([ADR 0001](docs/adr/0001-record-architecture-decisions.md)).
- Early exploration may use Claude Design (`/design`) or HTML mockups/screenshots, but the user decides on in-context option preview links (`option/<topic>-<n>` branches, Vercel previews).

## MCP servers

`.mcp.json` owns shared servers for any compatible client. Git-ignored `.mcp.local.json` may add project-local servers but cannot override shared names. `npm run agents:sync` generates ignored Codex config and shared skill metadata; add `-- --claude-local` to synchronize private additions through Claude's native local scope. `npm ci` prepares Codex config automatically; tests detect drift ([ADR 0031](docs/adr/0031-agent-neutral-setup-and-staging-writes.md)).

| Server          | Use for                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| next-devtools   | Next.js 16 runtime/build errors, routes, official Next docs — before changing routing or rendering                                                                                                      |
| chrome-devtools | Shared project browser: persist logins only for GitHub/Supabase/Vercel; use isolated contexts for all other websites. Debugging a page: console, network, perf traces, Lighthouse a11y/SEO, screenshots |
| shadcn          | Search/view/install components from the free registries in `components.json`                                                                                                                            |
| magicui         | Browse the free Magic UI catalog when choosing an effect or section                                                                                                                                     |
| motion          | Motion docs search before writing any animation (free server only)                                                                                                                                      |
| context7        | Current docs for other libraries (React, Supabase JS, Tailwind, zod, …)                                                                                                                                 |
| supabase        | Staging, read/write: inspect/query data and use authorized write tools; follow the migration procedure above                                                                                            |
| vercel          | Deployment status and logs. It can deploy — keep approval prompts on; never deploy unasked                                                                                                              |
| maestro         | Android-browser testing: `scripts/emulator/up.sh` first (set `AVD_NAME` when several AVDs exist), `down.sh` when done; if adb can't reach a server, ask the user to start it                            |

Codex loads `.codex/config.toml` only after the repo root is trusted; then `codex mcp login supabase` / `codex mcp login vercel`. OAuth credentials persist outside Git. Claude asks to approve servers on first use (`/mcp`); register private additions with `--scope local`. Vercel: verify the project’s actual account/team before setting scope. Older unscoped requests worked; a scoped 404 is not proof of expired authentication. Test an actual project request before claiming access works.

## Docs map

- Board: `handover/SGU-MSA-Website-Handbook.docx`, the only board how-to (the board owns and edits it); `docs/guides/board.md` points to it. Board steps for a new feature go in the PR body under "Handbook notes"; `/admin/help` only points to the handbook and lists the "Show me how" tours ([ADR 0028](docs/adr/0028-board-how-to-in-one-handbook.md)).
- Testing and release: `docs/release-checklist.md` (every PR adds a **Latest changes** entry).
- Owner (accounts, hosting, Gmail for invite emails, sign-in settings, first admin, backups): `docs/guides/owner-setup.md`. Developers: `docs/guides/developer.md`. Topics: `docs/guides/prayer-times.md`, `docs/guides/photography.md`.
- Decisions: `docs/adr/` (immutable; supersede, don't edit — ADR 0001). Feature decisions: `docs/contracts/<feature>.md`.
- Architecture: `docs/architecture.md` (Mermaid) — update it in the same PR that changes a flow. Roadmap: `docs/roadmap.md`. Provider notes: `docs/proposals/`. `docs/archive/` is history, not instructions.
- Guides are capped and every local doc link is tested (`tests/documentation.test.ts`); extend a guide instead of adding one.

Private access: use `scripts/agents/github.sh` for GitHub CLI. Optional owner credentials and the shared browser profile live only under ignored `.agents/local/`. Never use a personal browser profile, save passwords, export cookies or copy credentials into Git. Both clients follow this same SOP.
