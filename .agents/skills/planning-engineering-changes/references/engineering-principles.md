# Engineering principles

The single home for engineering practice in this repo. Cite these by number in contracts and reviews instead of restating them.

## Contents

- Ownership and knowledge (1-6)
- Boundaries and dependencies (7-11)
- State, effects and concurrency (12-17)
- Change over time (18-21)
- Patterns and SOLID, applied pragmatically
- Final decision questions

## Ownership and knowledge

1. **Capability before implementation.** "Show a badge when the event is upcoming" is really "decide event visibility and timing". The UI consumes the capability; it does not define the rule.
2. **One owner per important concept.** Admin membership is owned by `public.admins` + `public.is_admin()`; every other check delegates to it.
3. **One source of truth.** Ask: "if this rule changes tomorrow, where would an engineer change it?" If the answer is "three places", it is already a bug. Example: publication visibility is enforced by the `public_read` RLS policies; `isVisible` in `src/lib/community/schema.ts` is a declared mirror for the demo provider and must change in the same commit.
4. **DRY means knowledge, not text.** Two identical-looking Tailwind class lists may be coincidence; `published && date <= today` written three different ways is one rule duplicated.
5. **Existing abstractions have priority, but no god objects.** Ask whether the new responsibility changes for the same reason as the module's existing ones. If not, it belongs elsewhere.
6. **Abstraction decision test.** Before creating a shared abstraction, answer: Identity (is it one named concept?), Ownership, Knowledge (what rule does it encode?), Variation (what actually differs?), Change axis, Consumers (at least two real ones?), Coupling introduced, Reversibility, Cost. Weak answers mean keep it local.

## Boundaries and dependencies

7. **Narrow public APIs.** Expose `currentAdmin()` returning `{ client, user } | null`, not raw session cookies or table rows.
8. **Encapsulate known axes of change only:** data provider (`ContentProvider`), storage, payment destination, serialization, retry policy. Do not wrap things that have no second variant in sight.
9. **Dependency direction:** route (`src/app`) composes feature (`src/features`), which uses domain and data (`src/lib`). `src/lib` never imports `src/app` or `src/features` (enforced in `eslint.config.mjs`). Domain rules never import framework code.
10. **Separate policy from mechanism.** "Which files may be uploaded" (policy) is distinct from "write bytes to the `community` bucket" (mechanism).
11. **Make dependencies explicit.** Prefer pure functions with explicit inputs (`calculatePrayers(settings, date)`) over hidden reads of env, clock or globals.

## State, effects and concurrency

12. **Model important states explicitly.** Use discriminated unions or explicit state machines (`{ state: "ready", href } | { state: "unconfigured", reason }`) instead of boolean combinations. Name every state and every allowed transition (for example an order: `pending -> paid -> refunded`, never `refunded -> paid`).
13. **Type meaningful identifiers** where confusion is realistic (Go2Pay order id vs product id); no ceremony elsewhere.
14. **No dumping grounds.** No `utils`, `helpers`, `common`, `misc`, `manager` modules; name modules after the concept they own.
15. **Visible side effects.** A `getX()` must not refresh auth, write storage, revalidate paths or redirect. Mutations live in server actions with names that say so.
16. **Concurrency is correctness.** Ask: twice? out of order? caller gone? cancelled? retry-safe? who owns the state? racing writers? This repo uses an `updated_at` version check for concurrent board edits; reuse it.
17. **Prefer idempotent operations** for retries, webhooks, uploads, payments and notifications. Use natural keys or idempotency keys and upserts; re-verify external events at the source (Go2Pay: `GET /orders/{id}`) before acting.

## Change over time

18. **Preserve behavior when refactoring legacy:** characterize with tests, refactor the boundary, verify, then add behavior. Never mix a broad rewrite with a feature.
19. **Investigate strange code before deleting it:** history, comments, tests, ADRs, archived notes in `docs/archive/`.
20. **Incremental architectural commitment.** A private helper is cheap; a new table, RLS policy or shared module with many dependents is expensive and needs more evidence.
21. **Predictability over local cleverness.** Do what the next engineer expects to find in the place they will look.

## Security and reliability practices

- **Least privilege:** the app uses the publishable key plus the signed-in user's session; RLS grants only what each role needs. A secret key is server-only and limited to the use an ADR names (ADR 0007: manage-admins actions).
- **Defense in depth:** RLS and database constraints are the authority; server actions re-check `currentAdmin()` and validate with zod; UI checks are UX only. All three may exist, but each layer delegates to the same owner rather than inventing its own rule.
- **Fail honestly:** when Supabase is unavailable, public pages show an unavailable state (`unavailable: true`), never invented data.
- **Validate at boundaries:** zod parses every form, file and external payload; schema validation is not business validation.

## Patterns and SOLID, applied pragmatically

Use a design pattern only when the problem matches its intent, and name it in the contract (for example "Adapter: `ContentProvider` isolates Supabase vs demo data"). Do not introduce a pattern to look tidy.

- **Single responsibility:** one reason to change per module (`storage.ts` validates and stores uploads; it does no routing or UI).
- **Open/closed:** extend through existing seams (a new `Collection` value, a new provider) rather than editing every consumer.
- **Liskov:** every `ContentProvider` implementation honors the same `unavailable` semantics.
- **Interface segregation:** keep interfaces read-only or write-only where consumers differ (`ContentProvider` is public reads only).
- **Dependency inversion:** features depend on `getRecords` / server actions, never on a concrete Supabase client (enforced by lint for `.tsx`).

Common matches here: Adapter (providers, integrations), Strategy (prayer calculation methods), State machine (payments, publication), Repository only where a real persistence boundary exists (`src/lib/backend/admin-content.ts`).

## Final decision questions

1. What capability is changing?
2. Who owns it?
3. Where is the authoritative state?
4. Does a representation of it already exist?
5. Am I duplicating knowledge?
6. Is this concept stable enough to share?
7. Which known change does this isolate?
8. Is the dependency direction correct?
9. What is the easiest failure mode to overlook?
10. Where will the next engineer expect to modify this?
11. Can a board member change it without a developer?
