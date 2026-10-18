# Worked examples

Short sketches, not complete contracts. Paths are real; proposed names are illustrative.

## Contents

1. A Go2Pay fund the board must be able to edit
2. Admin check duplicated in the UI instead of RLS
3. A pluralized label that stays local
4. One visibility rule, three screens

## 1. A Go2Pay fund the board must be able to edit

**Request:** "Add a Zakat donate button next to the iftar one."

**Weak plan:** add `ZAKAT_URL` beside `DONATION_URL` in env, or a `funds:` list in `content/integrations.yaml`, and render a second button. Every new, renamed or retired fund then needs a developer and a redeploy, which breaks board self-sufficiency and contradicts ADR 0006.

**Capability:** board-managed Go2Pay funds (ADR 0005, ADR 0006).

**Evidence:** `src/lib/integrations/payments/` (`donationDestination` asks the `PaymentsProvider` port; today's link adapter is built from `DONATION_URL` and returns a `ready | unconfigured` destination); `content/integrations.yaml` (payments notice); `src/features/admin/actions.ts` (save pattern with `currentAdmin()` and `updated_at`); `supabase/migrations/202610150001_schema.sql` (table shape, `public_read` / `admin_manage`); `docs/proposals/go2pay.md` (Go2Pay API notes).

**Plan shape:**

- Migration for a funds table following the existing shape (RLS, grants, `touch_updated_at`).
- Server action creates the Go2Pay product through the API with a server-only test key and stores the returned link; board members never paste links.
- Orders recorded only after re-verifying with `GET /orders/{id}`, idempotently (unique Go2Pay order id); webhooks are a hint.
- `donationDestination` reads funds through a Go2Pay adapter behind `PaymentsProvider`; the demo gets its fake. Dashboard card plus help entry.
- Failure modes: Go2Pay API down while creating a fund (fund saved as not-yet-live, clear message); Supabase down shows "donations temporarily unavailable", never a stale hard-coded link.

**Product Decisions Required** (asked, not decided): which funds exist at launch; preset amounts versus quantity of a fixed amount; button wording and order; whether a retired fund is hidden or shown as closed. Present 2-3 options each, with a mockup for the button layout.

**Must not:** mention or model any payment channel other than Go2Pay; expose the Go2Pay key to the browser; store totals that could diverge from verified Go2Pay orders; add a second Supabase client.

## 2. Admin check duplicated in the UI instead of RLS

**Request:** "Only board members should see the Delete button on newsletters."

**Weak plan:** add `isBoardMember(email)` in the component with a hard-coded email list, and hide the button. The button is hidden but `deleteRecordAction` is still a public POST endpoint, and the email list is a second definition of "admin" that drifts from `public.admins`.

**Analysis:**

- Owner of "who is an admin": `public.admins` + `public.is_admin()`; server mirror `currentAdmin()` in `src/lib/backend/server.ts`.
- Authority: `admin_manage` RLS policy on `public.newsletters`. Defense in depth: `deleteRecordAction` already calls `currentAdmin()`. UX: `/admin/*` pages already call `requireAdmin()`, so non-admins never see the editor.
- Conclusion: the capability already exists. The correct plan is "no change", plus a test proving a non-admin delete returns zero rows.

**Lesson:** search for the owner before writing a check. Security rules are never client-only, and every layer delegates to the same owner.

## 3. A pluralized label that stays local

**Request:** "The resources page should say '1 resource' / '2 resources'."

**Observation:** `src/features/calendar/CalendarFilters.tsx` and `src/features/resources/ResourceFilters.tsx` each render `{resultCount} {resultCount === 1 ? "event" : "events"}`.

**Temptation:** a shared `pluralize()` in `src/lib/utils.ts`.

**Abstraction test:** two consumers, no business rule, no shared change axis, and `utils` is a dumping ground (principle 14). If localization arrives, the right owner is an i18n layer, which is a separate decision.

**Plan:** lightweight mode, keep it local. Board Self-Sufficiency Check: "Not board-editable; this is grammar, not content."

## 4. One visibility rule, three screens

**Request:** "An event with no end time drops off the homepage the moment it starts. Keep it listed while it is still happening, on every screen."

**Observation:** `isUpcoming` in `src/lib/community/schema.ts` is already used by `src/app/page.tsx`, `src/features/calendar/CalendarExplorer.tsx` and `src/app/admin/content/[kind]/page.tsx`. Public visibility itself is enforced by the `public_read` RLS policies; `isVisible` mirrors them for the demo provider.

**Risk:** each screen gets a slightly different inline condition, so the same rule exists three times with three bugs.

**Plan:** change `isUpcoming` once (its owner; today it falls back from `end_time` to `start_time`), add tests in `tests/community.test.ts` for the boundary in Grenada time, and touch no screen. If the change also affects what anonymous visitors may read, the RLS policy changes in a migration and `isVisible` changes in the same work package.

**Product decision to ask:** for events without an end time, how long after the start do they stay "upcoming"? Options: start time only (today); start + 2 hours; until local midnight. Recommendation with reasoning; the user chooses.
