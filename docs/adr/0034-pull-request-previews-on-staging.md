# 0034. Pull request previews on staging

- Status: Accepted
- Date: 2026-10-18
- Partially supersedes: [ADR 0010](0010-production-deploys-from-main-only.md), only its "no pull request or branch previews" decision

## Context

[ADR 0010](0010-production-deploys-from-main-only.md) turned off every Vercel build except `main`. Merging now publishes ([ADR 0033](0033-pull-requests-merge-to-main.md)), so the maintainer and the board need to look at a change before it is merged.

## Decision

- Vercel builds every pull request branch as a **preview** and posts the link on the PR. Production still deploys only from `main`.
- Previews use Vercel's **Preview** settings, pointing at the **staging** Supabase project (URL and publishable key only). Invites, payments, the daily check, warning emails and measurements are `off` or `false`. `SITE_URL` is the live address, so canonical links are right.
- Search engines index only the live production site: `indexable` is true only for production with real data, so previews and staging runs are `noindex`.
- Vercel Authentication is off for previews so board members can open a link without a Vercel account.
- Previews never receive production keys, the production database or a secret key.
- Decided by the maintainer 2026-10-18 ("yes add the preview links").

## Consequences

- A change can be looked at on a phone or by the board before it goes live.
- Preview builds read the staging database, so anyone with a preview link sees staging content; it holds no real personal data.
- Preview builds count toward the free Vercel plan; check usage if builds become frequent ([ADR 0029](0029-tracked-work-and-zero-spend.md)).
