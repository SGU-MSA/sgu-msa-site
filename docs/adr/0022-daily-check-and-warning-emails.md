# 0022. Daily check and warning emails

- Status: Accepted
- Date: 2026-10-05

## Context

Some problems the board must fix appear only because time passes: the iqamah times stop showing after "Times end on", and later (roadmap PR6) season days and funds have dates. Nobody saves anything when a date comes closer, so no save or database event can warn the board; something must look on a schedule. The board changes every year, developers have dashboard logins too, and the project uses free tools only ([ADR 0009](0009-free-tools-only.md)). Full reasoning and the options compared: [daily-check contract](../contracts/daily-check-notifications.md).

## Decision

- **One nightly check on Vercel Cron** (Hobby: once a day): Vercel calls `/api/daily-check` at 05:00 UTC (01:00–01:59 Grenada) with `Authorization: Bearer CRON_SECRET`. Any other call gets 401. Rejected: Supabase Cron (it sits inside the database it should watch), database webhooks (time passing changes no row) and Upstash QStash (one more account for a job Vercel already does).
- **One pure policy** (`src/lib/community/attention.ts`) lists what needs attention. The dashboard's "Needs attention" box and the email both use it, so they never disagree.
- **Email only when something needs attention, at most two per problem**: email 1 when it starts, one last call, then the dashboard only until it is fixed (D-13).
- **One shared inbox**: the email goes from the MSA Gmail to the MSA Gmail through Nodemailer and Gmail SMTP, with a second app password named `SGU MSA daily check` (D-14, D-15). The website stores no email address; developers never receive warnings unless the Gmail holder forwards them. Rejected: Resend (needs a domain the MSA owns), a per-person recipients screen (breaks at board turnover).
- **Real email only from Vercel Production.** The sandbox records the email instead; every other deployment and developer computer never sends, even with real Gmail values.
- **The Supabase secret key gets one more use**: reading and adding rows in `warning_emails_sent` (warning names and dates, no personal data; RLS on, no policies). This supersedes the "used only by the people server actions" clause of [ADR 0007](0007-people-and-permissions.md); the rest of ADR 0007 stands. The key is still handed out only by `src/lib/runtime/providers.ts`.
- **No website email when the database is down** (D-16): the nightly reads keep the free database awake, and Supabase emails its account holder if it pauses.

## Consequences

- Three new required production settings, with no defaults: `CRON_SECRET`, `MSA_GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`. A production deploy without them fails and the live site stays on the previous version.
- The owner can stop every warning in Vercel → Settings → Cron Jobs. Timings and wording are code constants (an accepted gap in board self-sufficiency, listed on the roadmap).
- Stage 2 (after roadmap PR6) adds season and Go2Pay to-dos to the same policy, route and email; no second scheduled job.
