# 0033. Pull requests merge to main

- Status: Accepted
- Date: 2026-10-18
- Supersedes: [ADR 0016](0016-integration-branch-and-release-pr.md)

## Context

[ADR 0016](0016-integration-branch-and-release-pr.md) sent every PR to a long-lived `integration` branch and published through one standing Release PR, because only commits merged by the Vercel account owner were built and many tracks were landing at once. The site now deploys from the public organization repository, which any maintainer with write access can merge into (Release PR #1 was merged by a developer account and Vercel built it). The launch backlog has landed. A second long-lived branch now only adds a step and drifts from `main`.

## Decision

- **Pull requests branch from `main` and target `main`.** Merging one publishes it: the Vercel project still deploys only `main` ([ADR 0010](0010-production-deploys-from-main-only.md)). Merge with **Create a merge commit**.
- Before merging: required CI checks pass, an independent review passes, the maintainer reviews and merges ([ADR 0032](0032-delegated-implementation-and-human-merge.md)), and anything the PR needs on hosted services (migration, setting) is ready first.
- **Temporary integration branches only for several dependent PRs** that must go live together: name it `integration/<feature>`, branch it from `main`, merge the parts into it, and merge it into `main` in one reviewed PR. Delete it afterwards. CI runs on PRs into `main` and `integration/**`.
- The standing `integration` branch is retired.
- Every PR adds its entry to **Latest changes** in `docs/release-checklist.md`.
- Decided by the maintainer (2026-10-17: "we don't need integration … integration is only for big features or multiple features that depend on each other").

## Consequences

- One fewer step per change; what is on `main` is what is live.
- A bad merge goes live immediately; Vercel Instant Rollback restores the previous deployment while a fix PR is prepared. Required checks, independent review and the cross-device layout gate are the safeguard.
- Hosted changes a PR depends on (staging, then production migrations) are applied before merge, not before a later release.
