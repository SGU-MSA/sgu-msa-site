## Summary

<!-- What changed and why, in plain language. -->

## Links

- Contract: `docs/contracts/...`
- ADRs: `docs/adr/...`

## Checklist

- [ ] `npm run check` passes
- [ ] `docs/release-checklist.md` **Unreleased** updated: what changed, how to test, settings, needs-confirmation items
- [ ] Tested locally (no preview deployments): staging via `.env.local`, or `npm run demo`
- [ ] New migrations were applied to **staging** first (never production first)
- [ ] Architecture diagrams and ADRs updated if a flow or decision changed
- [ ] Board self-sufficiency: a board member can change this without a developer, or the gap is on the roadmap
- [ ] No secrets, keys or personal data in the diff
- [ ] Screenshots attached for UI changes (mobile and desktop)

> Feature PRs target `integration`. Only the Release PR `integration → main` goes live, and it must be merged while signed in to the club GitHub account (linked to the club Vercel account) with **Create a merge commit**, never squash or rebase ([ADR 0010](../docs/adr/0010-production-deploys-from-main-only.md), [ADR 0016](../docs/adr/0016-integration-branch-and-release-pr.md)).
