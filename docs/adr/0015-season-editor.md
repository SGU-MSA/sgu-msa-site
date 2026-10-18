# 0015. Season editor

- Status: Accepted
- Date: 2026-10-03

## Context

Ramadan is the busiest time of the year, yet its page is hardcoded YAML: an `active` switch, a demo flag and each night's times live in `content/ramadan.yaml`, so every change needs a developer. Eid notices exist only as ordinary announcements. This breaks board self-sufficiency ([ADR 0002](0002-product-principles.md)), and a Ramadan-only screen would need another one for the next seasonal programme.

## Decision

- The dashboard gets a general **Season editor**. A season has a **name**, **show from / show until** dates that turn its public page on and off automatically, an **intro**, a **schedule table**, an optional **fund** and **tagged events**.
- Ramadan is the first season. The YAML switch, demo flag and hardcoded schedule are retired once it ships.
- **Eid is not a season.** It is announced with an **Urgent** announcement (every page under the nav, exact expiry time, one at a time).
- Seasons follow [ADR 0013](0013-activity-log-archive-and-history.md): changes are logged, archive replaces delete, and previous versions can be restored. The fund link follows [ADR 0006](0006-self-serve-payment-funds.md) (Go2Pay only, [ADR 0005](0005-payments-channel-policy.md)).
- Setting a season's fund requires **Can manage money** ([ADR 0007](0007-people-and-permissions.md)).
- Exact fields, schedule columns and screens are decided in the feature contract.
- Decided by the user (D0 follow-up, 2026-10-03); rejected: a Ramadan-only screen; events and announcements only (no season page).

## Consequences

- The season data model replaces `content/ramadan.yaml`; the Ramadan page reads the active season instead.
- The fund field is usable only after the payments work ([ADR 0006](0006-self-serve-payment-funds.md)); until then it stays empty or hidden.
- Tagged events reuse existing events, so a season never duplicates event data.
- Whether nightly iftar times come from calculated Maghrib or the schedule table is a contract question.
