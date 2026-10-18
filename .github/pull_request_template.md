## At a glance

Tick your answers with `[x]` and fill in the lines that apply.

### Type

Pick one.

- [ ] Feature
- [ ] Fix
- [ ] Design
- [ ] Docs or process

### Who notices

Pick one or more.

- [ ] Visitors
- [ ] Board (dashboard)
- [ ] Developers only

### Risk

Pick one. Medium or High: say why.

- [ ] Low
- [ ] Medium
- [ ] High

Why:

### Database migration

Pick one. Yes: name the file and tick where it is applied.

- [ ] None
- [ ] Yes

File:

- [ ] Applied to staging
- [ ] Applied to production (before merge)

### Hosted settings

Pick one. Before or after merge: say what (Vercel or Supabase). Before merge: tick Done once it is set. After merge items go in the release checklist entry.

- [ ] None
- [ ] Before merge
- [ ] After merge

What:

- [ ] Done (before merge only)

### Rollback

Pick one. Needs more: say how (for example the migration is additive, so old code still works).

- [ ] Vercel Instant Rollback is enough
- [ ] Needs more

How:

### Preview

Pick one. Vercel posts the preview link on the PR.

- [ ] No visible change
- [ ] Check these pages

Pages:

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
