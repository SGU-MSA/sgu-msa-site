# 0010. Production deploys from main only

- Status: Accepted
- Date: 2026-10-03

## Context

The site is hosted on a free Vercel (Hobby) account that a board member created for the mosque. Adding developers to it would need a paid plan, and Hobby refuses to deploy a commit unless its Git author is the account owner. Pull request previews built from developer commits therefore fail.

## Decision

- Vercel deploys only `main`, to production (`vercel.json`: `git.deploymentEnabled` is `{"**": false, "main": true}`). No pull request or branch previews.
- Developers test locally: the site against the **staging** Supabase project via `.env.local`, or `npm run demo` for sample data.
- Merging a pull request publishes it. Merge with GitHub's **Create a merge commit**, signed in as the Vercel account owner. Squash and rebase commits are credited to the PR author, who has no Vercel access, so Vercel refuses them.
- Board content edits in `/admin` never need a deploy (ADR 0002).

## Consequences

- No hosted review link; reviewers rely on local runs, screenshots and CI (`npm run check`).
- A mistake reaches the live site on merge. Recovery is Vercel **Instant Rollback** (Hobby: previous deployment only), then **Undo Rollback** once the fix is merged.
- Vercel holds production environment variables only; staging credentials stay in developers' `.env.local`.
- Revisit with a new ADR if the board moves to a paid Vercel plan.

See the [owner setup guide](../guides/owner-setup.md#5-how-publishing-works).
