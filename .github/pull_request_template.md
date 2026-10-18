## Summary

<!-- What changed and why, in plain language. -->

## Links

- Contract: `docs/contracts/...`
- ADRs: `docs/adr/...`

## Checklist

- [ ] `npm run check` passes
- [ ] `docs/release-checklist.md` **Latest changes** entry added: what changed, how to test, settings, needs-confirmation items
- [ ] Tested: the Vercel preview link on this PR (staging data), or locally with staging via `.env.local` or `npm run demo`
- [ ] New migrations were applied to **staging** first (never production first)
- [ ] Architecture diagrams and ADRs updated if a flow or decision changed
- [ ] Board self-sufficiency: a board member can change this without a developer, or the gap is on the roadmap
- [ ] No secrets, keys or personal data in the diff
- [ ] Screenshots attached for UI changes (mobile and desktop)

> PRs target `main`, and merging one publishes the live site. Merge with **Create a merge commit**, never squash or rebase, after required checks and an independent review pass. Several dependent PRs go through a temporary `integration/<feature>` branch ([ADR 0010](../docs/adr/0010-production-deploys-from-main-only.md), [ADR 0033](../docs/adr/0033-pull-requests-merge-to-main.md)).
