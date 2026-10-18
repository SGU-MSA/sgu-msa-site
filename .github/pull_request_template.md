## At a glance

Replace each answer with the one that applies (delete the other options).

| Item                   | Answer                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Type**               | Feature · Fix · Design · Docs/process                                                                      |
| **Who notices**        | Visitors · Board (dashboard) · Developers only                                                             |
| **Risk**               | Low · Medium · High: one line why                                                                          |
| **Database migration** | None · Yes: file.sql, applied to staging ☐ production ☐ before merge                                       |
| **Hosted settings**    | None · list (Vercel/Supabase), done ☐                                                                      |
| **Rollback**           | Vercel Instant Rollback is enough · Needs more: explain (e.g. migration is additive, old code still works) |
| **Preview**            | Vercel posts the link; pages to check: …                                                                   |

## What changed and why

<!-- Plain language, 2-5 lines. -->

## What to look at

<!-- Numbered steps on the preview: pages, light/dark, phone/desktop. -->

1.

## Screenshots (UI changes)

<!-- Before/after, phone and desktop. Write "none" if there is no UI change. -->

## Links

Ticket · contract (`docs/contracts/...`) · ADR (`docs/adr/...`)

## Checks

- [ ] `npm run check` passes, CI is green and an independent review passed
- [ ] `docs/release-checklist.md` **Latest changes** entry added: what changed, how to test, settings, needs-confirmation items
- [ ] No secrets, keys or personal data in the diff
- [ ] A board member can manage this from the dashboard, or the gap is ticketed

## Handbook notes

<!-- Board steps for a new feature, or write "none". -->

> PRs target `main`, and merging one publishes the live site. Merge with **Create a merge commit**, never squash or rebase, after required checks and an independent review pass. Several dependent PRs go through a temporary `integration/<feature>` branch ([ADR 0010](../docs/adr/0010-production-deploys-from-main-only.md), [ADR 0033](../docs/adr/0033-pull-requests-merge-to-main.md)).
