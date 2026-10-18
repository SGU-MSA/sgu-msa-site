# 0007. People, equal admins and two sensitive permissions

- Status: Accepted
- Date: 2026-10-03

## Context

Today every admin is equal and adding or removing one needs the Supabase dashboard and SQL (see the owner setup guide). There is no "forgot password", and the public board roster lives in a YAML file. Board turnover every term makes this a developer dependency, against [ADR 0002](0002-product-principles.md). Board members are peers, so a role hierarchy (owner/editor, "root" admins) does not fit.

## Decision

- **One People list** is the single source for dashboard access and the public "Our team" page. Each person has a name, role title, a required section (board-editable list; starter sections Board, Musallah team, Advisors), a required "Show on public page?" answer, an optional photo (Supabase Storage, shown only with consent; no photo means no image) and an **optional** dashboard login.
- **Every person with a login is an equal admin** for content. Two per-person permissions cover the sensitive areas: **Can manage people** (invite, deactivate, change permissions) and **Can manage money** (funds, payment links, payment records). A treasurer is a person with "manage money".
- Invites are by email; the person sets their own password. Removal is a reversible **deactivate**. Sign-in gains **forgot password**.
- Safety rules live **in the database**: nobody can remove their own access or "manage people" permission, and the last active "manage people" holder cannot lose it. Permission changes are serialized (the guard locks before re-counting), so two simultaneous removals cannot leave nobody in charge; stale screens are refused by the `updated_at` check.
- Every change is recorded in the add-only activity log ([ADR 0013](0013-activity-log-archive-and-history.md)).

## Consequences

- Sending invites needs a server-only Supabase secret key, used only by the people server actions; this changes the current "no service-role key" stance and is reviewed in the contract.
- Auth emails (invite, reset) need working email delivery and redirect URLs, configured by the owner.
- The interim SQL steps in the owner guide and the YAML board roster are removed once this ships.
- A two-connection race test proves the last-manager guard.

## Notes

- 2026-10-05: [ADR 0022](0022-daily-check-and-warning-emails.md) gives the secret key one more use: the daily check's private "already emailed" list (no personal data).
- 2026-10-05: [ADR 0025](0025-team-list-without-consent-records.md): the sections are now called groups; the Executive board and the General board always exist, the Executive board is listed by role, and photos need no recorded consent.
- 2026-10-06: [ADR 0027](0027-pages-edited-by-the-executive-board.md): Pages (page text and sections) are edited only by people in the Executive board group.
