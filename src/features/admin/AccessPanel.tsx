"use client";
import { useActionState, useState, type ReactNode } from "react";
import {
  changeEmailAction,
  inviteAction,
  removeLoginAction,
  resendInviteAction,
  setAccessAction,
} from "@/features/admin/access-actions";
import type { Access, AccessLock, AccessLocks } from "@/lib/community/people";
import {
  accessRefusals,
  accessStateLabels,
  changeEmailWords,
  initialEditorState,
  removeLoginWords,
} from "./fields";
import { FormMessages } from "./FormMessages";
import { ActionForm } from "./RecordActions";

type Login = Exclude<Access, { state: "none" }>;

const permissionHints = {
  canManagePeople:
    "Can invite people, change permissions and deactivate or reactivate logins.",
  // What "manage money" opens today (review follow-ups, 2026-10-07): Money
  // in and its download. Funds, tickets and merch are open to every board
  // member (Payments → Money in says so to the others).
  canManageMoney:
    "Can see Money in (the Go2Pay payments, with givers’ names and notes) and download it.",
} as const;

function statusLine(name: string, access: Access) {
  switch (access.state) {
    case "none":
      return `${name} has no login and cannot open the board dashboard.`;
    case "invited":
      return `Invited (${access.email ?? "email unknown"}). Waiting for them to choose a password.`;
    case "active":
      return `Login active (${access.email ?? "email unknown"}).`;
    case "deactivated":
      return `Login deactivated (${access.email ?? "email unknown"}). They cannot open the dashboard.`;
  }
}

/** Neither permission can be given here: the person is outside the Executive board and holds none. */
const outsideExecutive = (
  locks: Pick<AccessLocks, "managePeople" | "manageMoney">,
  current: { canManagePeople: boolean; canManageMoney: boolean },
) =>
  locks.managePeople === "not_executive" &&
  locks.manageMoney === "not_executive" &&
  !current.canManagePeople &&
  !current.canManageMoney;

/**
 * The two permission switches. A switch the guard would refuse (`lock`) is
 * shown but cannot be changed; a hidden field keeps its current value.
 */
function PermissionSwitches({
  current,
  managePeopleLock,
  manageMoneyLock,
}: {
  current: { canManagePeople: boolean; canManageMoney: boolean };
  managePeopleLock: AccessLock;
  manageMoneyLock: AccessLock;
}) {
  // Outside the Executive board nobody can hold either permission: no
  // boxes, one short line (review fixes P4: boxes only where they can be used).
  if (
    outsideExecutive(
      { managePeople: managePeopleLock, manageMoney: manageMoneyLock },
      current,
    )
  )
    return <p className="muted">{accessRefusals.not_executive}</p>;
  // One reason that locks both switches is said once, under the legend.
  const shared =
    managePeopleLock && managePeopleLock === manageMoneyLock
      ? managePeopleLock
      : null;
  return (
    <fieldset aria-describedby={shared ? "permissions-hint" : undefined}>
      <legend>Permissions</legend>
      {shared ? (
        <p id="permissions-hint" className="muted">
          {accessRefusals[shared]}
        </p>
      ) : null}
      {(["canManagePeople", "canManageMoney"] as const).map((name) => {
        const locked =
          name === "canManagePeople" ? managePeopleLock : manageMoneyLock;
        return (
          <div key={name}>
            <label className="check-label">
              <input
                type="checkbox"
                name={name}
                defaultChecked={current[name]}
                disabled={Boolean(locked)}
                aria-describedby={`${name}-hint`}
              />
              {name === "canManagePeople" ? "Manage people" : "Manage money"}
            </label>
            {locked && current[name] ? (
              <input type="hidden" name={name} value="on" />
            ) : null}
            <p id={`${name}-hint`} className="muted">
              {locked && !shared
                ? accessRefusals[locked]
                : permissionHints[name]}
            </p>
          </div>
        );
      })}
    </fieldset>
  );
}

/** The current permissions as hidden fields, for the (de)activate forms. */
function KeepPermissions({ login }: { login: Login }) {
  return (
    <>
      {login.canManagePeople ? (
        <input type="hidden" name="canManagePeople" value="on" />
      ) : null}
      {login.canManageMoney ? (
        <input type="hidden" name="canManageMoney" value="on" />
      ) : null}
    </>
  );
}

/**
 * "Remove login" for a deactivated login (PR5a D-27 e): the account is
 * deleted for good after the person's name is typed; the People entry and
 * the log stay. Shown to "manage people" holders only; the server checks.
 */
function RemoveLogin({
  personId,
  personName,
  version,
}: {
  personId: string;
  personName: string;
  version: string;
}) {
  return (
    <details>
      <summary>{removeLoginWords.summary}</summary>
      <p className="muted">{removeLoginWords.explain}</p>
      <ActionForm
        action={removeLoginAction}
        fields={{ personId, version }}
        label={removeLoginWords.button}
        pendingLabel="Removing…"
      >
        <label>
          {removeLoginWords.confirm(personName)}
          <input name="confirmation" required autoComplete="off" />
        </label>
      </ActionForm>
    </details>
  );
}

/**
 * "Change email" (review fixes P4): for "manage people" holders, on a
 * current person's login. An invited person gets the invite again at the
 * new address.
 */
function ChangeEmail({
  login,
  target,
  action,
  pending,
  changing,
  onSubmit,
}: {
  login: Login;
  target: ReactNode;
  action: (form: FormData) => void;
  pending: boolean;
  changing: boolean;
  onSubmit: () => void;
}) {
  return (
    <details>
      <summary>{changeEmailWords.summary}</summary>
      <form action={action} className="editor-form" onSubmit={onSubmit}>
        {target}
        <input type="hidden" name="version" value={login.version} />
        <label>
          {changeEmailWords.label}
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            aria-describedby="change-email-hint"
          />
        </label>
        <p id="change-email-hint" className="muted">
          {login.state === "invited"
            ? changeEmailWords.explainInvited
            : changeEmailWords.explain}
        </p>
        <div>
          <button className="button-secondary" disabled={pending}>
            {changing ? "Saving…" : changeEmailWords.button}
          </button>
        </div>
      </form>
    </details>
  );
}

/**
 * The login of an archived person: it stays off until the person is restored
 * (D-19). Reactivate is shown but cannot be used; the server refuses it too.
 */
function ArchivedLogin({
  login,
  target,
  onSubmit,
  action,
  removeLogin,
}: {
  login: Login | null;
  target: ReactNode;
  onSubmit: () => void;
  action: (form: FormData) => void;
  /** "Remove login" for this deactivated login. */
  removeLogin: ReactNode;
}) {
  if (login?.state !== "deactivated")
    return <p className="muted">{accessRefusals.person_archived}</p>;
  return (
    <>
      <form action={action} className="editor-form" onSubmit={onSubmit}>
        {target}
        <input type="hidden" name="version" value={login.version} />
        <input type="hidden" name="active" value="true" />
        <input type="hidden" name="intent" value="reactivate" />
        <KeepPermissions login={login} />
        <p className="muted">{accessRefusals.person_archived}</p>
        <button className="button-secondary" disabled>
          Reactivate login
        </button>
      </form>
      {removeLogin}
    </>
  );
}

/**
 * A person's dashboard login (PR3 contract, WP-D): invite, resend, the two
 * permissions, deactivate and reactivate. Only "manage people" holders get
 * the controls; the database guard decides every change, and `locks` only
 * mirrors it so a refused control is disabled with its reason.
 */
export function AccessPanel({
  personId,
  personName,
  access,
  canManage,
  locks,
  archived,
}: {
  personId: string;
  personName: string;
  access: Access;
  /** The signed-in board member holds "manage people". */
  canManage: boolean;
  locks: AccessLocks;
  /** The person is archived: their login stays off until they are restored (D-19). */
  archived: boolean;
}) {
  const [invited, invite, inviting] = useActionState(
    inviteAction,
    initialEditorState,
  );
  const [resent, resend, resending] = useActionState(
    resendInviteAction,
    initialEditorState,
  );
  const [changed, change, changing] = useActionState(
    setAccessAction,
    initialEditorState,
  );
  const [emailed, changeEmail, changingEmail] = useActionState(
    changeEmailAction,
    initialEditorState,
  );
  // The panel stays mounted when the page refreshes after a change, so the
  // answer to the last form sent stays visible.
  const [last, setLast] = useState<
    "invite" | "resend" | "change" | "email" | null
  >(null);
  const answer =
    last === "invite"
      ? invited
      : last === "resend"
        ? resent
        : last === "change"
          ? changed
          : last === "email"
            ? emailed
            : initialEditorState;
  const pending = inviting || resending || changing || changingEmail;
  const target = <input type="hidden" name="personId" value={personId} />;
  const login = access.state === "none" ? null : access;
  const removeLogin =
    login?.state === "deactivated" ? (
      <RemoveLogin
        personId={personId}
        personName={personName}
        version={login.version}
      />
    ) : null;
  return (
    <section className="content-card" aria-labelledby="access-heading">
      <h2 id="access-heading">Dashboard login</h2>
      <p>{statusLine(personName, access)}</p>
      {login ? (
        <p className="admin-badges">
          <span className="admin-badge">{accessStateLabels[login.state]}</span>
          {login.canManagePeople ? (
            <span className="admin-badge">Manage people</span>
          ) : null}
          {login.canManageMoney ? (
            <span className="admin-badge">Manage money</span>
          ) : null}
        </p>
      ) : null}
      <FormMessages error={answer.error} notice={answer.notice} />
      {!canManage ? (
        <p className="muted">{accessRefusals.forbidden}</p>
      ) : archived ? (
        <ArchivedLogin
          login={login}
          target={target}
          onSubmit={() => setLast("change")}
          action={change}
          removeLogin={removeLogin}
        />
      ) : !login ? (
        <form
          action={invite}
          className="editor-form"
          onSubmit={() => setLast("invite")}
        >
          {target}
          <label>
            Email for the invite
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
            />
          </label>
          <PermissionSwitches
            current={{ canManagePeople: false, canManageMoney: false }}
            managePeopleLock={locks.managePeople}
            manageMoneyLock={locks.manageMoney}
          />
          <p className="muted">
            They get an email with a link to choose their own password. The link
            works once and expires in 24 hours.
          </p>
          <button className="button-primary" disabled={pending}>
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
      ) : (
        <>
          {outsideExecutive(locks, login) ? (
            <p className="muted">{accessRefusals.not_executive}</p>
          ) : (
            <form
              key={login.version}
              action={change}
              className="editor-form"
              onSubmit={() => setLast("change")}
            >
              {target}
              <input type="hidden" name="version" value={login.version} />
              <input
                type="hidden"
                name="active"
                value={String(login.state !== "deactivated")}
              />
              <input type="hidden" name="intent" value="permissions" />
              <PermissionSwitches
                current={login}
                managePeopleLock={locks.managePeople}
                manageMoneyLock={locks.manageMoney}
              />
              <button className="button-secondary" disabled={pending}>
                {changing ? "Saving…" : "Save permissions"}
              </button>
            </form>
          )}
          <ChangeEmail
            key={`email-${login.version}-${login.email}`}
            login={login}
            target={target}
            action={changeEmail}
            pending={pending}
            changing={changingEmail}
            onSubmit={() => setLast("email")}
          />
          {login.state === "invited" ? (
            <form
              action={resend}
              className="editor-form"
              onSubmit={() => setLast("resend")}
            >
              {target}
              <p className="muted">
                No email arrived, or the link expired? Send a new link.
              </p>
              <button className="button-secondary" disabled={pending}>
                {resending ? "Sending…" : "Send the invite again"}
              </button>
            </form>
          ) : null}
          {login.state === "deactivated" ? (
            <>
              <form
                action={change}
                className="editor-form"
                onSubmit={() => setLast("change")}
              >
                {target}
                <input type="hidden" name="version" value={login.version} />
                <input type="hidden" name="active" value="true" />
                <input type="hidden" name="intent" value="reactivate" />
                <KeepPermissions login={login} />
                <p className="muted">
                  They can sign in again with their existing password. No new
                  invite is needed.
                </p>
                <button className="button-secondary" disabled={pending}>
                  {changing ? "Saving…" : "Reactivate login"}
                </button>
              </form>
              {removeLogin}
            </>
          ) : (
            <details>
              <summary>Deactivate login</summary>
              <p className="muted">
                They are signed out on every device at once and can no longer
                open the dashboard. Their People entry stays as it is. You can
                reactivate the login later.
              </p>
              <form
                action={change}
                className="editor-form"
                onSubmit={() => setLast("change")}
              >
                {target}
                <input type="hidden" name="version" value={login.version} />
                <input type="hidden" name="active" value="false" />
                <input type="hidden" name="intent" value="deactivate" />
                <KeepPermissions login={login} />
                {locks.deactivate ? (
                  <p className="muted">{accessRefusals[locks.deactivate]}</p>
                ) : null}
                <button
                  className="button-secondary"
                  disabled={pending || Boolean(locks.deactivate)}
                >
                  {changing ? "Saving…" : "Deactivate login"}
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
