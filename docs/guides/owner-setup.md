# Owner setup: accounts, hosting, admins and backups

This guide is for an **authorized site owner** who manages the SGU-MSA GitHub organization, Vercel project and Supabase projects. Use an individual account for each service; never share a login. Developers use their own GitHub identities, and board members receive separate website accounts.

Board members use the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx) for invitations, passwords and dashboard tasks. This guide covers service ownership, the one-time first-admin setup, hosting and backups.

This guide describes the intended setup, not an assertion that hosted services are configured. Dashboard labels can change; official references are linked beside the relevant steps. If a screen differs, stop and confirm the service/project name instead of guessing. No step below launches payments.

## 1. Before you start

Have these ready:

- Access to your own GitHub account and the SGU-MSA organization (§4), your email, and your phone/authenticator app.
- The owner of the existing Vercel project, if that is someone else.
- A decision on who approves any hosting costs.
- The exact Musallah entrance pin, the approved board editors' emails, and someone who can confirm prayer settings.
- The MSA's Gmail account and the phone for its 2-Step Verification (for invite and reset emails, §10).

Setup creates a club-owned database and recovery and backup ownership. It does not set up payments or ask for bank details. Never send anyone your passwords or recovery codes.

Allow 60–90 minutes; email delivery, ownership questions and billing approval can take longer. Design review is separate and needs no accounts.

## 2. Understand the four different things

| Service | What it does | Who normally uses it |
| --- | --- | --- |
| GitHub private-history repository `SGU-MSA/sgu-msa-site-private-history` | Keeps the old Git history, issues, pull requests and project tracking private | Maintainers and developers with access |
| GitHub public repository `SGU-MSA/sgu-msa-site` | Holds the reviewed website source for release | Maintainers and developers; anyone may read the public code |
| Vercel project `sgu-msa-site` | Runs the public website from the `main` branch | Site owner manages settings; visitors use the website |
| Supabase organization, staging and production projects | Stores website content, files and board sign-ins | Organization members only: owners and invited developers (§6) |
| Website `/admin` | Lets board members manage approved site content | Invited board members; no GitHub/Vercel/Supabase dashboard account needed |

For the publication, rename the old repository to `sgu-msa-site-private-history` so its issue numbers, pull requests and Project remain private. Create a new clean public repository at the original name `sgu-msa-site`. Copy only the reviewed current tree into it; never copy old commits, pull-request refs or raw archive files. GitHub issues remain the execution tracker in the private-history repository; code pull requests belong in the public repository. The roadmap summarizes work but does not replace tickets.

An **account** is one person’s login. An **organization** groups club repositories and invited people. A **project** is one website or database inside a service. An **environment variable** is a named setting the running website reads. A **migration** installs database tables and security rules. **Production** is the live website; **staging** is the rehearsal database developers use to test the same flows before release.

**Verified service state** (2026-10-17):

- Vercel Hobby project `sgu-msa-site` uses `main` as its production branch. Before launch, its Git settings must show the new public repository `SGU-MSA/sgu-msa-site`; do not release until this is verified (§5).
- The GitHub organization is `SGU-MSA`. Do not use a shared organization-owner login for routine work. Use an individually attributable account and the minimum required organization role.
- Supabase projects: **staging** `qglftmxfjvxmrzppkxks`, **production** `thhpkztmjoiaiuscdmdh`. Project refs are identifiers, not keys or passwords.
- The four follow-up production migrations have already been applied. Do not replay them (§8).
- The President must be added as the first production dashboard admin after the public site is available. The exact information needed and board steps are in §10 and the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx).

This guide records the intended operator steps. Confirm live dashboard values before acting; do not treat these notes as proof that a service setting is currently correct.

## 3. Agree ownership before clicking Create

1. Write down the accountable club representative and a backup representative. Confirm both consent to service ownership. A founder’s personal email is not automatically a permanent club identity; use individually attributable accounts with an agreed succession process.
2. Confirm an authorized maintainer can access the SGU-MSA organization and its private-history and public-code repositories. In Vercel, confirm the existing Hobby project is the intended project. Do not create a replacement project to get around access issues.
3. Agree who receives billing/security emails and approves charges. Do not enter your own card as a temporary shortcut. Read the selected plan’s current limits and renewal terms before approval.
4. Choose an organization-controlled password manager or existing approved credential vault. Record service URLs, owner/backup names, recovery method, billing contact and renewal dates there. Do not put secrets in GitHub, chat, shared screenshots, or this guide.
5. Enter passwords and MFA yourself. Pause screen sharing while scanning authenticator QR codes, displaying keys, or saving recovery material.

**Checkpoint:** two accountable people and a billing decision are recorded privately. No single person, including the developer, is the only one able to recover the website.

## 4. Use GitHub without shared accounts

The repositories belong to the **SGU-MSA organization**. Each maintainer and developer uses their own GitHub account. Do not create or share a club member login, and do not put personal access tokens or passwords in Git, chat or this guide.

- Routine development uses the public source repository `SGU-MSA/sgu-msa-site`; code branches and pull requests are reviewed there.
- The private repository `SGU-MSA/sgu-msa-site-private-history` retains the historical issue tracker, pull requests and organization Project. Use it for execution tickets and roadmap tracking.
- Invite developers to the appropriate repository with the minimum role needed. Board members who only edit the live website need no GitHub account.
- Reserve organization-owner access for organization administration. Use a maintainer account with repository access for ordinary issue and code work.
- Enable two-factor authentication on each person's GitHub account and store recovery codes privately. Never share recovery material.

A repository can be public while the historical repository and its tracker stay private. The public repository contains the current reviewed code and the applicable license; it does not include old Git history or the private issue backlog.

## 5. How publishing works

After it is reconnected for the clean publication, the existing Vercel Hobby project `sgu-msa-site` publishes the public repository's `main` branch. Pull requests and the `integration` branch do not publish production ([ADR 0010](../adr/0010-production-deploys-from-main-only.md), [ADR 0016](../adr/0016-integration-branch-and-release-pr.md)). The clean public repository must be connected before the release pull request is merged.

1. **Developers test on their own computers**, against Supabase staging or sample data, before asking for review.
2. **Feature pull requests target `integration`** in `SGU-MSA/sgu-msa-site`. After checks and independent review, the maintainer merges them. They do not publish the live site.
3. Before the first release, open Vercel → project `sgu-msa-site` → **Settings → Git**. Verify the connected repository is exactly `SGU-MSA/sgu-msa-site` and the production branch is `main`. If either is wrong, stop and have a Vercel project owner correct it; do not connect the private-history repository.
4. Check **Settings → Environment Variables** and confirm required production values exist without copying them into tickets or chat. Keep the plan on Hobby and do not enable paid add-ons or overages.
5. Review the Release PR `integration → main` in the public repository. Merge only after staging acceptance, independent review, all required checks, and the owner’s release confirmation. Use **Create a merge commit** for this release as required by [ADR 0016](../adr/0016-integration-branch-and-release-pr.md). A successful merge to `main` should start the Vercel production deployment.
6. In Vercel → **Deployments**, confirm the latest production deployment says **Ready**. Open the Vercel-provided domain and verify the public pages. If the deployment is Error or Blocked, the previous deployment remains live; ask the developer to investigate.
7. To undo a bad release, use Vercel **Instant Rollback** to select the previous deployment. Follow the dashboard's current prompts, then re-enable the intended latest deployment after the fix is reviewed and released.

Do not buy a domain or change plans for the initial showcase. Use the existing Vercel-provided address until the board decides otherwise. Board edits in `/admin` never need a code deployment.

**Checkpoint:** Vercel shows the public repository with production branch `main`, and a reviewed release reaches **Ready** on the existing Hobby plan.

References: [Instant Rollback](https://vercel.com/docs/instant-rollback), [Hobby collaboration limits](https://vercel.com/docs/deployments/troubleshoot-project-collaboration), [Vercel MFA](https://vercel.com/docs/two-factor-authentication).

## 6. Create the Supabase organization; invite the developer

1. Open the [Supabase dashboard](https://supabase.com/dashboard). If already registered, sign in. Otherwise select **Sign up**, use your own approved email, choose a unique password if using email authentication, and complete the email verification.
2. In account settings open **Multi-factor authentication** and register an authenticator (TOTP). Scan the QR code privately and enter its current code. Supabase does **not** supply account recovery codes: register a backup authenticator factor or securely retain the setup secret using the organization’s recovery process. Verify recovery access before relying on a single phone. See [Supabase MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication).
3. From the organization selector choose **New organization**. Suggested name: **SGU MSA**. Keep this separate from personal client projects. Select the plan only after the owner reads costs/limits. No paid upgrade is required merely to review frontend designs.
4. Open the new organization’s **Settings → Team/Members**. Invite the backup representative as **Owner**. They accept through their own account; verify they can open the organization. This provides succession without sharing your password.
5. Invite each developer with the **Developer** role ([New developer checklist](#new-developer-checklist)). They create their own Supabase login when accepting, enable MFA, and open the **SGU MSA** organization. Making a developer an Owner is unnecessary unless the club deliberately delegates ownership.
6. If an invitation expires, the owner sends a new one. Ensure you accept using the exact account identity invited, not a different sign-in method accidentally creating a second identity.

References: [Supabase account roles and ownership](https://supabase.com/docs/guides/platform/access-control). These infrastructure roles do not add complex roles to the website: every website editor has equal content permissions, plus two dashboard permissions ("manage people", "manage money") given in **People**.

### Database access rules

- **Database access is Supabase organization membership.** Only the club owners and invited developers are members. Board members never need it: they use the dashboard.
- **Changing the database's structure** (tables, rules): only through a reviewed pull request that adds a **new migration file** after the four baseline files (§8 lists them; they are never edited). It is applied to **staging first**, checked, then to **production by a person**, never automatically.
- **Changing content** (events, people, prayer times, pages): always through the dashboard, never with SQL.
- **SQL on production is for emergencies only**, such as the lock-out steps in §10. Write each use in `docs/release-checklist.md` (date, who, what and why). Changes made with SQL show in the dashboard's History and Recent changes as "Site owner".

### New developer checklist

1. **GitHub:** the authorized SGU-MSA organization maintainer adds the developer's own GitHub account as a collaborator with **Write** (§4).
2. **Supabase:** an Owner invites them to the club organization with the **Developer** role (step 5). They work on **staging only**; production changes are a person's step, done with the owner's OK. This is a rule, not a lock: the Developer role can also open production.
3. **Vercel:** no access. Releases go live only through the Release PR (§5).
4. **Dashboard:** developers never get a login on the live dashboard; the live site is for the board. They try the dashboard in the local sandbox (`npm run demo`) or on staging, where the site owner can give them a staging-only login with `owner_add_admin` (§10).
5. **Read first:** [AGENTS.md](../../AGENTS.md), then the [developer guide](developer.md).

## 7. Create an isolated staging database

1. In the **SGU MSA** organization click **New project**. Confirm the organization selector before proceeding.
2. Enter **sgu-msa-staging** as the name. This is the rehearsal database, not real production content.
3. Generate a strong database password and save it in the approved vault. It is not a board-member password and is not needed in the website’s Vercel environment variables.
4. Select a nearby supported region based on the club’s audience and hosting location; review availability rather than assuming a specific region label. Record the chosen region. Review any cost before creating.
5. Click **Create project** and wait until the project is ready. Record its dashboard URL and project reference in the private operations record.
6. Later, before launch, repeat with **sgu-msa-production**. Approve the plan/backup capability separately. Never point a developer's local copy at production credentials: edits there would change real content.

No Supabase GitHub integration or MCP is required. The application connects through project settings below. An optional MCP is not a substitute for ownership and must not receive broad production authority just to build designs.

## 8. Install the database

Do this on **staging first**. You can do it yourself or let the developer do it with their Administrator access.

1. Open the project and double-check its name is **sgu-msa-staging**.
2. Open **SQL Editor → New query**.
3. The database is four files in `supabase/migrations/`, run **in this order**: `202610150001_schema.sql`, `202610150002_starter_data.sql`, `202610150003_quran_verses.sql`, `202610150004_recent_changes.sql`. In this repository on `main`, open the first one and use the file’s **Raw/Copy** control to copy its full contents, not a screenshot or the GitHub page’s HTML.
4. Paste into the SQL editor. Review the beginning/end to confirm the entire file was copied. Run it once. Then do the same with the next file, until all four ran. If the editor reports an error, stop, retain the message without keys and ask the developer; do not repeatedly run unrelated SQL. Do not run `seed.sql` or automated test fixtures on hosted projects.
   - **A project that already has an older database** (staging built before the clean files, or a rebuild): wipe it first, exactly as the [release checklist](../release-checklist.md) says under Settings, "Supabase: wipe and install the clean database" (empty and delete the `community` bucket in **Storage**, run the wipe query, then the four files and the check query). The bucket can only be deleted from Supabase's **Storage** screen: SQL that deletes it is refused.
5. Add the first admin: [First admin, or everyone locked out](#first-admin-or-everyone-locked-out) (`owner_add_admin`).
6. Open **Table Editor**, select the `public` schema and verify `admins`, `events`, `announcements`, `news_posts`, `newsletters`, `prayer_settings`, `people`, `people_sections`, `activity_log`, `page_texts`, `quran_verses` and `seasons`. Verify Row Level Security is enabled. The SQL installs the policies; do not make all rows public to troubleshoot.
7. Open **Storage**. Confirm the `community` bucket is **private**, maximum upload size **3 MB**, accepted stored types **WebP/PDF**. The website converts accepted JPEG/PNG photos before storage. Do not create a second public bucket.
8. Open **Authentication → Sign In / Providers** (or its current configuration equivalent). Disable **Allow new users to sign up** and anonymous sign-ins; leave only the email/password method needed here. Save. Keep rate limiting enabled.
9. The email, link and password settings for board logins are in [§10](#10-board-logins-email-password-rules-and-the-first-admin). Do not invent a domain for the Site URL there.

**Checkpoint:** schema and private storage exist, public registration is disabled. Do not insert unconfirmed prayer times or turn historical prototype events into live events.

## 9. Connect the live site to the production database

Vercel holds **production settings only**. Staging credentials live only in each developer's private, Git-ignored `.env.local` (one per worktree).

Do this once **sgu-msa-production** exists and §8 has been run on it. The live site needs every setting in [Required variables](#required-variables) below, including the Supabase ones: if one is missing, a deploy stops with a message naming it and the previous version stays live.

1. In Supabase open the **production** project → **Connect** (or **Settings → API Keys**). Copy the **Project URL** and **publishable key** (`sb_publishable_…`). A secret key (`sb_secret_…`) goes **only** in `SUPABASE_SECRET_KEY` (see [§10](#the-invite-key-supabase_secret_key)), never in any other setting or place. Never use the legacy `service_role` key, the database password or an access token.
2. In Vercel open the project → **Settings → Environment Variables**. Add **SUPABASE_URL** and **SUPABASE_PUBLISHABLE_KEY** with those values, environment **Production**. Both must come from the same project.
3. Add the other settings from [Required variables](#required-variables): **SUPABASE_SECRET_KEY** (made in [§10](#the-invite-key-supabase_secret_key)), **SITE_DEMO_MODE** `false`, **SITE_URL** (the approved site address; if it is not decided, record that as a launch blocker), **GO2PAY_API_KEY** `off` until launch (see [The payments key](#the-payments-key-go2pay_api_key)), **CRON_SECRET**, **MSA_GMAIL_ADDRESS** and **GMAIL_APP_PASSWORD** (see [The daily check](#the-daily-check-warning-emails-to-the-msa-gmail)). The musallah location is not a setting: it is a pin in the database (§11).
4. Redeploy: **Deployments** → newest production entry → **⋮** → **Redeploy**. Setting changes need this; board content edits never do.
5. Open the live site. Public pages render (empty sections are fine) and `/admin` shows a sign-in form. If not, check spelling, the Production scope and that the redeploy finished. Never paste key values into an issue.

**Visitor statistics.** You decide whether the live site counts visits. Add **ENABLE_VERCEL_MEASUREMENTS** (Production) set to `true` (on) or `false` (off); this variable is required, and there is no default ([ADR 0011](../adr/0011-production-analytics-explicit-setting.md)). A missing value stops the deploy with a message naming it. If you chose `true`, open the project's **Analytics** tab and click **Enable**, then do the same on **Speed Insights**, and redeploy. Admin pages, demo mode and a developer's computer are never measured.

### Required variables

Every setting below must be present: there are no defaults ([ADR 0012](../adr/0012-ports-adapters-and-fail-fast-configuration.md)). For the live site, add them in Vercel → project → **Settings → Environment Variables**, environment **Production**, then redeploy (step 4). Developers put the "your computer" values in their private `.env.local` (template: `.env.example`). Type values exactly as shown, in lower case, without quotes.

| Name | What it controls | Allowed values | Example | Live site (Vercel, Production) | Your computer (`.env.local`) |
| --- | --- | --- | --- | --- | --- |
| `SITE_DEMO_MODE` | Real data or sample data | `false` or `true` | `false` | Required, must be `false` | Required; `false` for the staging database. `npm run demo` sets `true` by itself |
| `SITE_DEMO_DATE` | The date sample data is built around | A date-time such as `2026-09-11T12:00:00Z` | `2026-09-11T12:00:00Z` | Never set | Only with sample data; `npm run demo` sets it. Otherwise leave it out |
| `SUPABASE_URL` | Which database the site reads | The Supabase **Project URL** | `https://abcd1234.supabase.co` | Required (production project) | Required with real data (staging project) |
| `SUPABASE_PUBLISHABLE_KEY` | Public key for that database | The **publishable** key, never a secret key | `sb_publishable_…` | Required, same project as the URL | Required with real data |
| `SUPABASE_SECRET_KEY` | Sending invite emails to new board members, and deleting the login account of a person a board member permanently deletes (nothing else) | A **secret** key, or `off` | `sb_secret_…` | Required, a secret key of the same project; `off` is refused | Required with real data; `off` (no invite emails). Ignored with sample data |
| `SITE_URL` | The site's own address, used in links and search results | An https address with nothing after the domain | `https://sgu-msa-site.vercel.app` | Required, https | Required; `http://localhost:3000` is fine |
| `GO2PAY_API_KEY` | Reading payments for **Payments → Money in** (the board makes the Go2Pay pages by hand; the website never changes them) | A Go2Pay **Take payments only** key: **live** (`g2p_live_…`) on the live site, **test** (`g2p_test_…`) anywhere else; or `off` | `off` | Required; `off` until launch, then a live **Take payments only** key. A test key, or a key that can do more, is refused | Required with real data; a test key or `off`. A live key is refused. Ignored with sample data |
| `CRON_SECRET` | The password Vercel uses to start the nightly check (nobody else can start it) | A random secret of at least 32 letters and digits, or `off` | 64 letters and digits from `openssl rand -hex 32` | Required, a secret; `off` is refused | Required, also with sample data; `off` (no nightly check) |
| `MSA_GMAIL_ADDRESS` | The MSA Gmail that sends the nightly warning emails to itself | A `…@gmail.com` address, or `off` | the MSA Gmail address | Required; `off` only together with the next line, until the club Gmail is set up: the deploy log then warns, the dashboard says "Warning emails are off: set up the MSA Gmail" and no warning email is sent | Required with real data; `off` (together with the next line). Ignored with sample data |
| `GMAIL_APP_PASSWORD` | The Gmail app password `SGU MSA daily check` for those emails | 16 letters (spaces do not matter), or `off` | `abcd efgh ijkl mnop` | Required; `off` only together with `MSA_GMAIL_ADDRESS=off` (one `off` alone stops the deploy) | Required with real data; `off`. Even real values never send email from a computer or preview: only the live site sends |
| `ENABLE_VERCEL_MEASUREMENTS` | Visitor statistics | `true` or `false` | `false` | Required | Not needed; local runs are never measured |

`VERCEL`, `VERCEL_ENV` and `NODE_ENV` are set automatically; do not add them. Keep “Automatically expose System Environment Variables” turned on (Settings → Environment Variables): if Vercel stops providing `VERCEL_ENV`, the deploy fails with a message saying so. `SITE_DESIGN` is no longer used (the site has one design, light and dark): you may delete it from Vercel; leaving it is harmless. `DONATION_URL` is no longer read either (the Donate page lists the board's funds): delete it from Vercel once the release with the Donate page is live. If a deploy fails with "The site configuration has … problems", the message lists each missing or wrong name: add or correct it here, then redeploy. The live site keeps the previous version meanwhile.

### The payments key: GO2PAY_API_KEY

The MSA's Go2Pay account belongs to **so-msa@sgu.edu**: whoever holds that inbox holds the Go2Pay login, makes the keys and hands them over at each board change. Board members make each fund's and ticket's Go2Pay page by hand and paste its link into the dashboard; the website only **reads** payments, so it needs a key that can do nothing else ([ADR 0019](../adr/0019-go2pay-products-made-by-the-board-payments-only-key.md)).

1. **Until launch:** Vercel → project → **Settings** → **Environment Variables** → `GO2PAY_API_KEY` = `off`, environment **Production** → **Save** → redeploy (§9 step 4). The Donate page still works; **Payments → Money in** says payments can't be read.
2. **At launch:** sign in to go2pay.gd as so-msa@sgu.edu → **go2pay.gd/integration-keys** → **API Keys** → create a **live** key named `website-live` with the permission **Take payments only** (never **Everything my account can do**). Copy it straight into Vercel's `GO2PAY_API_KEY` (Production, **Sensitive** on) → **Save** → redeploy. The site refuses a key that can do more: Payments then says to replace it.
3. **For developers:** a **test** key with **Take payments only**, named `website-test`, given privately (password manager, never chat or email); they put it in their own `.env.local`. Even a test key reads the real givers' names, emails and phones.
4. **If a key may have leaked, or a key holder leaves:** go2pay.gd/integration-keys → **Revoke** next to the key. Payments already made are not affected. Make a new key the same way and replace it in Vercel (or give it to the developer).
5. **Rotate** the live key once a year and at every board handover: create the new key, replace it in Vercel, redeploy, then revoke the old one.

Never paste the key anywhere else: not in another setting, an issue, a chat or `.env.example`.

## 10. Board logins: email, password rules and the first admin

Supabase platform login and website login are different. Do not enter your Supabase dashboard password into the website.

Board members join from the dashboard: someone with the "manage people" permission opens **People**, sends an invite, and the new member chooses their own password from the email ([ADR 0007](../adr/0007-people-and-permissions.md)). Passwords are stored only by Supabase Auth, as a one-way bcrypt hash: nobody at the MSA, you included, can read them, and the website never stores them. For this to work, do the four parts below once, on **staging first, then production**. The first admin, or anyone added while the MSA Gmail is not connected, is added by the owner ([First admin, or everyone locked out](#first-admin-or-everyone-locked-out)).

**Password reset safety, in plain words:** a reset or invite link expires (after 24 hours) and works once; the email only goes to the login's own address, so nobody can send it somewhere else; and nobody, not even a developer or the site owner, can see a password.

### Email texts, link address, link expiry and password rules

In the Supabase project (staging, then production):

1. **Authentication → Emails → Templates.** In this repository on GitHub (branch `integration` until the release with People is live, then `main`) open `supabase/templates/invite.html` and click **Raw**. Its first line looks like `<!-- Subject: You are invited to the SGU MSA website dashboard -->`: copy only the words after "Subject:" (without the closing `-->`) into **Subject** of **Invite user**, paste everything from the second line to the end into the message body, and click **Save**. Do the same with `supabase/templates/recovery.html` for **Reset password**. Without them the email links do not reach the website's pages.
2. **Authentication → URL Configuration.** **Site URL**: on production the `SITE_URL` value (today `https://sgu-msa-site.vercel.app`); on staging `http://localhost:3000` (staging is used only from a developer's computer, so its email links open there). Click **Add URL** and add the Site URL followed by `/admin/auth/confirm` (for example `https://sgu-msa-site.vercel.app/admin/auth/confirm`). **Save**.
3. **Authentication → Sign In / Providers → Email.** **Email OTP expiration** `86400` (links work for 24 hours), **Minimum password length** `12`, **Password requirements** "Lowercase, uppercase letters, digits and symbols". Keep **Allow new users to sign up** off (§8). **Save**. The website's password form checks the same rule, but Supabase is the one that decides.

### Connect the MSA Gmail for invite and reset emails

Supabase sends the invite and reset emails through the MSA's existing Gmail account. It is free; Gmail sends about 500 emails a day, far more than the board needs. Record privately who holds the Gmail account and the phone for its 2-Step Verification: if either is lost at turnover, emails stop (§13).

1. Sign in to the MSA Gmail account, open myaccount.google.com → **Security** → **2-Step Verification** → **Turn on**, and finish the phone steps.
2. Open myaccount.google.com/apppasswords, type the name `SGU MSA website`, click **Create**, and copy the 16-character password (spaces do not matter). Keep it only in the club password manager.
3. Supabase (staging first, then production) → **Authentication** → **Emails** → **SMTP Settings**: turn **Enable custom SMTP** on; Sender email = the Gmail address; Sender name = `SGU MSA`; Host = `smtp.gmail.com`; Port = `587`; Username = the Gmail address; Password = the 16-character app password; **Save**.
4. Send yourself a test invite:
   - On **staging**, and on production before the release with People is live: Supabase → **Authentication** → **Users** → **Add user** → **Send invitation**, type an address you own and send. (This test email greets nobody by name; that is expected.)
   - On **production** once People is live: in the dashboard, **People** → **Add a person** (name "Email test", **Group** **General board**, **Show on public page?** **No**) → **Save changes** → **Edit** → **Dashboard login** → type an address you own → **Send invite**.

   Check that it arrives from "SGU MSA" (look in Spam too). Then clean up, so no test data stays on the live site: for the dashboard test, open the "Email test" entry → **Archive this person** (this also turns its login off), then, as someone with "manage people", open it under the **Archived** tab → **Delete permanently** → type **DELETE** → **Delete permanently** (this also deletes its login account). For the Supabase test, open **Authentication** → **Users**, that address → **Delete user**.

If an invite later says "The invite email could not be sent", nothing was changed in the dashboard: check that 2-Step Verification is still on, that the app password still exists (myaccount.google.com/apppasswords) and matches step 3, and whether many emails went out today (Gmail's limit) or this hour (Supabase → **Authentication** → **Rate Limits**).

### The invite key: SUPABASE_SECRET_KEY

The live site needs one secret key, used for two things only: sending invite emails and, when a board member permanently deletes a person, deleting that person's login account. It stays on the server and never reaches visitors' browsers.

1. Supabase (**production** only) → **Project Settings** → **API Keys** → **Secret keys** → create a key named `website-invites` and copy the `sb_secret_…` value.
2. Vercel → project → **Settings** → **Environment Variables** → add `SUPABASE_SECRET_KEY` with that value, environment **Production** only → **Save**.
3. Redeploy (§9 step 4).

Never paste the key anywhere else: not in another setting, an issue, a chat or `.env.example`. Staging needs no key; developers keep `off`. If the key may have leaked, delete it in Supabase, create a new one, replace it in Vercel and redeploy.

### The daily check: warning emails to the MSA Gmail

Once a night (01:00–01:59 Grenada time) Vercel starts the website's check. If something needs fixing (today: iqamah times that end within 7 days), the MSA Gmail gets **one** short email from itself, "SGU MSA website: 1 thing needs attention", with a link to the dashboard page that fixes it. Nothing wrong, no email. Each problem gets at most two emails (the first, then a last call the day before), and the dashboard's notifications bell (top of every dashboard page) shows it until it is fixed. Only the live site sends; developers' computers and previews never do ([ADR 0022](../adr/0022-daily-check-and-warning-emails.md)).

1. **Make the cron secret.** In a terminal run `openssl rand -hex 32` (or a password manager's generator, 40 letters and digits). Copy it.
2. **Make the Gmail app password.** Sign in to the MSA Gmail → myaccount.google.com/apppasswords → App name `SGU MSA daily check` → **Create** → copy the 16 letters → **Done**. (2-Step Verification is already on from [Connect the MSA Gmail](#connect-the-msa-gmail-for-invite-and-reset-emails); this second app password means revoking one never breaks invite emails.)
3. **Add three variables in Vercel.** Vercel → the SGUMSA team → the `sgu-msa-site` project that deploys from GitHub → **Settings** → **Environment Variables** → **Add New**, tick **Production** only, **Sensitive** on if offered, **Save**: `CRON_SECRET` (step 1), `MSA_GMAIL_ADDRESS` (the MSA Gmail address), `GMAIL_APP_PASSWORD` (step 2). If the MSA Gmail is not available yet, set **both** Gmail variables to `off`: the site launches, nothing is emailed, and the dashboard says "Warning emails are off: set up the MSA Gmail" until you replace both and redeploy.
4. **Deploy.** Add them before the Release PR merge that needs them, or that deploy fails safely with a message naming the missing variable.
5. **Check the job.** Vercel → project → **Settings** → **Cron Jobs**: one line `/api/daily-check`, `0 5 * * *`. If it offers **Run**, click it, then **View Logs**: status 200.
6. **Check an email arrives.** On the live dashboard set Prayer & iqamah → **Times end on** to 6 days from today and save. Run the job (step 5). The MSA Gmail gets "SGU MSA website: 1 thing needs attention" (check Spam the first time; mark "Not spam"). If the board wants per-topic forwarding, add the Gmail filter now and run the job again the next day to confirm it forwards. Put **Times end on** back.
7. **To stop everything:** Vercel → **Settings** → **Cron Jobs** → **Disable Cron Jobs**.

Never paste the cron secret or the app password anywhere else. If one may have leaked: make a new one (step 1 or 2; for Gmail, delete the old app password), replace it in Vercel and redeploy.

### First admin, or everyone locked out

Public pages do not require an account. Let the President review the deployed site first. To add the President as the first production dashboard admin, the authorized site owner needs exactly:

- the President’s full name as it should appear in the dashboard;
- an email address the President personally controls and can open during setup; and
- confirmation that the board has appointed this person President and approves giving them **Manage people** so they can invite the rest of the board.

Do not ask for or accept their password, GitHub login, Supabase login, recovery codes or a shared platform account. The President does not need a website password in advance. They request a reset from the deployed site after the owner creates the account; the reset email goes to the address supplied above, and the President chooses their own password.

Use these steps only for the first admin of a new database or when nobody with Manage people can sign in. They require an authorized Supabase project owner. The code deployment must already be connected to the intended database, and SMTP/templates/reset URLs must be configured and tested (§9–§10). For staging rehearsal, perform the same steps in **staging only** while the developer runs the staging-connected site locally; for onboarding the actual President, use **production only after the approved release**.

1. Confirm the three items above directly with the President. Never write their email into a public ticket or documentation file.
2. In the correct Supabase project, open **Authentication → Users → Add user → Create new user**. Use the President's email, generate a temporary random password that meets the site's rules, and turn on **Auto Confirm User**. The President does not need this temporary value. Do not use **Send invitation** here; it does not set the person's name.
3. Open **SQL Editor → New query** and run the existing first-admin function with the confirmed email and full name:

```sql
select public.owner_add_admin('president-email', 'President Full Name', true, 'President');
```

4. Tell the President the account is ready. They open the deployed site’s **Forgot your password?** form, enter the approved email and request a reset. This sends the one-time message from the configured MSA Gmail to their own inbox. They check Spam if needed, open the link, click **Continue**, and choose a password. Then they sign in at the deployed website’s `/admin` page. The reset link expires after 24 hours and works once.
5. The President opens **People**, confirms their Executive board/President role and **Manage people** permission, then adds board members using the Board Handbook steps below. Before ending onboarding, ask them to give **Manage people** to at least one additional trusted Executive board member.
6. Confirm the new President can sign out and sign back in. Do not delete or change existing accounts. If the email does not arrive, stop and check SMTP, message templates, URL configuration and Supabase/Vercel deployment settings; never hand over the temporary password as the workaround.

The function's `true` value grants Manage people. Only Executive board members may hold that permission. The role argument `'President'` assigns the role; if it is already held, the current role holder moves to General board, so verify the existing role before running this operation. Use the dashboard to fix an existing admin instead of calling the function again. Every production SQL use must be recorded as required by [Database access rules](#database-access-rules).

For regular board invitations and password resets, follow the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx), sections “Give someone a dashboard login” and “Forgot your password”. Invite and reset messages are sent by the configured MSA Gmail to each member’s own login email inbox. Passwords are set and stored by Supabase Auth; board members, owners and developers cannot read them.

Password reset safety: each link expires after 24 hours and works once; the message goes only to the login email; nobody can see or recover the chosen password. A person who forgets it requests a new reset email from the sign-in page.

## 11. Confirm the musallah pin

The musallah location is one pin stored in the database (roadmap PR7), not a Vercel setting. It feeds the map, the Apple Maps and Google Maps directions and the prayer start times. The clean database files (§8; `202610150002_starter_data.sql`) add it with a starting pin: the Google Maps place "MSA Mosque" (12.0025521, −61.7723834). Board members check it on site and move it in the dashboard (Prayer & iqamah → Musallah location); the [release checklist](../release-checklist.md) lists the steps. The map needs no account or key: it uses OpenFreeMap's free map pictures and OpenStreetMap's building names. Fixing Google's own "MSA Mosque" listing (claim it, add the website and real photos) is a board task with the MSA's Gmail: the steps are the **Google Maps listing** card in the dashboard's Help.

The old **MUSALLAH_LOCATION_CONFIRMED**, **MUSALLAH_LATITUDE** and **MUSALLAH_LONGITUDE** settings are no longer read. Delete them from Vercel (Production and Preview) once the release with the pin is live; until then they are harmless.

## 12. Prayer, payments, branding: board decisions, not setup guesses

- Religious lead supplies/approves iqamah/Jummah times, schedule effective/expiry dates and weekly reviewer. Enter them at `/admin/prayer-times`. Calculated prayer starts are not congregation times; the calculation is fixed (Muslim World League, Standard Asr), see [Prayer times explained](prayer-times.md).
- Giving goes live only after the university approves Go2Pay. The only payment channel is Go2Pay ([ADR 0005](../adr/0005-payments-channel-policy.md)); the Donate page shows only the funds the board lists in **Payments → Funds**, and says there are no open appeals until then.
- The design is Quiet Paper, light and dark ([ADR 0018](../adr/0018-design-direction-quiet-paper.md)). The light palette is Green Ink (the board's pick); the board still confirms the seal artwork, and the board reviews every Arabic reminder before launch. A visual preference is not permission to launch unverified content.
- Confirm photo consent, location access information, current programs/contact channels and the final organization wording. Old artifacts are references, not automatic approval.

## 13. Ownership handoff and turnover

Routine editors do not need ownership of every platform. Keep two club representatives as owners and invite developers as operators. If the club wants a successor to become an owner, use invitations/transfer controls, never password sharing.

1. **Supabase:** current organization owner opens Members, invites/promotes the incoming accountable person to Owner; that person accepts and verifies access. Keep another club Owner. Remove the outgoing person's membership only after the successor completes setup/recovery tests. Projects created inside this club organization do not need transferring. If a project was created elsewhere, use the official project-transfer process after checking billing/region/integration consequences.
2. **Vercel:** an authorized project owner invites the successor using their own account or transfers project ownership through Vercel’s supported controls. The successor checks the GitHub connection, domain, variables and a production deploy. Never share a login or move the project to a personal account; a paid plan is a board decision. An authorized maintainer merges the Release PR (§5).
3. **GitHub:** keep both repositories under the SGU-MSA organization. Use individually owned maintainer accounts, confirm the private-history repository still retains the issue tracker and Project, and verify developers can access the public source repository. Never pass a shared GitHub login, PAT or recovery code to a successor. For the clean-public-repository setup and Vercel connection, follow the owner-authorized steps in §5 and the active private launch ticket. Do not transfer repositories to personal accounts or delete the private-history repository.
4. **Website editor:** a board member who can manage people invites the successor in **People** and deactivates the outgoing editor (handbook chapter 5, "When someone leaves, or a new board starts"); before Gmail is connected, use §10 [First admin, or everyone locked out](#first-admin-or-everyone-locked-out). Have the successor publish/unpublish a test notice and sign out.
5. **MSA Gmail:** the outgoing holder hands the Gmail account and its 2-Step Verification phone to the successor, who checks that the app passwords `SGU MSA website` and `SGU MSA daily check` still exist and sends a test invite (§10). Record the new holder privately.
6. Update the private owner/billing/recovery record. Rotate shared/exposed credentials if any were previously shared. Keep MFA under each individual’s control.
7. Assign backup/export and maintenance responsibilities. Database backup coverage and file backups are separate; rehearse restoration in staging. This is not a “set up once and abandon forever” system. See [§15 Backups and recovery](#15-backups-and-recovery).

## 14. Setup checklist

- [ ] You and the backup representative can independently access/recover every service.
- [ ] Both the private-history tracker and the public source repository are under SGU-MSA; the Vercel project points to the public repository and `main`; developers use their own accounts; no shared password or token was used.
- [ ] Any plan/seat charges have an accountable approver.
- [ ] Existing Vercel project/repository/production branch verified by its owner.
- [ ] A merge commit to `main` deployed, and the owner knows how to roll back (§5).
- [ ] Staging schema, private bucket and no-public-signup settings verified.
- [ ] PR3 database updates applied to staging, checked, then production (§8 step 5).
- [ ] Email templates, URL configuration, 24-hour links and the password rule set on staging and production; MSA Gmail connected and a test invite arrived (§10).
- [ ] `SUPABASE_SECRET_KEY` (key `website-invites`) set in Vercel, Production only, and redeployed (§10).
- [ ] `GO2PAY_API_KEY` set to `off` in Vercel (Production) until launch, then a live **Take payments only** key made by so-msa@sgu.edu ([The payments key](#the-payments-key-go2pay_api_key)); `DONATION_URL` deleted from Vercel.
- [ ] `CRON_SECRET`, `MSA_GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` set in Vercel (Production); the daily check ran with status 200 and a test warning arrived ([The daily check](#the-daily-check-warning-emails-to-the-msa-gmail)).
- [ ] At least two board members have "manage people".
- [ ] Every [required variable](#required-variables) set in Vercel (Production), including **ENABLE_VERCEL_MEASUREMENTS** `true` or `false`, and redeployed; if `true`, Analytics and Speed Insights enabled.
- [ ] One board editor has completed draft → publish → unpublish → logout on a phone.
- [ ] Map pin and prayer confirmations have a named owner if still missing.
- [ ] Donation and commerce remain disabled until policy/product decisions.
- [ ] Selected design and requested changes are recorded.
- [ ] Production setup, backup restore, final content/privacy review and launch acceptance are scheduled.

You can stop after any section with its checkpoint incomplete. Record what remains; do not describe a dependency on owner access as “completed in code.”

## 15. Backups and recovery

Assign a named backup owner and verify the chosen Supabase plan’s database backup/retention features. Database backups do not by themselves guarantee recovery of Storage file bytes: maintain a separate periodic export of the `community` bucket. Export before substantial cleanup or migration and at board turnover.

Keep encrypted backup copies in organization-controlled storage, with documented retention and access. A developer can use Supabase-supported database dump/restore tooling and Storage export methods. Test restoration to a separate staging project at least once before handoff and after changing the backup process. Verify records, file paths, Auth users/memberships, and storage policies after restoration. Never test a restore over the live database.

Board members archive items instead of deleting them (reversible from the Archived tab); a permanent delete from the dashboard is final without a backup. Replaced files of events, news and newsletters are intentionally retained; the dashboard deletes a person's replaced or removed photo and the files of permanently deleted items. Review references across the four content tables and `people` before deleting a storage object by hand. Do not make the private bucket public to troubleshoot a broken image.

## 16. Troubleshooting

| Symptom | Check |
| --- | --- |
| Deploy failed: "The site configuration has … problems" | Each listed name is missing or has a value that is not allowed; fix it in [Required variables](#required-variables), then redeploy |
| Deploy failed: a SUPABASE_… variable is missing | Add it in Vercel → Settings → Environment Variables (Production), then redeploy |
| Correct password but no board access | In the dashboard, **People**: their login must say **Login active** (a board member who can manage people can reactivate it). Never added at all: §10 [First admin, or everyone locked out](#first-admin-or-everyone-locked-out) |
| "The invite email could not be sent" | §10 Gmail steps: 2-Step Verification on, app password still exists and matches SMTP Settings; Gmail's daily limit (about 500) or Supabase **Authentication → Rate Limits** |
| Email link says it expired or was already used | Older than 24 hours or already used: **Send the invite again** or **Forgot your password?**. Every link fails: check §10 templates and URL Configuration |
| Email link opens the wrong address (for example localhost on production) | §10 **URL Configuration**: Site URL and the `/admin/auth/confirm` address of that project |
| No warning emails, but the dashboard's notifications bell lists problems | Each problem is emailed at most twice, then shown only on the dashboard. Otherwise: Vercel → **Settings** → **Cron Jobs** is enabled; the Gmail app password `SGU MSA daily check` still exists and matches `GMAIL_APP_PASSWORD`; look in Spam ([The daily check](#the-daily-check-warning-emails-to-the-msa-gmail)) |
| Cron job shows 401 or 500 | **401**: `CRON_SECRET` was changed without a redeploy; redeploy. **500** with `"failed":"mail"`: Gmail refused the app password or did not answer (it retries the next night); `"facts"` or `"ledger"`: the database did not answer (Supabase project health) |
| Content temporarily unavailable | Supabase project health, migration, RLS policies, Vercel server logs |
| Save conflict | Another editor saved; preserve text, reload, compare |
| Published item missing | Publication/expiry date in Grenada, Published flag, cache refresh |
| Event missing from Upcoming | It already ended or has no end time and already started; use Past events |
| Iqamah missing | Effective date, expiry date, blank times; check published schedule |
| Prayer calculations absent ("temporarily unavailable") | The database is installed (§8: `select count(*) from public.musallah_location;` gives 1); prayer migrations applied |
| Upload failure | Size <=3 MB, accepted format, valid file, bucket migration, an active login (**People**: **Login active**) |
| Old PDF/image still in Storage | Intentional retention; review references before owner cleanup |
| A merge did not go live | In Vercel → project → **Settings → Git**, verify the connected repository is the public `SGU-MSA/sgu-msa-site` and the production branch is `main`. Open the deployment details and logs, confirm the expected commit and that the deployment was authorized, and check whether a rollback is active. Ask the Vercel project owner to resolve connection or authorization issues (§5). |
| Analytics has no data | `ENABLE_VERCEL_MEASUREMENTS` is exactly `true` (Production) and redeployed, Analytics/Speed Insights tabs enabled, a real visit to a public page (admin pages are never counted) |

Inspect server logs without sharing tokens, cookies, passwords, or personal information in issues. For suspected account compromise, have a board member who can manage people deactivate that login in **People** (it ends all of that person's sessions at once; §10 "When a board member leaves" if nobody can), rotate affected credentials, and review **Recent changes** and published content.

## 17. Final handoff acceptance

- Two organization representatives control recovery for every service.
- Production/staging configuration is recorded privately.
- Admin login/logout and draft/publish/unpublish tested on a phone.
- A test invite and a password reset email arrived from the MSA Gmail, and the link let the person choose a password (§10).
- Newsletter upload/download tested; a draft attachment is inaccessible anonymously.
- Prayer settings approved; schedule reviewer and expiry established.
- Donation placeholder or verified destination reviewed.
- Domain, Git integration, production branch, merge-commit publishing and rollback verified by owner.
- Backup/export and isolated restore rehearsed.
- Incoming board trained using the [Board Handbook](../../handover/SGU-MSA-Website-Handbook.docx).
- A future maintenance contact and billing/renewal owner are recorded. The site remains maintainable, but hosting, dependencies, backups, and account security still need an owner after the original developer leaves.
