# Architecture decision records

How and when to write one: [ADR 0001](0001-record-architecture-decisions.md). Feature-scoped decisions go in the contract's Decisions section in `docs/contracts/` instead.

| ADR                                                                 | Title                                                                                  | Status             | Date       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | ---------- |
| [0001](0001-record-architecture-decisions.md)                       | Record architecture decisions                                                          | Accepted           | 2026-10-02 |
| [0002](0002-product-principles.md)                                  | Product principles                                                                     | Accepted           | 2026-10-02 |
| [0003](0003-shared-agent-configuration.md)                          | Shared agent configuration for Claude Code and Codex                                   | Accepted           | 2026-10-02 |
| [0004](0004-lightweight-engineering-process.md)                     | Lightweight engineering process                                                        | Accepted           | 2026-10-02 |
| [0005](0005-payments-channel-policy.md)                             | Payments channel policy                                                                | Accepted           | 2026-10-02 |
| [0006](0006-self-serve-payment-funds.md)                            | Self-serve payment funds                                                               | Accepted           | 2026-10-02 |
| [0007](0007-people-and-permissions.md)                              | People, equal admins and two sensitive permissions                                     | Accepted           | 2026-10-03 |
| [0008](0008-layered-admin-onboarding.md)                            | Layered admin onboarding                                                               | Accepted           | 2026-10-02 |
| [0009](0009-free-tools-only.md)                                     | Free tools only                                                                        | Accepted           | 2026-10-02 |
| [0010](0010-production-deploys-from-main-only.md)                   | Production deploys from main only                                                      | Accepted           | 2026-10-03 |
| [0011](0011-production-analytics-explicit-setting.md)               | Production analytics are an explicit owner setting                                     | Accepted           | 2026-10-03 |
| [0012](0012-ports-adapters-and-fail-fast-configuration.md)          | Ports and adapters, one composition point, fail-fast configuration                     | Accepted           | 2026-10-03 |
| [0013](0013-activity-log-archive-and-history.md)                    | Activity log, archive instead of delete, and version history                           | Accepted           | 2026-10-03 |
| [0014](0014-no-stored-member-data-forms-as-links.md)                | No stored member data; sign-up forms as links                                          | Accepted           | 2026-10-03 |
| [0015](0015-season-editor.md)                                       | Season editor                                                                          | Accepted           | 2026-10-03 |
| [0016](0016-integration-branch-and-release-pr.md)                   | Integration branch and Release PR                                                      | Superseded by 0033 | 2026-10-03 |
| [0017](0017-fixed-prayer-calculation-mwl-standard-asr.md)           | Fixed prayer calculation: Muslim World League + Standard Asr                           | Accepted           | 2026-10-03 |
| [0018](0018-design-direction-quiet-paper.md)                        | Design direction: Quiet Paper                                                          | Accepted           | 2026-10-03 |
| [0019](0019-go2pay-products-made-by-the-board-payments-only-key.md) | Go2Pay products made by the board, linked by the site, payments-only key               | Accepted           | 2026-10-05 |
| [0020](0020-format-rules-product-rules-and-settings.md)             | Format rules, fixed product rules and changeable settings                              | Accepted           | 2026-10-05 |
| [0021](0021-seasons-follow-the-islamic-calendar.md)                 | Seasons follow the Islamic calendar; the two Eids are seasons                          | Accepted           | 2026-10-05 |
| [0022](0022-daily-check-and-warning-emails.md)                      | Daily check and warning emails                                                         | Accepted           | 2026-10-05 |
| [0023](0023-quran-verses-picked-from-alquran-cloud.md)              | Qur'an verses: the board picks from api.alquran.cloud; text saved unaltered; no typing | Superseded by 0026 | 2026-10-05 |
| [0024](0024-cache-components-cached-page-text-fresh-per-visit.md)   | Cache Components: page text cached until a board save; fresh data streamed per visit   | Accepted           | 2026-10-05 |
| [0025](0025-team-list-without-consent-records.md)                   | Team list without consent records; two permanent groups                                | Accepted           | 2026-10-05 |
| [0026](0026-fixed-quran-verse-library.md)                           | Qur'an verses: a fixed library of short whole verses; the board picks one per place    | Accepted           | 2026-10-06 |
| [0027](0027-pages-edited-by-the-executive-board.md)                 | Pages are edited by the Executive board                                                | Accepted           | 2026-10-06 |
| [0028](0028-board-how-to-in-one-handbook.md)                        | The board's how-to lives in one handbook; picture help removed                         | Accepted           | 2026-10-06 |
| [0029](0029-tracked-work-and-zero-spend.md)                         | Tracked work, $0 spending and separate documentation audiences                         | Accepted           | 2026-10-12 |
| [0030](0030-project-local-mcp-additions.md)                         | Project-local MCP additions, generated active config outside Git                       | Accepted           | 2026-10-14 |
| [0031](0031-agent-neutral-setup-and-staging-writes.md)              | Agent-neutral setup and staging writes                                                 | Accepted           | 2026-10-14 |
| [0032](0032-delegated-implementation-and-human-merge.md)            | Delegated implementation and human merge                                               | Accepted           | 2026-10-14 |
| [0033](0033-pull-requests-merge-to-main.md)                         | Pull requests merge to main                                                            | Accepted           | 2026-10-18 |
