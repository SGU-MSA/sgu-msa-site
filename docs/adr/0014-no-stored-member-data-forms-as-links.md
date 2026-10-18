# 0014. No stored member data; sign-up forms as links

- Status: Accepted
- Date: 2026-10-03

## Context

The site is run by the MSA board in Grenada, not the US. Grenada's Data Protection Act, No. 1 of 2023, has been enacted, but our privacy research (October 2026, not legal advice) could not confirm that it is in force, and its scope ("commercial transactions") may not cover a club site. If it applies, it asks for consent, minimal collection, security, limited retention and access on request, and treats religious belief as sensitive data needing written consent. Being listed by a Muslim students' association can reveal belief. Holding as little personal data as possible keeps us safe whatever the law ends up requiring.

## Decision

- **The site stores no personal data about regular members** (no member accounts, sign-up answers, mailing lists or RSVPs).
- **Sign-ups use the board's Google Forms.** An event can carry a form link, shown as a styled "Sign up →" button that opens the form in a new tab. Forms are never embedded, and answers stay in the board's Google account.
- **Personal data the site does hold:**
  - People entries ([ADR 0007](0007-people-and-permissions.md)): name, role title, section, show-on-public choice, optional login email, and an optional photo shown only with consent.
  - The add-only activity log of who changed what ([ADR 0013](0013-activity-log-archive-and-history.md)).
  - Essential Supabase sign-in cookies for admins only.
  - Payment order records from Go2Pay ([ADR 0005](0005-payments-channel-policy.md)); card details stay with Go2Pay.
- **Consent for the public team page:** listing a person needs a recorded written consent (date and how: email, message, in person or paper); a photo needs a separate consent. The People form refuses to save "Show on public page = Yes" or a photo without consent details, keeps everything typed and says clearly what is missing. Consent records are logged ([ADR 0013](0013-activity-log-archive-and-history.md)). Withdrawal removes the listing and permanently deletes the photo.
- This data is processed by Supabase (database, auth, storage) and Vercel (hosting, plus optional analytics under [ADR 0011](0011-production-analytics-explicit-setting.md)), whose servers may be outside Grenada.

- Decided by the user (D0 follow-up, 2026-10-03); rejected: embedded forms, member accounts, tick-box-only consent.

## Consequences

- Features that would collect member data (accounts, RSVPs, newsletters) need a new ADR first.
- The privacy page must list the data above, the providers (Supabase, Vercel, Google, Go2Pay, map services), cookies, retention and how to request access, correction or removal. It states only what is live: each feature PR adds its own paragraph.
- Open for the board: whether the Act is in force and applies; how long the activity log and deactivated accounts are kept; who answers privacy requests; the Supabase region.

## Notes

- 2026-10-05: [ADR 0025](0025-team-list-without-consent-records.md) removes the recorded listing and photo consent: "Show on public page?" alone decides who is listed, and a listed person's photo shows whenever one is uploaded. The rest of this ADR stands.
