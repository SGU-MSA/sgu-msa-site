---
status: approved
mode: light
---

# Keep the staging database awake

Base: `origin/main` (868b2c7). PR target: `main` in `SGU-MSA/sgu-msa-site`. Branch: `chore/staging-keep-awake`.

## Capability

The free staging Supabase project (`qglftmxfjvxmrzppkxks`, used by every pull request preview and the review site, ADR 0034, ADR 0035) stays awake between work sessions, the way the nightly check keeps production awake (ADR 0022, D-16). If staging is unreachable anyway, a developer hears about it the same day.

## Requested Behavior

1. Once a day, a GitHub Actions job makes one small read from the staging database through its public REST API: `GET https://qglftmxfjvxmrzppkxks.supabase.co/rest/v1/prayer_settings?select=id&limit=1` with the header `apikey: <staging publishable key>`. It needs HTTP 200. An empty array still counts as success.
2. The job can also be started by hand (`workflow_dispatch`).
3. A missing key secret, a network error or a status other than 200 fails the job, after a few retries. GitHub then emails the developer, because a scheduled run's failure goes to whoever last edited the workflow's schedule. The log never prints the key or the response body.
4. The job never contacts anything except the staging project. Production stays awake through its own nightly check and is never named in this workflow.

## Existing System Evidence

- Production stays awake only because of `vercel.json`: a cron calls `/api/daily-check`, `0 5 * * *`. Vercel runs crons only on production deployments, so previews, and staging with them, get no nightly reads (owner guide, Preview environment: `CRON_SECRET` is `off` in Preview).
- Staging was found paused on 2026-11-25. Its host no longer resolved in DNS, and the Supabase MCP returned "Database is possibly not accessible", after 14 quiet days. The free plan pauses after about a week without activity (daily-check contract, sources line).
- The staging ref `qglftmxfjvxmrzppkxks` is already public in `.mcp.json` and `docs/guides/developer.md`. The publishable key is built for public use (it ships in every client bundle) and RLS governs what it can do.
- The anonymous role can read `public.prayer_settings` (`supabase/migrations/202610150001_schema.sql:1358-1360`, `public_read` policy plus `grant select … to anon`). It is a one-row table (`id = 1`).
- The repository is public, so GitHub Actions minutes are free ($0 ceiling, ADR 0029).
- Existing workflows are `.github/workflows/validate.yml` and `pr-body.yml`. PR #11 (not merged) adds `review-branch.yml`. None of them is scheduled.

## Owner

`.github/workflows/staging-keep-awake.yml` (new; CI is the only owner of scheduled developer jobs). The test sits in `tests/staging-keep-awake.test.ts`.

## Source of Truth

- Staging project ref: `.mcp.json` (the developer guide says to change it there when staging is recreated). The workflow repeats the ref in its URL, and the test fails if the two ever differ.
- Staging publishable key: the GitHub repository secret `STAGING_SUPABASE_PUBLISHABLE_KEY`, set by the planner before merge. It is never in Git.

## Product Decisions Required

None. This is developer infrastructure that no board member sees.

## Decisions

- D-1 (maintainer, 2026-11-25): "would it be possible to set a daily check just like we have on the prod db to keep it up?" Yes. Build it.
- D-2 (planner, engineering): a GitHub Actions schedule. Rejected: a Vercel cron (production deployments only); pg_cron inside staging (it cannot run while the database is paused, and it may not count as outside activity); an outside uptime service (one more account to own and hand over).
- D-3 (planner, engineering): a REST read using the publishable key. It is the same kind of request the previews make. No secret or service-role key is involved.
- D-4 (planner, engineering): no automatic restore. Restoring needs a Supabase management token, which means a new secret and more power. A paused staging is restored by hand from the Supabase dashboard (developer guide line).

## Board Self-Sufficiency Check

Not board-facing. Staging belongs to the developers, and the board's live site is unaffected. Nothing the board might want to change is added.

## Implementation Constraints

- Allowed files:
  - `.github/workflows/staging-keep-awake.yml` (new)
  - `tests/staging-keep-awake.test.ts` (new)
  - `docs/guides/developer.md`: one short paragraph next to the PR preview / staging text, saying what the job does, that a failure email means staging paused (restore it in Supabase → the staging project → Restore, then re-run the job), and that a recreated staging needs a new ref in `.mcp.json` and the workflow plus a new secret.
  - `docs/architecture.md`: one sentence after the nightly-check diagram, saying staging is kept awake by a daily GitHub Actions read rather than by the nightly check.
  - `docs/release-checklist.md`: top entry of **Latest changes**.
  - This contract.
- Workflow shape:
  - `on: schedule` once a day at an off-the-hour minute (for example `"23 7 * * *"`), plus `workflow_dispatch`.
  - `permissions: {}` (no repository token scopes).
  - One job on `ubuntu-latest` with `timeout-minutes: 5` and no checkout.
  - One `run` step. It fails with a clear `::error::` line if the secret is empty, then runs `curl` with `--fail`, `--silent`, `--show-error`, `--retry 3`, `--retry-all-errors`, `--retry-delay 20`, `--max-time 30` and `--output /dev/null`, and writes the status code. The key goes in through `env:` from `secrets.STAGING_SUPABASE_PUBLISHABLE_KEY`, never inline in the command.
- No `Authorization` header (a publishable key is not a JWT), no other secret, no production URL, no `SUPABASE_SECRET_KEY`.
- No new dependency (the test uses the existing `js-yaml`). Do not touch `vercel.json`, `src/` or migrations.
- Stop with PLAN MISMATCH if `prayer_settings` turns out not to be readable by `anon`, or if `.mcp.json` no longer names a single staging ref.

## Test Strategy

`tests/staging-keep-awake.test.ts` parses the workflow with `js-yaml` and asserts that:
- it has a `schedule` with exactly one cron, and `workflow_dispatch`;
- `permissions` is an empty object;
- the only `secrets.*` used anywhere is `STAGING_SUPABASE_PUBLISHABLE_KEY`;
- the request host is `<ref>.supabase.co`, where `<ref>` is the `project_ref` parsed from `.mcp.json`;
- the run script contains `--fail` and does not contain `Authorization`.

Run `npm run check`. After merge, the planner starts the job once by hand and confirms it is green.

## Acceptance Criteria

- The workflow runs daily and on demand, and passes against a running staging.
- When staging is paused or the secret is missing, the run fails and GitHub sends its failure email. The log shows no key.
- The test fails if the workflow's ref drifts from `.mcp.json`, or if another secret or an `Authorization` header is added.
- `npm run check` passes. The docs links resolve (`tests/documentation.test.ts`).
