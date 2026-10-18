"use client";
import { useActionState } from "react";
import {
  archiveSectionAction,
  deleteSectionAction,
  restoreSectionAction,
  saveSectionAction,
} from "@/features/admin/people-actions";
import type { PermanentGroup } from "@/lib/community/people";
import { systemText } from "@/lib/system-text";
import { CheckedForm } from "./form-check/CheckedForm";
import { FieldError } from "./form-check/FieldError";
import { noProblems } from "./form-check/problems";
import { initialKeptForm, typedValues } from "./form-state";
import { ArchiveActions, ArchivedRow } from "./ArchiveActions";
import { groupNotEmpty, teamListWords } from "./fields";
import { OrderedList } from "./OrderedList";
import { sectionFromForm } from "./person-form";

type EditableGroup = {
  id: string;
  name: string;
  /** What "Show on public page?" starts as for a new person here. */
  shownByDefault: boolean;
  /** The permanent Executive board or General board; null for the board's own. */
  kind: PermanentGroup | null;
  /** The group's `updated_at`. */
  version: string;
};

type ArchivedGroup = EditableGroup & {
  /** How many People entries, archived or not, are still in it. */
  people: number;
};

/**
 * Name of one group and its start answer for new people; also adds a new
 * one. A permanent group keeps its name (review 2): only its start answer is
 * changed here. The order is set by dragging the groups (review fixes PR-2).
 */
function GroupForm({
  group,
  submitLabel,
}: {
  group: EditableGroup | { id: string; version: null };
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(
    saveSectionAction,
    initialKeptForm,
  );
  const saved = "name" in group ? group : null;
  const values: Partial<Record<string, string>> = state.values ?? {
    name: saved?.name,
    // A new group's people start shown (review fixes P4).
    shown_by_default: !saved || saved.shownByDefault ? "on" : "",
  };
  return (
    <CheckedForm
      action={action}
      state={state}
      check={(form) => {
        // The order number is the server's.
        const result = sectionFromForm(typedValues(new FormData(form)), 0);
        return result.ok ? noProblems : result.fields;
      }}
      className="editor-form"
      key={state.attempt}
    >
      <input type="hidden" name="id" value={group.id} />
      <input type="hidden" name="version" value={group.version ?? ""} />
      {saved?.kind ? (
        <>
          <input type="hidden" name="name" value={saved.name} />
          <p className="muted">
            This group is always kept: it cannot be renamed or archived.
          </p>
        </>
      ) : (
        <label>
          Group name
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            defaultValue={values.name}
          />
          <FieldError name="name" />
        </label>
      )}
      {saved?.kind === "executive" ? (
        <>
          {/* Always on About (review fixes P4): the start answer is unused. */}
          {values.shown_by_default === "on" ? (
            <input type="hidden" name="shown_by_default" value="on" />
          ) : null}
          <p className="muted">{teamListWords.executiveListed}</p>
        </>
      ) : (
        <label className="check-label">
          <input
            type="checkbox"
            name="shown_by_default"
            defaultChecked={values.shown_by_default === "on"}
          />
          New people in this group start with “Show on public page” ticked
        </label>
      )}
      <button className="button-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </CheckedForm>
  );
}

/** Archive: a board group's other control (only an empty one, D-22). */
function ArchiveGroup({ group }: { group: EditableGroup }) {
  return (
    <ArchiveActions
      archived={false}
      layout="row"
      itemName={group.name}
      fields={{ id: group.id, version: group.version }}
      archive={{
        action: archiveSectionAction,
        initial: initialKeptForm,
        summary: "Archive this group",
        label: "Archive group",
        explain:
          "Only a group with nobody in it can be archived. It disappears from People and from the public team list. You can restore it later under Archived groups.",
      }}
      restore={{ action: restoreSectionAction, initial: initialKeptForm }}
    />
  );
}

/**
 * Rename, reorder (by dragging, review fixes PR-2), archive, restore and
 * delete team groups (D-7, D-22, review 2), and add new ones. The Executive
 * board and the General board are always kept.
 */
export function GroupsEditor({
  groups,
  archived,
  newId,
  canDelete,
}: {
  groups: EditableGroup[];
  archived: ArchivedGroup[];
  newId: string;
  /** The signed-in board member holds "manage people" (a UX mirror). */
  canDelete: boolean;
}) {
  return (
    <>
      <p className="muted">{systemText.order.hint}</p>
      <OrderedList
        list="people_sections"
        label="Team groups"
        look="cards"
        rows={groups.map((group) => ({
          id: group.id,
          version: group.version,
          name: group.name,
          content: (
            <section aria-labelledby={`group-${group.id}`}>
              <h2 id={`group-${group.id}`} className="order-card-title">
                {group.name}
              </h2>
              <GroupForm key={group.version} group={group} submitLabel="Save" />
              {group.kind ? null : <ArchiveGroup group={group} />}
            </section>
          ),
        }))}
      />
      <section className="content-card" aria-labelledby="add-group">
        <h2 id="add-group">Add a group</h2>
        <GroupForm
          group={{ id: newId, version: null }}
          submitLabel="Add group"
        />
      </section>
      {archived.length ? (
        <section className="admin-group" aria-labelledby="archived-groups">
          <h2 id="archived-groups">Archived groups</h2>
          <p className="muted">
            Archived groups cannot be edited. Restore one to use it again, then
            drag it into place.
          </p>
          <ul className="admin-list">
            {archived.map((group) => (
              <ArchivedRow
                key={group.id}
                name={group.name}
                heading="h3"
                fields={{ id: group.id, version: group.version }}
                restore={{
                  action: restoreSectionAction,
                  initial: initialKeptForm,
                }}
                // Deleted for good once nobody is in it (review 2; "manage people" holders, D-6).
                purge={{
                  action: deleteSectionAction,
                  allowed: canDelete,
                  blocked: group.people ? groupNotEmpty : null,
                  label: "Delete group",
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
