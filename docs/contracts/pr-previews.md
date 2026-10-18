---
status: approved
mode: light
---

# Pull request preview links on staging

Ticket: SGU-MSA/sgu-msa-site-private-history#109 (process). Base: `origin/main` (329e79e). PR target: `main`.

## Capability

Every pull request gets a Vercel preview link (posted on the PR by Vercel) showing the change against the staging database, so the maintainer and board can look before merging.

## Requested Behavior

1. `vercel.json`: enable Git deployments for all branches (previews) while production stays `main`. Remove the `git.deploymentEnabled` block (or set `"**": true`); keep `crons` unchanged (Vercel runs crons on production only).
2. Search engines never index anything but the live site: in `src/lib/runtime/wiring.ts` `deploymentProfileFor`, `indexable` becomes `c.production && !sample` (today it is `!sample`, which would index previews and local staging runs). Update `tests/runtime.test.ts` expectations and add a case: real data + not production → `indexable: false`.
3. New `docs/adr/0034-pull-request-previews-on-staging.md` (Status Accepted, 2026-10-18; "Partially supersedes: ADR 0010, only its 'no pull request or branch previews' decision"): previews build every PR branch with Vercel Preview settings pointing at the **staging** Supabase project (URL + publishable key only); invites, payments, daily check, warning emails and measurements are `off`/`false` on previews; `SITE_URL` on previews is the live address (canonical links), and previews are not indexed; Vercel Authentication is off so board members can open preview links without a Vercel account; previews must never receive production keys. Decided by the maintainer 2026-10-18 ("yes add the preview links"). Add the index row in `docs/adr/README.md`.
4. Docs: `docs/guides/developer.md` (step 4 "There are no preview deployments" and any other "no previews" text → previews exist, on staging; how to find the link on the PR), `docs/guides/owner-setup.md` (§5 and the variables table: add the Preview column/notes listing the ten Preview values above, and that production keys never go in Preview), `.github/pull_request_template.md` (the "Tested locally (no preview deployments)" item → mention the preview link), `docs/release-checklist.md` (top of **Latest changes**: what changed, how to test: open the Vercel preview link on this PR; settings: the ten Preview variables are already set by the planner, Vercel Authentication off), `docs/architecture.md` only if it shows deployment flow.

## Existing System Evidence

`vercel.json` (`git.deploymentEnabled` `{"**": false, "main": true}`); `src/lib/runtime/config.ts` allows `off` for SUPABASE_SECRET_KEY/CRON_SECRET/GO2PAY outside production and http SITE_URL only off-production; `src/lib/runtime/wiring.ts:113`; consumers `src/app/robots.ts`, `sitemap.ts`, `layout.tsx`, `page.tsx`. Hosted state already done by the planner: Preview-scoped variables created; `ssoProtection` set to null.

## Owner

Runtime wiring owns indexability; vercel.json owns deployment triggers; ADR + guides own the policy text.

## Source of Truth

`deploymentProfileFor` is the single rule for indexing. ADR 0034 is the single policy record.

## Product Decisions Required

None.

## Decisions

- D-1 (maintainer, 2026-10-18): add PR preview links.
- D-2 (planner, per the maintainer's "board can click through" goal): Vercel Authentication off for previews; previews use staging, never production keys.

## Board Self-Sufficiency Check

Board members can open a preview link from a PR without any account. No dashboard change.

## Implementation Constraints

- Allowed files: `src/lib/runtime/config.ts` (comments and messages only), `tests/daily-check.test.ts` (edited because it asserted the removed `vercel.json` block), `vercel.json`, `src/lib/runtime/wiring.ts`, `tests/runtime.test.ts`, the docs listed above, `docs/adr/0034-…`, `docs/adr/README.md`, this contract copied to `docs/contracts/pr-previews.md`.
- Do not change `config.ts` rules, production behaviour, or any other runtime flag. Do not add dependencies. Do not touch files owned by the other open branches (`feat/home-centering-password-toggle`, `chore/remove-archive-label`).
- Branch `chore/pr-previews` from `origin/main`.

## Test Strategy

`npm run check`. After pushing, open the PR (draft is fine — the planner opens it) and confirm Vercel posts a preview link and the preview build succeeds; the planner verifies the preview renders and serves `noindex`.

## Acceptance Criteria

- Production behaviour unchanged (`indexable` true only on production real data).
- Preview build for this branch succeeds and renders public pages from staging.
- Docs no longer say there are no previews; ADR 0034 indexed.
