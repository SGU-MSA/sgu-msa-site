import Link from "next/link";
import {
  listAdminLogins,
  listAdminPeople,
  listAdminSteps,
} from "@/lib/backend/admin-content";
import type {
  VersionedLogin,
  VersionedPerson,
} from "@/lib/backend/providers/contract";
import { handoverProgress } from "@/lib/community/handover";
import { formerMember } from "@/lib/community/activity";
import { dayLabel } from "@/lib/time/date-label";
import { AdminHeader } from "@/features/admin/AdminHeader";
import { ActionForm } from "@/features/admin/RecordActions";
import { ArchivedRow } from "@/features/admin/ArchiveActions";
import { StepChecklist } from "@/features/admin/handover/StepChecklist";
import { checklistStep } from "@/features/admin/handover/pages";
import {
  restoreSharedLoginAction,
  startNewTermAction,
} from "@/features/admin/handover/handover-actions";
import { boardPage } from "@/features/admin/page-state/board-page";

/** A holder's People name, with their role on the first column (mockup `handover`). */
function holderName(
  id: string,
  people: ReadonlyMap<string, VersionedPerson>,
  withRole: boolean,
) {
  if (!id) return "—";
  const person = people.get(id);
  // Not in People: deleted since (or People could not be loaded, which the
  // page says).
  if (!person) return people.size ? formerMember : "—";
  return withRole && person.role_title
    ? `${person.full_name} (${person.role_title})`
    : person.full_name;
}

function LoginRows({
  logins,
  people,
}: {
  logins: readonly VersionedLogin[];
  people: ReadonlyMap<string, VersionedPerson>;
}) {
  return (
    <table className="login-table">
      <thead>
        <tr>
          <th scope="col">Account</th>
          <th scope="col">Holder</th>
          <th scope="col">2-step phone</th>
          <th scope="col">Last changed</th>
        </tr>
      </thead>
      <tbody>
        {logins.map((login) => (
          <tr key={login.id}>
            <th scope="row">
              <Link
                className="text-link"
                href={`/admin/handover/logins/${login.id}`}
              >
                {login.service}
                <span className="sr-only"> (edit)</span>
              </Link>
              {login.note ? (
                <span className="muted login-note">{login.note}</span>
              ) : null}
            </th>
            <td data-label="Holder:">
              {holderName(login.holder_person_id, people, true)}
            </td>
            <td data-label="2-step phone:">
              {holderName(login.second_factor_person_id, people, false)}
            </td>
            <td data-label="Last changed:">
              {login.last_changed_on ? (
                <time dateTime={login.last_changed_on}>
                  {dayLabel(login.last_changed_on)}
                </time>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const notices: Record<string, string> = {
  archived: "Account archived. Find it under Archived accounts.",
  restored: "Account restored.",
};

/**
 * New board term (PR5a D-5, D-27 d; mockup `handover`): the hand-over
 * checklist any board member ticks and edits, "Start a new term", who holds
 * each shared login (names only), and the warning when fewer than two people
 * can manage people.
 */
async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [steps, logins, archivedLogins, current, archivedPeople] =
    await Promise.all([
      listAdminSteps(),
      listAdminLogins(),
      listAdminLogins("archived"),
      listAdminPeople(),
      listAdminPeople("archived"),
    ]);
  const people = new Map(
    [...current.people, ...archivedPeople.people].map(
      (person) => [person.id, person] as const,
    ),
  );
  const progress = handoverProgress(steps.steps);
  const loginNotice =
    typeof query.login === "string" ? notices[query.login] : undefined;
  return (
    <div className="admin-shell">
      <AdminHeader title="New board term" tour="handover" />
      {query.started ? (
        <p role="status" className="success-message">
          New term started. Every tick is cleared; the steps and the shared
          logins stay.
        </p>
      ) : null}
      {loginNotice ? (
        <p role="status" className="success-message">
          {loginNotice}
        </p>
      ) : null}
      <div className="handover-layout">
        <section aria-labelledby="checklist">
          <h2 id="checklist" className="sr-only">
            Checklist
          </h2>
          {steps.unavailable ? (
            <p role="alert" className="content-card">
              The checklist could not be loaded. Check your connection and
              reload.
            </p>
          ) : (
            <>
              <div className="handover-progress">
                <p data-tour="handover-progress">
                  {progress.done} of {progress.total} done
                </p>
                <details className="handover-new-term">
                  <summary data-tour="handover-new-term">
                    Start a new term…
                  </summary>
                  <p className="muted">
                    Clears every tick, so the new board starts the checklist
                    from the top. The steps and the shared logins stay, and
                    Recent changes keeps who ticked what.
                  </p>
                  <ActionForm
                    action={startNewTermAction}
                    fields={{}}
                    label="Start a new term"
                    pendingLabel="Starting…"
                  />
                </details>
              </div>
              {steps.steps.length ? (
                <StepChecklist steps={steps.steps.map(checklistStep)} />
              ) : (
                <p className="content-card">No steps yet.</p>
              )}
              <p className="admin-actions handover-edit">
                <Link
                  className="button-secondary"
                  href="/admin/handover/steps"
                  data-tour="handover-edit"
                >
                  Edit the steps
                </Link>
                <span className="muted">
                  Add, reword, reorder or archive steps. Every tick and change
                  is in Recent changes.
                </span>
              </p>
            </>
          )}
        </section>
        <section
          className="content-card"
          id="logins"
          aria-labelledby="logins-heading"
          data-tour="handover-logins"
        >
          <h2 id="logins-heading">Who holds each shared login</h2>
          <p>Names only. Never passwords or codes.</p>
          {logins.unavailable ? (
            <p role="alert">
              The shared logins could not be loaded. Check your connection and
              reload.
            </p>
          ) : logins.logins.length ? (
            <>
              {current.unavailable || archivedPeople.unavailable ? (
                <p role="status">
                  Names could not be loaded. Reload to try again.
                </p>
              ) : null}
              <LoginRows
                logins={logins.logins}
                people={
                  current.unavailable || archivedPeople.unavailable
                    ? new Map()
                    : people
                }
              />
            </>
          ) : (
            <p>No shared logins listed yet.</p>
          )}
          <p className="admin-actions">
            <Link
              className="button-secondary"
              href="/admin/handover/logins/new"
            >
              + Add an account
            </Link>
          </p>
          <p>
            Holders are picked from People, so no new personal data is stored.
          </p>
          {archivedLogins.logins.length ? (
            <details>
              <summary>
                Archived accounts ({archivedLogins.logins.length})
              </summary>
              <ul className="admin-list">
                {archivedLogins.logins.map((login) => (
                  <ArchivedRow
                    key={login.id}
                    name={login.service}
                    heading="h3"
                    view={`/admin/handover/logins/${login.id}`}
                    fields={{ id: login.id, version: login.updated_at }}
                    restore={{ action: restoreSharedLoginAction }}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default boardPage(HandoverPage);
