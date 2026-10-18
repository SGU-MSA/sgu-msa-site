# Run, compare and maintain the shared application

## Find the right instructions

- **Board members:** the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx), for using the dashboard. Keep code, tickets and infrastructure steps out of it.
- **Owner/operator:** [Owner setup](owner-setup.md), for accounts, billing, hosting and backups.
- **Developers:** this guide and the [README](../../README.md); use architecture, ADRs and contracts for deeper reference.
- **AI agents:** [AGENTS.md](../../AGENTS.md) and the shared repo skills.

Create or link a GitHub issue in the private-history repository before starting a task. Explain intended behavior and files before implementation, link the issue/contract in the public code PR, give short progress updates and record checks/remaining work on the ticket. Tickets own execution status; the [roadmap](../roadmap.md) summarizes scope/dependencies. Current ecosystem work starts at [epic #109](https://github.com/SGU-MSA/sgu-msa-site-private-history/issues/109). Code branches and pull requests belong in `SGU-MSA/sgu-msa-site`; execution issues and the Project remain in `SGU-MSA/sgu-msa-site-private-history`.

Infrastructure spending is authorized at **$0 only**. Do not enable paid plans, subscriptions, add-ons or overages without a new explicit decision. Metered-product budgets need enforced stop-usage controls where available; alerts alone are insufficient. Confirm actual account settings instead of claiming defaults are safe. See [ADR 0029](../adr/0029-tracked-work-and-zero-spend.md).

## First run: no accounts or backend required

1. Install Node.js 22 LTS (22.15 or newer) and open a terminal in this repository (the folder containing this file's parent README and package.json).
2. Run `npm ci` to install the exact dependencies in the lockfile.
3. Copy `.env.example` to `.env.local` (it already holds a safe local value for `SITE_URL`).
4. Run `npm run demo` and open http://localhost:3000. Use `npm run demo -- -p 3004` for another port.
5. Keep the terminal open. Press Ctrl+C there to stop the server.

The site has one design, Quiet Paper, in light and dark ([ADR 0018](../adr/0018-design-direction-quiet-paper.md)). The header's round switch flips the theme and is remembered on that device; until then the site follows the device setting. The old six review themes, `SITE_DESIGN` and `npm run review` are gone.

### Storybook: the shared components

`npm run storybook` opens http://localhost:6006 with every primitive in `src/shared/ui` and the header and footer, each in light and dark, plus a **Foundations/Tokens** page. The toolbar switches **Theme** (light Green Ink or dark Dusk). Stories live beside their component (`*.stories.tsx`); reminder stories read `content/reminders.yaml`, never a copy. `npm run build-storybook` (run in CI) writes the ignored `storybook-static/` folder. Storybook needs no `.env.local`: `.storybook/main.ts` gives it the demo's sample settings.

## What the sample data means

The sample data starts from fixed IDs and records built from one captured seed timestamp. It uses no database and no credentials. Restarting the launcher anchors the sample dates to today again, so upcoming events stay useful for a review. The same seed timestamp produces identical records for tests.

### Local sandbox: try the dashboard with sample data

Every demo server is an editable sandbox ([data-providers contract](../contracts/data-providers.md), D-6). Run `npm run demo`, open `http://localhost:3000/admin` and sign in with username **admin** and password **admin** (accepted only by the sample `AdminAuth`; [cleanup contract](../contracts/cleanup-outdated.md), D-3). Every dashboard edit (events, notices, news, newsletters, uploads, prayer times, People and sections, logins, archive, restore, duplicate, permanent delete, prayer history) shows on that server's public pages and in Recent changes, and survives navigation and refresh. The sandbox never sends email: invites and reset requests answer exactly like the live site (no "Sandbox" line, review fixes PR-1) and an invited sample person shows as **Invited**. Stop and restart `npm run demo` to erase all edits and sign out. Edits live only in that server's memory (`src/lib/demo/store.ts`), never on disk or in Supabase. The sandbox cannot run on the live site: a production build with `SITE_DEMO_MODE=true` fails, `planWiring` refuses sample adapters in production, and the Supabase sign-in rejects anything that is not an email address before contacting Supabase. Analytics stay off. Payments use the fake gateway: Give opens the sandbox checkout `/checkout/<id>`, whose **Pay** adds an order that **Payments → Money in** shows (the e2e tests never press it, so the totals stay fixed). Real admin sign-in is at `/admin` when demo mode is off.

Production does not substitute samples on database failure. Demo mode is explicitly blocked on Vercel Production.

## Normal development and production checks

| Command                                                                                         | Purpose                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                                                        | Reproduce dependencies; use after pulling lockfile changes                                                                                                                      |
| `npm run dev`                                                                                   | Normal app at localhost:3000; configure .env.local for real data                                                                                                                |
| `npm run demo -- -p 3004`                                                                       | The populated sample app (sandbox)                                                                                                                                              |
| `npm run storybook`                                                                             | Shared components in light and dark at localhost:6006                                                                                                                           |
| `npm run build-storybook`                                                                       | Build Storybook into ignored `storybook-static/` (CI runs it)                                                                                                                   |
| `npm run format`                                                                                | Format application/test code                                                                                                                                                    |
| `npm run check`                                                                                 | Lint, TypeScript, unit tests, formatting check                                                                                                                                  |
| `npm run build`                                                                                 | Validate editorial content and build normal production app                                                                                                                      |
| `npm start`                                                                                     | Serve the last normal production build                                                                                                                                          |
| `npm run demo:review -- -p 4100`                                                                | The sandbox as the reviewed demo: a fresh production build of it, then serve it (one seed time for both; as fast as the live site; Ctrl+C and run it again to erase edits)      |
| `npm run demo:build`                                                                            | Build the sandbox in production mode                                                                                                                                            |
| `npm run demo:start -- -p 3004`                                                                 | Serve that build (a restart erases the sandbox's edits, as with `npm run demo`)                                                                                                 |
| `npm run test:e2e`                                                                              | Browser tests; see playwright.config.ts for server selection                                                                                                                    |
| `E2E_DEMO=true E2E_SERVER_MODE=development E2E_BASE_URL=http://localhost:3004 npm run test:e2e` | With `npm run demo -- -p 3004` running, test the public flows, both themes (`theme.spec.ts`) and the sandbox (Bash/WSL)                                                         |
| `E2E_DEMO=true E2E_SERVER_MODE=production E2E_BASE_URL=http://localhost:4100 npm run test:e2e`  | The same tests against `npm run demo:review -- -p 4100` (the production build; one test runs only there, review fixes PR-C)                                                     |
| `npm run test:db`                                                                               | Database checks (access guard and race, add-only activity log, archive, storage, RLS) on a throwaway Postgres in Docker (`compose.test.yaml`), removed afterwards; needs Docker |
| `npm run test:backend`                                                                          | Explicit backend integration checks on a fresh local Supabase stack; requires test backend setup                                                                                |

Do not run the normal build while a dev or demo server is running: stop it first. Do not run integration tests against the organization's production database. Do not commit .env.local, credentials or compiler output.

Run one Playwright test command at a time: concurrent runs using the same output directory can overwrite each other's traces.

## Architecture: intentionally small

Ports and adapters with one composition point. The rules are in [ADR 0012](../adr/0012-ports-adapters-and-fail-fast-configuration.md); the full design and decisions are in the [data-providers contract](../contracts/data-providers.md). The pictures are in [architecture.md](../architecture.md) (section 3).

`routes, features, admin actions → lib functions → composition point (src/lib/runtime/providers.ts) → port → adapter`

| Port (`<capability>/providers/contract.ts`)                             | What it serves                                                                                                                                                                    | Adapters today                                                                                               | Pages read it through                                                                                                                                                    | Next adapter                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `ContentProvider` (`src/lib/community/`)                                | Public records, prayer settings, `/media` files, the public team list (`getTeam`, `public_team()`)                                                                                | `supabase`, `mock` (sample)                                                                                  | `community/queries.ts`, `community/managed.ts`                                                                                                                           | —                                    |
| `EditorialSource` (`src/lib/content/`)                                  | Page text (`page_texts`, PR5b); the reminders and the developer-owned parts of page text from `content/*.yaml`                                                                    | `supabase`, `sample` (starter YAML plus sandbox edits), `yaml`                                               | `getSite()` and the other `getX()` in `content/index.ts`                                                                                                                 | Ramadan and merch in Supabase (PR5c) |
| `PaymentsProvider` (`src/lib/integrations/payments/`)                   | Funds, tickets, merch sizes, their Go2Pay links, seasons with their pages, merch collections and items (public reads, [PR6 contract](../contracts/pr6-go2pay-payments.md))        | `supabase`, `sample`                                                                                         | `/donate` (`loadDonatePage`), `/donate/<slug>/give` (`loadGiveTarget`), the event page's ticket (`loadEventTicket`), the Home and Ramadan bands (`donatePageShowsFunds`) | —                                    |
| `PaymentGateway` (`src/lib/integrations/payments/`)                     | The only holder of `GO2PAY_API_KEY`: reads Go2Pay orders, checks the key's scope, says where Give goes                                                                            | `go2pay`, `fake` (sample orders; Give lands on the sandbox's `/checkout/<id>`, a 404 everywhere else), `off` | Payments screen, `loadGiveTarget`                                                                                                                                        | —                                    |
| `PaymentItemEditor`, `SeasonEditor`, `MerchEditor` (`src/lib/backend/`) | Board writes of funds, tickets, merch sizes, Go2Pay links, seasons and their pages, merch collections and items, under RLS (no Go2Pay call)                                       | `supabase`, `sample`                                                                                         | PR6 PR-B screens                                                                                                                                                         | —                                    |
| `PlacesProvider` (`src/lib/maps/`)                                      | The board's musallah pin (PR7)                                                                                                                                                    | `supabase`, `sample`                                                                                         | `musallahPin()`, `musallahDirections()`, the campus-names route                                                                                                          | —                                    |
| `ContentEditor`, `AdminAuth` (`src/lib/backend/`)                       | Board writes (save, archive, restore, permanent delete, file removal), protected reads, sign-in, password reset, email links, set password                                        | `supabase`, `sample` (sandbox)                                                                               | `currentAdmin()`/`requireAdmin()`, `backend/admin-content.ts`, `features/admin/actions.ts`, `features/admin/access-actions.ts`                                           | —                                    |
| `PeopleEditor` (`src/lib/backend/`)                                     | People, team groups (`people_sections`, two permanent: Executive board, General board) and dashboard access, under RLS                                                            | `supabase`, `sample`                                                                                         | `backend/admin-content.ts`, `features/admin/people-actions.ts`, `access-actions.ts`                                                                                      | —                                    |
| `OrderEditor` (`src/lib/backend/`)                                      | "Save order" of a dragged board list (People in a group, groups, funds, tickets, hand-over steps): one `save_order` call, every row or none, under RLS (review fixes PR-2)        | `supabase`, `sample`                                                                                         | `features/admin/order-actions.ts` through `OrderedList` and `src/shared/ui/SortableList`                                                                                 | —                                    |
| `AccountInviter` (`src/lib/backend/`)                                   | Holds `SUPABASE_SECRET_KEY` (with `WarningLedger`): invite emails and deleting a permanently deleted person's login                                                               | `supabase`, `sample`, `off` (`SUPABASE_SECRET_KEY=off`, local only)                                          | `features/admin/access-actions.ts`, `people-actions.ts`                                                                                                                  | —                                    |
| `WarningMailer`, `WarningLedger` (`src/lib/backend/`)                   | The daily check's one warning email to the MSA Gmail, and what was already emailed (`warning_emails_sent`, secret key; [ADR 0022](../adr/0022-daily-check-and-warning-emails.md)) | mailer: `gmail` (Vercel Production only), `sample`, `off`; ledger: `supabase`, `sample`, `off`               | `backend/daily-check.ts` (`runDailyCheck`) from `app/api/daily-check/route.ts`                                                                                           | Stage 2 facts from PR6               |
| `ActivityLog` (`src/lib/backend/`)                                      | Read-only activity log: Recent changes, prayer history, dashboard prayer notice                                                                                                   | `supabase`, `sample`                                                                                         | `backend/admin-content.ts` (`listActivity`)                                                                                                                              | —                                    |

- `src/lib/runtime/`: `config.ts` (the only reader of `process.env`, validated, no defaults), `clock.ts`, `wiring.ts` (`planWiring` picks one adapter per port; `deploymentProfileFor` holds the site-wide policies) and `providers.ts` (the composition point, the only module that imports adapters; one adapter per request).
- Read results carry `unavailable` and `provenance` (`live` or `sample`). Features branch on those, on a link's `state`, or on `DeploymentProfile` fields (`indexable`, `measurements`, `adminPortal`), never on demo mode or env. Nothing a visitor or board member reads says the data is sample data: the sandbox looks exactly like the live site (review fixes PR-1; `tests/e2e/real-site-look.spec.ts`).
- `src/lib/community/schema.ts`: shared validated domain types, `recordFromRow` and the visibility/date rules. `queries.ts` deduplicates reads per request and applies `isVisible` on the server clock (`clock().now()`).
- `src/lib/demo/fixtures.ts` and `store.ts`: reproducible sample data and the in-memory sandbox store, used only by the sample adapters; never a production fallback.
- `src/lib/prayer/`: calculation and congregation rules, independent of the database and theme.
- `src/lib/backend/`: Supabase clients (`publicClient`, `adminClient`), `currentAdmin`/`requireAdmin` (they ask `adminAuth()`), protected board reads (`admin-content.ts`), upload checks and image normalization (`normalizeUpload` in `storage.ts`), the password rule (`password.ts`) and the write ports. The secret-key clients live in `providers/supabase-inviter.ts` and `providers/supabase-ledger.ts` (ADR 0022); `supabaseSecretKey()` and `gmailAppPassword()` may be imported only by `runtime/providers.ts`, and `cronSecret()` only by `app/api/daily-check/route.ts` (ESLint, and source tests). Public read ports never write.
- `src/lib/community/people.ts` and `activity.ts`: People and access shapes with the pure mirrors of the database guards (`accessChangeProblem`), and the activity-log shapes with `describeChange`. Postgres decides; the mirrors only drive the sample adapters and disabled buttons ([PR3 contract](../contracts/pr3-people-permissions-activity.md)).
- `src/features/admin/actions.ts`: authenticated, validated server mutations, identical for every theme. Each action calls `currentAdmin()`, validates with zod, writes only through `contentEditor()` and revalidates; RLS stays the authority.
- `src/styles/tokens.css` (the only home of design values; light on `:root`, Dusk on `[data-theme="dark"]`), `src/styles/design.css` (shared classes: header, footer, buttons, Section and PageHero) and `src/shared/ui` (primitives, with Storybook stories, and `page.module.css`, the page patterns every public page shares): presentation only. The dhikr of the hour and the tasbih are `content/reminders.yaml` (`loadReminders()`); each page's Qur'an verse comes from the verse library (`placedReminder(place)`, PR5b); the dhikr slot is `src/lib/prayer/dhikr.ts` and the Hijri date `src/lib/time/hijri.ts`, both on the server clock.
- `src/features/`, `src/shared/`: UI, not database clients or fixture stores. Lint stops them (and every other module) from importing an adapter or reading `process.env`, and stops feature and shared components from importing `@/lib/runtime/*`.

No generic repository framework, dependency-injection container, React Context or extra backend is needed.

### Adding an adapter

A new data source (PR5 YAML pages in Supabase, PR6 Go2Pay and its fake, PR7 the map pin) is a new adapter for an existing port. Pages do not change.

**Changing the menu, footer links, logo, header button or filter lists** (developer-only, PR5b D-22): edit `content/site.yaml` (`navigation`, `header_cta`, `footer`, `brand.logo`, `meta.keywords`), `content/events.yaml` (`terms`) or `content/resources.yaml` (`categories`), run `npm run check` and deploy through a PR. These parts (`developerOwnedPaths` in `src/lib/content/documents.ts`) always come from YAML, laid over the stored page text, so they show even while the database is down; the dashboard never changes them, and a test fails if a YAML part is neither a board field nor listed there.

1. Write it in `<capability>/providers/<name>.ts`, implementing the port in `providers/contract.ts`. It receives what it needs as arguments from the composition point (a configuration value, the sample seed time); it never reads env or the clock, never decides the mode and never falls back to another adapter. Its results carry `unavailable` and `provenance`. A method the port does not have needs a contract change first.
2. Add its id to `Wiring` and choose it in `planWiring` (`src/lib/runtime/wiring.ts`). Sample adapters are chosen only with sample data (today's `planWiring`); no sample or fake adapter is ever chosen in production, and `planWiring` throws if asked ([ADR 0012](../adr/0012-ports-adapters-and-fail-fast-configuration.md) rule 4). The PR6 contract decides when the Go2Pay fake is used.
3. Construct it in the port's accessor in `src/lib/runtime/providers.ts`, the only place that imports adapters.
4. A new setting is declared in `parseRuntimeConfig` (`src/lib/runtime/config.ts`) with its allowed values, in `.env.example` and in the owner guide's [Required variables](owner-setup.md#required-variables) table. No defaults.
5. Run the port's conformance suite on it (`tests/provider.test.ts`, `editorial`, `payments`, `places` or `editor`) and add its wiring cases. Supabase and other network adapters are tested with `npm run test:backend` against staging.
6. Pages are built ahead of time where they can be (Cache Components). A read through the new adapter either happens per visit (its lib function calls `requestNow()` or `connection()` first) or is cached with `"use cache"`, a `cacheLife` and a tag from `publicCacheTags`, which every save expires through `publicDataChanged()` ([Data caching and time](#data-caching-and-time)).
7. Update the diagrams in [architecture.md](../architecture.md) in the same PR.

## Handoff: who changes what?

Board members use the authenticated dashboard for events, announcements, news, newsletters, prayer settings, People and the public team list, logins and permissions, archive and restore, and Recent changes. They do not run npm, edit JSON, commit files or redeploy to publish these updates.

The site owner follows [the beginner setup guide](owner-setup.md) for organizational account ownership, MFA, Supabase setup, admin provisioning and Vercel environment configuration. The developer handles migrations and software updates through reviewed PRs to `integration` ([ADR 0016](../adr/0016-integration-branch-and-release-pr.md)). No founder account is required to run the demo or Storybook.

For prayer approvals see [Prayer times explained](prayer-times.md). For requested photos and current static-media limitations see [Photo shot list](photography.md). Routine board tasks, accounts and emergency steps are documented only in the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx), a Word file the board owns; the [Board guide](board.md) points to it. When a dashboard screen changes, update the handbook's steps (or list them under "Handbook notes" in the PR body).

Before handoff, verify real login/logout, published-content updates, storage permissions and uploads against the configured backend. A passing demo is not evidence that those account-dependent workflows are configured.

## Configuration

Every variable, its allowed values and where to set it: the owner guide's [Required variables](owner-setup.md#required-variables) table, mirrored by `.env.example`. `src/lib/runtime/config.ts` is the only code that reads them; there are no defaults, so a missing or invalid value stops `npm run dev`/`build`/`start` with a message naming it ([ADR 0012](../adr/0012-ports-adapters-and-fail-fast-configuration.md)). `npm run demo` sets `SITE_DEMO_MODE=true` and `SITE_DEMO_DATE` itself; it still needs `SITE_URL` and `CRON_SECRET` from `.env.local`. The `MUSALLAH_*` variables are no longer read (PR7: the musallah pin is in the dashboard); delete them from `.env.local`. `SITE_DESIGN` is no longer read; delete it from `.env.local`.

The deployed app needs one secret key, `SUPABASE_SECRET_KEY` (a Supabase `sb_secret_…` key named `website-invites`), used only by the `AccountInviter` adapter to send invite emails and to delete a permanently deleted person's login, and by the `WarningLedger` adapter to read and add rows in `warning_emails_sent` ([ADR 0022](../adr/0022-daily-check-and-warning-emails.md)). It is parsed once in `config.ts`, kept off `RuntimeConfig` (which carries only `invites: "on" | "off"`), never echoed, and `off` is refused in production. On your computer keep `SUPABASE_SECRET_KEY=off` (invites off; everything else works); with sample data it is ignored. Never put a hosted project's secret key in `.env.local`. `GO2PAY_API_KEY` (PR6) follows the same pattern: `RuntimeConfig.go2pay` is only `"test" | "live" | "off"`, `go2payApiKey(config)` returns the key and only `src/lib/runtime/providers.ts` may import it (lint); keep `off` or the MSA's **Take payments only** test key locally (a live key is refused off Vercel Production, a test key on it; production also refuses a key that can do more, [ADR 0019](../adr/0019-go2pay-products-made-by-the-board-payments-only-key.md)). Even a test key returns **live orders with real givers' names, emails and phones**: never log, print, store or screenshot them. A full-access test key ("Everything my account can do") is allowed only on your own computer for a one-off check; it can read the MSA's real bank details, so never share it and revoke it after use (PR6 D-73). The daily check adds `CRON_SECRET` (required everywhere, sample data included; keep `off` locally, which answers every call to `/api/daily-check` with 401; only `src/app/api/daily-check/route.ts` may import `cronSecret`) and `MSA_GMAIL_ADDRESS` with `GMAIL_APP_PASSWORD` (required with real data; keep both `off` locally; only `providers.ts` may import `gmailAppPassword`). Real warning email is wired only in Vercel Production: the sandbox records it in `demo/store.ts` (`sentWarnings`), and everything else uses the `off` mailer, even with real Gmail values. To try the route in the sandbox, set a local `CRON_SECRET` of 32+ letters and call it with `curl -H "Authorization: Bearer <secret>" http://localhost:3000/api/daily-check`. No custom session-signing secret is required. Remove old `ADMIN_SESSION_SECRET` and `ALLOW_DEMO_ADMIN_IN_PRODUCTION` settings. They are no longer used.

Prayer starts use one fixed calculation, the `prayerCalculation` constant in `src/lib/prayer/calculate.ts` (Muslim World League, Standard Asr; [ADR 0017](../adr/0017-fixed-prayer-calculation-mwl-standard-asr.md)), never an environment variable. Iqamah, schedule dates, Jumu'ah, changes for one date, and the Hijri adjustment are edited in the board dashboard; the coordinates are the one musallah pin (`musallah_location`, read through `PlacesProvider`; `managedPrayer` calculates the starts once per request, PR7); see [Prayer times explained](prayer-times.md). Grenada’s timezone is centralized as `America/Grenada`.

## Directory map

```text
src/
  app/                 Next routes, metadata and page composition
  features/            Domain UI and user workflows
    admin/             Editors and authenticated server actions
    calendar/          Event browser, filtering and calendar interactions
    community/         News and announcement presentation
    home/              Homepage composition slots
    prayer/            Times, congregation, location and first-visit UI
    resources/         Resource/newsletter browser
    involve/ merch/ season/   Remaining public feature presentation
  shared/
    ui/                Reusable buttons, sections, images/placeholders
    layout/            One shared navigation/footer/refresh/measurement shell
  lib/
    runtime/           Validated configuration, clock, wiring and the composition point
    backend/           Supabase clients, identity, upload checks and the write ports
    community/         Validated records, public reads and the content port
    prayer/            Calculation, adjustment schema, congregation precedence
    demo/              Sample fixtures and the in-memory sandbox store
    maps/              Places port, the Grenada box, directions links, device rule, map style, campus names
    media/             Photo-shot briefs
    validation/        Shared date/time validation
    content/           Editorial documents (including reminders), schemas and the editorial port (YAML)
    time/              Hijri date (Umm al-Qura) on the server clock
    calendar/          Standards-based ICS generation
    integrations/      Form links and the payments port
  styles/              Tokens (light and dark) and shared component classes
  proxy.ts             Next request/session boundary
content/               Infrequently changing editorial material, not live schedules
public/                Public files; inherited photos kept but shown as shot briefs
supabase/migrations/   Ordered reproducible schema changes
tests/                 Pure, SQL-migration and browser tests
scripts/               Validation, explicit demo launcher and backend checks
docs/guides/           Board, owner, developer, prayer and photo guides
docs/adr/              Decision records; docs/contracts: feature contracts
docs/archive/          Founder design inputs, payments proposal, photo manifest
```

## Authentication and authorization

Supabase manages credentials and session tokens. `adminClient()` uses server-side HttpOnly, SameSite=Lax cookies, marked Secure in production. No browser Supabase client or localStorage auth is used. `src/proxy.ts` refreshes sessions only on `/admin` routes and marks responses private/no-store.

`currentAdmin()` asks `adminAuth()`: the Supabase adapter calls Auth `getUser()` and reads the protected membership table with its two permissions ("manage people", "manage money"; [ADR 0007](../adr/0007-people-and-permissions.md)); a deactivated login counts as no admin (the sandbox's sample adapter reads its own demo session cookie). Every protected page and mutation checks identity/membership; RLS (`is_admin()`, `can_manage_people()`) separately enforces it for direct API calls, and the `admins_guard` trigger refuses removing your own access or the last "manage people" holder, serialized by an advisory lock. Deactivating a login deletes that user's `auth.sessions`, so refresh tokens stop working on every device; `is_admin()` is false at once for the remaining access token.

Joining and passwords ([PR3 contract](../contracts/pr3-people-permissions-activity.md), Design; picture in [architecture.md](../architecture.md) section 5): `inviteAction` → `accountInviter().invite` (secret key, `auth.admin.inviteUserByEmail`) → `peopleEditor().grantAccess` (RPC `grant_access`). The email links (templates in `supabase/templates/`, token-hash links) open `/admin/auth/confirm`, a page with a **Continue** button that never verifies on GET, because mail scanners open links (D-25); its POST calls `verifyEmailLink`, then `/admin/set-password` checks `passwordSchema` (D-16: 12+ characters with lower, upper, digit and symbol; Supabase Auth enforces the same) and, after `updateUser`, signs out the person's other sessions. `/admin/forgot-password` always answers the same neutral message. The app passes passwords only to Supabase Auth, which stores a bcrypt hash; it never stores, logs or shows them.

Next Server Actions enforce Origin/Host checks, and the application validates submitted fields with Zod. Inputs are rendered as escaped plain text. The existing CSP/security headers are retained. The CSP retains Next’s existing inline bootstrap allowance; a strict nonce-only policy would require a separate rendering/CSP migration. No `unsafe-eval` is enabled for production. The musallah map (PR7) adds exactly `connect-src https://tiles.openfreemap.org` and `worker-src 'self'`, and sets `frame-src 'none'`: `scripts/map-library.ts` copies MapLibre's three files from `node_modules/maplibre-gl/dist/` into the gitignored `public/maplibre/` on every `next dev`, `build`, `start` and Storybook run, and the page imports the library from there only when a map is shown, so the worker is same-origin and never a `blob:`.

Supabase Auth rate limits are the authoritative login limit; there is no misleading process-local limiter presented as a distributed defense. Owners must disable public signups and unused authentication providers in the hosted dashboard.

## Data caching and time

Public PostgREST reads disable automatic SDK retry backoff and cap network requests at three seconds. An unavailable database must not keep the route in its loading fallback through repeated retries. Independent homepage reads start together. The existing minute refresh or a user reload provides the next attempt. Browser request cancellation is preserved.

Public operational reads use an anonymous client independent of cookies and React per-render deduplication, with `no-store` fetches. Cache Components are on (review fixes PR-C; [architecture](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): page text, verses, prayer settings and the musallah pin are cached with `"use cache"` and a tag from `publicCacheTags` (`src/lib/runtime/public-cache.ts`) until a board save; announcement rows for a minute, filtered by the clock on every visit. Everything else is read per visit: a read that depends on "now" or must be fresh calls `requestNow()` (or `connection()`) first, never `clock().now()` before it, so it never lands in a page built ahead of time (a `new Date()` there fails the live build). Never read cookies, headers or the clock inside a `"use cache"` function, and give each one a `cacheLife` (a fallback read gets `"minutes"`). Route segments may not export `dynamic`, `revalidate` or `fetchCache`; a page built from its address that the menu cannot prerender sets `export const instant = false` (the dashboard does so in `src/app/admin/layout.tsx`). Next keeps up to 3 visited pages hidden in the browser for going back, so code that searches the document must skip hidden copies, and e2e tests use visibility-aware locators.

Every successful board action calls `publicDataChanged()` (`src/features/admin/public-refresh.ts`): `updateTag` for every public tag and `revalidatePath("/", "layout")`. Off Vercel Production (`npm start`, `npm run demo:start`/`demo:review`) the built pages are kept in memory by `src/lib/runtime/local-page-cache.mjs` (`cacheHandler` in `next.config.ts`): Next's own file cache compares a page's save time on the wall clock with a board save's time on another clock that drifts behind it under WSL, so a page could keep showing the old text after a save; ours drops every page that used a saved tag and keeps nothing on disk. Vercel keeps the pages in production. RLS and request-time filters hide drafts, future-dated news/notices/newsletters, and expired records. Visible operational public tabs refresh every minute; no refresh runs in the editor. During a backend outage, operational sections show an explicit unavailable state rather than presenting old schedules as current.

Events use Grenada dates and wall-clock times. Grenada is UTC−04:00 year-round; `America/Grenada` is used for calendar dates and display. ICS exports UTC instants so someone importing abroad sees the correct event instant. An event has a start date, an optional start time (none: all day) and an optional end date and end time; the end must come after the start (review 2). Without an end, the event stops being upcoming at its start time (all day: at the end of the day). "Add to Calendar" builds the file, Google Calendar and Outlook from one reading (`calendarTimes`, `src/lib/calendar/ics.ts`) and picks by device in the browser (`CalendarTarget`, `src/lib/calendar/targets.ts`). Date-only legacy exports use all-day calendar values.

Iqamah settings have effective/expiry dates. No expired or prototype congregation times are treated as current. Calculations use the maintained `adhan` library locally: no network prayer API, quota, API cache, or API outage is involved. Without the pin (it could not be read) no starts are shown. The library produces absolute instants, then the app formats them in Grenada’s timezone. Two dates are calculated to cover next-day Fajr; sunrise is shown but excluded from the next-prayer indicator. Countdown updates every 30 seconds and refreshes its underlying schedule with the public page. Changes for one date (iqamah, or one Friday's Jumu'ah via `jumuahFor`) and the Hijri adjustment are managed in the prayer editor; start corrections were removed in PR4. `scheduleEndStatus` (`src/lib/prayer/congregation.ts`) is the one rule for the dashboard reminder before and after **Times end on**; see [Prayer times](prayer-times.md).

## Storage

The `community` bucket is private. Admins can upload new random UUID paths; overwrites are not available to application credentials, and any admin may delete a file once no row (archived ones included) names it (D-23, `202610050003_archive.sql`). Public reads require a reference from a published, currently visible, not archived record, or a team photo `public_team()` shows. Draft attachment paths are not public grants.

Before upload, the board's photo box (`ImageField`, the only one) makes the photo smaller in the browser (canvas, upright, at most 1600 px; JPEG for photos, WebP for PNG/WebP) and stops a save over the per-save photo limits; the limits live in `src/lib/media/photo-limits.ts`, shared with the server, which stays the authority. The upload server checks a 3 MB limit. Photos are decoded with Sharp, limited to 24 million input pixels, rotated, resized to at most 1600×1600, stripped of source metadata, and converted to WebP. PDFs require the correct MIME type and `%PDF-` signature; that is format validation, not malware scanning. Trusted board members must only upload reviewed documents. The media route returns PDFs as attachments with sandbox/nosniff headers. Managed images bypass Next’s long-lived optimizer cache to avoid retaining public draft/unpublished media; uploads are already resized.

Replaced files of events, news and newsletters are kept (avoids breaking shared references; periodic owner cleanup). A person's replaced or removed photo and the files of permanently deleted items are deleted through `contentEditor().removeFile`, which storage allows only for files no row names (D-23); a failed removal shows "A file is left over" with **Remove**. Storage bytes need a separate backup from database records. Large file support and antivirus scanning can be added if operational needs justify them.

## Local testing

Development CSP permits React's required `unsafe-eval` debugging behavior **only** when `NODE_ENV=development`. Production continues to prohibit eval. Restart `npm run dev` after security-header changes and reload old tabs. The rendering regression can be run with `E2E_SERVER_MODE=development` or `production` to assert the corresponding response header. With a stopped local Supabase stack, reads show unavailable states. The two backend variables are required with real data, so blank values stop the server instead. Do not erase real hosted configuration to troubleshoot a local stack.

Install dependencies with `npm ci`. Start a dedicated local Supabase stack using `npx supabase start`; migrations apply automatically. Never run the backend fixtures against a hosted project. The script refuses any URL other than localhost/127.0.0.1 port 54321, and any database that is not on this computer.

Add these **local-only** values to ignored `.env.local`, in addition to normal configuration:

```text
SUPABASE_SECRET_KEY=<off, or the local stack's secret key for the browser invite walkthrough>
SUPABASE_TEST_SECRET_KEY=<local secret key from supabase status>
SUPABASE_TEST_DB_URL=<local DB_URL from supabase status>
E2E_ADMIN_EMAIL=<local test email>
E2E_ADMIN_PASSWORD=<local test password: 12+ characters with a lower-case letter, a capital, a digit and a symbol>
```

Run:

```sh
npm test
node --env-file=.env.local --import tsx scripts/test-backend.ts stack
npx playwright install chromium
npm run dev
# In another terminal:
node --env-file=.env.local node_modules/@playwright/test/cli.js test
```

The integration script provisions one local board test account (through `owner_add_admin`, as the owner does), tests an unauthorized user, archive and permanent delete, session revocation on deactivation, and the invite and reset emails: the local stack catches every email in Mailpit (`[inbucket]` in `supabase/config.toml`, http://127.0.0.1:54324), where the script reads the token-hash links, sets a password meeting D-16 and checks that a reset ends other sessions. It removes its transient records and accounts. `tests/e2e/editor.spec.ts` adds a browser walkthrough (invite email → set password → reset signs out another browser → deactivation) when the app points at the local stack with `SUPABASE_SECRET_KEY` set to the stack's local secret key; it skips itself when the key is `off`. The board test account remains for browser testing. Browser tests exercise mobile/desktop public pages, axe accessibility, navigation focus, protected routes, and real administration. Test results and traces are ignored. A failed browser mutation test may leave an explicitly named local test record; remove it through the local dashboard.

For production-mode verification, stop the dev server, run `npm run build`, then `npm start`, and rerun browser tests. A build with a required variable missing must stop with a message naming it (there is no setup state to test). Avoid simultaneous dev/build processes sharing `.next`.

## Board help and tours

The board's how-to lives only in the handbook (`handover/SGU-MSA-Website-Handbook.docx`, [ADR 0028](../adr/0028-board-how-to-in-one-handbook.md)): when a dashboard screen changes, write the new board steps under "Handbook notes" in the PR body. The dashboard's Help page (`/admin/help`) only points to the handbook and lists the tours from `tourPages`. The "Show me how" tours (react-joyride, admin only) take their steps from `src/features/admin/tour/steps.ts` and point at `data-tour` attributes on the screens: update a tour in the same PR as the screen it describes (step texts are approved by the user, ADR 0008).

## Quality and CI

`npm run check` (lint, typecheck, unit tests, format check), `npm run validate:content` and `npm run build` are the local checks. The PR workflow (`.github/workflows/validate.yml`, PRs to `main` and `integration`) runs the first two and, in a second job, `npm run test:db` (free GitHub-hosted runner with Docker), providing checks Vercel’s build does not cover. Vercel remains the sole deployment/build integration. No GitHub Actions → Vercel deployment pipeline was added.

Unit coverage targets content expiry, invalid dates/URLs, event completion, prayer settings without coordinates, the fixed calculation, Jumu'ah changes, the Hijri adjustment, midnight calculation behavior, and UTC/UTF-8 ICS correctness. Backend tests use real Auth/Postgres/Storage rather than mocks. Browser automation does not replace physical-device or screen-reader validation; record those limitations explicitly.

## SEO and measurement

Static routes have descriptive titles/descriptions and canonical paths; the site origin is centralized in `SITE_URL`. Dynamic public details, sitemap, and admin noindex follow the same publication rules. Do not invent local-business addresses or geographic metadata. The organization’s real name/logo/social links are the evidence-backed identity.

Vercel Analytics and Speed Insights run only on the live production site when the owner sets `ENABLE_VERCEL_MEASUREMENTS=true` (`deploymentProfileFor` in `src/lib/runtime/wiring.ts`, [ADR 0011](../adr/0011-production-analytics-explicit-setting.md)), never on admin routes, in demo mode or locally. Do not add another analytics platform without an operational reason.

## Maintenance cadence

Monthly: review dependency advisories, deployment errors, backup status, broken links, and storage growth. Before each term: account turnover and content review. Before a dependency major upgrade: read the installed Next.js guides and run the full verification suite. Before a schema migration: back up, test staging, review policies, and agree with the owner when to merge.

Reference documentation: [Supabase server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase storage policies](https://supabase.com/docs/guides/storage/security/access-control), [Adhan JS](https://github.com/batoulapps/adhan-js), [Vercel Speed Insights](https://vercel.com/docs/speed-insights/quickstart). Installed Next.js documentation lives in `node_modules/next/dist/docs/`.

## Database files

The database is one clean baseline (final plan A5), four files run in order: `202610150001_schema.sql` (tables, RLS, functions, triggers, storage rules), `202610150002_starter_data.sql` (starter rows; sample-free), `202610150003_quran_verses.sql` (the fixed verse library, generated by `scripts/page-text-seed.mjs --verses`) and `202610150004_recent_changes.sql` (the activity-log triggers, last so the starter rows are not logged). They replaced the 14 earlier files and build exactly the same database: the schema dump and every seeded row were compared on two throwaway Postgres 17 databases, the only differences being that the events Google Forms check is valid from the start (no old rows to wait for) and the log starts empty. Hosted projects are wiped and reinstalled with the release checklist's steps. Prayer settings keep the retired columns (`confirmed`, `method`, `madhab`, `adjustments`, `latitude`, `longitude`) unread until a later change drops them; one-date changes and the Hijri adjustment are protected by PostgreSQL checks and admin RLS.

The isolated PGlite tests (`tests/*-migration.test.ts`) run all four files and test constraints and RLS; this is a test-only PostgreSQL runtime, not a new application database. `npm run test:db` runs them on real Postgres 17. Neither replaces hosted Supabase authentication/RLS/storage acceptance tests.

## Focused QA and coverage

Run `npm run test:smoke` for the small admin browser gate. It owns a fresh loopback-only sample server, refuses to reuse an occupied port, and tests desktop/light and phone/dark with one worker and zero retries. No hosted credentials are needed. Run `npx playwright install chromium` once if the browser is missing. Failure screenshots/traces and reports are ignored; CI keeps failure evidence briefly. Existing detailed `npm run test:e2e` suites still cover affected features; inspect their opt-in flags and do not count skips as passes.

The smoke personas are signed out, `board/board` without sensitive permissions, and `admin/admin` with both. Both signed-in views represent the same Executive account. They do not prove General-board page restrictions, independent single-permission accounts, real Supabase Auth or RLS. Existing SQL tests/CI cover database guards; `npm run test:backend` needs a dedicated local Supabase stack. Do not run these tests on production. The real app permits ordinary admins to edit Funds/Tickets; Manage money protects Money in, while Manage people protects login changes and Term export.

For exploratory QA, choose a persona, task and risk first; try normal completion, invalid input, a direct forbidden URL, session loss and the public result. Record revision/environment, expected/actual results and evidence in the existing issue/PR. Turn confirmed defects into focused failing regressions, delegate the smallest fix, then recheck. Code can verify observable outcomes; usability and visual judgment still require a deliberate review. Use axe plus keyboard checks for affected screens; add load testing only when a capacity/concurrency contract calls for it.

`npm run test:coverage` uses Node 22 native coverage with the existing unit suite; `npm run check` enforces it once. Initial loaded-module baseline: 88.07% lines, 89.64% branches, 84.11% functions. Floors start at 88/89/84 and must rise as meaningful tests improve coverage; aim for at least 95% branch coverage of new critical pure rules and 90% or better across reported metrics as gaps close. Reports in ignored `coverage/` include `lcov.info` and `scope.txt` with the measured denominator/scope. Only loaded `src` modules are measured (Storybook stories excluded); unimported files are absent. This is not whole-repository coverage or proof of dead code. Do not add ignore pragmas, remove tests or exclude difficult modules to raise the number. Investigate suspected unused code with call-site searches, lint/types and runtime evidence before deleting it.

## Working with AI agents

Claude Code and Codex share one setup: [AGENTS.md](../../AGENTS.md) is the agent rulebook (Claude reads it through CLAUDE.md), skills live in `.agents/skills` (client compatibility paths are symlinks), and MCP servers are defined once in `.mcp.json`. Read AGENTS.md for the agent procedure; this section is the maintainer's side.

**Delegated engineering** ([ADR 0032](../adr/0032-delegated-implementation-and-human-merge.md)): the capable primary agent plans/coordinates, a Luna/Sonnet agent implements a bounded contract, and a separate capable agent reviews/tests the final diff. Fixes loop back to an implementer. You review and merge the PR; the previous automatic integration-merge permission is superseded. Shared roles live in `.agents/roles`; `.claude/agents` and `.codex/agents` select client models and point to those roles. Native files require a compatible client; model availability and substitutions must be checked at dispatch. No daemon or after-every-message hook runs. Current documentation: [Codex custom agents](https://developers.openai.com/codex/subagents), [Claude custom agents](https://code.claude.com/docs/en/sub-agents). Drafts stay ignored in `.plans`; approved executable contracts live in `docs/contracts` and are linked from their ticket. Approval of the overall ecosystem does not select alternatives that its child package explicitly leaves unresolved.

**One-time setup**

1. The Supabase server already points at staging (`qglftmxfjvxmrzppkxks`). If staging is ever recreated, replace the `project_ref` in `.mcp.json` with the **staging** project's ref (Supabase dashboard → Project Settings → General → Project ID; never the production project), then run `npm run agents:sync`. One maintainer does this once and commits `.mcp.json` with the regenerated files.
2. Run `npm ci` (its prepare step generates Codex configuration), then launch `claude` or `codex` from the repository root.
3. Codex: trust the project when asked (it only loads `.codex/config.toml` for trusted projects).
4. Claude Code: run `/mcp` and approve the project's MCP servers.
5. Sign in once to each OAuth server: `codex mcp login supabase` and `codex mcp login vercel`; in Claude, authenticate from `/mcp`. Credentials persist in the client's local credential store, outside Git; a new chat should reuse them. Reauthenticate only after an actual authentication failure, expiration or revocation. Supabase staging supports read/write; writes follow the approved task scope; Vercel prompts remain enabled. For Vercel, resolve the project’s actual account/team before supplying scope. Older unscoped requests succeeded, but newer tool versions may require a team ID; a scoped 404 does not establish an authentication failure. Check a real project request, not just the connection indicator.
6. Windows: clone inside WSL, or enable `git config core.symlinks true` before cloning, so `.codex/skills` is a real symlink.

**Changing shared agent configuration**: edit `.mcp.json`, then run `npm run agents:sync`. Commit the shared JSON, generator changes and generated skill metadata. The active `.codex/config.toml` is generated locally and ignored by Git. Skill dependency blocks use shared definitions only (edit their `# servers:` lines to change dependencies); `npm test` fails on drift.

**Private connections, including production**: add unique server names to `.mcp.local.json`, using the same `mcpServers` shape as `.mcp.json`, then run `npm run agents:sync`. Codex loads them automatically for this trusted repository only. The generator refuses tracked or unignored local files, prevents overrides of shared names and sets local files to owner-only permissions on Unix. Authenticate an added server once with `codex mcp login <server-name>`. Run `npm run agents:sync -- --claude-local` to register the same local definitions in Claude using its project-local scope; matching registrations are preserved. This explicit operation requires Claude CLI and its default config location. Each client authenticates separately; `claude mcp login <server-name>` handles Claude consent. Native client files are adapters, not separate configuration sources. Never use Codex's `mcp add` for production: it writes user-level configuration. Do not copy credentials into JSON or TOML. OAuth storage belongs to the client and is separate from the project-scoped server registration ([official MCP documentation](https://developers.openai.com/codex/mcp)).

**Private browser and GitHub access**: use `scripts/agents/github.sh` for GitHub commands; it selects this project's ignored owner login when present, otherwise your existing CLI login. Never put a token in chat or Git. Chrome MCP uses `.agents/local/browser-profile`, shared by both clients. Only GitHub, Supabase and Vercel sign-ins may be retained there; password saving is disabled. Use an isolated browser context for other sites. Browser sessions and owner CLI credentials stay under ignored `.agents/local/`. Check authentication automatically before requesting another sign-in; monitor interactive consent completion without asking the user to report “done”.

**Tracking and hooks**: the shared `managing-project-work` skill runs at substantive task boundaries: reuse the issue, milestone and organization Project; update meaningful progress and close completed work. No GitHub-writing hook runs after each reply. [Codex hooks](https://developers.openai.com/codex/hooks) and [Claude hooks](https://code.claude.com/docs/en/hooks) use different configuration and trust rules; keep any future reminder script shared and client adapters thin.

**Connection checks**: use a harmless server request, then repeat from a fresh client to verify saved authentication. Next DevTools requires a running local Next.js server; `CRON_SECRET=off npm run demo` starts sample data without a database. Maestro's local Chromium check is free; do not use cloud runs. If Supabase docs work but SQL times out, inspect project status before repeating OAuth login. Production read/write capability does not authorize data changes: require explicit user authorization for any production operation and retain approval prompts. Connection results belong in the tracking issue, not a second permanent status document.

**Normal workflow** ([ADR 0004](../adr/0004-lightweight-engineering-process.md))

1. Ask the agent to plan. It searches for existing code first and brings product questions to you as 2–3 options with a recommendation; you decide ([ADR 0002](../adr/0002-product-principles.md)).
2. The agent drafts a contract in `.plans/<feature>.md` with your decisions; once you approve it, it moves to `docs/contracts/<feature>.md`.
3. The agent implements, reviews its diff, and runs `npm run check`.
4. Test locally: `npm run dev` with the **staging** project's URL and publishable key in your `.env.local`, or `npm run demo` for sample data. There are no preview deployments ([ADR 0010](../adr/0010-production-deploys-from-main-only.md)).
5. Branch from `integration` and open the PR **against `integration`** using the template; CI repeats the checks. Once CI and the review pass, the PR is merged into `integration` (nothing deploys from it). Test everything locally with `git checkout integration && git pull && npm run dev` ([ADR 0016](../adr/0016-integration-branch-and-release-pr.md)).
6. **Going live:** an authorized maintainer reviews and merges the Release PR `integration → main` in the public code repository after staging acceptance and required checks. The Vercel project must be connected to that repository and configured to deploy `main`; verify the deployment in Vercel afterwards ([owner guide §5](owner-setup.md#5-how-publishing-works), [ADR 0010](../adr/0010-production-deploys-from-main-only.md), [ADR 0016](../adr/0016-integration-branch-and-release-pr.md)).

**Design with Claude Design (Claude Code only)**: `/design-login` once, then `/design <brief>` to get artboards. Pick one, and hand its handoff bundle back to Claude Code to implement. Run `/design-sync` (uploads the repo's components) only after a design direction is chosen and built, so the discarded review themes don't steer the artboards. Codex users compare rendered HTML mockups or screenshots instead.

## Documentation and artifact policy

README is the single entry point. Update an existing guide for ongoing instructions; do not create a new handoff/checklist document for every iteration. The five guides in docs/guides have distinct audiences. Decisions go in [docs/adr](../adr/README.md), feature contracts in docs/contracts, and proposals awaiting decisions in docs/proposals. Update [architecture diagrams](../architecture.md) in the same PR that changes a flow.

docs/archive/notes keeps the decision-linked founder design, payments and asset notes; they are history, not instructions. Raw source briefs and concept images are excluded from the public repository and retained only in private history. Do not copy them into public assets without rights and consent review. New screenshots, browser reports and performance output go in ignored artifacts/ (the render script uses artifacts/render-check). Curate only useful review evidence into a dated review folder; never dump generated media in the repository root.

Public files are intentionally web-accessible; raw evidence and sensitive documents do not belong in public/.
