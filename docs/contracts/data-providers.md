---
status: done
mode: full
---

# Data providers and fail-fast configuration

## Capability

**Data-source independence with strict configuration.** Each data source (Supabase reads and board writes, `content/*.yaml`, environment variables, demo fixtures, later Go2Pay) sits behind a small capability interface (_port_). Implementations (_adapters_) are chosen in one server-only composition point from one validated configuration module, the only reader of `process.env` in `src/`. Pages and features depend on ports and on data (`provenance`, `unavailable`), never on "is this the demo?". Sample data can never run in production, and missing or invalid configuration stops the build instead of falling back to a default.

Pattern: Ports and Adapters with one Composition Root. Not a DI container, repository framework or single "DataProvider" (`docs/guides/developer.md` "Architecture: intentionally small"; principle 5).

## Requested Behavior

- Code never depends on whether data is demo or real; one composition point picks adapters from configuration (maintainer).
- Demo, fake and sample data exist only in development and staging, never in production (D-3).
- No silent defaults for deployment configuration; missing values fail the build with a readable message (D-4).
- PR3 (roles), PR5 (YAML into Supabase), PR6 (Go2Pay + fake), PR7 (map points) plug in as new adapters without page rework.
- Small ordered PRs; WP-1 lays the foundation.
- A local sandbox demo with editable sample data that survives navigation and refresh, resets on restart, and offers "Sign in as demo admin"; never production (D-6).

Visible behavior on a correctly configured site: unchanged. Intended changes: a production deploy with missing or invalid variables fails; the "board portal is awaiting setup" state disappears (Supabase becomes required); the Ramadan YAML demo switch is removed; in demo runs, server date rules use the demo seed clock; the local demo dashboard becomes editable (WP-8).

Non-goals: no table, migration, RLS, bucket or existing server-action signature change; no caching change; archive, duplicate, history (ADR 0013) and People (ADR 0007) stay in PR3; browser clocks in `CalculatedPrayers` and `CalendarExplorer` stay as they are; the PR5/PR6/PR7 adapters themselves.

## Existing System Evidence

Inspected at `905f341` on `chore/agent-setup-and-handoff`.

- Existing port: `src/lib/community/providers/contract.ts` `ContentProvider` (`getRecords`, `getPrayerSettings`, `unavailable`); selection in `providers/index.ts` via `demoEnabled()` and a direct `process.env.SITE_DEMO_DATE` read; adapters `supabase.ts` and `mock.ts` (fixtures `src/lib/demo/fixtures.ts`); `queries.ts` caches it per request and applies `isVisible` on the wall clock.
- `src/lib/demo/mode.ts` `demoEnabled()` is called 15 times in 11 files: `src/proxy.ts`, `src/lib/backend/server.ts` `adminClient`, `src/app/{layout.tsx (robots, banner), page.tsx (JSON-LD, method label), robots.ts, sitemap.ts, admin/page.tsx, demo/prayer-settings/page.tsx}`, `src/features/community/CommunityFeed.tsx`, `src/lib/community/adapters.ts` (×2), `src/lib/integrations/payments.ts`, `src/lib/site-config.ts` `measurementsEnabled`.
- Other `process.env` reads in `src/`, several with silent defaults: `src/lib/backend/config.ts` (Supabase, null if missing), `src/proxy.ts` and `src/lib/backend/server.ts` (`NODE_ENV`; identical cookie options duplicated), `src/lib/site-config.ts` (`SITE_URL` falls back to `sgu-msa-site.vercel.app`; `measurementsEnabled` per ADR 0011, on only with an explicit `true`), `src/config/design.ts` (`SITE_DESIGN` falls back to `courtyard`), `src/lib/maps/location.ts` (`MUSALLAH_*`), `src/lib/integrations/payments.ts` (`DONATION_URL`, empty means off).
- YAML: `src/lib/content/index.ts` has 17 synchronous `loadX()` loaders over `readContent` (`yaml.ts`), which blocks swapping in an async Supabase source. Second demo switches: `content/ramadan.yaml` `demo_mode` (`src/features/ramadan/TonightPanel.tsx`) and `content/admin.yaml` demo fields (only `scripts/validate-content.ts` reads them).
- Duplication: row parsing ×3 (`providers/supabase.ts`, `backend/admin-content.ts` ×2); "schedule current" ×2 (`community/adapters.ts` `managedPrayer`, `prayer/congregation.ts`); "indexable" encoded 4 ways; "admin portal available" 3 ways.
- Unused exports: `integrationStatuses`, `listDriveShortcuts`, `resolvePublicCalendar`, `formDetails`, `*Status` in `src/lib/integrations/`.
- Writes: `src/features/admin/actions.ts` calls `currentAdmin()` then `admin.client` directly (insert/update guarded by `updated_at`, delete, `prayer_settings` update, `signInWithPassword`); `backend/admin-content.ts` holds protected reads via `requireAdmin()`; `backend/storage.ts` `uploadContentFile` normalizes with sharp and puts to the `community` bucket; `app/media/[name]/route.ts` downloads via `publicClient`. The demo admin page says "read-only design demo" (`tests/e2e/demo.spec.ts`).
- Tests: `tests/{provider,review,community,site-config}.test.ts`, `tests/e2e/demo.spec.ts`; launchers `scripts/{demo,review}.mjs`; ADRs 0005 (Go2Pay only), 0007, 0010 (production deploys from `main` only), 0011 (analytics an explicit owner setting).
- Next docs: `02-guides/data-security.md` (only the Data Access Layer reads `process.env`); `instrumentation.md` (`register()` runs once at server start).

## Owner

New `src/lib/runtime/` owns environment parsing, the production/sample rules, the clock and adapter selection. It replaces `src/lib/demo/mode.ts` and `src/lib/community/providers/index.ts` and owns no domain rule. Each port stays with its capability: `src/lib/community/providers/`, `src/lib/content/providers/`, `src/lib/integrations/payments/`, `src/lib/maps/providers/`, and `src/lib/backend/providers/` for board writes and sign-in (`ContentEditor`, `AdminAuth`). The sandbox store lives with the fixtures in `src/lib/demo/store.ts`.

## Source of Truth

- Env variables, required-ness and messages: `parseRuntimeConfig` (zod) in `src/lib/runtime/config.ts`. Mirrors: `.env.example`, owner-guide variable table.
- Production: `VERCEL_ENV === "production"` (set by Vercel; ADR 0010 makes Production the only deployment).
- Adapter per port: `planWiring` in `src/lib/runtime/wiring.ts`.
- Site-wide policies (indexable, banner, measurements, admin portal): `deploymentProfileFor` in the same file.
- Server "now": `clock()` in `src/lib/runtime/providers.ts`.
- Visibility, admin membership and write permission: RLS and `public.is_admin()` (unchanged; `isVisible` and `currentAdmin()` stay declared mirrors).
- Sandbox data: the one process-wide store in `src/lib/demo/store.ts`, seeded from fixtures on the seed clock.
- Data shapes: `src/lib/community/schema.ts`, `src/lib/content/schemas.ts`, migrations.

## Reuse and Duplication Analysis

Reused: `ContentProvider` and both adapters, `publicClient`/`adminClient`/`currentAdmin`, `uploadContentFile` validation (split into `normalizeUpload` plus an adapter `put`), every action's validation and messages, `LinkDestination`, `safeHref`, zod schemas, `readContent`, fixtures, `cache()`, `revalidatePath("/", "layout")`. Extended: `ContentProvider` results gain `provenance`. Merged into one owner each: indexable, admin-portal, measurements rule, cookie options (`sessionCookieOptions` in `backend/config.ts`), row parsing (`recordFromRow` in `community/schema.ts`), schedule-current (`isScheduleCurrent` in `prayer/congregation.ts`). Renamed: `community/adapters.ts` becomes `community/managed.ts`, because those functions are page-model builders, not adapters. Searched with no match: `DataProvider`, `Repository`, `container`, `inject`, `Clock`, `env.ts`, `getConfig`, `instrumentation`; no other contract or `.plans/` file in this area.

## New Abstractions

- `RuntimeConfig` (`config.ts`): the only env reader. Has no `server-only` import because `next.config.ts`, `src/proxy.ts` and tests import it.
- `Clock` (`clock.ts`): `systemClock`, `fixedClock`.
- `Wiring` and `DeploymentProfile` (`wiring.ts`, pure, unit-tested).
- Composition point (`providers.ts`, `server-only`): the only importer of adapters.
- Ports `EditorialSource` (YAML now, Supabase in PR5), `PaymentsProvider` (link now, Go2Pay and fake in PR6), `PlacesProvider` (env now, Supabase in PR7), `ContentEditor` and `AdminAuth` (Supabase and sample now, D-6). Each has a second variant and at least two consumers (principle 6).
- Sandbox store (`demo/store.ts`, `server-only`): one module-level store held on `globalThis` so actions, pages and route handlers share it; the only sanctioned global mutable state, imported only by sample adapters.

## Product Decisions Required

- [x] PD-1: Retire the Ramadan YAML demo switch?
      Decision: D-3
- [x] PD-2: The analytics rule (ADR 0011 as first drafted: "on by default in production") conflicts with D-4 ("never use defaults"). How should it work?
      Decision: D-5

## Decisions

- D-1: Production deploys from `main` only; no preview deployments (ADR 0010; user, 2026-10-02; rejected: per-PR previews).
- D-2: Analytics only in production, never in demo, dev or preview (ADR 0011; user, 2026-10-02). Its "default on" part was replaced by D-5.
- D-3: Demo, fake and sample data sources are allowed only in development and staging. The composition point refuses them in production, and the build fails when `SITE_DEMO_MODE` is not `false` in production. The Ramadan YAML switch is removed (PD-1 option A). (User, 2026-10-03; rejected: B, sample Ramadan times in demo; C, keep the switch.)
- D-4: Fail-fast configuration. One zod env schema covers local (development or staging) and production. It is checked when `next.config.ts` loads (`next dev`/`build`/`start`; a failed Vercel build leaves the previous deployment live) and at server start (`src/instrumentation.ts`). There are no silent defaults. Deployment config and secrets live in env. Board-changeable settings belong in the dashboard per the roadmap and show "not set up yet" when empty. Interim env values must be explicit: `DONATION_URL` is an https link or the literal `off`; `MUSALLAH_LOCATION_CONFIRMED` is `true` or `false`, with coordinates required when `true`. (User, 2026-10-03.)
- D-5: `ENABLE_VERCEL_MEASUREMENTS` is required in production as `true` or `false`; measurement runs only in production with `true`. ADR 0011 was amended before merge (PR #9) to "Production analytics are an explicit owner setting", keeping its privacy safeguards; until WP-1 a missing value means off, then it fails the build. (User, 2026-10-03; rejected: default-on exception.)
- D-6: Sandbox demo: editable sample data, local only, never production. Edits survive navigation and refresh; a server restart resets them. A demo-only "Sign in as demo admin" replaces the read-only note. (User, 2026-10-03.)
- D-7: Tests load `server-only` modules through a test-only resolve hook (`tests/support/register.mjs` maps `server-only` to an empty stub for `npm test` and `npm run test:backend`); production builds keep the real guard. `isUpcoming` takes a required `now`; `CalendarExplorer` passes the browser clock explicitly (one-line client change, no behavior change). (Planner, 2026-10-03, resolving the WP-8 PLAN MISMATCH; rejected: dropping `server-only` from server modules, injecting the store from the composition point.)
- Amendment: D-6's sign-in method is replaced by [cleanup-outdated](cleanup-outdated.md) D-3 and D-10 (the sandbox signs in with username admin / password admin through the normal form; the "Sign in as demo admin" button is removed). (User, 2026-10-03.)
- Amendment (user, 2026-10-05; review fixes PR-1): the sandbox and staging look exactly like the live site. `DeploymentProfile.sampleBanner` and the banner are removed; sample provenance no longer changes what visitors or the board read (no "Illustrative … not approved" method line, no "Pending verification" on sample events, no "Placeholder entry" newsletters, no sample photo briefs on updates, no "Sandbox: …" lines on Payments, invites or resets). Sample fixtures (`src/lib/demo/fixtures.ts`) are realistic, unlabeled content with the same ids and shapes, and sample orders are not marked as test orders. `indexable: false` and `adminPortal: "sample"` (the username sign-in) stay. `next.config.ts` sets `devIndicators: false`. Guarded by `tests/e2e/real-site-look.spec.ts` (no "demo", "sample", "example", "placeholder", "not approved" or "illustrative" in any page's visible text; board hints may say "for example") and `tests/review.test.ts`.
- Amendment (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): `queries.ts` and `content/index.ts` no longer only deduplicate per request. Page text, verses, prayer settings and the musallah pin are cached with `"use cache"` and a tag from `publicCacheTags` (`src/lib/runtime/public-cache.ts`) until a board save; announcement rows for a minute. Reads that must be fresh call `requestNow()` (the server clock after `connection()`), so the sandbox and the live site build the same pages ahead of time. Every action calls `publicDataChanged()` instead of `revalidatePath("/", "layout")` alone.
- Amendment (user, 2026-10-06, third review section E; [ADR 0026](../adr/0026-fixed-quran-verse-library.md)): the Qur'an service is no longer a data source. `QuranSource` and its `alquran-cloud` and `sample` adapters and the wiring choice `quran` are removed. `ContentProvider.getVerses()` becomes `getVerse(reference)` (one verse of the fixed library, or null) and `getVerseLibrary()` (all of it, in Qur'an order, read in pages of 1000 rows); both are cached with no tag, since the library never changes. The sandbox reads the same library from `src/lib/quran/verse-library.json` (`src/lib/demo/quran.ts`).

## Board Self-Sufficiency Check

Nothing board-editable is added or removed; the sandbox (D-6) lets founders try every dashboard edit locally without touching real data. The change turns PR5 (YAML pages into the dashboard), PR6 (Go2Pay funds) and PR7 (map points) into adapter swaps, which is how `DONATION_URL`, `MUSALLAH_*` and YAML copy leave env/code. Owner-facing consequence: a missing or invalid Vercel variable now fails the deploy with a message naming the variable and where to set it; the live site stays on the previous version. The owner guide lists the required variables (WP-1). Not on the roadmap yet: the per-theme headline copy in `src/config/design.ts` (Open Risks).

## Design

```text
env ─► runtime/config.ts (validate, fail fast) ─► runtime/wiring.ts (adapter ids, policies)
                                                        │
                       runtime/providers.ts (server-only, cache() per request)
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
   ContentProvider  EditorialSource  PaymentsProvider  PlacesProvider   clock, profile
   supabase|sample  yaml (PR5: +db)  link|off (PR6)    env (PR7: +db)
        ▲ lib query functions (getRecords, managedPrayer, getSite, donationDestination, musallahDirections)
        ▲ routes and features
admin actions/pages ─► currentAdmin() ─► ContentEditor, AdminAuth: supabase (RLS) | sample ─┐
sample ContentProvider + sample ContentEditor ─► demo/store.ts (one in-memory store) ◄────────┘
```

Rules (recorded in ADR 0012 in WP-1):

1. Ports live in `<capability>/providers/contract.ts`. Read results carry `unavailable` and `provenance: "live" | "sample"`; only `ContentEditor` and `AdminAuth` write.
2. Adapters never read env or the clock, never decide the mode, and never fall back to another adapter.
3. Only `runtime/providers.ts` imports adapters (tests excepted). Lint enforces this.
4. `planWiring` never selects a sample adapter in production. It throws if asked to.
5. Features branch on data (`provenance`, `unavailable`, `state`) or on `DeploymentProfile` fields, never on mode or env.
6. Admin actions keep validation, `currentAdmin()`, revalidation and redirects, and write only through `contentEditor()`; RLS stays the authority. New write operations (PR3 archive, duplicate, history, People; PR6 Go2Pay gateway) are new methods or ports with a sample adapter, never direct client calls.
7. Every env variable is declared in `parseRuntimeConfig`, `.env.example` and the owner guide. No defaults.

## Public Contract

```ts
// src/lib/runtime/config.ts
export type RuntimeConfig = Readonly<{
  production: boolean;                       // VERCEL_ENV === "production"
  data: "live" | "sample";                   // SITE_DEMO_MODE: "true" | "false" (required; "true" rejected in production)
  sampleSeed: Date | null;                   // SITE_DEMO_DATE: required ISO when sample, rejected otherwise
  supabase: { url: string; publishableKey: string } | null; // required when live
  secureCookies: boolean;                    // NODE_ENV === "production"
  siteUrl: string;                           // SITE_URL: required https URL (http allowed only when not production)
  design: string;                            // SITE_DESIGN: required, one of the six design keys
  donation: { url: string } | "off";         // DONATION_URL: required when live; https URL or "off"
  musallahEntrance: { latitude: number; longitude: number } | "off"; // MUSALLAH_LOCATION_CONFIRMED + coordinates
  measurements: boolean;                     // ENABLE_VERCEL_MEASUREMENTS: required "true" | "false" in production (D-5); always false when not production
}>;
export class ConfigurationError extends Error {} // one message listing every problem, each naming the variable and where to set it
export function parseRuntimeConfig(env: Record<string, string | undefined>): RuntimeConfig;
export function runtimeConfig(): RuntimeConfig; // memoized parse of process.env

// src/lib/runtime/clock.ts
export type Clock = { now(): Date }; export const systemClock: Clock; export function fixedClock(at: Date): Clock;

// src/lib/runtime/wiring.ts (pure)
export type Wiring = { clock: "system" | { fixed: Date }; content: "supabase" | "sample";
  editorial: "yaml"; payments: "link" | "off"; places: "config";
  editor: "supabase" | "sample"; auth: "supabase" | "sample" };  // sample only with content: "sample"
export type DeploymentProfile = { indexable: boolean; sampleBanner: string | null;
  measurements: boolean; adminPortal: "ready" | "sample"; editorPreview: boolean };
export function planWiring(c: RuntimeConfig): Wiring;
export function deploymentProfileFor(c: RuntimeConfig): DeploymentProfile;

// src/lib/runtime/providers.ts ("server-only", each cache()-wrapped)
export function clock(): Clock; export function deploymentProfile(): DeploymentProfile;
export function contentProvider(): ContentProvider; export function editorialSource(): EditorialSource;
export function paymentsProvider(): PaymentsProvider; export function placesProvider(): PlacesProvider;
export function contentEditor(): ContentEditor; export function adminAuth(): AdminAuth;

// Ports (results also carry unavailable + provenance)
ContentProvider: getRecords(kind), getPrayerSettings(), getMedia(name)  // existing, + provenance; getMedia serves /media/[name]
EditorialSource: get<K extends EditorialKey>(key: K)                    // keys = the 17 YAML documents
PaymentsProvider: donation(label): Promise<LinkDestination & { provenance }>
PlacesProvider: musallahEntrance(): Promise<{ place: Place | null; ... }>

// src/lib/backend/providers/contract.ts (write ports; WP-8)
type WriteResult = { ok: true } | { ok: false; reason: "conflict" | "unavailable" };
ContentEditor: listRecords(kind), readRecord(kind, id), readPrayer()       // protected reads, + version
  saveRecord(kind, row, version: string | null): Promise<WriteResult>     // null inserts; else matches updated_at
  deleteRecord(kind, id, version), savePrayerSettings(settings, version)  // delete becomes archive in PR3
  upload(field: "image" | "file", file: File): Promise<string | null>    // after normalizeUpload
AdminAuth: current(): Promise<{ userId: string; email: string } | null>
  signIn(input: { email: string; password: string } | "demo"): Promise<"ok" | "invalid" | "not-admin">; signOut()
```

Also added: `src/instrumentation.ts` `register()` calls `runtimeConfig()`; `next.config.ts` calls `parseRuntimeConfig(process.env)` at load. Removed: `demoEnabled`, `measurementsEnabled`, `community/providers/index.ts`, `locationLinks(env)` (it becomes `directionsLinks(point)` plus the places port), `adminPortal: "unconfigured"` and its "awaiting setup" copy, `content/ramadan.yaml` `demo_mode`/`demo_notice`. Lint: `no-restricted-properties` on `process.env` across `src/**` except `runtime/config.ts`; `no-restricted-imports` on `**/providers/*` (except `contract`) and `**/demo/{mode,store}` outside `src/lib/runtime/**` and `providers/` folders; `@/lib/runtime/*` banned from feature and shared `.tsx`. No routes, tables or RLS change; existing action signatures stay. WP-8 adds `demoSignInAction` and moves `admin-content.ts` reads behind `ContentEditor`; `currentAdmin()` returns `{ userId, email }` instead of `{ client, user }`.

## Private Implementation

The implementer chooses: the zod layout and message wording (each message must name the variable, the allowed values and "Vercel → Settings → Environment Variables, or .env.local"); memoization; file splits inside `providers/` folders; private helpers; fixtures.

## Data and State Flow

Route → lib query function → composition accessor (one adapter per request) → adapter (Supabase `no-store` with 3 s timeout, YAML process cache, fixtures on the seed clock, or config values) → zod parse → `queries.ts` applies `isVisible(row, kind, clock().now())`. Writes (WP-8): action → `currentAdmin()` → zod → `contentEditor()` (Supabase cookie client under RLS, or the sandbox store) → `revalidatePath("/", "layout")`. Config is parsed once per process and when `next.config.ts` loads. Statically prerendered pages (`/donate`, `/about`, and others) resolve their adapters at build. When PR5/PR6/PR7 switch such a page to a database or Go2Pay adapter, the page must render at request time and be revalidated by its save action.

## Failure Modes

- Missing or invalid variable: `ConfigurationError` lists every problem. On Vercel the build fails and the previous deployment stays live. Locally `next dev` refuses to start.
- `SITE_DEMO_MODE=true` (or any sample wiring) in production: the build fails, and `planWiring` also throws at runtime.
- Supabase down: `unavailable: true`, "temporarily unavailable" copy, never sample data.
- `DONATION_URL=off` or `MUSALLAH_LOCATION_CONFIRMED=false`: today's "being finalized" or map placeholder state.
- Invalid YAML: logged fallback (unchanged); `validate:content` fails the build.
- Session expiry, stale `updated_at`, double submit, deployment skew: unchanged messages; adapters return `conflict` or `unavailable`, and the sample adapter applies the same `updated_at` check.
- Sandbox: a restart resets all edits (intended); uploads live in memory under the 3 MB limit; "Sign in as demo admin" cannot exist in production, because sample wiring fails the build and `planWiring` throws, and the Supabase `AdminAuth` rejects `"demo"`.

## Compatibility and Migration

No database change. Rollout step for WP-1, done by the owner before merge: set every required production variable in Vercel (`SITE_DEMO_MODE=false`, `SITE_URL`, `SITE_DESIGN`, `DONATION_URL` link or `off`, `MUSALLAH_LOCATION_CONFIRMED`, Supabase keys, and `ENABLE_VERCEL_MEASUREMENTS` `true` or `false`). If one is missed, the deploy fails safely. Developers add the same variables to `.env.local`; `scripts/demo.mjs` and `scripts/review.mjs` set `SITE_DEMO_MODE=true` and `SITE_DEMO_DATE` explicitly and refuse production. Each WP reverts on its own.

## Parallel Work and Merge Order

```yaml
WP-1: { creates: [src/config/design-keys.ts, src/lib/runtime/*, src/instrumentation.ts, tests/runtime.test.ts, docs/adr/0012-*], extends: [next.config.ts, community/queries.ts, backend/{config,server}.ts, proxy.ts, site-config.ts, config/design.ts, maps/location.ts, integrations/payments.ts, app/layout.tsx, scripts/{demo,review}.mjs, .env.example, docs/guides/owner-setup.md, eslint.config.mjs], depends_on: [PR #9 merged] }
WP-2: { extends: [community/providers/*, community/managed.ts, app pages using demoEnabled, CommunityFeed.tsx, backend/admin-content.ts, content/ramadan.yaml, content/admin.yaml, content/schemas.ts, TonightPanel.tsx], depends_on: [WP-1] }
WP-3: { extends: [queries.ts, managed.ts, prayer/congregation.ts, app/page.tsx, app/prayer/page.tsx, admin pages, admin/actions.ts], depends_on: [WP-2] }
WP-4: { creates: [content/providers/*, content/documents.ts], extends: [all loadX callers, SiteChrome.tsx, FormCta.tsx, integrations/*, validate-content.ts], depends_on: [WP-3], merge_after: [WP-8] }
WP-5: { creates: [integrations/payments/*], extends: [runtime/{wiring,providers}.ts, donate, ramadan pages], depends_on: [WP-4] }
WP-6: { creates: [maps/providers/*], extends: [runtime/{wiring,providers}.ts, LocationMap.tsx], depends_on: [WP-1], merge_after: [WP-5] }
WP-8: { creates: [backend/providers/*, demo/store.ts, tests/editor.test.ts], extends: [runtime/{wiring,providers}.ts, admin/actions.ts, backend/{server,admin-content,storage}.ts, community/providers/mock.ts, app/media/[name]/route.ts, app/admin/**, tests/e2e/demo.spec.ts], depends_on: [WP-3] }
WP-7: { extends: [developer.md, architecture.md, AGENTS.md, nextjs-react.md reference, integrations/index.ts], depends_on: [WP-6, WP-8] }
integration_owner: planner
```

Merge order: WP-1, WP-2, WP-3, WP-8, WP-4, WP-5, WP-6, WP-7. WP-8 follows WP-3 because it needs `adminPortal`, `recordFromRow` and the seed clock, shares `actions.ts` and admin pages with WP-3, and unblocks PR3 and the sandbox walkthrough earliest; WP-4/WP-5 only rebase on its runtime lines, and WP-7 documents it. WP-6 can be written in parallel with WP-2 to WP-5 but rebases last, because it shares the runtime files.

## Work Packages

### WP-1: Validated configuration, no sample data in production, composition point

- Purpose: the foundation (D-3, D-4); one env reader, one composition point.
- Depends on: PR #9 merged (`905f341` plus the amended ADR 0011).
- Expected files: as listed for WP-1 in Parallel Work and Merge Order; delete `src/lib/community/providers/index.ts`; `tests/site-config.test.ts` cases move to `tests/runtime.test.ts`.
- Reuse: `createMockContentProvider`, `supabaseContentProvider`, the `demoEnabled` production guard, the measurements truth table.
- Required changes: implement `config.ts`, `clock.ts`, `wiring.ts` and `providers.ts` (`clock`, `deploymentProfile`, `contentProvider`). Validate in `next.config.ts` and `src/instrumentation.ts`. Route every `process.env` read in `src/` through `runtimeConfig()`, removing the `SITE_URL` and `SITE_DESIGN` fallbacks. Add `sessionCookieOptions`. Keep `demoEnabled` temporarily as a one-line delegate to `runtimeConfig().data === "sample"` (WP-2 deletes it). Write ADR 0012 (the pattern plus D-3/D-4; it links ADR 0011 for the measurements rule and makes its missing-variable case a build error). Add a "Required variables" table to `docs/guides/owner-setup.md` and update `.env.example`. Add the lint rules.
- Must not: add any default for deployment config; add `server-only` to `config.ts`; import adapters outside `providers.ts`; add a DI container, registry class or global mutable state.
- Tests: `tests/runtime.test.ts` checks: production with `SITE_DEMO_MODE=true` throws; production with `SITE_DEMO_DATE` throws; each missing required variable throws a `ConfigurationError` naming it and "Vercel"/".env.local"; several missing variables are reported together; `DONATION_URL` accepts https and `off` and rejects `http:`, empty and missing; `MUSALLAH_LOCATION_CONFIRMED=true` without coordinates throws; `planWiring` never returns `sample` in production (exhaustive over env combinations); measurements per D-5 (missing in production throws; `true` on; `false` off; never outside production); `adminPortal` and `indexable` per mode.
- Done when: `grep -rn "process\.env" src` shows only `runtime/config.ts`; `npm run build` with one required variable removed fails with the readable message; `npm run check` passes; demo e2e passes; lint rejects a deliberate adapter import in a page (checked by hand, then reverted).

### WP-2: Replace demo branches with policies and provenance

- Purpose: no code asks "is this the demo?".
- Depends on: WP-1.
- Expected files: as listed for WP-2 in Parallel Work and Merge Order; delete `src/lib/demo/mode.ts`.
- Reuse: `DeploymentProfile`, today's copy strings verbatim.
- Required changes: add `provenance` to `ContentProvider` results. `managed.ts`, `CommunityFeed` and the home method label read `provenance`. Robots, sitemap, metadata and JSON-LD read `indexable`; the banner reads `sampleBanner`; `adminClient`, `proxy.ts` and the admin page read `adminPortal`; `/demo/prayer-settings` reads `editorPreview`. `recordFromRow` replaces the three duplicated parses. Remove the Ramadan `demo_mode`/`demo_notice` (schema, YAML, `TonightPanel`) and the unused demo fields in `admin.yaml`. Payments returns `unconfigured` when wiring says `off` (interim until WP-5).
- Must not: change visible copy on a live configuration; let feature `.tsx` import `@/lib/runtime/*`.
- Tests: `tests/provider.test.ts` becomes a conformance suite (`unavailable`, `provenance`) run on the mock adapter; a `recordFromRow` null-date case; demo and site e2e unchanged.
- Done when: `grep -rn "demoEnabled\|SITE_DEMO\|demo_mode" src content` shows only `runtime/config.ts`; `npm run check` passes.

### WP-3: One server clock

- Purpose: sample fixtures and visibility rules use the same "now".
- Depends on: WP-2.
- Expected files: as listed for WP-3 in Parallel Work and Merge Order; `tests/community.test.ts`.
- Reuse: the existing `now` parameters of `isVisible`, `isUpcoming`, `localDate`, `calculatePrayers` and `congregationTimes`.
- Required changes: every server call passes `clock().now()`; add `isScheduleCurrent(settings, today)` and use it in both `managedPrayer` and `congregationTimes`; the mock adapter is seeded from `clock()`.
- Must not: change the rules or any client component.
- Tests: `isScheduleCurrent` boundaries; sample records stay visible across a simulated Grenada midnight on a fixed clock.
- Done when: no `new Date()` remains in server modules except `clock.ts`, the `ics.ts` stamp and the footer year; `npm run check` passes.

### WP-4: EditorialSource port (YAML adapter)

- Purpose: PR5 can move pages into Supabase one document at a time.
- Depends on: WP-3.
- Expected files: as listed for WP-4 in Parallel Work and Merge Order; `tests/editorial.test.ts`.
- Reuse: `readContent`, every schema and fallback (moved into `documents.ts`).
- Required changes: async `getX()` replaces each `loadX()`. `SiteChrome` and `FormCta` become async server components. `validate-content.ts` uses the adapter's synchronous `readYamlDocument`.
- Must not: change YAML content or schemas (beyond WP-2); add database reads; make a static page dynamic.
- Tests: the YAML adapter parses every document; an invalid temp document falls back with a warning; a memory adapter passes the same suite; `npm run build` still prerenders static pages.
- Done when: no `loadX(` remains outside the YAML adapter; check, build and e2e pass. This WP may land as two PRs.

### WP-5: PaymentsProvider port

- Purpose: the slot for PR6's Go2Pay adapter and its fake.
- Depends on: WP-4.
- Expected files: as listed for WP-5 in Parallel Work and Merge Order; `tests/payments.test.ts`.
- Reuse: `LinkDestination`, `safeHref`, the https check.
- Required changes: `link` and `off` adapters plus a test memory adapter; `planWiring` returns `off` in sample mode or when `DONATION_URL=off`; pages call `await donationDestination(label)`; remove the WP-2 interim branch.
- Must not: name or model any channel other than Go2Pay (ADR 0005); add Go2Pay code or keys.
- Tests: adapter behavior and wiring selection.
- Done when: only `integrations/payments/` and `runtime/` know where the link comes from.

### WP-6: PlacesProvider port

- Purpose: the slot for PR7's database points of interest.
- Depends on: WP-1.
- Expected files: as listed for WP-6 in Parallel Work and Merge Order; `tests/places.test.ts`.
- Reuse: today's coordinate validation and URL building.
- Required changes: a `config` adapter built from `musallahEntrance`; pure `directionsLinks(point)`; a server-only `musallahDirections()`.
- Must not: infer coordinates or add a sample place.
- Tests: the existing `locationLinks` assertions, ported.
- Done when: `LocationMap.tsx` calls only `musallahDirections()`.

### WP-7: Developer docs and cleanup

- Purpose: docs match the code; dead exports leave.
- Depends on: WP-6, WP-8.
- Expected files: as listed for WP-7 in Parallel Work and Merge Order.
- Reuse: link to ADR 0012 rather than restating it.
- Required changes: update the architecture, configuration and "adding an adapter" docs. Remove the zero-consumer integration exports after checking `git log -S` (principle 19).
- Must not: add a guide (the cap is five); edit an accepted ADR.
- Tests: `npm test` (doc links, size budgets).
- Done when: the docs describe only existing code.

### WP-8: Write port and local sandbox

- Purpose: board writes and sign-in sit behind ports, so the local demo is an editable sandbox (D-6) and PR3 adds operations without touching Supabase calls in actions.
- Depends on: WP-2 (`adminPortal`, `recordFromRow`) and WP-3 (seed clock); merges after WP-3.
- Expected files: as listed for WP-8 in Parallel Work and Merge Order; `tests/editor.test.ts`.
- Reuse: every validation and message in `actions.ts`; `recordFromRow`; `sessionCookieOptions`; the sharp pipeline as `normalizeUpload`; fixtures to seed the store.
- Required changes: Supabase `ContentEditor` (today's queries from `actions.ts` and `admin-content.ts`, cookie client, RLS unchanged) and `AdminAuth` (today's sign-in, `getUser` and `admins` check). Sample adapters over `demo/store.ts`: the store seeds once per process from fixtures at the seed time `providers.ts` passes in (adapters never read the clock), the sample `ContentProvider` reads it (so public pages show edits, still filtered by `isVisible`), and the sample `AdminAuth` keeps a demo session in an httpOnly cookie and accepts only `"demo"`. `currentAdmin()` and `requireAdmin()` delegate to `adminAuth()`; every action still calls `currentAdmin()` first. The admin sign-in page shows "Sign in as demo admin" when `adminPortal === "sample"`; `/media/[name]` uses `getMedia`.
- Must not: change tables, RLS, buckets, messages or existing action signatures; add archive, duplicate, history or People (PR3); let any page or action import an adapter or the store; persist the store to disk.
- Tests: `tests/editor.test.ts` conformance suite on the sample adapters (insert, update, stale-version `conflict`, delete, prayer save, upload then `getMedia`, edits visible to the sample `ContentProvider`); `planWiring` never returns sample `editor`/`auth` in production; `AdminAuth` rejects `"demo"` on Supabase (`npm run test:backend`, staging). Demo e2e: sign in as demo admin, edit an event, refresh and see it on the public page.
- Done when: `actions.ts` and admin pages contain no Supabase client call; restarting `npm run demo` restores the fixtures; `npm run check` and both e2e suites pass.

## Implementation Constraints

- Do not read `process.env` in `src/` outside `src/lib/runtime/config.ts`.
- Do not give any deployment variable a default value; missing means an error.
- Do not select or import a sample, demo or fake adapter in production, and do not fall back to one on error.
- Do not import adapters outside `src/lib/runtime/providers.ts` and tests.
- Do not branch on mode or env in routes, features or domain modules.
- Do not create a combined DataProvider, DI container, React Context or a second Supabase client factory.
- Must not add writes to read ports, write outside `ContentEditor`, or change tables, RLS, buckets or existing server action signatures.
- Must not mention any payment channel other than Go2Pay.

## Worker Escalation Conditions

Emit `PLAN MISMATCH` if `next.config.ts` cannot import `src/lib/runtime/config.ts`; if `server-only` breaks the proxy or `tsx --test`; if a `demoEnabled` or `process.env` site exists that is not listed; if a static page would become dynamic; if ESLint flat config cannot keep the existing patterns; if a port needs a method not listed; if the sandbox store is not shared between server actions, pages and `/media/[name]` in `next dev` and `next start`; or if any test needs a visible change on a live configuration.

## Test Strategy

Unit tests (`npm test`): `tests/runtime.test.ts` (fail-fast messages, the production guard, wiring, profile, measurements) and conformance suites for every non-network adapter (`provider`, `editorial`, `payments`, `places`, `editor`); additions in `tests/community.test.ts`. Supabase adapters (read and write): `npm run test:backend` on staging. End-to-end: `tests/e2e/demo.spec.ts` (`E2E_DEMO=true`) and `site.spec.ts` after each WP. Gates: `npm run check` on every PR; `npm run build` on WP-1, WP-4 and WP-5, including one run with a variable removed to confirm the failure message.

## Acceptance Criteria

- A visitor sees the same live site; the local demo still shows its banner and sample events.
- In the local demo, "Sign in as demo admin" opens the dashboard; an edit stays after navigating and refreshing and disappears after a restart. Production has no such button and cannot be built with sample wiring.
- A production deploy with `SITE_DEMO_MODE=true` or a missing variable fails with a message naming the variable and where to set it, and the previous deployment stays live.
- With Supabase down, pages show "temporarily unavailable" and never sample data.
- The owner guide lists every required production variable and its allowed values.
- Adding the PR5, PR6 or PR7 adapter needs no page edits beyond request-time rendering; lint rejects pages that import adapters or read `process.env`.

## Open Risks or Escalations

- The production check relies on `VERCEL_ENV` (Vercel is the only host, ADR 0010); self-hosting would need a new rule.
- The per-theme headline copy in `src/config/design.ts` is board-facing text with no roadmap item; propose adding it to the D0 inventory.
- `DONATION_URL` accepts any https link; restricting it to Go2Pay is left to the PR6 contract (ADR 0005).
