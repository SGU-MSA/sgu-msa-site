# Supabase in this repo

Postgres + RLS + Auth + Storage. Schema lives in `supabase/migrations/*.sql`; app-side shapes in zod (`src/lib/community/schema.ts`).

## Authority and defense in depth

- **RLS and table constraints are the authority.** Every table has RLS enabled, a `public_read` policy for what anonymous visitors may see, and an `admin_manage` policy using `(select public.is_admin())`.
- **Server checks are defense in depth.** Server actions call `currentAdmin()` (which reads `public.admins` with the user's session) before writing. They never replace RLS.
- **UI checks are UX only.** Hiding a button never secures anything.
- Each layer delegates to the same owner: admin membership is `public.admins` / `public.is_admin()`. People permissions ("manage people", "manage money"; ADR 0007) extend that owner in the database; never add email allowlists or per-route checks that redefine "admin".
- Authorization follows existing policy ownership; do not repeat rules per route or per action.

## Keys and secrets

- The app uses `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` with the user's session cookie, so RLS always applies.
- A secret (service-role) key bypasses RLS. It must never reach the browser or be prefixed `NEXT_PUBLIC_`. ADR 0007 allows it only inside the manage-admins server actions (`AccountInviter`: invite, and deleting a permanently deleted person's login, PR3 D-21); any other use needs a new ADR.
- Never read, print or copy `.env.local`. Plans reference variable names only.

## Migrations

- A migration is part of the feature. The contract states: the migration file, compatibility before and after deploy, defaults/backfill, nullability transition, RLS and grants, rollback approach, and test fixtures.
- Naming: `supabase/migrations/YYYYMMDDNNNN_<slug>.sql`; the clean baseline is four ordered files (`202610150001_schema.sql` … `202610150004_recent_changes.sql`).
- **Schema changes are new additive migration files; never edit the baseline files; staging first, with the user's OK.** One new file per PR, dated after `202610150004`, with a PGlite test that it applies cleanly on top of the baseline. Editing a baseline file is a review blocker.
- Apply to **staging first**, verify, then production. Agents never apply migrations to or query production; production rollout is a human step.
- New tables copy the existing shape: `enable row level security`, `public_read` + `admin_manage` policies, explicit `grant`s, `updated_at` + `touch_updated_at()` trigger for the version check, `check` constraints mirroring the zod schema.
- Keep functions `security definer` only when required, always with `set search_path = ''`.

## Types and single-sourced shapes

- Data shapes are single-sourced: the migration defines storage and constraints; the zod schema mirrors them for forms and parsing. The contract names both and states which constraint is authoritative.
- Generated types come from `supabase gen types typescript` against staging (ADR 0004). The repo has no generated file yet: the first contract that needs one names its path and regeneration command; implementers never add one ad hoc.
- Do not hand-write a third copy of a row type.

## Storage

- Bucket `community` is private (3 MB, `image/webp` and `application/pdf`). Anonymous reads are allowed only for files referenced by a currently published row.
- Uploads go through `normalizeUpload` in `src/lib/backend/storage.ts` (size/type checks, image normalization to WebP, UUID names), then `contentEditor().upload`. Reuse them; do not add a second uploader.
- There is no overwrite policy, by design (protects published files). The only delete policy (PR3 contract, D-23) lets any admin remove a file that no row names; widening it further is a user decision.

## Auth

- Email/password sign-in through `signInAction`; a signed-in user without an `admins` row is signed out immediately.
- `src/proxy.ts` refreshes session cookies for `/admin/*`; it is not an authorization check.
- Board access is managed in the dashboard's People list (ADR 0007, PR3): invites through `AccountInviter`, access changes through `grant_access`/`set_access` guarded by the `admins_guard` trigger, every change in the add-only activity log (ADR 0013). The owner's only SQL step is `owner_add_admin` (first manager, or before Gmail SMTP works; `docs/guides/owner-setup.md` §10); plan against those ADRs.

## Board-editable data checklist

When the board must be able to change something:

1. Store it in a Supabase table (or a column on `prayer_settings`-style singleton), not YAML or env.
2. RLS: `public_read` limited to what visitors should see; `admin_manage` via `is_admin()`.
3. A zod schema + server action in `src/features/admin/actions.ts` pattern with `currentAdmin()`, the `updated_at` version check, and the write through `contentEditor()` (a new method on the Supabase and sample adapters).
4. A dashboard entry, plain-language labels, and board steps under "Handbook notes" in the PR body (ADR 0028).
5. Sample data (fixtures and the sandbox store in `src/lib/demo/`) so the local sandbox (`npm run demo`) and Storybook still work without a backend.

## Evidence with MCP

Use `mcp__supabase__list_tables`, `mcp__supabase__list_migrations` and read-only `mcp__supabase__execute_sql` (for example `select * from pg_policies where tablename = 'events'`) against **staging only**. If the server is unavailable, read the migrations and mark live-state claims as unverified.
