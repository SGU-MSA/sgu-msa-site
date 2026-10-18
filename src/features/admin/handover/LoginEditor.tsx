"use client";
import { useActionState } from "react";
import { CheckedForm } from "../form-check/CheckedForm";
import { FieldError } from "../form-check/FieldError";
import { ArchiveActions } from "../ArchiveActions";
import { initialKeptForm, typedValues } from "../form-state";
import { loginFromForm, problemsIn } from "./handover-forms";
import {
  archiveSharedLoginAction,
  restoreSharedLoginAction,
  saveSharedLoginAction,
} from "./handover-actions";
import { DateField } from "@/shared/ui/DateField";
import { dayRange } from "@/lib/time/field-rules";

/** A person the holder boxes offer: current People, plus a holder archived since. */
export type HolderChoice = { id: string; name: string };

/** A shared login as its form starts. */
export type EditableLogin = {
  id: string;
  service: string;
  holder_person_id: string;
  second_factor_person_id: string;
  last_changed_on: string;
  note: string;
  /** The row's `updated_at`; null for a new account. */
  version: string | null;
};

const neverSecrets = "Never write passwords or codes here.";

function HolderSelect({
  name,
  label,
  value,
  people,
}: {
  name: string;
  label: string;
  value: string;
  people: readonly HolderChoice[];
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">Nobody yet</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      <FieldError name={name} />
    </label>
  );
}

/**
 * Who holds one shared login (PR5a D-5, mockup `handover`): the account, a
 * holder and a 2-step phone holder chosen from People, the day the password
 * was last changed and a short note. No box takes a password or a code.
 */
export function LoginEditor({
  login,
  people,
  today,
}: {
  login: EditableLogin;
  people: readonly HolderChoice[];
  /** Today in Grenada (`YYYY-MM-DD`): the latest "Last changed" day. */
  today: string;
}) {
  // The login's own rules, as you type.
  const checkLogin = problemsIn((values) => loginFromForm(values, today));
  const [state, action, pending] = useActionState(
    saveSharedLoginAction,
    initialKeptForm,
  );
  const { version, ...saved } = login;
  const values: Partial<Record<string, string>> = state.values ?? saved;
  return (
    <>
      <CheckedForm
        action={action}
        state={state}
        check={(form) => checkLogin(typedValues(new FormData(form)))}
        className="editor-form"
        key={state.attempt}
      >
        <input type="hidden" name="id" value={login.id} />
        <input type="hidden" name="version" value={version ?? ""} />
        <label>
          Account
          <input
            name="service"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="MSA Gmail"
            defaultValue={values.service}
          />
          <FieldError name="service" />
          <span className="muted">The service only. {neverSecrets}</span>
        </label>
        <div className="form-grid">
          <HolderSelect
            name="holder_person_id"
            label="Holder"
            value={values.holder_person_id ?? ""}
            people={people}
          />
          <HolderSelect
            name="second_factor_person_id"
            label="2-step phone"
            value={values.second_factor_person_id ?? ""}
            people={people}
          />
        </div>
        <p className="muted">
          Holders are picked from People, so no new personal data is stored.
        </p>
        <label>
          Last changed (optional)
          <DateField
            name="last_changed_on"
            // A password change has happened already: no later day.
            rule={dayRange({ until: today })}
            defaultValue={values.last_changed_on}
          />
          <FieldError name="last_changed_on" />
          <span className="muted">The day the password was last changed.</span>
        </label>
        <label>
          Note (optional)
          <textarea
            name="note"
            rows={2}
            maxLength={200}
            placeholder="The recovery email is the MSA Gmail."
            defaultValue={values.note}
          />
          <FieldError name="note" />
          <span className="muted">{neverSecrets}</span>
        </label>
        <button className="button-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </CheckedForm>
      {version ? (
        <ArchiveActions
          archived={false}
          fields={{ id: login.id, version }}
          archive={{
            action: archiveSharedLoginAction,
            summary: "Archive this account",
            label: "Archive account",
            explain:
              "It leaves the list of shared logins. You can restore it later under Archived accounts.",
          }}
          restore={{ action: restoreSharedLoginAction }}
        />
      ) : null}
    </>
  );
}
