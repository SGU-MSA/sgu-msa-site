# 0012. Ports and adapters, one composition point, fail-fast configuration

- Status: Accepted
- Date: 2026-10-03

## Context

Pages and features asked "is this the demo?" in 15 places, environment variables were read in nine files, and several had silent fallbacks (`SITE_URL`, `SITE_DESIGN`). Upcoming work moves YAML pages into Supabase, adds Go2Pay and adds map points, each of which swaps a data source. Sample data must never reach the live site, and a wrong or missing setting should stop a deploy rather than quietly change the site. Decided by the user in the [data providers contract](../contracts/data-providers.md) (D-3, D-4, 2026-10-03).

## Decision

**Pattern.** Each data source sits behind a small capability interface (a *port*, `<capability>/providers/contract.ts`) with interchangeable implementations (*adapters*). One server-only composition point, `src/lib/runtime/providers.ts`, picks the adapters from one validated configuration. No DI container, registry class or single "DataProvider".

1. Read results carry `unavailable` and `provenance` (`"live"` or `"sample"`); only the write ports write.
2. Adapters never read env or the clock, never decide the mode and never fall back to another adapter.
3. Only `src/lib/runtime/providers.ts` imports adapters (tests excepted). Lint enforces this.
4. `planWiring` (`src/lib/runtime/wiring.ts`) never selects a sample adapter in production; it throws if asked to.
5. Features branch on data (`provenance`, `unavailable`, `state`) or on `DeploymentProfile` fields, never on mode or env.
6. Admin actions keep validation, `currentAdmin()`, revalidation and redirects, and write only through the write port; RLS stays the authority. New write operations are new port methods with a sample adapter.
7. Every env variable is declared in `parseRuntimeConfig` (`src/lib/runtime/config.ts`), `.env.example` and the owner guide's [Required variables](../guides/owner-setup.md#required-variables) table.

**No sample data in production (D-3).** Demo, fake and sample data sources are allowed anywhere except production (in practice, developers' computers; [ADR 0010](0010-production-deploys-from-main-only.md)). Production is `VERCEL_ENV=production`; on Vercel a missing `VERCEL_ENV` fails the build. The build fails when `SITE_DEMO_MODE` is not `false` in production, and `planWiring` refuses sample wiring at runtime.

**Fail-fast configuration (D-4).** `src/lib/runtime/config.ts` is the only reader of `process.env` in `src/`. One zod schema covers local runs and production, with no defaults. It runs when `next.config.ts` loads (`next dev`, `build`, `start`) and at server start (`src/instrumentation.ts`). A failure lists every problem in one message, each naming the variable, its allowed values and where to set it. Interim values are explicit: `DONATION_URL` is an https link or `off`; `MUSALLAH_LOCATION_CONFIRMED` is `true` (with coordinates) or `false`. Board-changeable settings belong in the dashboard, not env.

**Measurements.** The rule stays as [ADR 0011](0011-production-analytics-explicit-setting.md) states it (production and exactly `true`). As ADR 0011 anticipated, a missing or invalid `ENABLE_VERCEL_MEASUREMENTS` in production is now a build error. The rule's code owner is `deploymentProfileFor` in `src/lib/runtime/wiring.ts`.

## Consequences

- A missing or invalid Vercel variable fails the deploy with a readable message; the previous deployment stays live. The owner must set every required variable before the release that introduces this check.
- Developers need the same variables in `.env.local`; `npm run demo` and `npm run review` set the sample switch and seed time themselves and refuse production.
- New data sources (YAML pages in Supabase, Go2Pay, map points) become new adapters chosen in one place, without page rework.
- Self-hosting outside Vercel would need a new rule for detecting production.
