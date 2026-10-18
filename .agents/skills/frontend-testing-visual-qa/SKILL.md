---
name: frontend-testing-visual-qa
description: Decides what to test and which gate catches each regression in this repo, covering node test runner unit tests, migration tests on PGlite, backend RLS tests against local Supabase, Playwright end-to-end flows, axe accessibility scans in light and dark, Storybook stories, screenshot and Lighthouse checks, and the npm run check gate. Use when adding tests for a feature, choosing the right test level, writing Playwright specs, visually or accessibility-checking a UI change, or proving a board edit reaches the public site. Not for reviewing a finished diff against its implementation contract (use reviewing-engineering-changes) or performance tuning (use core-web-vitals-optimization).
allowed-tools:
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__resize_page
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__take_snapshot
  - mcp__chrome-devtools__lighthouse_audit
  - mcp__chrome-devtools__list_console_messages
---

# Frontend testing and visual QA

Test behavior the user or board member sees, at the cheapest level that catches the regression.

## Gates in this repo

| Command                                   | Catches                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`                           | eslint + `tsc` + unit tests + prettier. Must pass before handoff.                                            |
| `npm test` (`tsx --test tests/*.test.ts`) | Pure logic: zod schemas, content loaders, date and prayer math, helpers. `node:test` + `node:assert/strict`. |
| `tests/prayer-migration.test.ts`          | Migration SQL on in-memory PGlite.                                                                           |
| `npm run test:backend`                    | RLS and data access against a dedicated **local** Supabase (`127.0.0.1:54321`) only.                         |
| `npm run test:e2e`                        | Playwright specs in `tests/e2e` against `E2E_BASE_URL` (default `localhost:3000`), `retries: 0`.             |
| `npm run validate:content`                | `content/*.yaml` against schemas (also runs in `build`).                                                     |

Some specs skip unless an environment flag is set (for example `demo.spec.ts` needs `E2E_DEMO=true` against `npm run demo`; the editor specs need a local test account). Read a spec's `test.skip` before counting it as coverage. `tests/e2e/theme.spec.ts` covers the theme switch, no-flash and axe on every public page in light and dark.

## Choosing the level

| Change                                         | Test                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Logic, parsing, formatting, schema             | Unit test in `tests/*.test.ts`                                                       |
| SQL migration                                  | PGlite test                                                                          |
| RLS, permissions, data access                  | `test:backend`                                                                       |
| User-visible flow                              | Playwright e2e                                                                       |
| Appearance in light and dark and across widths | Storybook story in both themes, plus screenshots at fixed widths reviewed by a human |
| Accessibility                                  | Axe in Playwright on every designed page, plus a keyboard pass                       |

**Board-editability test (principle 1):** for each admin-editable field, an e2e or backend test proves that an edit made in the dashboard appears on the public page without a rebuild.

## Rules

- Query like a user: `getByRole`, `getByLabel`, `getByText`. Test IDs only when no accessible query exists.
- Assert outcomes, not implementation details.
- Deterministic data and time: pass explicit `Date` values (see `tests/community.test.ts`); prayer and event logic depends on the date and the `America/Grenada` timezone.
- Cover empty, very long and missing-image content, not only the sample data.
- Flaky tests get fixed or quarantined with a recorded follow-up; never silently re-run.
- Storybook (design-foundation D-1, D-2) documents every shared primitive in light and dark; `npm run build-storybook` runs in CI. Do not add another test framework (Testing Library, Vitest, MSW, a visual-diff service) without a recorded decision.
- Screenshot baselines, if added, are updated deliberately and reviewed by a human.

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("calendar has no axe violations", async ({ page }) => {
  await page.goto("/calendar");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations).toEqual([]);
});
```

## Intentional QA and regression-first changes

Choose a persona, a real task and a failure risk before clicking. Cover signed-out, ordinary-board and relevant sensitive-permission cases; distinguish Executive page editing from people/money permissions. Check discoverability, errors, keyboard use, direct-route/action refusal, stale/session-lost state and the resulting public page. Use disposable local data. The sandbox has full and restricted views of the same Executive account: it does not prove General-board, independent single-permission, Supabase Auth or RLS behavior.

Record the revision, environment, persona, steps, expected/actual outcome and evidence on the existing issue/PR. Keep traces/screenshots out of Git and never include credentials or live private data. A confirmed bug gets a focused failing regression before the smallest fix; verify the failure reason, get green, refactor, then rerun affected gates. Send implementation and review fixes through the shared agent roles; maintainers review/merge.

Use `npm run test:smoke` for the small fresh-local browser CI gate and `npm run test:coverage` for native unit coverage. Keep broad browser exploration and the existing detailed suites for changed areas/release QA. Inspect uncovered branches for useful missing assertions; do not import code or add ignores to raise a number. Node 22 coverage measures loaded application modules and omits unimported files; it is not a whole-repo or dead-code report. Use the coverage artifact, call-site searches, lint/types and actual runtime paths before removing suspected unused code. Raise measured floors as meaningful tests improve coverage. Load tests are warranted for an approved concurrency/capacity change, not every PR.

## Quick visual check

- chrome-devtools MCP: `new_page` to the local URL, `resize_page` to 390 and 1280 wide, `take_screenshot` of each; `take_snapshot` for the accessibility tree; `lighthouse_audit` for accessibility and SEO; `list_console_messages` for runtime errors and hydration warnings.
- If the server is unavailable: a Playwright script with `page.setViewportSize` and `page.screenshot`, or `npx playwright test --ui`.
- Board-facing guides prefer screenshots over prose (principle 4); capture them the same way.

## Checklist

- [ ] Right level chosen for each change
- [ ] Board edit reaches the public page (if the change touches editable data)
- [ ] Axe clean on affected pages in light and dark
- [ ] Screenshots reviewed at phone and desktop widths
- [ ] Dashboard changes: screenshot every state and screen size in the Responsive list of the [admin UX gate](../reviewing-engineering-changes/references/admin-ux-gate.md)
- [ ] `npm run check` passes

## Failure modes

- E2E tests for logic a unit test covers in milliseconds
- Tests that pass only on the day they were written
- A skipped spec counted as coverage
- Visual change shipped without anyone looking at it
