"use client";
import { useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { savePersonAction } from "@/features/admin/people-actions";
import {
  EXECUTIVE_ROLES,
  isExecutiveRole,
  type Person,
  type PermanentGroup,
  type RoleHolder,
} from "@/lib/community/people";
import { systemText } from "@/lib/system-text";
import {
  executiveMoveRefusals,
  leavingExecutive,
  roleTakenWords,
  teamListWords,
} from "./fields";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems, withProblems } from "./form-check/problems";
import { initialKeptForm, typedValues } from "./form-state";
import { ImageField } from "./ImageField";
import { anyPhotoName, personFromForm } from "./person-form";

type Values = Partial<Record<string, string>>;

/** The access guard's refusal of a move out of the Executive board. */
export type MoveOutRefusal = "self" | "last_manager" | null;

/** A group as the form offers it. */
type GroupChoice = {
  id: string;
  name: string;
  shownByDefault: boolean;
  /** The permanent Executive board or General board; null for the board's own. */
  kind: PermanentGroup | null;
};

/**
 * "Show on public page" for a new person in `groupId`: the group's start
 * answer (ticked unless the board changed it on Edit groups).
 */
const startAnswer = (
  groups: readonly GroupChoice[],
  groupId: string | undefined,
) => groups.find((choice) => choice.id === groupId)?.shownByDefault ?? true;

/** The stored entry as form text; a new person starts with nothing chosen. */
function valuesOf(person: Person | null): Values {
  if (!person) return {};
  return {
    full_name: person.full_name,
    role_title: person.role_title,
    section_id: person.section_id,
    show_on_public: person.show_on_public ? "yes" : "no",
    // A saved person's answer is the board's own; it never follows the group.
    show_on_public_chosen: "yes",
  };
}

/**
 * "Omar Haddad is President. Make <name> President instead?" (user,
 * 2026-10-06: one current person per Executive board role), under Role when
 * the chosen role is taken. Yes keeps the role: the save then moves the
 * holder to the General board in the same step. Cancel puts the role back.
 * When the holder cannot be moved (it is you, they are the last person who
 * can manage people, or you cannot manage people) only the reason and
 * Cancel are shown.
 */
function RoleQuestion({
  holder,
  name,
  canManagePeople,
  onYes,
  onCancel,
}: {
  holder: RoleHolder;
  /** The Name box as typed. */
  name: string;
  canManagePeople: boolean;
  onYes: () => void;
  onCancel: () => void;
}) {
  const blocked = !canManagePeople
    ? roleTakenWords.forbidden
    : holder.stays === "self"
      ? roleTakenWords.self
      : holder.stays === "last_manager"
        ? roleTakenWords.last_manager(holder.name)
        : null;
  return (
    <div
      className="role-question"
      role="group"
      aria-labelledby="role-question-text"
    >
      <p id="role-question-text">
        <strong>
          {blocked
            ? roleTakenWords.taken(holder.name, holder.role)
            : roleTakenWords.question(holder.name, holder.role, name.trim())}
        </strong>
      </p>
      <p className="muted">{blocked ?? roleTakenWords.explain(holder.name)}</p>
      <input
        type="hidden"
        name="role_question"
        value={blocked ? "blocked" : "open"}
      />
      <div className="admin-actions">
        {blocked ? null : (
          <button
            type="button"
            id="role-question-yes"
            className="button-primary"
            onClick={onYes}
          >
            {roleTakenWords.yes}
          </button>
        )}
        <button
          type="button"
          id="role-question-cancel"
          className="button-secondary"
          onClick={onCancel}
        >
          {roleTakenWords.cancel}
        </button>
      </div>
      {/* Shown at Save while unanswered; Save then moves to the first button. */}
      <FieldError
        name="role_question"
        controls={blocked ? ["role-question-cancel"] : ["role-question-yes"]}
      />
    </div>
  );
}

function PersonFields({
  personId,
  values,
  groups,
  roleTitles,
  roleHolders,
  hasPhoto,
  onShrinking,
  stored,
  canManagePeople,
  holdsPermissions,
  moveOutRefusal,
}: {
  personId: string;
  values: Values;
  groups: readonly GroupChoice[];
  /** Suggestions for "Role title"; any other title can be typed. */
  roleTitles: readonly string[];
  /** Who holds each Executive board role now. */
  roleHolders: readonly RoleHolder[];
  hasPhoto: boolean;
  /** The photo box is making a chosen photo smaller (`ImageField`). */
  onShrinking: (shrinking: boolean) => void;
  /** The saved group and role; null for a new person. */
  stored: { sectionId: string; role: string } | null;
  /** The signed-in board member can manage people: only they move people into or out of the Executive board. */
  canManagePeople: boolean;
  /** This person's login holds "manage people" or "manage money". */
  holdsPermissions: boolean;
  /** Why moving this person out of the Executive board would be refused (the access guard), or null. */
  moveOutRefusal: MoveOutRefusal;
}) {
  const executiveId =
    groups.find((group) => group.kind === "executive")?.id ?? null;
  // Without "manage people", the Executive board and its roles stay as they
  // are (the server and the database refuse it too, SGU15).
  const lockedIn =
    !canManagePeople && Boolean(stored) && stored?.sectionId === executiveId;
  // A group archived since this entry was saved is never chosen silently.
  const groupGone = Boolean(
    values.section_id && !groups.some((g) => g.id === values.section_id),
  );
  const [groupId, setGroupId] = useState(
    lockedIn && stored
      ? stored.sectionId
      : groupGone
        ? ""
        : (values.section_id ?? ""),
  );
  const [role, setRole] = useState(
    lockedIn && stored ? stored.role : (values.role_title ?? ""),
  );
  const leaving =
    canManagePeople &&
    holdsPermissions &&
    stored?.sectionId === executiveId &&
    groupId !== executiveId;
  // What Cancel on the role question puts back.
  const [roleBefore, setRoleBefore] = useState("");
  const [name, setName] = useState(values.full_name ?? "");
  // In the Executive board the role is one of its five, from a list (review 2).
  const executive =
    groups.find((group) => group.id === groupId)?.kind === "executive";
  // One current person per role (2026-10-06): who holds the chosen one, and
  // whether Yes was answered for them (kept through a refused save).
  const holder = executive
    ? roleHolders.find((held) => held.role === role && held.id !== personId)
    : undefined;
  const [yesFor, setYesFor] = useState(values.replace_holder ?? "");
  const replacing = holder && yesFor === holder.id ? holder : undefined;
  const roleBox = useRef<HTMLSelectElement>(null);
  const confirmedLine = useRef<HTMLParagraphElement>(null);
  // Kept through a refused save, so a pre-filled box still follows the
  // group until the board ticks or unticks it.
  const [answered, setAnswered] = useState(
    values.show_on_public_chosen === "yes",
  );
  // A new person's box starts as their group's (ticked by default); it
  // follows the group until the board ticks or unticks it itself.
  const [shown, setShown] = useState(
    answered
      ? values.show_on_public === "yes"
      : startAnswer(groups, values.section_id),
  );
  // Photos are for the Executive board only (user, 2026-10-07).
  const photoGoes = hasPhoto && !executive && stored?.sectionId === executiveId;
  return (
    <>
      <label>
        Name
        <input
          name="full_name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values.full_name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FieldError name="full_name" />
      </label>
      <label>
        Group
        {lockedIn ? (
          <input type="hidden" name="section_id" value={groupId} />
        ) : null}
        <select
          name={lockedIn ? undefined : "section_id"}
          required
          disabled={lockedIn}
          aria-describedby={
            !canManagePeople ? "group-executive-hint" : undefined
          }
          value={groupId}
          onChange={(event) => {
            const chosen = event.currentTarget.value;
            setGroupId(chosen);
            if (!answered) setShown(startAnswer(groups, chosen));
          }}
        >
          <option value="" disabled>
            Choose a group
          </option>
          {groups.map((group) => (
            <option
              key={group.id}
              value={group.id}
              disabled={
                !canManagePeople &&
                group.id === executiveId &&
                groupId !== executiveId
              }
            >
              {group.name}
            </option>
          ))}
        </select>
        <FieldError name="section_id" />
      </label>
      {groupGone ? (
        <p className="muted">
          This person&apos;s group was archived; choose a new one.
        </p>
      ) : null}
      {!canManagePeople ? (
        <p id="group-executive-hint" className="muted">
          {systemText.sguCodes.SGU15}
        </p>
      ) : null}
      {leaving ? (
        <p className="muted" role="status">
          {moveOutRefusal
            ? executiveMoveRefusals[moveOutRefusal]
            : leavingExecutive}
        </p>
      ) : null}
      {executive ? (
        <label>
          Role
          {lockedIn ? (
            <input type="hidden" name="role_title" value={role} />
          ) : null}
          <select
            ref={roleBox}
            name={lockedIn ? undefined : "role_title"}
            required
            disabled={lockedIn}
            value={isExecutiveRole(role) ? role : ""}
            onChange={(event) => {
              setRoleBefore(role);
              setRole(event.currentTarget.value);
            }}
          >
            <option value="" disabled>
              Choose a role
            </option>
            {EXECUTIVE_ROLES.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
          <FieldError name="role_title" />
        </label>
      ) : (
        <label>
          Role title (optional)
          <input
            name="role_title"
            maxLength={120}
            autoComplete="off"
            list="role-title-suggestions"
            value={role}
            onChange={(event) => setRole(event.currentTarget.value)}
          />
          <datalist id="role-title-suggestions">
            {roleTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
          <FieldError name="role_title" />
        </label>
      )}
      {holder && !replacing ? (
        <RoleQuestion
          holder={holder}
          name={name}
          canManagePeople={canManagePeople}
          onYes={() => {
            flushSync(() => setYesFor(holder.id));
            confirmedLine.current?.focus();
          }}
          onCancel={() => {
            setRole(roleBefore);
            roleBox.current?.focus();
          }}
        />
      ) : null}
      {replacing ? (
        <p
          ref={confirmedLine}
          tabIndex={-1}
          role="status"
          className="role-question-done"
        >
          {roleTakenWords.confirmed(replacing.name, replacing.role)}
          <input type="hidden" name="replace_holder" value={replacing.id} />
          <input
            type="hidden"
            name="replace_version"
            value={replacing.version}
          />
        </p>
      ) : null}
      <input
        type="hidden"
        name="show_on_public_chosen"
        value={answered ? "yes" : ""}
      />
      {executive ? (
        <>
          {/* The Executive board is always on About (user, 2026-10-07). */}
          <input type="hidden" name="show_on_public" value="yes" />
          <p className="muted">{teamListWords.executiveListed}</p>
          <fieldset>
            <legend>Photo (optional)</legend>
            {hasPhoto ? null : (
              <p className="nudge-note">{teamListWords.addPhoto}</p>
            )}
            <ImageField
              label="Photo"
              attached={hasPhoto}
              onShrinking={onShrinking}
              // A photo chosen from the uploaded ones (photo library).
              pick={{ field: "photo_pick" }}
            />
            <p className="muted">{teamListWords.photoHint}</p>
            <FieldError name="image" />
          </fieldset>
        </>
      ) : (
        <>
          <div>
            <label className="check-label">
              <input
                type="checkbox"
                name="show_on_public"
                value="yes"
                checked={shown}
                aria-describedby="show-on-public-hint"
                onChange={(event) => {
                  setShown(event.currentTarget.checked);
                  setAnswered(true);
                }}
              />
              {teamListWords.showLabel}
            </label>
            <p id="show-on-public-hint" className="muted">
              {teamListWords.showHint}
            </p>
            <FieldError name="show_on_public" />
          </div>
          {photoGoes ? (
            <p className="muted" role="status">
              {teamListWords.photoGoes}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * Adds or edits a People entry. "Show on public page?" starts as the chosen
 * group's start answer for a new person (review fixes PR-2). In the Executive
 * board the role is picked from its five (review 2); the server and the
 * database check it again. Only a board member who can manage people moves
 * someone into or out of the Executive board or changes an executive's role
 * (2026-10-06): for the others those choices are shown but locked. Each role
 * has one current holder (2026-10-06): a taken role asks "Make <name> <role>
 * instead?" under Role, and Yes hands it over in the same save. The order is
 * set by dragging on the People list:
 * a new person, or one moved to another group, goes last in that group (the
 * Executive board is listed by role).
 */
export function PersonEditor({
  id,
  person,
  version,
  groups,
  roleTitles,
  roleHolders,
  canManagePeople,
  holdsPermissions,
  moveOutRefusal,
}: {
  id: string;
  person: Person | null;
  /** The entry's `updated_at`; null for a new person. */
  version: string | null;
  groups: readonly GroupChoice[];
  roleTitles: readonly string[];
  /** Who holds each Executive board role now (`roleHolders`). */
  roleHolders: readonly RoleHolder[];
  /** The signed-in board member can manage people (Executive board moves, 2026-10-06). */
  canManagePeople: boolean;
  /** This person's login holds "manage people" or "manage money". */
  holdsPermissions: boolean;
  /** Why moving this person out of the Executive board would be refused, or null. */
  moveOutRefusal: MoveOutRefusal;
}) {
  const [state, action, pending] = useActionState(
    savePersonAction,
    initialKeptForm,
  );
  // Save waits, quietly disabled, while a chosen photo is made smaller.
  const [shrinking, setShrinking] = useState(false);
  // The save's own rules (`personFromForm`), as you type.
  const check = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const photo = data.get("image");
    const chosen =
      (photo instanceof File && photo.size > 0) ||
      Boolean(data.get("photo_pick"));
    const result = personFromForm(typedValues(data), {
      position: 0,
      photoPath: chosen || person?.photo_path ? anyPhotoName : "",
      executiveGroupId:
        groups.find((group) => group.kind === "executive")?.id ?? null,
    });
    const problems = result.ok ? noProblems : result.fields;
    // The role question under Role is answered before saving (2026-10-06);
    // its line is in the question, not on Role, so choosing a role is not
    // marked wrong before the question could be answered.
    const question = data.get("role_question");
    return question
      ? withProblems(problems, {
          role_question:
            question === "open"
              ? roleTakenWords.answer
              : roleTakenWords.chooseAnother,
        })
      : problems;
  };
  return (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version ?? ""} />
      <PersonFields
        key={state.attempt}
        personId={id}
        values={state.values ?? valuesOf(person)}
        groups={groups}
        roleTitles={roleTitles}
        roleHolders={roleHolders}
        canManagePeople={canManagePeople}
        hasPhoto={Boolean(person?.photo_path)}
        onShrinking={setShrinking}
        stored={
          person
            ? { sectionId: person.section_id, role: person.role_title }
            : null
        }
        holdsPermissions={holdsPermissions}
        moveOutRefusal={moveOutRefusal}
      />
      <button className="button-primary" disabled={pending || shrinking}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </CheckedForm>
  );
}
