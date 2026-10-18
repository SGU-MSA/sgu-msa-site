# 0011. Production analytics are an explicit owner setting

- Status: Accepted
- Date: 2026-10-03

## Context

Vercel Web Analytics and Speed Insights were opt-in through `ENABLE_VERCEL_MEASUREMENTS=true`. The club wants basic visit and performance numbers for the live site without collecting more than needed. Turning measurement on silently by default would be hidden behavior, and the project is moving to deployment settings with no silent defaults.

## Decision

- Production requires `ENABLE_VERCEL_MEASUREMENTS` set explicitly to `true` or `false` in Vercel. The owner decides; there is no default.
- Measurement runs only when `VERCEL_ENV` is `production` **and** `ENABLE_VERCEL_MEASUREMENTS` is exactly `true`; never in demo mode, previews or local runs (`measurementsEnabled()` in `src/lib/site-config.ts`).
- Until the fail-fast configuration check lands, a missing variable means off. Once it lands, a missing or invalid value fails the production build with a message naming the variable.
- To collect data, the owner also clicks **Enable** once on the project's Analytics and Speed Insights tabs.

## Privacy safeguards

- Admin routes are never measured.
- Query strings are removed from measured addresses.
- No advertising or custom profiling; the privacy page states that measurement happens only when the site owner switches it on.

## Consequences

- Measurement is a visible owner choice: one variable in Vercel, plus enabling the dashboard tabs.
- Usage counts against the Vercel free plan's analytics limits when switched on.
- Adding another analytics platform needs a new ADR.
