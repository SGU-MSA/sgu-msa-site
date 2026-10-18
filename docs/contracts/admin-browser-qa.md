---
status: approved
mode: light
issue: 124
---

# Focused admin browser QA and coverage

## Capability

Repeatable task-based admin QA, a small local-only browser CI gate, and measured unit coverage.

## Requested Behavior

The maintainer requested intentional exploratory browser QA, permission-focused regression tests, maintainable test layers, regression-first fixes, CI evidence and high code coverage. Reuse existing tools. Do not change product rules, authentication, layout or live data. Start with a bounded gate; the ecosystem remains separately tracked in #117.

## Existing System Evidence

- `tests/e2e/actions.ts` owns sandbox sign-in, accessible locators and save helpers.
- `playwright.config.ts` owns browser defaults and failure screenshots/traces. Existing browser specs require an explicitly started server and many skip without flags; CI currently runs no browser flow.
- `scripts/demo.mjs` creates a process-local sample backend; `admin/admin` has people/money rights and `board/board` has neither. Both identities represent the same Executive member; this is not a General-board or independent single-permission fixture.
- `src/lib/backend/providers/sample.ts`, `src/lib/backend/server.ts`, `src/lib/backend/admin-payments.ts` and current PR3/PR6 contracts own permissions. Ordinary admins may edit Funds/Tickets; Manage money protects Money in. Manage people protects login changes and Term export.
- `tests/*-migration.test.ts`, `scripts/test-backend.ts` and CI database job own real SQL/RLS/guard testing. Docker is unavailable in this WSL distro; do not present sample tests as local hosted-auth/RLS evidence.
- Node 22 provides native test coverage. Baseline must be measured; coverage only includes loaded modules and is not a whole-repository dead-code detector.

## Owner

Extend existing testing ownership: `playwright.config.ts`, `tests/e2e/`, `.github/workflows/validate.yml`, `package.json`, `tests/support/`, and existing testing skill/developer guide. Use a separate thin smoke config only if it reuses the main config and cannot redirect to hosted data. Coverage output stays ignored.

## Source of Truth

Existing approved feature contracts and runtime/SQL rules define expected behavior. Tests observe those rules. The testing skill owns the QA/TDD procedure; developer guide owns commands. Reports/issue comments own run evidence, not a second product rulebook.

## Product Decisions Required

None for this bounded testing capability. No product permissions, visual design, dependency, hosted environment or retention changes.

## Decisions

D-1: Maintainer approved implementation and requested intentional admin QA plus CI regression coverage (2026-10-14).
D-2: Maintainer additionally requested high code coverage and dead-code investigation (2026-10-14). Measure honestly, enforce a baseline floor and raise coverage through meaningful missing-case tests; do not silently exclude difficult modules or treat unexecuted code as removable.
D-3: Reuse Playwright, axe, Node test runner and existing SQL tests; no new dependency or paid testing service is needed.

## Board Self-Sufficiency Check

No board UI changes. The QA procedure models existing board tasks; operator steps stay in the handbook, testing steps stay in the developer guide/skill.

## Implementation Constraints

- Expected files: this contract; `playwright.config.ts` and optionally `playwright.smoke.config.ts`; `tests/e2e/admin-smoke.spec.ts`, shared `tests/e2e/actions.ts` save synchronization, and focused regression additions to existing `tests/payment-screens.test.ts`; `package.json` and matching lockfile root engine metadata; `.github/workflows/validate.yml`; `.gitignore` and `eslint.config.mjs` source-versus-ignored-local exclusions; existing testing skill and developer/release guides; narrowly scoped coverage reporter/runner under `tests/support` or `scripts` only if native CLI reporting is insufficient.
- Reuse existing sign-in/save helpers and accessible locators. Keyboard save must await the same observable POST completion as click save before asserting the transient success toast; retain click as the helper’s default. Only the complete create/edit/public-revalidation/axe/archive journey may use a 60-second case budget: independent CI trace showed all save/public/accessibility assertions passing, with final archive navigation crossing the cumulative 30-second limit. Keep other limits and zero retries unchanged; a closed-page cleanup guard must preserve the primary timeout while real live-page cleanup failures still propagate. CI trace demonstrated a valid cold create response taking nearly five seconds, so do not start the success-toast assertion while the operation is still saving. No fake permission bypass, new sandbox account, API testing backdoor or production test identity.
- Fresh loopback-only sample server owned by the smoke run; refuse reuse of an occupied server. Ignore E2E_BASE_URL in smoke mode. Tests must not silently skip in the dedicated CI command.
- Cover signed-out refusal; restricted user navigation and direct sensitive routes/download; manager access; ordinary content edit reflected publicly; invalid input; session lost before submit; keyboard/axe at desktop light and phone dark.
- No real payment/email, hosted CRUD, schema change, new framework, random fuzzing or blanket screenshot/coverage threshold. Declare the Node 22.15+ test-tooling minimum (existing registerHooks and native coverage flags); update only matching lockfile root metadata, not dependencies.
- ESLint must ignore `.plans/**` draft scratch and `.agents/local/**` private tooling data, as Git already does. These are not application source; retain all application/test/role checks and do not weaken lint rules. This fixes the observed normal-workspace gate failure rather than requiring every agent to build a separate clean worktree.
- Keep deterministic known sample content and serial writes. Restore edited sample content where feasible; use fresh contexts for sessions.
- Record exploration charter, expected/actual result, revision and evidence in #124/PR, and add a focused regression for a confirmed bug before its fix. Exploratory UX judgment is separate from automated assertions.
- Coverage report must state included files, skipped/unloaded scope and metric denominator. Do not lower a passing baseline or add ignore pragmas to inflate a number. Existing lint/type checks detect some unused code; coverage alone does not.

## Test Strategy

QA-01 signed-out direct screens/download refused; QA-02 restricted board sees correct navigation and sensitive route refusal; QA-03 manager can reach sensitive screens; QA-04 allowed content edit reaches a separate public browser without rebuild; QA-05 invalid form/save recovery and no unintended changes; QA-06 expired session cannot save; QA-07 keyboard/accessibility and viewport checks. Smoke runs each at desktop/light and phone/dark with isolated contexts, one worker and zero retries. Keep reports/traces/screenshots on failure, using short artifact retention. Run existing unit/migration tests, lint/type/format gate and CI database/Storybook. Coverage command measures loaded application modules, emits a machine-readable artifact and enforces measured floors; add focused tests for critical uncovered branches rather than shallow line execution. In the existing payment-screen tests, exercise readMoneyIn’s injected gateway/rows boundary for unavailable local rows, refused key and failed order fetch; assert safe output and that denied/unavailable paths make no forbidden remote call. No application behavior changes are needed.

## Acceptance Criteria

Dedicated smoke command starts/stops its own local sample server and executes all named cases without skips; CI uploads useful failure evidence. Coverage command reports honest baseline metrics and fails a deliberate unmet threshold. Full `npm run check` passes. QA findings and unsupported permission profiles are recorded. No production changes, new paid service or dependency; website/game feature work remains separate.
