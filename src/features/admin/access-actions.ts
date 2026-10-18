"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "./save-state/saved-flash";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { emailLinkSchema } from "./email-link";
import { passwordHint, passwordSchema } from "@/lib/backend/password";
import type {
  AdminIdentity,
  GrantResult,
  VersionedPerson,
} from "@/lib/backend/providers/contract";
import { currentAdmin } from "@/lib/backend/server";
import { accessChangeSchema, permissionsProblem } from "@/lib/community/people";
import { siteUrl } from "@/lib/site-config";
import {
  accountInviter,
  adminAuth,
  peopleEditor,
} from "@/lib/runtime/providers";
import type { EditorState } from "./actions";
import {
  accessFailures,
  accessRefusals,
  changeEmailWords,
  expiredLink,
  refuse,
  removeLoginWords,
  resetRequested,
} from "./fields";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
} from "@/lib/system-text";

/**
 * Logins and passwords (PR3 contract, WP-D). Invites, permissions and
 * deactivation need "manage people"; the database decides (`grant_access`,
 * `set_access`, `admins_guard`). Passwords go only to Supabase Auth, which
 * keeps a one-way hash; nothing here stores, logs or shows one.
 */

const told = (notice: string): EditorState => ({ error: null, notice });

/** Where invite and reset emails lead (the email templates build the same link). */
const emailLinkTarget = () => new URL("/admin/auth/confirm", siteUrl).href;

const checked = (form: FormData, name: string) => form.get(name) === "on";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

const inviteFailures = {
  "email-unavailable":
    "The invite email could not be sent. Nothing was changed. Ask the site owner to check the email setup.",
  unavailable:
    "Could not send the invite. Check your connection and try again. Nothing was changed.",
  // A developer's computer only (`SUPABASE_SECRET_KEY=off`); refused on the live site.
  off: "Invite emails are switched off on this computer (SUPABASE_SECRET_KEY is off). Nothing was changed.",
} as const;

const grantFailures: Record<
  Extract<GrantResult, { ok: false }>["reason"],
  string
> = {
  forbidden: accessRefusals.forbidden,
  no_account:
    "The invite could not be finished. Wait a minute, then try again.",
  already_linked:
    "This email already belongs to another person's login. Use a different email.",
  person_has_login: "This person already has a login. Reload to see it.",
  person_archived: accessRefusals.person_archived,
  not_executive: accessRefusals.not_executive,
  unavailable: unavailableMessage("finish the invite"),
};

/** The People entry an access form names: current, or a board-facing refusal. */
async function currentPerson(
  id: unknown,
): Promise<VersionedPerson | EditorState> {
  const personId = z.uuid().safeParse(id);
  if (!personId.success) return refuse("Unknown person. Reload and try again.");
  const { person, unavailable } = await peopleEditor().readPerson(
    personId.data,
  );
  if (unavailable) return refuse(unavailableMessage("load this person"));
  if (!person) return refuse(staleScreen);
  if (person.archived_at) return refuse(accessRefusals.person_archived);
  return person;
}

/** The inviter's People name for the email (D-1); their login email if it cannot be read. */
async function inviterName(admin: AdminIdentity) {
  const { people } = await peopleEditor().listPeople();
  const own = people.find(
    (person) =>
      person.access.state !== "none" && person.access.userId === admin.userId,
  );
  return own?.full_name ?? admin.email;
}

/**
 * The invite flow (PR3 contract, Design → Invite): (1) the caller checked
 * "manage people"; (2) the invite email, where an existing account is not an
 * error; (3) the grant, only after (2) succeeded; (4) an existing account that
 * never signed in gets a reset link instead. Retrying is safe.
 */
async function deliverInvite(
  admin: AdminIdentity,
  person: VersionedPerson,
  email: string,
  permissions: { canManagePeople: boolean; canManageMoney: boolean },
  sentVerb: "sent" | "sent again",
): Promise<EditorState> {
  // Only Executive board members hold the two permissions (SGU14): checked
  // before the email goes out, so nobody is emailed for a grant the
  // database would refuse (a stale screen, or a person moved out meanwhile).
  const groups = await peopleEditor().listSections();
  if (groups.unavailable) return refuse(unavailableMessage("send the invite"));
  const executiveId =
    groups.sections.find((group) => group.kind === "executive")?.id ?? null;
  if (permissionsProblem(person.section_id === executiveId, permissions))
    return refuse(accessRefusals.not_executive);
  const sent = await accountInviter().invite(email, emailLinkTarget(), {
    fullName: person.full_name,
    invitedBy: await inviterName(admin),
  });
  if (!sent.ok && sent.reason !== "already-registered")
    return refuse(inviteFailures[sent.reason]);
  const granted = await peopleEditor().grantAccess(
    person.id,
    email,
    permissions,
  );
  if (!granted.ok) return refuse(grantFailures[granted.reason]);
  publicDataChanged();
  // The sandbox sends nothing but answers like the live site (review fixes PR-1).
  const delivered = () =>
    told(
      `Invite email ${sentVerb} to ${email}. The link works once and expires in 24 hours.`,
    );
  if (sent.ok) return delivered();
  const { person: linked, unavailable } = await peopleEditor().readPerson(
    person.id,
  );
  if (unavailable || !linked)
    return refuse(
      "The login was linked, but the email could not be sent. Click “Send the invite again”.",
    );
  if (linked.access.state !== "invited")
    return told(
      `Access given. ${email} already has an account and can sign in with its existing password.`,
    );
  const reset = await adminAuth().requestPasswordReset(
    email,
    emailLinkTarget(),
  );
  return reset.ok
    ? delivered()
    : refuse(
        "The login was linked, but the email could not be sent. Click “Send the invite again”.",
      );
}

/** Invites a People entry without a login (needs "manage people"). */
export async function inviteAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(accessRefusals.forbidden);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return refuse(email.error.issues[0].message);
  const person = await currentPerson(form.get("personId"));
  if ("error" in person) return person;
  if (person.access.state !== "none")
    return refuse("This person already has a login. Reload to see it.");
  return deliverInvite(
    admin,
    person,
    email.data,
    {
      canManagePeople: checked(form, "canManagePeople"),
      canManageMoney: checked(form, "canManageMoney"),
    },
    "sent",
  );
}

/** Sends a new link to someone who was invited but has not signed in yet. */
export async function resendInviteAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(accessRefusals.forbidden);
  const person = await currentPerson(form.get("personId"));
  if ("error" in person) return person;
  const { access } = person;
  if (access.state !== "invited" || !access.email) return refuse(staleScreen);
  return deliverInvite(
    admin,
    person,
    access.email,
    {
      canManagePeople: access.canManagePeople,
      canManageMoney: access.canManageMoney,
    },
    "sent again",
  );
}

/**
 * "Change email" (review fixes P4; "manage people" only): the login's email
 * changes through the server-only inviter (the secret-key adapter). Someone
 * invited who has not signed in yet gets the invite again at the new
 * address; anyone else signs in with it from now on, password unchanged.
 */
export async function changeEmailAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(accessRefusals.forbidden);
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return refuse(email.error.issues[0].message);
  const person = await currentPerson(form.get("personId"));
  if ("error" in person) return person;
  const { access } = person;
  if (access.state === "none" || access.version !== form.get("version"))
    return refuse(staleScreen);
  if (access.email?.toLowerCase() === email.data)
    return refuse(changeEmailWords.same);
  const changed = await accountInviter().changeEmail(access.userId, email.data);
  if (!changed.ok)
    return refuse(
      changed.reason === "taken"
        ? changeEmailWords.taken
        : changed.reason === "off"
          ? changeEmailWords.off
          : unavailableMessage("change the email"),
    );
  publicDataChanged();
  if (access.state !== "invited")
    return told(changeEmailWords.done(email.data));
  // Invited only: the link goes to the new address (the old one no longer works).
  return deliverInvite(
    admin,
    person,
    email.data,
    {
      canManagePeople: access.canManagePeople,
      canManageMoney: access.canManageMoney,
    },
    "sent",
  );
}

const accessNotices = {
  permissions: "Permissions saved.",
  deactivate:
    "Login deactivated. They were signed out on every device and can no longer open the dashboard.",
  reactivate:
    "Login reactivated. They can sign in again with their existing password.",
} as const;

/**
 * Changes permissions, or deactivates or reactivates a login, with the
 * version on screen. Deactivating ends all their sessions (D-15).
 */
export async function setAccessAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(accessRefusals.forbidden);
  const active = form.get("active");
  const change = accessChangeSchema.safeParse({
    personId: form.get("personId"),
    canManagePeople: checked(form, "canManagePeople"),
    canManageMoney: checked(form, "canManageMoney"),
    active: active === "true" ? true : active === "false" ? false : undefined,
    version: form.get("version"),
  });
  // The intent picks the wording; it must agree with the change, or the
  // screen is not one this panel rendered.
  const intent = z
    .enum(["permissions", "deactivate", "reactivate"])
    .safeParse(form.get("intent"));
  if (
    !change.success ||
    !intent.success ||
    (intent.data === "deactivate" && change.data.active) ||
    (intent.data === "reactivate" && !change.data.active)
  )
    return refuse(staleScreen);
  const saved = await peopleEditor().setAccess(change.data);
  if (!saved.ok) return refuse(accessFailures[saved.reason]);
  publicDataChanged();
  return told(accessNotices[intent.data]);
}

/**
 * "Remove login" for a deactivated person (PR5a D-27 e, "manage people"
 * only): deletes their login account through the server-only inviter; the
 * access row goes with it (`on delete cascade`), the People entry and the
 * log stay. The login, its state and its version come from the database;
 * the typed name must match the People entry.
 */
export async function removeLoginAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(removeLoginWords.forbidden);
  const personId = z.uuid().safeParse(form.get("personId"));
  if (!personId.success) return refuse("Unknown person. Reload and try again.");
  const { person, unavailable } = await peopleEditor().readPerson(
    personId.data,
  );
  if (unavailable) return refuse(unavailableMessage("remove the login"));
  const access = person?.access;
  if (
    !person ||
    access?.state !== "deactivated" ||
    access.version !== form.get("version")
  )
    return refuse(staleScreen);
  const typed = String(form.get("confirmation") ?? "").trim();
  if (typed.toLowerCase() !== person.full_name.trim().toLowerCase())
    return refuse(removeLoginWords.wrongName);
  const removed = await accountInviter().deleteAccount(access.userId);
  if (!removed.ok)
    return refuse(
      removed.reason === "off"
        ? removeLoginWords.off
        : unavailableMessage("remove the login"),
    );
  publicDataChanged();
  redirect(`/admin/people/${person.id}?login=removed`);
}

/** Forgot password: always the same neutral answer (never reveals whether an account exists). */
export async function requestPasswordResetAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return refuse(email.error.issues[0].message);
  // Whatever the adapter says, the answer is the same (`resetRequested`).
  await adminAuth().requestPasswordReset(email.data, emailLinkTarget());
  return told(resetRequested);
}

/**
 * The **Continue** button on an invite or reset email link (D-25). Only this
 * POST uses the one-time token: mail scanners open links with GET before the
 * person does, and opening the page changes nothing. The token hash signs the
 * person in (the session cookie is set here), then they choose a password; a
 * used, expired or broken link goes back to sign-in with a message.
 */
export async function confirmEmailLinkAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const link = emailLinkSchema.safeParse({
    token_hash: form.get("token_hash"),
    type: form.get("type"),
  });
  const result = link.success
    ? await adminAuth().verifyEmailLink(link.data.token_hash, link.data.type)
    : "expired";
  redirect(result === "ok" ? "/admin/set-password" : "/admin?link=expired");
}

/**
 * Sets the signed-in person's own password after an invite or reset link,
 * then ends their other sessions (D-15). It changes only the session's own
 * password, so a deactivated person may still reset theirs; the dashboard
 * stays closed to them.
 */
export async function setPasswordAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return refuse(passwordHint);
  if (form.get("confirm") !== password.data)
    return refuse(
      "The two passwords are different. Type the same password in both boxes.",
    );
  const result = await adminAuth().setPassword(password.data);
  if (result === "weak") return refuse(passwordHint);
  if (result === "no-session") return refuse(expiredLink);
  if (result === "unavailable")
    return refuse(unavailableMessage("save your password"));
  return redirectSaved("/admin/dashboard", "password");
}
