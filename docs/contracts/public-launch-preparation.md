---
status: approved
mode: full
---

# Current website publication and staging onboarding

Tracking: private launch issue 118; private documentation issue 115. Base: integration `177056a575f1fe9f1104c408fff3d3b043d9511e`.

## Capability

Publish the reviewed current website without historical raw archives and rehearse real board onboarding before its first production deployment.

## Requested Behavior

Keep spending at $0. Remove obsolete source archives while preserving current public website assets. Apply MIT to project code with separate media/vendor notices. Retain the old repository and its issues privately; publish a clean website repository under `SGU-MSA/sgu-msa-site`. Test staging invitations, password selection/reset, permissions and removal using an owner-controlled temporary alias. Release integration to main only after review and checks. Use the existing Vercel address; no domain purchase.

## Existing System Evidence

- `LICENSE` currently contains The Unlicense; Motion and applying-design-styles have separate vendored notices.
- `docs/archive/notes/ASSET_MANIFEST.md` records raw media excluded from public selections. Three archived notes remain linked by accepted ADRs.
- Historical `source-assets/`, `docs/archive/assets/` and `docs/archive/source/` retain old media; GitHub pull-request refs prevent a force-push from guaranteeing removal.
- Staging and production have the four current follow-up migrations. Production rollout is recorded on launch issue 118 and must not be repeated.
- `src/features/admin/access-actions.ts`, `people-actions.ts` and existing Supabase providers own invitations, passwords and account removal.
- Staging has existing accounts including a President and manager. Preserve their identities, roles and permissions.
- `handover/SGU-MSA-Website-Handbook.docx` already owns board instructions; owner guide section 10 owns bootstrap.

## Owner

Repository licensing/publication and existing owner/developer guides own source distribution. Existing People/Auth ports own onboarding; no new application feature is needed.

## Source of Truth

Existing SQL and schemas remain authoritative. GitHub issues and Project track execution. LICENSE and applicable vendor/media notices define distribution scope. The board handbook remains the only board how-to.

## Reuse and Duplication Analysis

Reuse current application and migrations unchanged. Reuse real staging Auth and SMTP, existing browser helpers and UI. Keep three archived provenance/payment/merch notes because accepted ADR links depend on them. Do not create another board guide or duplicate onboarding implementation.

## New Abstractions

None. A private historical repository and clean public repository separate historical private material from released source; they are not new application services.

## Product Decisions Required

None. The maintainer selected the clean-public-repository route, MIT, temporary staging rehearsal and conditional production release. The temporary inbox is provided privately, not recorded here.

## Decisions

D-1: Publish clean source under the current website repository name; retain historical repository/issues privately (maintainer, 2026-10-17).
D-2: MIT for project code, preserve independent third-party terms and exclude separately owned media/branding from the blanket code license (maintainer requested MIT, 2026-10-17).
D-3: Authorize staging test invitations/resets and disposable account cleanup; use the owner-controlled alias stored only in ignored local state (maintainer, 2026-10-17).
D-4: Authorize release integration to main after staging acceptance, independent review and passing gates; use existing Vercel address, purchase nothing (maintainer, 2026-10-17).
D-5: Retain the existing staging President. Use one synthetic disposable person. In General, disable public listing and verify both sensitive permissions are cleared. Manager scenarios may temporarily move only this person into the verified free Vice President (Brothers) role; Executive members are always public and General members cannot hold sensitive permissions. The synthetic name/role will therefore briefly appear in staging's anonymously callable public team data as well as the local About page. Never put a real name, email, contact details or photo in public fixture fields. Return the fixture to hidden General promptly after manager tests, verify public absence, and delete it after the rehearsal. This operational correction was independently reviewed; it changes no product, listing or permission rules.

## Board Self-Sufficiency Check

After one owner bootstrap, a person with Manage people adds/invites board members in People. Members choose/reset their own passwords. Public showcase requires no account. Board steps stay in the existing handbook, infrastructure steps in owner guide. GitHub/Supabase/Vercel accounts are not website member accounts.

## Design

No UI change. Private historical repository retains old commits/issues. A clean initial main commit contains only safe bootstrap documentation/license; integration receives the reviewed cleaned website tree. A new release PR publishes that integration tree to main after tests. Vercel connects to the new repository identity and continues tracking main.

## Public Contract

Application routes, schemas, ports, migrations, permissions and current public assets stay unchanged. Code distribution changes from root Unlicense to MIT prospectively; existing Unlicense grants and vendored terms are preserved. Public source must not contain test inboxes, authentication state or historical raw archives.

## Private Implementation

Snapshots, clone bundles, account IDs, inbox alias, browser evidence and temporary server state live under ignored `.agents/local/` or `.plans/`. Do not expose credentials in command logs or task output. Do not commit a temporary staging invitation key.

## Data and State Flow

Owner-controlled inbox receives a staging invite/reset; the app confirms a one-time link and sets a password through Supabase Auth. The original staging manager remains available to remove the temporary identity. Git publication copies an inspected tree, not old commits or PR refs. Existing Vercel production settings remain with the existing project.

## Failure Modes

- Missing staging invitation capability: report the exact missing setting and use a private user-entry path; never print or copy secrets into Git.
- Email/link failure: keep a bounded failure report, do not claim delivery from API success alone, and do not add public signup.
- Rehearsal cleanup failure: retain IDs privately, report what remains, and retry only the identified disposable objects after inspection.
- Source publication audit failure: keep the new repository private until corrected; never expose old history to avoid a delay.
- CI or deployment failure: stop release/promotion, inspect logs without exposing values, fix through the implementer/reviewer loop.

## Compatibility and Migration

No new SQL migration. All four existing production follow-ups are already applied. Do not replay them or alter baseline files. Existing account names/roles must not change in staging. Temporary staging credentials may be process-only for this authorized test; do not persist them in tracked config or reusable production connections.

## Parallel Work and Merge Order

Cleanup/license/docs work may run while staging preflight proceeds; local staging server must use a stable checkout so documentation edits do not affect app logic. Review before merging the preparation PR. Preserve private tracker access when renaming the old repository. Publish only independently inspected clean commits. Update Vercel Git link before authorized final main merge; verify actual deployment afterward.

## Work Packages

### WP-1: Current-tree cleanup, license and instructions

- Purpose: make the current tree suitable for clean publication and explain onboarding precisely.
- Depends on: approved decisions above.
- Expected files: LICENSE, preserved original license notice, package.json and root lockfile license metadata, README.md, docs/guides/owner-setup.md, developer.md, photography.md if needed, AGENTS.md, relevant shared project-management skill, public-launch contract, docs/release-checklist.md, handbook existing sections, applying-design-styles Project notes only, obsolete docs/archive/assets and docs/archive/source files.
- Reuse: existing guides/handbook, vendor notices and three archived notes.
- Required changes: remove current obsolete original assets/source PDFs; fix current links/instructions; add MIT and clear asset/vendor scope; explain private historical tracker and public code repository; provide owner packet and step-by-step board invites/password/reset.
- Must not: change application code, dependencies, migrations, current public assets or immutable ADRs; edit vendored policy outside Project notes; erase existing license grants; add personal data.
- Tests: npm run check, applicable doc/link checks, license metadata consistency and preserved public tree hashes.
- Done when: independent diff review passes and implementation is ready for the authorized integration merge.

### WP-2: Staging rehearsal and disposable cleanup

- Purpose: verify real Auth/SMTP and admin UX before release.
- Depends on: temporary inbox and safe staging-only runtime.
- Expected files: private artifacts only; report discoveries before any proposed source fix.
- Reuse: existing app and People/Auth ports, browser accessibility queries and submit helper.
- Required changes: baseline snapshot IDs privately; use the single synthetic fixture and bounded General/Executive role cycle in D-5; invite the controlled inbox; verify link origin, Continue, password rules, sign-in, one-use link rejection, reset and session revocation; test permission refusals against existing page/action policies; remove only disposable entries/accounts and verify original counts/roles restored.
- Must not: use production, displace President, delete existing users, run local-only backend tests against hosted staging, send messages outside the approved test inbox, promise log erasure, store passwords or email in Git/tickets.
- Tests: recorded intentional browser scenarios and read-only cleanup checks; human inbox/password entry is private.
- Done when: delivery and browser outcomes are observed, or a concrete missing user action is identified; temporary identities/keys/server are removed when testing completes.

### WP-3: Clean repository and release

- Purpose: publish without old PR/cached history, then deploy the reviewed site.
- Depends on: WP-1 review, WP-2 acceptance and source audit.
- Expected files: private publication snapshots and new clean Git commits; no raw media history copied.
- Reuse: existing GitHub owner wrapper, organization Project, Vercel project and production-only variables.
- Required changes: snapshot old refs privately; rename old repository to `sgu-msa-site-private-history` while retaining private issues; create clean website repository at original name; construct safe main/integration commits; independently verify object history/current asset hashes/secrets scope; update canonical tracker links; connect Vercel to new repository ID; pass checks and merge reviewed release into main; verify site and daily job.
- Must not: publish old Git objects/PR refs, delete old repository, lose tracker data, enable paid features, buy a domain or point previews at production secrets.
- Tests: clean-history object/path audit, clean checkout gate and browser smoke, Vercel repository/main/Hobby verification, live public/admin/media/email/cron checks as authorized.
- Done when: the public site works at the existing Vercel address and tracking/onboarding handoff is accurate.

## Implementation Constraints

- Every worker owns named files/operations and accommodates others; no unrelated reverts.
- Planners write process documents and run diagnostics; lower-cost agents implement code/tooling, with independent capable review.
- Do not expose test email, passwords, secrets, private production endpoints, cookies, profiles or backups.
- No new dependencies, paid service, general archive engine or authentication redesign.
- Preserve all current `public/` asset bytes for this release.

## Worker Escalation Conditions

Report PLAN MISMATCH before changing product behavior, permission rules, existing accounts, required assets, schema or source ownership beyond the exact plan. Stop publication if historical objects or private data are reachable in the clean repository.

## Test Strategy

Run the normal gate for current-tree changes and dedicated smoke. Real staging testing remains separate from sample/browser and local RLS test evidence. Audit clean Git objects and compare preserved runtime/public files byte-for-byte. Record environment/revision/persona/expected/observed outcomes without identity data. Reviewer verifies final diff, source audit and staging cleanup before conditional release authorization is used.

## Acceptance Criteria

- MIT scope and vendor/media notices are accurate; no obsolete source archives in published history.
- Existing current website assets and behavior are preserved.
- Staging receives and completes the approved invitation/reset flows, permissions are checked, and disposable account cleanup is verified.
- Owner knows exactly which President information is needed; handbook explains adding everyone else and password recovery.
- Private historical issues remain available; public source/release links identify the correct repositories.
- Passing reviewed integration is released to main and the existing Vercel site is verified without spending.

## Open Risks or Escalations

The private inbox owner must observe delivery and privately choose passwords. Staging invitation key availability remains a runtime preflight item. GitHub App access must cover the new repository identity. Email and managed-service logs can retain metadata after disposable account deletion. No claim of permanent Free-tier availability is made.
