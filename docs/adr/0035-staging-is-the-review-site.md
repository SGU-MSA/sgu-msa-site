# 0035. Staging is the review site

- Status: Accepted
- Date: 2026-11-10
- Partially supersedes: [ADR 0013](0013-activity-log-archive-and-history.md), only its add-only rule for the activity log on the staging project, during a staging reset

## Context

The board and the university need a fixed place to see the whole site and dashboard with realistic, harmless content, while production holds only real data. [ADR 0034](0034-pull-request-previews-on-staging.md) already points previews at the staging Supabase project.

## Decision

- **Three environments.** The local sandbox (`npm run demo`, in memory). Staging, the **review site**: fake content built from the one fixture set in `src/lib/demo/fixtures.ts` plus the starter page text, disposable, reset by a developer with `npm run staging:reset`. Production: real data only.
- **Fixed link.** The long-lived `review` Git branch is kept equal to `main` by a GitHub workflow; Vercel builds it as a Preview on the staging variables ([ADR 0034](0034-pull-request-previews-on-staging.md)), so it is `noindex`.
- **Three review logins** (plus-addresses of a base address kept out of Git): President (manage people and money), Treasurer (manage money), Board member (neither), made with the Auth Admin API, never by invite email.
- **Who the logins are.** The Board member login is the fixture Secretary, an Executive board member with neither permission; all three logins can edit Pages ([ADR 0027](0027-pages-edited-by-the-executive-board.md)); there is no General board login (D-9, E-4).
- **Where secrets live.** The staging secret key, database URL, passwords and optional deploy hook live only in one ignored local file that agents never read or print (D-7).
- **No Go2Pay key on staging.** Funds, tickets and sizes link only to Go2Pay **test payment requests** the developer makes (Go2Pay cannot create test products; D-11); the fixtures' own product numbers are never written, so no visitor is sent to a stranger's product ([ADR 0005](0005-payments-channel-policy.md)).
- **What a reset does.** It refuses any target but the staging project, then in one transaction empties `events`, `announcements`, `news_posts`, `newsletters`, `list_options`, `people_sections`, `people`, `admins`, `seasons`, `merch_collections`, `merch_items`, `payment_items`, `payment_item_links`, `handover_steps`, `shared_logins`, `prayer_settings`, `musallah_location`, `page_texts` and `activity_log`, re-seeds all but the log, and empties the `community` storage bucket. It keeps `quran_verses`, `warning_emails_sent`, every other login, the schema and every Supabase setting.
- **Activity log exception.** Inside the reset transaction only, the add-only guard and the `activity` triggers are switched off so Recent changes starts empty and the seed rows are not logged; they are switched back on before commit.
- Decided by the maintainer 2026-10-26 and 2026-11-10.

## Consequences

- Anyone with the review link sees fake content and may open the staging sign-in page; the logins' passwords are shared privately.
- Developer logins on staging lose dashboard access at a reset (their `admins` rows are emptied); they sign in with a review login.
- Resetting is a developer action; the board asks for one before a presentation. Each reset starts a new review build when a deploy hook is set (free plan, [ADR 0029](0029-tracked-work-and-zero-spend.md)).
