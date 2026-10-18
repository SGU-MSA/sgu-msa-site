"use client";
import {
  archivePersonAction,
  removePhotoAction,
  restorePersonAction,
} from "@/features/admin/people-actions";
import { ArchiveActions } from "./ArchiveActions";
import { accessRefusals, leftTeamWords } from "./fields";
import { ActionForm } from "./RecordActions";

/** A People entry and the version on screen. */
type Target = { id: string; version: string };

/**
 * "No longer on the team" (ADR 0013, D-12; review fixes P4, the plan's
 * meaning of archiving a person): off the public team list and the login off
 * in the same step, their history kept, restorable. `lock` is why the
 * access guard would refuse it (a UX mirror; the database decides).
 */
export function ArchivePerson({
  target,
  lock,
}: {
  target: Target;
  lock: keyof typeof accessRefusals | null;
}) {
  return (
    <ArchiveActions
      archived={false}
      fields={target}
      archive={{
        action: archivePersonAction,
        summary: leftTeamWords.summary,
        label: leftTeamWords.button,
        explain: leftTeamWords.explain,
        lock: lock ? accessRefusals[lock] : null,
      }}
      restore={{ action: restorePersonAction }}
    />
  );
}

/**
 * "Remove photo" (ADR 0014): clears the photo and nothing else; works for
 * archived people too (D-26).
 */
export function RemovePhoto({ target }: { target: Target }) {
  return (
    <section className="content-card" aria-labelledby="remove-photo">
      <h2 id="remove-photo">Remove the photo?</h2>
      <p>
        The photo file is deleted for good; nothing else changes. This also
        works for archived people.
      </p>
      <ActionForm
        action={removePhotoAction}
        fields={target}
        label="Remove photo"
        pendingLabel="Removing…"
      />
    </section>
  );
}
