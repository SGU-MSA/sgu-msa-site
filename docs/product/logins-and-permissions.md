# Dashboard logins and permissions

**Who uses it:** board members with Manage people (invites, permissions), every board member (sign-in, passwords), the site owner (first admin, lock-out). **Where:** People → a person → **Dashboard login**; `/admin` (Board sign in), **Forgot your password?**, the email link's **Continue** page, **Choose your password**; **Sign out** in every dashboard header. **Related:** [PR3 contract](../contracts/pr3-people-permissions-activity.md), [ADR 0007](../adr/0007-people-and-permissions.md), [ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md), [ADR 0022](../adr/0022-daily-check-and-warning-emails.md) (secret-key holders), [home-centering contract](../contracts/home-centering.md) (password toggle), [owner guide §10](../guides/owner-setup.md#10-board-logins-email-password-rules-and-the-first-admin). People entries: [people](people.md).

## Why it exists

The board must let new members in and old members out every year without a developer, and without anyone ever seeing a password. Two sensitive areas, people's access and money, need a small, trusted group, and the club must never lock itself out.

## User stories

### Invites

- **US-LOGIN-1.** As a board member with Manage people, I want to invite a person from their People page, so that they choose their own password.
  - Acceptance: **Email for the invite**, the permission boxes (Executive board only) and **Send invite**; the answer "Invite email sent to (email). The link works once and expires in 24 hours."
  - Acceptance: the email names the inviter; the link opens a page with **Continue**, and only that click uses the link.
  - Acceptance: the People list shows "Invited" until their first sign-in, then "Login active".
- **US-LOGIN-2.** As a board member with Manage people, I want to resend an invite, so that someone whose email expired or never arrived can still join.
  - Acceptance: while "Invited", **Send the invite again** sends a fresh 24-hour link.
- **US-LOGIN-3.** As a board member with Manage people, I want to change the email a login uses, so that a typo or a lost inbox can be fixed.
  - Acceptance: **Change email**: invited people get the invite again at the new address and the old link stops working; others sign in with the new email and keep their password.
- **US-LOGIN-4.** As a General board member, I want to be on the team list without a login, so that I only get dashboard access if I need it.
  - Acceptance: a People entry with "No login" is complete; a login is optional for everyone (maintainer, 2026-11-10).

### Turning access off and on

- **US-LOGIN-5.** As a board member with Manage people, I want to deactivate a login, so that someone leaving cannot change the site.
  - Acceptance: **Deactivate login** signs them out on every device at once; their People entry stays. **Reactivate login** lets them sign in again with their existing password.
  - Acceptance: **Remove login** on a deactivated login deletes the account for good after typing their name; the People entry and history stay.

### The two permissions

- **US-LOGIN-6.** As the President, I want to give Manage people to at least one other executive, so that the club is never stuck if I am away.
  - Acceptance: **Manage people**: "Can invite people, change permissions and deactivate or reactivate logins." Also needed for Term export, permanent deletes and Executive board moves.
  - Acceptance: the bell warns Manage people holders while fewer than two active people hold it.
- **US-LOGIN-7.** As the Treasurer, I want Manage money, so that I can see the Go2Pay payments.
  - Acceptance: **Manage money**: "Can see Money in (the Go2Pay payments, with givers’ names and notes) and download it." Another manager must turn it on; nobody turns on their own.
- **US-LOGIN-8.** As a board member with Manage people, I want to hand an Executive board role to a new person, so that the role never has two holders.
  - Acceptance: choosing a taken role asks "(holder) is (role). Make (name) (role) instead?"; **Yes** moves the holder to the General board with no role title, in the same save.
  - Acceptance: leaving the Executive board turns off both permissions: "Moving them out of the Executive board turns off their Manage people and Manage money."

### Pages

- **US-LOGIN-9.** As an executive, I want to edit the public pages' words and photos, so that the elected leadership speaks for the club.
  - Acceptance: Pages shows only to Executive board members whose login is invited or active; everyone else is sent to the dashboard. No tick-box: it follows the group.

### Signing in and passwords

- **US-LOGIN-10.** As a board member, I want to sign in with my email and password and see what I type, so that I can sign in on a phone.
  - Acceptance: **Board sign in**; each password box has an eye button ("Show password", pressed or not) that returns to hidden on submit.
  - Acceptance: a wrong password: "Sign-in unsuccessful. Check your credentials or try again later."; no board access: "This account does not have board access. Ask a board member who can manage people."
- **US-LOGIN-11.** As a board member, I want to reset a forgotten password myself, so that I do not need anyone.
  - Acceptance: **Forgot your password?** always answers "If this email belongs to a board account, a reset link is on its way. Check your inbox and spam folder."
  - Acceptance: **Choose your password** needs "At least 12 characters, including a lower-case letter, a capital letter, a number and a symbol." typed twice; saving signs out other devices.

## Rules

- Every person with a login is an equal admin for content; the two permissions cover access and money ([ADR 0007](../adr/0007-people-and-permissions.md)). Pages are for the Executive board only ([ADR 0027](../adr/0027-pages-edited-by-the-executive-board.md)).
- Only Executive board members may hold either permission (PR3 amendment 2026-10-06, SGU14).
- Leaving the Executive board turns both permissions off, and they are not remembered: coming back means a manager gives them again (PR3 amendment 2026-10-06; maintainer, 2026-11-10). Deactivating and reactivating a login keeps them.
- Nobody removes their own access or own Manage people, nobody turns on their own Manage money, and the last active Manage people holder keeps it; the database decides and serializes changes ([ADR 0007](../adr/0007-people-and-permissions.md), PR6 D-18).
- Invite and reset links work once, for 24 hours (PR3 D-3); a mail scanner's visit does not use them (D-25).
- Passwords are stored only by Supabase Auth as a one-way hash; the site never stores or shows them (PR3 Source of Truth).
- No "sign out on all devices" button and no two-step sign-in; deactivation ends every session, a password reset ends the other sessions (PR3 D-15).
- Emails go through the MSA Gmail (PR3 D-2). The secret key that sends invites and changes emails is server-only ([ADR 0022](../adr/0022-daily-check-and-warning-emails.md)).

## Edge cases

| Case                                                                    | What should happen                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invite link expired or already used                                     | "This link has expired or was already used. Ask for a new invite or use Forgot password." A manager uses **Send the invite again**.                 |
| Invited email typed wrong                                               | While "Invited": **Change email**; the link to the wrong address stops working.                                                                     |
| The email already belongs to another person's login                     | "This email already belongs to another person's login. Use a different email."                                                                      |
| Invite email cannot be sent (Gmail down or over its limit)              | "The invite email could not be sent. Nothing was changed. Ask the site owner to check the email setup."                                             |
| Reset email never arrives                                               | The answer is the same either way (it never reveals who has an account); check spam, then ask the site owner (owner guide §16).                     |
| Lost password and no access to the login email                          | A manager uses **Change email** to an inbox they can open; they then use **Forgot your password?**.                                                 |
| The last manager tries to leave                                         | Refused: they first give Manage people to another executive, who then moves them out.                                                               |
| Moving yourself out of the Executive board while you hold Manage people | Refused: "You cannot move yourself out of the Executive board while you can manage people. Ask another person who can manage people."               |
| Two people claim the same role                                          | One holder per role; the second save gets the role question, or "Someone else in the Executive board holds this role now." if it changed meanwhile. |
| Two managers remove each other's Manage people at once                  | One succeeds; the other gets "At least one active person must keep 'manage people'."                                                                |
| Account deactivated while signed in                                     | Signed out on every device; the next click says "Your session expired or access was removed. Sign in again."                                        |
| The second Manage people holder never accepted their invite             | An invited login counts like a signed-in one, so the bell shows no warning; check the People list for "Invited" and resend.                         |
| Nobody with Manage people can sign in                                   | The site owner follows "First admin, or everyone locked out" ([owner guide §10](../guides/owner-setup.md#first-admin-or-everyone-locked-out)).      |

## Known gaps

- **Change email** is not in Recent changes and emails nobody for an active login (Supabase Auth keeps the email; no ticket yet; see Open questions).

## Open questions

- Should **Change email** on an active login email the person, and should it show in Recent changes? ([release checklist](../release-checklist.md), Review fixes P4)
- Should changing funds, tickets and merch need **Manage money**? Today every board member can.
- Should a dashboard session end by itself after a while (for example on a shared lab computer)? Today it lasts until **Sign out**, a password reset or deactivation.
