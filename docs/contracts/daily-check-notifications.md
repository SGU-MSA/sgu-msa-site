---
status: approved
mode: full
---

# Daily check: email the board's shared inbox only when something needs attention

**Approved (2026-10-05):** every product decision is answered (P-1 = A, P-8 = A; answer sheet 2). Stage 1 (WP-1 to WP-7) is built on branch `feature/daily-check-stage1`; stage 2 (WP-8) waits for PR6. Implementation choices made while building are E-1 to E-7 under Decisions.

Workflow checklist: [x] 1 Scope · [x] 2 Inspect · [x] 3 Capability/owner · [x] 4 Duplication · [x] 5 Sources of truth · [x] 6 Reuse · [x] 7 Beyond happy path · [x] 8 Product decisions (P-1 = A and P-8 = A, user 2026-10-05, answer sheet 2) · [x] 9 Parallel work · [x] 10 Contract · [x] 11 Validate

**Revision 2.1 (2026-10-05, answer sheet 2):** P-1 = A (one shared inbox, the MSA Gmail; the user: "A survives even when members change and doesnt depend on people remembering") and P-8 = A (no website email when the database is down). No open product decisions remain. The example email no longer shows a Hijri date (HIJRI RULE: Hijri dates appear only with prayer times and on the calendar).

**Revision 2.** Applies the user's answers Q15–Q27 (`.plans/answers-2026-10-05.md`) and the PR6 switch to a "Take payments only" Go2Pay key. Read against `origin/integration` @ 44627c3. What changed since rev 1:

- **Nobody's personal inbox by default.** Rev 1 emailed "everyone with a login", which would include developers. Rev 2 sends to one shared board inbox, the MSA Gmail (P-1 A, decided 2026-10-05). The per-person off switch, the login-email lookup and the `admins` column are gone with it.
- **One repeat rule for every warning:** at most 2 emails per problem (email 1 when it starts, email 2 once as a last call), then the dashboard only (Q23).
- **No Go2Pay archiving.** With the payments-only key the site cannot close Go2Pay pages. The board closes them by hand, and this check reminds them. The Go2Pay "not synced" and "key rejected" warnings are dropped (rev 1 W3, W5).
- **Dropped:** the zakat al-Fitr last-day email (Q18; the Donate slip shows a countdown instead, PR6). The database-down email was asked as P-8, because it cannot follow the repeat rule; answer A: the website sends none.
- **Engineering choices now stated, not asked:** timings, the Gmail app password, the server permission and the email library (Q24–Q27).
- `scheduleEndStatus` (iqamah "ending soon" or "ended") already landed in PR #57, so this plan reuses it unchanged.

**In one picture.** Once a night, Vercel calls one private address on our site. The site looks for things the board must fix. If nothing is wrong, no email. If something is wrong, the MSA Gmail gets **one** short email that names each problem and links to the dashboard page that fixes it. The dashboard shows the same list until it is fixed. Picture: `.plans/mockups/notifications/recipients.png` (left) and `email-rule.png`.

**Example email** (wording approved as Q20 A; the topic tags and the last line are the rev 2 changes):

```text
From:    SGU MSA website (the MSA Gmail)
To:      the MSA Gmail
Subject: SGU MSA website: 2 things need attention

1. [Prayer] Iqamah times end on Thu 15 Oct (in 7 days). After that day
   the website stops showing iqamah times.
   Fix it: https://(site)/admin/prayer-times

2. [Seasons] Eid al-Fitr is still "expected" on Tue 9 Mar 2027.
   Confirm the day once the moon is announced.
   Fix it: https://(site)/admin/seasons

Sent to the MSA Gmail by the website's nightly check.
It only writes when something needs fixing.
```

## Capability

**Board warnings on a schedule.** One daily server job turns the site's own time-based "needs attention" conditions into at most one email a night to the MSA Gmail. One pure policy computes the conditions, and the dashboard uses the same policy, so the email and the dashboard can never disagree. Things caused by a save are not this job's concern: the save itself checks them and shows an error at once.

## Requested Behavior

Requested (user answers and computed task):

- Explain plainly why a schedule is needed rather than events (Q15), compare the free schedulers honestly, and use the simplest.
- Developers have logins and must never get these emails. Replace "everyone with a login" with a model that survives board turnover (Q16, Q17).
- One repeat rule for every warning, the database-down case included (Q23).
- Timings, Gmail app password and server permission are engineering decisions, stated in one line each (Q24–Q26).
- Compare Nodemailer + Gmail with Resend and other free options, and recommend one (Q27).
- No zakat al-Fitr reminder email (Q18).
- Unchanged from rev 1: free tools only; email only when something needs attention; no personal data stored; ports and adapters with a sample adapter that never sends; fail-fast server-only configuration; tests; exact owner steps.

Non-goals:

- Any email to donors or the public (ADR 0014). Go2Pay sends receipts.
- Amounts, donor names or any personal data in the email.
- A notification centre, push, SMS, WhatsApp, or a second scheduled job.
- Writing to any board content table, the activity log, or Go2Pay.
- Board-editable timings (fixed named constants, D-4).

Acceptance from the user: the board hears about a problem before it hurts visitors, gets no email when all is well, never gets the same warning every day, and no developer receives board warnings.

### Why a nightly check and not events (Q15)

Most warnings are about **time passing**, not about someone doing something. "Iqamah times end in 7 days" becomes true at midnight on its own; nobody saves anything. "Eid is still only expected 3 days before" is the same. No event fires when a date gets closer, so something has to look on a schedule. Things that **are** caused by a save (a wrong date, a fund closed early) are already handled instantly inside the save. Speed does not matter here: the closest deadline is a day away.

| Free option                      | What it is                                                                                 | Fits?                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel Cron (Hobby)**          | Vercel calls one address of our site once a day (within the chosen hour)                   | **Yes, recommended.** Nothing new to sign up for, same code and secrets as the site. It runs outside the database, so its reads also keep the free database awake.                                      |
| Supabase Cron (pg_cron + pg_net) | A timer inside the database, can run every minute, on all plans including free             | Works, but it sits inside the thing it should watch: if the database is paused it cannot run. It would still have to call our site or an Edge Function to send email, so the setup lives in two places. |
| Supabase database webhooks       | Calls an address when a row is inserted, updated or deleted                                | No. Time passing changes no row, so it never fires for these warnings.                                                                                                                                  |
| Upstash QStash (free tier)       | An outside service that calls an address on a schedule; 1,000 messages a day, 10 schedules | Works, but adds an account, a key and signature checks, for a once-a-day job Vercel already does.                                                                                                       |

Decision (engineering, stated): Vercel Cron, one job, once a day at 05:00 UTC (01:00–01:59 Grenada time).

### Which warnings have a real use case

| #   | Warning                                                                                              | Who is hurt if missed                                                                                       | Type           | In?                                              |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------ |
| W1  | Iqamah times end within 7 days                                                                       | After "Times end on" the public page hides iqamah times; happens every term break (edge G11)                | Has a deadline | Stage 1                                          |
| W2  | A season day (Ramadan start, Eid al-Fitr, Eid al-Adha, board seasons) still "expected" 3 days before | Fund windows and zakat al-Fitr's closing follow these days (PR6, edge C1, C6)                               | Has a deadline | Stage 2                                          |
| W4  | A fund closed on the site, but its Go2Pay page must be closed by hand                                | Old shared links keep taking money into a closed fund, for example zakat al-Fitr after Eid prayer (edge B5) | No deadline    | Stage 2, shape set by PR6 rev 7                  |
| W6  | A season fund waits for "Running again" 45 days before its season                                    | Without it the fund never opens that season (PR6 D-14)                                                      | Has a deadline | Stage 2, only if PR6 rev 7 keeps the yearly step |
| —   | Keep-awake                                                                                           | Nightly reads count as database activity, so the free project is far less likely to pause                   | —              | By-product                                       |

Removed in rev 2:

- W3 "not synced" and W5 "key rejected": with the payments-only key the board pastes each Go2Pay link, so Give buttons never depend on the key. Only the Payments totals do, and that screen already says "Payments could not be loaded".
- W7 zakat al-Fitr last day (Q18): the Donate slip shows a countdown near the end (PR6), and the board tells people in person.
- W8 database down: dropped (P-8 A, D-16). Supabase emails its account holder before and when it pauses.
- Unchanged from rev 1: Hijri adjustment left at +1, featured notice with no end date, unaccepted invites, end of term, Gmail password revoked, and a "last ran" line (the dashboard or Vercel's Cron Jobs page already covers each).

## Existing System Evidence

- `src/lib/prayer/congregation.ts`: `scheduleEndStatus(settings, today)` returns `none`, `ending_soon` (0–7 days) or `ended`; `scheduleEndReminderDays = 7`. Landed in PR #57 (D-12 amendment). W1 reuses it unchanged.
- `src/app/admin/dashboard/page.tsx`: renders "Iqamah times end on / ended on (date) — update them" from `scheduleEndStatus` and `readAdminPrayer()`. The one box this plan generalises.
- `src/app/admin/help/page.tsx`: already explains the reminder using `scheduleEndReminderDays`.
- `src/lib/community/providers/contract.ts` `ContentProvider.getPrayerSettings()`: public read through `publicClient()` (3 s timeout, `no-store`). The check needs no session.
- `src/lib/runtime/config.ts`: the only env reader, no defaults, secrets in WeakMaps (`supabaseSecretKey`, and since PR #58 `go2payApiKey`).
- `src/lib/runtime/wiring.ts` `planWiring`: `inviter: "supabase" | "sample" | "off"` is the precedent for a sender that never sends off production.
- `src/lib/backend/providers/supabase-inviter.ts` and `providers.ts`: "the only holder of the secret key". A second use needs ADR 0022.
- `src/lib/backend/providers/contract.ts` `AccountInviter`: the `{ ok: true } | { ok: false, reason }` shape this plan copies.
- `docs/guides/owner-setup.md` §10: the MSA Gmail with 2-Step Verification, SMTP `smtp.gmail.com:587`, app password `SGU MSA website`, about 500 emails a day. `SITE_URL` today is `https://sgu-msa-site.vercel.app` (no MSA-owned domain).
- `vercel.json`: only `git.deploymentEnabled`; no `crons`.
- `.plans/pr6-go2pay-payments.md` rev 6 and the 2026-10-05 answers: payments-only key, the board creates and closes Go2Pay products by hand (rev 7 pending); P-50 asked this plan to decide the closer.
- `git grep` on `origin/integration` for `cron`, `nodemailer`, `smtp`, `sendMail`, `attention`, `mailer`, `CRON_SECRET`: no match in `src/`.
- Vercel docs (cron usage and pricing, updated 2026-07-15, fetched for rev 2): Hobby 100 jobs per project, **once per day**, precision ±59 min; a more frequent expression fails the deploy. From rev 1: GET to the production URL, `Authorization: Bearer (CRON_SECRET)`, no retry, a run can be missed or doubled.
- Supabase docs: pg_cron "can make an HTTP request, such as invoking a Supabase Edge Function"; available on the free plan (secondary sources, not a Supabase page). Database webhooks fire only on `INSERT`, `UPDATE`, `DELETE`. Free plan pauses after a quiet week; Supabase emails the project owner about a week before pausing and again when paused (secondary sources). Edge Functions free: 500,000 invocations a month.
- Upstash QStash pricing: free tier 1,000 messages a day, 10 active schedules.
- Resend pricing and docs: free 3,000 emails a month, 100 a day, 30-day retention; "You must add and verify at least one domain to send emails with Resend."
- Vercel Blob (for P-8 B only): free on Hobby within 1 GB and 2,000 write operations a month.
- Nodemailer (rev 1 check): MIT-0 licence, no dependencies, Node 20+. Vercel allows outbound 465 and 587.

## Owner

- **Warning rules:** a new pure module `src/lib/community/attention.ts`. It owns "what needs attention, which email step is due". It consumes facts from their owners (`congregation.ts` for iqamah; PR6 `season-policy.ts` and the payment policy in stage 2) and re-implements none.
- **Iqamah end status:** `src/lib/prayer/congregation.ts`, unchanged.
- **Sending email:** a new port `WarningMailer` in `src/lib/backend/providers/contract.ts` beside `AccountInviter`.
- **"Already emailed" memory:** a new port `WarningLedger`, adapter beside the inviter; the secret key is handed out only by `src/lib/runtime/providers.ts`.
- **Entry point:** `src/app/api/daily-check/route.ts`. It composes; it owns no rule.

## Source of Truth

- Iqamah end date: `prayer_settings.valid_until`, read through `ContentProvider.getPrayerSettings()`.
- Season days and fund windows: PR6 tables resolved by PR6 policies (stage 2).
- Warning list, type and due step: `attentionItems()` and `emailsDue()` in `attention.ts`. The dashboard and the email both call `attentionItems`.
- Recipient: the MSA Gmail address in env (`MSA_GMAIL_ADDRESS`), used as both sender and recipient (P-1 A). No email address in the database.
- "Already emailed": `public.warning_emails_sent`, primary key `(warning_key, step)`, with the date sent.
- Timings: named constants in `attention.ts`; iqamah reuses `scheduleEndReminderDays`.
- Secrets: env, parsed only in `config.ts`.

## Reuse and Duplication Analysis

Reused unchanged: `scheduleEndStatus`, `scheduleEndReminderDays`, `publicClient()`, `ContentProvider.getPrayerSettings()`, `localDate`, `clock()`, the dashboard box styles (`content-card activity-highlight`), the `ConfigurationError` messages, the WeakMap secret pattern, the sample adapter and `demo/store.ts` pattern, the `supabase-inviter.ts` client options.

Extended: the dashboard page (one "Needs attention" box), `config.ts`, `wiring.ts`, `providers.ts`, `vercel.json`, `backend/providers/contract.ts`.

Duplication avoided:

- The 7-day iqamah rule stays in `congregation.ts`; `attention.ts` maps its `ending_soon` and `ended` states.
- The dashboard renders `attentionItems`; it computes no list of its own.
- No second public Supabase client. The only new client is inside the ledger adapter (secret key, inviter pattern).
- One scheduled route: PR6's `/api/payments/close-ended` (WP-12) is not built.

## New Abstractions

1. **`attentionItems` / `emailsDue` (pure policy, `attention.ts`).** Responsibility: list what needs attention today, each with a stable key, a type (`deadline` or `open`), wording and a dashboard link; and decide which email step is due. Two real consumers (dashboard, route). Pattern: Policy.
2. **`WarningMailer` (port).** Send one plain-text email to the MSA Gmail. Adapters: `gmail` (Nodemailer SMTP, Vercel Production only), `sample` (records in `demo/store.ts`), `off` (everywhere else, even with real Gmail values on a developer computer). Pattern: Adapter at a real external boundary.
3. **`WarningLedger` (port).** Read and add "already emailed" rows. Adapters: `supabase` (secret key, server-only), `sample`. Pattern: Adapter.

No service layer, queue, scheduler library or Context.

## Product Decisions Required

- [x] **P-1. Who gets the warning emails?** (replaces rev 1 P-1, P-2, P-3; picture `.plans/mockups/notifications/recipients.png`)
      Options: A. One shared board inbox, the MSA Gmail. Whoever holds it can forward one topic to one person with a Gmail filter (for example, everything tagged `[Prayer]` to the prayer lead), or give board members shared access to the inbox. The website stores no email address. B. A "Warning emails" screen on the dashboard where the board ticks which person gets which topic (Prayer, Seasons, Go2Pay).
      Recommendation: A. It survives board turnover with no setup (the Gmail is handed over each year), developers are never included, and it needs no new screen, table or permission to read login emails. With B, a new board must re-tick names, and an unticked topic reaches nobody.
      Decision: D-15
- [x] **P-8. When the website's database is down, does the website email anyone?** (replaces rev 1 P-8 / Q19 A; picture `email-rule.png`, bottom)
      Options: A. No website email for this. The nightly check's reads keep the free database from pausing (the usual cause). If it still pauses, Supabase itself emails its account holder a week before and when it happens, and only that person can switch it back on. B. Email the MSA Gmail with the same 2-email rule. The website's memory of "already emailed" lives in that database, so this needs a second free store (Vercel Blob) only for this case, and one more owner setup step.
      Recommendation: A. The one rule then holds for every warning, nothing extra is set up, and the board could only pass the email on anyway.
      Decision: D-16

## Decisions

Recorded from the user (do not re-ask):

- D-1: Free tools only; Vercel Hobby; email through the MSA Gmail (ADR 0009; user, 2026-10-04).
- D-2: Email only when something needs attention; no email on a quiet night (2026-10-04).
- D-3: The iqamah dashboard warning stays after the end date until updated (2026-10-04; built in PR #57).
- D-4: Lead times are named constants, not dashboard settings (2026-10-04).
- D-5: No donor or member personal data stored; no email to donors (ADR 0014).
- D-6: Go2Pay is the only payment channel named anywhere (ADR 0005).
- D-7: The check writes nothing to board content, the activity log or Go2Pay (ADR 0013).
- D-8 (superseded, 2026-10-05): PR6 now uses a "Take payments only" key; the board creates and closes Go2Pay products by hand. Rev 1's nightly archiving is dropped; PR6 P-50 is answered "no archiving job" and PR6 WP-12 is not built.
- D-9: A nightly check (Q15, 2026-10-05), on Vercel Cron for the reasons in "Why a nightly check and not events".
- D-10: Developers never receive board warnings (Q16, 2026-10-05).
- D-11: No zakat al-Fitr last-day email; the Donate slip shows a countdown instead, PR6 (Q18, 2026-10-05).
- D-12: Wording approved (Q20 A); one email lists every warning (Q21 A); the site remembers what it emailed, catches up a missed night, and never repeats a step (Q22 A).
- D-13: One repeat rule for every warning (Q23, 2026-10-05): **email 1** when the problem starts; **email 2** once, as a last call, if it is still not fixed; then the dashboard only, until fixed. A deadline warning's last call is 1 day before the deadline. A warning with no deadline gets its last call 3 nights after email 1.
- D-14: Nodemailer + Gmail SMTP for sending (Q27; the user had no objection; reasons below). Counts as the AGENTS.md approval of the new package.
- D-15: **Warning emails go to one shared inbox, the MSA Gmail** (P-1 A; user, 2026-10-05, answer sheet 2 Q6: "B looks simpler to setup, but A survives even when members change and doesnt depend on people remembering. i think A is better right?" — yes). The website stores no email address; whoever holds the Gmail forwards topics with Gmail filters or shares access (rejected: B, a "Warning emails" screen with per-topic names).
- D-17: **The live site may launch with warning emails off** (the user, 2026-10-06), so it is not blocked until the club Gmail is recovered. On Vercel Production `MSA_GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` may **both** be `off` (one `off` and one set is still refused; a missing value still stops the deploy). Then the build log prints a warning (not an error) naming both variables and saying warning emails are off (`configurationWarnings` in `config.ts`, printed by `next.config.ts`); the dashboard's **Needs attention** box shows "Warning emails are off: set up the MSA Gmail" until they are set (`DeploymentProfile.warningEmailsOff`); the nightly check still runs (`CRON_SECRET` stays required) with the `off` mailer, so it shows problems on the dashboard and sends nothing. `SUPABASE_SECRET_KEY` stays required.
- D-16: **No website email when the database is down** (P-8 A; user, 2026-10-05, answer sheet 2 Q7 by "all recommended"). The nightly reads keep the free database awake; if it still pauses, Supabase emails its account holder, who is the only person able to restore it. No Vercel Blob store (rejected: B, email the MSA Gmail through a second store).
- D-18 (review fixes P1, approved plan of 2026-10-07): the dashboard's "Needs attention" box becomes the **notifications bell** in every dashboard page's header, with the same list from `attentionItems` (and the D-17 line), worked out on every load; these lines are problems and cannot be closed. Amends D-3, D-17 and WP-6 where they name the box.

Implementation choices (stage 1, engineering, 2026-10-05):

- E-1: `CRON_SECRET` is required in every mode, sample data included (`off` refuses every call with 401); the two Gmail variables are ignored with sample data, as the Public Contract says. Both Gmail variables are `off` together or set together.
- E-2: the ledger wiring gains `off` (an empty list that records nothing) for a developer's computer with `SUPABASE_SECRET_KEY=off`, where the mailer is `off` too; production is still `supabase` only.
- E-3: the steps of one run live in `runDailyCheck` (`src/lib/backend/daily-check.ts`) with `cronAuthorized` (SHA-256 then `timingSafeEqual`), so they are unit-tested without a server; the route only reads the secret, composes and answers. A mailer answering `off` ends the run with 200 and `emailed: 0`, nothing recorded. `emailed` counts the warnings listed in that night's email.
- E-4: `AttentionItem` also carries `linkLabel` (the dashboard link's words, "Open Prayer & iqamah"). The dashboard shows each item's `title`, so its iqamah line now uses the email wording ("… (in 7 days)", "(tomorrow)", "(today)"; after the end "… — update them") instead of "Iqamah times end on 15 Oct — update them"; flagged for confirmation in the release checklist. `attentionFacts(prayer, today)` builds the stage 1 facts for both callers.
- E-5: the sample adapters are `sample-mailer.ts` and `sample-ledger.ts`; `off-ledger.ts` is added for E-2. Nodemailer 10 ships its own types, so `@types/nodemailer` is not added.
- E-6: the sandbox e2e for the dashboard box is in `tests/e2e/demo.spec.ts` (the sandbox suite); `tests/e2e/editor.spec.ts` needs a real test account.
- E-7: the help card is **Website warning emails** (`warnings`), with one picture of the box; `scripts/help-pictures.mjs` sets `CRON_SECRET=off` for its own sandbox.

Engineering decisions (stated, not asked; Q24–Q26):

- **Timings (Q24):** iqamah email 1 at 7 days before the end (the existing dashboard rule), last call 1 day before. A season day still "expected": email 1 at 3 days before, last call 1 day before (the moon is announced the evening before, so earlier is noise). "Running again": email 1 at 45 days (PR6 D-14), last call 1 day before. No-deadline problems: the night found, then 3 nights later. The job runs 01:00–01:59 Grenada time.
- **Gmail app password (Q25):** a second app password on the MSA Gmail named `SGU MSA daily check`, so revoking one never breaks invite emails. It is free, and the owner makes it in two minutes (steps below).
- **Server permission (Q26):** the server's secret key may also read and add rows in one private "already emailed" list (warning names and dates only, no personal data). With the shared inbox it no longer reads anyone's login email or an off switch, so the rest of Q26 disappears. Recorded in ADR 0022.
- **Email library (Q27):**

| Option                                      | Free limit                                          | Needs                                                                                           | Verdict                                                                                                                                                                      |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nodemailer + MSA Gmail SMTP**             | about 500 emails a day; we send at most 1 a night   | The MSA Gmail (already set up for invites) and an app password                                  | **Chosen.** No new account, no domain, the same Gmail the board already holds. Nodemailer is free (MIT-0), has no other packages, and is the standard way to send from Node. |
| Resend                                      | 3,000 a month, 100 a day                            | A **domain the MSA owns**, verified with DNS records; you cannot verify gmail.com or vercel.app | Not free for us: the site has no domain of its own, so we would have to buy one. Fine later if the MSA gets a domain.                                                        |
| Supabase                                    | Its email only sends login emails (invites, resets) | —                                                                                               | Cannot send our warnings. An Edge Function could, but it would still need an email service.                                                                                  |
| Other services (Brevo, Mailjet and similar) | Free tiers exist                                    | A new account, an API key, sender verification                                                  | No gain over Gmail for one email a night, and one more account to hand over.                                                                                                 |

- Amendment (engineering, review fixes PR-C, 2026-10-05; [architecture section 8](../architecture.md#8-caching-and-streaming-review-fixes-pr-c)): `/api/daily-check` no longer exports `dynamic = "force-dynamic"` (Cache Components forbid it); it reads the request's `Authorization` header, so it is still answered per request.

- Amendment (user-approved final plan `.plans/final-plan.md` A4 and A6, 2026-10-06): **stage 2 (WP-8) is built, plus a photo-space warning.** The rules are unchanged: email only when something needs fixing, one combined email a night, at most 2 emails per problem (D-13), nothing on a normal night. What stage 2 adds, as built:
  - **One read for both callers.** `readAttention()` (`src/lib/backend/attention-reads.ts`) reads the prayer settings, the current seasons, the funds and tickets visitors can see with their links (`PaymentsProvider`), and the photo space (`ContentProvider.getStorageUse`, `community_storage_bytes()`); all public reads, so the nightly check needs no session and the dashboard lists exactly what the email does. `attentionFacts(reads, today)` builds the facts with the owners' rules (`resolveSeason`, `seasonContext`, `zakatAlFitrLastDay`, `paymentItemWindow`, `paymentItemFlags`, `storageLevel`); `runDailyCheck({ read, … })` replaces `readPrayer`. If **any** read fails, the night sends nothing (500 `facts`) and the next night catches up; the dashboard still lists what it could read. The `"not_built"` placeholders are gone.
  - **W2, a season day still "expected"** (Islamic seasons; typed seasons never are): from `SEASON_CONFIRM_FIRST_DAYS` = 3 days before until the day; a one-day season (an Eid) is one problem, a longer one its first and its last day each (key `season:(id):first|last|day:(Hijri year)`). Title "Eid al-Fitr is still “expected” on Tue 9 Mar 2027" / "Ramadan’s first day is still “expected” on …", detail "Confirm the day once the moon is announced.", link to that season (`/admin/seasons/(id)`, "Open" and the season name). Topic `[Seasons]`.
  - **W4, an ended fund or ticket to close in Go2Pay:** exactly while the board's list shows "Ended on … · close it in Go2Pay" (`paymentItemFlags` `ended`: shown, ended within `ENDED_REMINDER_DAYS` = 7). Open timing (the night found, last call 3 nights later). Key `close-in-go2pay:(id):(end day)` (the end day added, so running again next year is a new problem). Tickets included (same flag). Topic `[Go2Pay]`, link to the fund or ticket.
  - **W6, waiting for "Running again":** the `waiting_rerun` flag with its 45-day reminder (`SEASON_RERUN_REMINDER_DAYS`); deadline = the season's first day, last call the day before. Key `rerun:(id):(Hijri year)`. Topic `[Seasons]`.
  - Only shown ("listed"), current funds and tickets count (the ones visitors can read), so the dashboard and the email agree.
  - **New W9, photo space** (final plan A6): from 80% full of the free 1 GB, one open item for the highest level reached ("Photo space is 82% full (820 MB of 1 GB)", key `storage:80`, then `storage:95` as a new problem at 95%), link to Photos. Topic `[Photos]` (new tag, so a Gmail filter can forward it).
  - New wording (titles, details, link words, the `[Photos]` tag) is listed in the release checklist for confirmation; the approved email layout (Q20 A) is unchanged.

## Board Self-Sufficiency Check

- **Fixing what an email reports:** every line links to the dashboard page that fixes it. No developer.
- **Who reads the warnings (P-1 A):** handled entirely in Gmail by whoever holds the MSA Gmail: forwarding filters by topic tag, or shared access. Board turnover = handing over the Gmail (owner guide §13, already a step). A help card shows how.
- **Timings and wording:** fixed constants and code text (D-4, D-13). Changing them is a developer change, already listed on `docs/roadmap.md` as an accepted gap.
- **Turning the whole check off:** owner only (Vercel → Settings → Cron Jobs → Disable). Deliberate: warnings should not be silenced by accident.

## Design

```text
Vercel Cron (once a day, 05:00–05:59 UTC = 01:00–01:59 Grenada)
  GET /api/daily-check   Authorization: Bearer CRON_SECRET
        │  wrong or missing → 401, nothing runs
        ▼
  route.ts (composes only; maxDuration 60 s)
   ├─ 1. facts    getPrayerSettings()  ·  (stage 2) seasons, closed funds from PR6 public reads
   ├─ 2. policy   attentionItems(facts, today)                 (same call as the dashboard)
   ├─ 3. ledger   alreadySent(keys) → { key → { first?, last_call? } }
   ├─ 4. policy   emailsDue(items, sent, today) → nothing due? stop, { emailed: 0 }
   ├─ 5. mailer   send(warningEmail(due, siteUrl))             (awaited; To = From = MSA Gmail)
   └─ 6. ledger   record(due, today)  only after a successful send
  response: counts only { warnings, emailed } — no wording, ids or addresses
```

- **Item types.** `deadline` items carry the deadline date; `open` items have none.
- **Which step is due** (`emailsDue`, per item, D-13):
  - `deadline`: `last_call` is due from 1 day before the deadline; `first` is due from the item's lead time. Send `last_call` if due and not sent (skipping a missed `first`); else `first` if not sent; else nothing.
  - `open`: `first` if not sent; `last_call` if `first` was sent 3 or more days ago and `last_call` was not; else nothing.
- **After the deadline:** no more email; the dashboard keeps the item (iqamah "ended", D-3).
- **Keys change when the board fixes something:** `iqamah:2026-10-15` (a new end date is a new key), `season:(id):(side):1448`, `close-in-go2pay:(item id)`, `rerun:(item id):1448`. A fixed problem stops appearing; a new one starts fresh.
- **Topic tags** in each line (`[Prayer]`, `[Seasons]`, `[Go2Pay]`) let Gmail filters forward by topic (P-1 A).
- **Email:** plain text, From "SGU MSA website" (the MSA Gmail), To the same address, no Bcc, no tracking, no HTML.
- **The dashboard** shows one "Needs attention" box from `attentionItems`, replacing the iqamah-only box. It never reads the ledger.

## Public Contract

```ts
// src/lib/community/attention.ts (pure; no env, clock or Supabase)
export const SEASON_CONFIRM_FIRST_DAYS = 3,
  LAST_CALL_DAYS_BEFORE = 1,
  OPEN_LAST_CALL_AFTER_DAYS = 3;
// iqamah lead time reuses scheduleEndReminderDays; "running again" reuses PR6 SEASON_RERUN_REMINDER_DAYS
export type EmailStep = "first" | "last_call";
export type AttentionTopic = "Prayer" | "Seasons" | "Go2Pay";
export type AttentionItem = Readonly<{
  key: string;
  topic: AttentionTopic;
  timing:
    | { type: "deadline"; deadline: string; firstFrom: string }
    | { type: "open" };
  title: string; // "Iqamah times end on Thu 15 Oct (in 7 days)" or "Iqamah times ended on Thu 15 Oct — update them"
  detail: string; // one sentence of consequence
  href: string; // "/admin/prayer-times"
}>;
export type AttentionFacts = Readonly<{
  prayer: ScheduleEndStatus | "unavailable";
  seasons: readonly ExpectedSeasonDay[] | "unavailable" | "not_built"; // stage 2, PR6 shape
  closedFunds: readonly ClosedFundFact[] | "unavailable" | "not_built"; // stage 2, PR6 rev 7 shape
  reruns: readonly RerunFact[] | "unavailable" | "not_built"; // stage 2, only if PR6 keeps it
}>;
export function attentionItems(
  facts: AttentionFacts,
  today: string,
): AttentionItem[];
export type SentSteps = ReadonlyMap<string, Partial<Record<EmailStep, string>>>; // key → step → date sent
export function emailsDue(
  items: readonly AttentionItem[],
  sent: SentSteps,
  today: string,
): { item: AttentionItem; step: EmailStep }[];
export function warningEmail(
  due: readonly { item: AttentionItem; step: EmailStep }[],
  siteUrl: string,
): { subject: string; text: string };

// src/lib/backend/providers/contract.ts (new ports)
export interface WarningMailer {
  send(email: {
    subject: string;
    text: string;
  }): Promise<
    | { ok: true; delivery: "email" | "sandbox" }
    | { ok: false; reason: "rejected" | "unavailable" | "off" }
  >;
}
export interface WarningLedger {
  alreadySent(
    keys: readonly string[],
  ): Promise<{ sent: SentSteps } | { unavailable: true }>;
  record(
    rows: readonly { key: string; step: EmailStep }[],
    on: string,
  ): Promise<{ ok: boolean }>;
}

// src/lib/runtime/config.ts (secrets in WeakMaps; no defaults)
//   dailyCheck: "on" | "off"   CRON_SECRET: 32+ chars [A-Za-z0-9_-]; required in production; "off" only off production
//   warningMail: { address: string } | "off"
//     MSA_GMAIL_ADDRESS (…@gmail.com) and GMAIL_APP_PASSWORD (16 letters, spaces ignored):
//     required everywhere with live data; both "off" together (production too, with a build warning, D-17); ignored with sample data
export function cronSecret(config: RuntimeConfig): string; // lint: only route.ts may import
export function gmailAppPassword(config: RuntimeConfig): string; // lint: only providers.ts may import

// src/lib/runtime/wiring.ts
//   mailer: "gmail" | "sample" | "off"   production: "gmail", or "off" while both Gmail variables are "off" (D-17); never "gmail" off production
//   ledger: "supabase" | "sample"        production: "supabase" only

// src/lib/runtime/providers.ts
export const warningMailer: () => WarningMailer;
export const warningLedger: () => WarningLedger;
```

Route `src/app/api/daily-check/route.ts`: `export async function GET(request)`, `dynamic = "force-dynamic"`, `maxDuration = 60`. Responses: 401 `Unauthorized`; 200 `{ warnings, emailed }`; 500 the same plus `{ failed: "mail" | "ledger" | "facts" }`.

`vercel.json` adds `"crons": [{ "path": "/api/daily-check", "schedule": "0 5 * * *" }]`.

Migration `supabase/migrations/202610080001_daily_check.sql`:

```sql
-- What the nightly check already emailed (D-12, D-13). No personal data.
-- RLS on, no policies: only the server's secret key reads or writes (ADR 0022).
create table public.warning_emails_sent (
  warning_key text not null check (length(warning_key) between 1 and 200),
  step text not null check (step in ('first', 'last_call')),
  emailed_on date not null,
  primary key (warning_key, step)
);
alter table public.warning_emails_sent enable row level security;
revoke all on public.warning_emails_sent from anon, authenticated;
```

Dashboard: `src/app/admin/dashboard/page.tsx` renders `attentionItems` as one "Needs attention" box (title line plus link per item), replacing the iqamah-only box with identical wording for iqamah.

## Private Implementation

The implementer decides: helper names inside `attention.ts`, the email body layout within the approved wording, the Nodemailer transport options (`smtp.gmail.com`, port 587, `requireTLS: true`, 10 s timeouts as named constants), sample-store field names, test fixtures, and whether the ledger prunes rows older than a year (only if trivial).

## Data and State Flow

- **Reads:** prayer settings (anon, 3 s, `no-store`); stage 2 PR6 public reads; the ledger (secret key, server-only).
- **Writes:** `warning_emails_sent` inserts after a successful send (`on conflict do nothing`). Nothing else.
- **Clock:** `clock().now()` and `localDate` (Grenada); the seed clock in the sandbox.
- **Caching and revalidation:** none; the route is dynamic, and the dashboard already is.

## Failure Modes

| Situation                                                                   | Expected behaviour                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request without the right `Authorization` header                            | 401, nothing read or sent. Constant-time comparison.                                                                                                                                                                               |
| `CRON_SECRET` or Gmail values missing in production                         | The build fails with one configuration message naming them; the live site stays on the previous version.                                                                                                                           |
| Vercel skips a night                                                        | The next night sends the highest due step not yet sent (catch-up).                                                                                                                                                                 |
| Vercel runs twice the same night                                            | The second run sees the first run's rows; if both run in the same second, one duplicate email is possible, never a lost one. Accepted as rare.                                                                                     |
| Supabase unreachable                                                        | Facts or ledger unavailable → no email, 500 `{ failed: "facts" }` or `"ledger"`, visible in Vercel → Cron Jobs → logs. The website emails nobody about it (P-8 A, D-16); Supabase emails its account holder if the project pauses. |
| Gmail rejects the login or times out                                        | Nothing recorded, so tomorrow retries. 500 `{ failed: "mail" }`. The dashboard still shows everything.                                                                                                                             |
| Email sent, recording fails                                                 | That step is sent once more the next night (never a gap).                                                                                                                                                                          |
| Gmail daily limit (about 500)                                               | Not reachable: at most one email a night.                                                                                                                                                                                          |
| Gmail does not apply a forwarding filter to mail the account sent to itself | The email is still in the MSA inbox. The owner test (step 6) checks it; the fallback is shared access to the inbox (help card).                                                                                                    |
| Sandbox or developer computer                                               | Sample mailer records the email in the sandbox store; `off` never sends. Vercel never calls a local server.                                                                                                                        |
| Vercel rollback                                                             | That deployment's cron list applies. Harmless.                                                                                                                                                                                     |

## Compatibility and Migration

- **Migration `202610080001_daily_check.sql`:** additive (one new empty table). Applied by a human: local, staging, then production, before the release containing WP-4.
- **Rollback:** disable the cron in Vercel; `drop table public.warning_emails_sent;` ships in the WP-2 PR.
- **Env:** `CRON_SECRET`, `MSA_GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` must exist in Vercel Production before the release that requires them, or that deploy fails safely.
- **ADR 0022** "Daily check and warning emails": Vercel Cron, Gmail SMTP to the shared inbox, and the secret key's one extra use. It supersedes ADR 0007's "only uses" clause. Renumber if PR6's ADRs land later.
- **PR6 amendments** (for the PR6 rev 7 owner): P-50 answered "no archiving job" (D-8); WP-12 and `CRON_SECRET` move here; rev 7 supplies the `ClosedFundFact` shape (and whether a "closed in Go2Pay" tick exists) and `RerunFact` if "running again" stays.
- **Hobby:** one job, once a day, within the limits.

## Parallel Work and Merge Order

```yaml
WP-1: { creates: [], extends: [src/lib/runtime/config.ts, src/lib/runtime/wiring.ts, eslint.config.mjs, .env.example, package.json (nodemailer), tests/runtime.test.ts], depends_on: [] }
WP-2: { creates: [supabase/migrations/202610080001_daily_check.sql, tests/daily-check-migration.test.ts], extends: [scripts/test-backend.ts], depends_on: [] }
WP-3: { creates: [src/lib/community/attention.ts, tests/attention.test.ts], extends: [], depends_on: [] }
WP-4: { creates: [src/lib/backend/providers/{gmail-mailer,sample-mailer,off-mailer,supabase-ledger,sample-ledger}.ts, tests/warning-mail.test.ts], extends: [src/lib/backend/providers/contract.ts, src/lib/demo/store.ts, src/lib/runtime/providers.ts], depends_on: [WP-1, WP-2] }
WP-5: { creates: [src/app/api/daily-check/route.ts, tests/daily-check.test.ts], extends: [vercel.json], depends_on: [WP-3, WP-4] }
WP-6: { extends: [src/app/admin/dashboard/page.tsx, tests/e2e/editor.spec.ts], depends_on: [WP-3] }
WP-7: { creates: [docs/adr/0022-daily-check-and-warning-emails.md], extends: [docs/adr/README.md, docs/guides/owner-setup.md, src/app/admin/help/page.tsx, docs/architecture.md, docs/roadmap.md, docs/release-checklist.md], depends_on: [WP-5, WP-6] }
WP-8: { extends: [src/app/api/daily-check/route.ts, src/lib/community/attention.ts, tests/{attention,daily-check}.test.ts, docs/release-checklist.md], depends_on: [PR6 rev 7 policies merged, WP-5], replaces: "PR6 WP-12" }
integration_owner: planner
```

- **Stage 1 (before PR6):** WP-1 to WP-7: iqamah warnings (W1) and the keep-awake effect.
- **Stage 2 (after PR6 rev 7's policies):** WP-8 adds W2, W4 and W6.
- **Parallel:** WP-2, WP-3 and WP-6 can run alongside WP-1. WP-4 owns the new ports in `contract.ts`.
- Only the integration owner runs `npm run check` and `npm run build`.

## Work Packages

### WP-1: Configuration and the Nodemailer dependency

- Purpose: three server-only variables, fail fast, adapter choice.
- Depends on: nothing (P-1 A, D-15).
- Expected files: `config.ts`, `wiring.ts`, `eslint.config.mjs`, `.env.example`, `package.json`, `package-lock.json`, `tests/runtime.test.ts`.
- Reuse: the `missing`/`invalid` helpers, the WeakMap pattern, the `inviter` wiring precedent.
- Required changes:
  - `CRON_SECRET` as in Public Contract; never echoed.
  - `MSA_GMAIL_ADDRESS` (ends `@gmail.com`) and `GMAIL_APP_PASSWORD` (16 letters after removing spaces).
  - Lint: only `route.ts` imports `cronSecret`; only `providers.ts` imports `gmailAppPassword`.
  - `planWiring` throws if production would get `off` or `sample`, and never returns `gmail` off production.
  - Add `nodemailer` (MIT-0) and `@types/nodemailer` (dev).
- Must not: give a default, add a `NEXT_PUBLIC_` variable, read `process.env` outside `config.ts`, allow `off` in production.
- Tests: missing, invalid and `off`-in-production for each variable; messages never contain values; real-looking Gmail values off production still wire `off`.
- Done when: `npm test` passes and a production config without them fails with one message listing all three.

### WP-2: Migration

- Purpose: the "already emailed" list.
- Depends on: nothing.
- Expected files: the migration, `tests/daily-check-migration.test.ts`, `scripts/test-backend.ts`.
- Reuse: the PGlite setup in `tests/prayer-migration.test.ts`.
- Required changes: exactly the SQL in Public Contract, with a header comment naming this plan.
- Must not: add policies for `anon` or `authenticated`, store any address, or touch production.
- Tests: PGlite applies it after PR4's; RLS: anon and authenticated cannot select or insert; the primary key refuses a duplicate step.
- Done when: `npm run test:db` and `npm run test:backend` pass, and the owner applied it to staging.

### WP-3: Warning policy (pure)

- Purpose: one rule for the dashboard and the email.
- Depends on: nothing (P-1 A, D-15: the topic tags let Gmail filters forward by topic).
- Expected files: `src/lib/community/attention.ts`, `tests/attention.test.ts`.
- Reuse: `scheduleEndStatus`, `scheduleEndReminderDays`; a day-label formatter from `src/lib` (move the dashboard's `shortDateLabel` to `src/lib` only if it lives in `src/features`).
- Required changes:
  - W1 from `ScheduleEndStatus`: `ending_soon` → deadline item; `ended` → dashboard item with the "ended" title and no email step due (deadline passed).
  - Stage 2 facts accept `"not_built"` and give nothing.
  - `emailsDue` and `warningEmail` as in Design; singular and plural subject.
- Must not: read env, clock or Supabase; import from `src/app` or `src/features`; include amounts, names or addresses.
- Tests:
  - Iqamah 8 days → no item; 7 → `first`; 1 → `last_call`; 0 → `last_call` if not sent; ended → dashboard item, no step.
  - Missed `first` with `last_call` due → only `last_call`.
  - Open item: `first`, then nothing for 2 nights, then `last_call` on night 4, then nothing.
  - A new key starts fresh.
  - Email text snapshot for one and two items.
- Done when: `npm test` passes with full branch coverage of `attention.ts`.

### WP-4: Mailer and ledger adapters

- Purpose: send through Gmail in production only.
- Depends on: WP-1, WP-2.
- Expected files: `contract.ts`, `gmail-mailer.ts`, `sample-mailer.ts`, `off-mailer.ts`, `supabase-ledger.ts`, `sample-ledger.ts`, `demo/store.ts`, `providers.ts`, `tests/warning-mail.test.ts`.
- Reuse: `supabase-inviter.ts` client options; `demo/store.ts`.
- Required changes:
  - `gmail-mailer.ts` (server-only): Nodemailer to `smtp.gmail.com:587`, STARTTLS required, 10 s timeouts; From "SGU MSA website" (address), To the same address. An auth failure maps to `rejected`, anything else to `unavailable`; never log the password.
  - `sample-mailer.ts` records into `store.sentWarnings`; `off-mailer.ts` returns `off`.
  - `supabase-ledger.ts` (server-only, secret key) reads and inserts `warning_emails_sent` only.
  - Update the "only holder of the secret key" comments to name ADR 0022.
- Must not: create a second public client, import adapters outside `providers.ts`, send from any adapter but `gmail`, or touch any other table with the secret key.
- Tests: gmail adapter with Nodemailer's `jsonTransport` (headers, To, error mapping); sample records; off never connects; ledger SQL in `test:backend`.
- Done when: tests pass and `grep` shows the secret key handed out only in `providers.ts`.

### WP-5: The nightly route and the cron entry

- Purpose: one secured endpoint.
- Depends on: WP-3, WP-4 (P-8 A, D-16: no database-down email, no Blob store).
- Expected files: `route.ts`, `vercel.json`, `tests/daily-check.test.ts`.
- Reuse: `contentProvider()`, `clock()`, `warningMailer()`, `warningLedger()`, `runtimeConfig().siteUrl`.
- Required changes: constant-time `Authorization` check (401 otherwise or when `off`); steps 1–6 of Design; counts only; `vercel.json` `crons` with `0 5 * * *`, `git` block unchanged.
- Must not: accept the secret in a query string, redirect, return wording or ids, write to board tables, or send more than one email per run.
- Tests (sample wiring, fixed clock):
  - Wrong or missing header → 401, nothing sent.
  - Iqamah 7 days away → one email; second run the same day → none; next day → none; 1 day before → one; after the end → none.
  - Mailer fails → 500, nothing recorded; next run sends.
  - Prayer read unavailable → 500 `facts`, no email (P-8 A).
- Done when: tests pass and `npm run build` shows the route as dynamic.

### WP-6: Dashboard "Needs attention" box

- Purpose: the board sees the same list as the email until fixed (D-3).
- Depends on: WP-3.
- Expected files: `src/app/admin/dashboard/page.tsx`, `tests/e2e/editor.spec.ts`, help pictures if the box changes visibly.
- Reuse: the existing box markup and styles.
- Required changes: render `attentionItems` (title and link each); iqamah wording identical to today's.
- Must not: read the ledger; add a style token.
- Tests: e2e in the sandbox (box on the seed date; gone after moving the end date 10 days later; "ended" line with a past date); axe in light and dark.
- Done when: the e2e passes and a screenshot is in the PR.

### WP-7: ADR, owner guide, help card, release checklist

- Purpose: record and teach.
- Depends on: WP-5, WP-6.
- Expected files: as in the YAML above.
- Required changes:
  - ADR 0022.
  - Owner guide: the setup steps below; troubleshooting rows "No warning emails" and "Cron job shows 401 or 500".
  - Help card "Website warning emails": what triggers them, the 2-email rule, how to forward one topic with a Gmail filter or share inbox access, and that the dashboard box is the full list.
  - Release checklist entry, flagging unconfirmed items: the Vercel "Run" button location, Gmail filters on self-sent mail, spam-folder behaviour.
- Must not: put secret values in any document, or name any payment channel other than Go2Pay.
- Tests: `tests/documentation.test.ts`.
- Done when: the docs and link checks pass.

**Owner setup steps (WP-7 copies these into the owner guide):**

1. **Make the cron secret.** In a terminal run `openssl rand -hex 32` (or a password manager's generator, 40 letters and digits). Copy it.
2. **Make the Gmail app password.** Sign in to the MSA Gmail → myaccount.google.com/apppasswords → App name `SGU MSA daily check` → **Create** → copy the 16 letters → **Done**. (2-Step Verification is already on from §10.)
3. **Add three variables in Vercel.** Vercel → the SGUMSA team → the `sgu-msa-site` project that deploys from GitHub → **Settings** → **Environment Variables** → **Add New**, tick **Production** only, **Sensitive** on if offered, **Save**: `CRON_SECRET` (step 1), `MSA_GMAIL_ADDRESS` (the MSA Gmail address), `GMAIL_APP_PASSWORD` (step 2).
4. **Deploy.** Add them before the Release PR merge that needs them, or that deploy fails safely with a message naming the missing variable.
5. **Check the job.** Vercel → project → **Settings** → **Cron Jobs**: one line `/api/daily-check`, `0 5 * * *`. If it offers **Run**, click it, then **View Logs**: status 200.
6. **Check an email arrives.** On the live dashboard set Prayer & iqamah → **Times end on** to 6 days from today and save. Run the job (step 5). The MSA Gmail gets "SGU MSA website: 1 thing needs attention" (check Spam the first time; mark "Not spam"). If the board wants per-topic forwarding, add the Gmail filter now and run the job again the next day to confirm it forwards. Put **Times end on** back.
7. **To stop everything:** Vercel → **Settings** → **Cron Jobs** → **Disable Cron Jobs**.

### WP-8: Stage 2, after PR6 rev 7: seasons and Go2Pay to-dos (replaces PR6 WP-12)

- Purpose: add W2, W4 and W6.
- Depends on: PR6 rev 7's season and fund policies merged; WP-5.
- Expected files: `route.ts`, `attention.ts`, `tests/attention.test.ts`, `tests/daily-check.test.ts`, `docs/release-checklist.md`.
- Reuse: PR6 `resolveSeason`, the fund window policy, `SEASON_RERUN_REMINDER_DAYS`.
- Required changes: read the facts through PR6's public providers; map them to items (W2 deadline, W4 open, W6 deadline only if PR6 keeps "running again").
- Must not: write to any payment or season table, call Go2Pay, duplicate a window or season rule, or build `/api/payments/close-ended`.
- Tests: Eid expected in 3 days → `first`; 1 day → `last_call`; confirmed → nothing. A fund closed tonight → W4 `first`, then `last_call` 3 nights later if still listed.
- Done when: tests pass and the PR6 contract marks WP-12 replaced.

## Implementation Constraints

- No second scheduled job, queue, scheduler library or paid email service.
- No email address, name or amount in any table, log or response.
- Email is sent only by the `gmail` adapter, only in Vercel Production, and only to the MSA Gmail.
- The secret key's only new use is reading and inserting `warning_emails_sent`.
- Do not copy the iqamah, season or fund-window rules; call their owners.
- No defaults or `NEXT_PUBLIC_` on new variables; `process.env` only in `config.ts`.
- Never accept the cron secret from a query string or log it.
- Never write to board content tables, the activity log or Go2Pay.
- Never name a payment channel other than Go2Pay.

## Worker Escalation Conditions

Stop and emit `PLAN MISMATCH` when:

- `scheduleEndStatus` no longer has the `none | ending_soon | ended` shape;
- PR6 rev 7's season or closed-fund facts are missing or shaped differently (stage 2);
- Vercel refuses the cron expression on Hobby;
- Gmail refuses SMTP from Vercel with a correct app password;
- the user changes P-8 to B later (a Blob store is not in this contract);
- an answered decision needs a table, policy or variable not listed here.

## Test Strategy

- **Unit (`npm test`):** `attention.test.ts` (every item type, both steps, catch-up), `runtime.test.ts` (the three variables), `warning-mail.test.ts` (adapters), `daily-check.test.ts` (route, sample wiring, fixed clock).
- **Database:** `npm run test:db`, `npm run test:backend` (RLS on the sent list).
- **End-to-end:** the dashboard box in the sandbox, axe in light and dark.
- **Gate:** `npm run check` and `npm run build` by the integration owner.
- **Manual (release checklist):** owner steps 5 and 6; a Gmail filter forwards a self-sent warning; no email on a quiet night.

## Acceptance Criteria

- On a night with nothing wrong, no email is sent.
- With "Times end on" 7 days away, the MSA Gmail gets one email that night; none the following nights; one last call the day before; none after; the dashboard box stays until the date is moved.
- No developer or other personal inbox receives a warning unless the Gmail holder chose to forward it.
- A visitor opening `/api/daily-check` gets "Unauthorized" and nothing is sent.
- In the sandbox and on a developer's computer, no real email is ever sent.
- After stage 2, an Eid day still "expected" is emailed 3 days and 1 day before, and a closed fund's "close it in Go2Pay" to-do is emailed at most twice.
- A production deploy without the three variables fails with one message naming them.

## Open Risks or Escalations

- No open product decisions: P-1 = A and P-8 = A (2026-10-05). The plan is ready for an approved contract.
- Whether Gmail applies forwarding filters to mail the account sent to itself is unconfirmed; owner step 6 checks it, and shared inbox access is the fallback.
- Gmail may put the first email in Spam; step 6 covers it.
- The Vercel "Run" button's location is unconfirmed; WP-7 confirms it with a screenshot.
- Supabase does not publish how much activity prevents pausing; nightly reads are expected to be enough. pg_cron on the free plan and Supabase's pause emails are confirmed only by secondary sources (affects the comparison and P-8 A, not the build).
- Stage 2 waits for PR6 rev 7 (payments-only key, hand-made products).
- ADR number 0022 depends on PR6's ADRs 0019–0021 landing first.
