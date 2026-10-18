"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "./save-state/saved-flash";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import { uploadFailed } from "@/lib/backend/storage";
import {
  personSchema,
  photoAllowed,
  roleHolder,
  touchesExecutive,
} from "@/lib/community/people";
import { storedPhotoName } from "@/lib/community/schema";
import { nextPosition } from "@/lib/community/order";
import {
  accountInviter,
  contentEditor,
  peopleEditor,
} from "@/lib/runtime/providers";
import type { VersionedPerson } from "@/lib/backend/providers/contract";
import type { EditorState } from "./actions";
import { removeUnusedFiles, withLeftFiles } from "./file-cleanup";
import { keepTyped, typedValues, type KeptFormState } from "./form-state";
import { personFromForm, sectionFromForm } from "./person-form";
import {
  accessFailures,
  executiveMoveRefusals,
  groupNotEmpty,
  purgeForbidden,
  refuse,
  roleTakenWords,
  teamListWords,
  typeDeleteToConfirm,
} from "./fields";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
  systemText,
} from "@/lib/system-text";

/**
 * People and team-group saves (PR3 contract, WP-C; review 2). Any admin may
 * edit People entries and groups (D-7, D-8), except that moves into or out
 * of the Executive board and its roles need "manage people" (2026-10-06);
 * the database stays the authority for the group, role and version rules. A refused save keeps the
 * typed values (`KeptFormState`).
 */

const conflict = staleScreen;
const unknownGroup = "Unknown group. Reload and try again.";

const unavailable =
  "Could not save. Check your connection and try again. Your entered details are still here.";

export async function savePersonAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  const admin = await currentAdmin();
  if (!admin) return refuseKeeping(sessionExpired);
  const id = z.uuid().safeParse(values.id);
  if (!id.success)
    return refuseKeeping("Unknown person. Reload and try again.");
  const version = values.version || null;
  // The stored photo name comes from the database, never from the form.
  let storedPhoto = "";
  let stored: {
    section_id: string;
    role_title: string;
    position: number;
  } | null = null;
  if (version) {
    const { person, unavailable: down } = await peopleEditor().readPerson(
      id.data,
    );
    if (down) return refuseKeeping(unavailable);
    // Archived entries stay read-only until restored; the database refuses
    // them too (D-20).
    if (!person || person.archived_at) return refuseKeeping(conflict);
    storedPhoto = person.photo_path;
    stored = person;
  }
  // The Executive board's people hold one of its roles (review 2).
  const groups = await peopleEditor().listSections();
  if (groups.unavailable) return refuseKeeping(unavailable);
  const executiveGroupId =
    groups.sections.find((group) => group.kind === "executive")?.id ?? null;
  // The order is set by dragging on the People list (review fixes PR-2): a
  // person keeps their place; a new person, or one moved to another group,
  // goes last in that group. The Executive board's current people say who
  // holds the chosen role (2026-10-06).
  let position = stored?.position ?? 0;
  const moving = !stored || stored.section_id !== values.section_id;
  let people: readonly VersionedPerson[] = [];
  if (moving || values.section_id === executiveGroupId) {
    const current = await peopleEditor().listPeople();
    if (current.unavailable) return refuseKeeping(unavailable);
    people = current.people;
  }
  if (moving) {
    const archived = await peopleEditor().listPeople("archived");
    if (archived.unavailable) return refuseKeeping(unavailable);
    position = nextPosition(
      [...people, ...archived.people].filter(
        (person) => person.section_id === values.section_id,
      ),
    );
  }
  const image = form.get("image");
  const chosen = image instanceof File && image.size > 0 ? image : null;
  // A photo chosen from the uploaded ones (photo library): its stored name.
  const pickedName = storedPhotoName.safeParse(values.photo_pick);
  const picked = pickedName.success ? pickedName.data : null;
  // Photos are for the Executive board only (user, 2026-10-07; the
  // database's `people_photo_executive_only` decides too): a new photo for
  // anyone else is refused. Someone moved out keeps theirs, hidden
  // (`shownPhoto`), for when they come back.
  const withPhoto = photoAllowed(values.section_id ?? "", executiveGroupId);
  if (!withPhoto && (chosen || picked))
    return refuseKeeping(null, { image: teamListWords.photoExecutiveOnly });
  const keptPhoto = storedPhoto;
  const parsed = personFromForm(values, {
    position,
    // A newly chosen photo is checked with the rest before it is stored.
    photoPath: chosen ? `${crypto.randomUUID()}.webp` : (picked ?? keptPhoto),
    executiveGroupId,
  });
  const again = chosen ? " Choose the photo again before saving." : "";
  // Each problem shows on its box (review 2).
  if (!parsed.ok)
    return refuseKeeping(again ? again.trim() : null, parsed.fields);
  const row = parsed.row;
  // Moving someone into or out of the Executive board, or changing an
  // executive's role, needs "manage people" (2026-10-06; the database's
  // `people_executive_moves` decides too).
  if (touchesExecutive(stored, row, executiveGroupId) && !admin.canManagePeople)
    return refuseKeeping(executiveMoveRefusals.forbidden + again);
  // One current person per Executive board role (2026-10-06): a taken role
  // is handed over only after the form's "Make <name> <role> instead?" Yes,
  // for the holder the form showed; the database checks again.
  const holder = roleHolder(people, row, executiveGroupId);
  if (holder && values.replace_holder !== holder.id)
    return refuseKeeping(again ? again.trim() : null, {
      role_title: roleTakenWords.stale(holder.full_name, row.role_title),
    });
  try {
    row.photo_path = chosen
      ? ((await contentEditor().upload("image", chosen)) ?? keptPhoto)
      : (picked ?? keptPhoto);
  } catch (error) {
    return refuseKeeping(
      (error instanceof Error ? error.message : uploadFailed) + again,
    );
  }
  const saved = holder
    ? await peopleEditor().savePersonTakingRole(row, version, {
        id: holder.id,
        version: values.replace_version ?? "",
      })
    : await peopleEditor().savePerson(row, version);
  // The photo file no entry names any more (replaced, or uploaded for a
  // refused save) is removed. Any admin may do this; storage keeps any file a
  // row still names (D-23). A photo chosen from the uploaded ones stays in
  // the library when the save is refused.
  const [kept, unused] = saved.ok
    ? [row.photo_path, storedPhoto]
    : [storedPhoto, chosen ? row.photo_path : null];
  if (unused && unused !== kept) await contentEditor().removeFile(unused);
  if (!saved.ok)
    return refuseKeeping(
      {
        invalid:
          "Could not save: these details were refused. Check the group and the role, then try again.",
        conflict,
        unavailable,
        ...executiveMoveRefusals,
        role_taken: `${systemText.sguCodes.SGU17} Reload the page, then choose again.`,
        // A handover's refusals are about the holder moved out.
        ...(holder
          ? {
              forbidden: roleTakenWords.forbidden,
              self: roleTakenWords.self,
              last_manager: roleTakenWords.last_manager(holder.full_name),
            }
          : {}),
      }[saved.reason] + again,
    );
  publicDataChanged();
  return redirectSaved("/admin/people", holder ? "moved" : "saved");
}

export async function saveSectionAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  // The order is set by dragging (review fixes PR-2): a group keeps its
  // place; a new one goes last, after archived ones too.
  const [current, archived] = await Promise.all([
    peopleEditor().listSections(),
    peopleEditor().listSections("archived"),
  ]);
  if (current.unavailable || archived.unavailable)
    return refuseKeeping(unavailable);
  const version = values.version || null;
  const stored = current.sections.find((section) => section.id === values.id);
  if (version && !stored) return refuseKeeping(conflict);
  const parsed = sectionFromForm(
    // The Executive board and the General board keep their names (review 2).
    stored?.kind ? { ...values, name: stored.name } : values,
    stored?.position ??
      nextPosition([...current.sections, ...archived.sections]),
  );
  if (!parsed.ok) return refuseKeeping(null, parsed.fields);
  const saved = await peopleEditor().saveSection(parsed.row, version);
  if (!saved.ok)
    return saved.reason === "name_taken"
      ? refuseKeeping(null, {
          name: "Another group already has this name. Choose a different name.",
        })
      : refuseKeeping(
          {
            conflict,
            unavailable,
            permanent: systemText.sguCodes.SGU13,
          }[saved.reason],
        );
  publicDataChanged();
  return redirectSaved("/admin/people/groups");
}

/** The entry or group id and the version an archive, restore or delete form posts. */
function postedTarget(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  return id.success && version.success
    ? { id: id.data, version: version.data }
    : null;
}

export async function archiveSectionAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const refuseKeeping = keepTyped(previous, typedValues(form));
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuseKeeping(unknownGroup);
  const archived = await peopleEditor().archiveSection(
    target.id,
    target.version,
  );
  if (!archived.ok)
    return refuseKeeping(
      {
        section_in_use: systemText.sguCodes.SGU04,
        permanent: systemText.sguCodes.SGU13,
        conflict,
        unavailable: unavailableMessage("archive"),
      }[archived.reason],
    );
  publicDataChanged();
  redirect("/admin/people/groups?archived=1");
}

/** Brings an archived group back (D-22); any admin may restore (D-6). */
export async function restoreSectionAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const refuseKeeping = keepTyped(previous, typedValues(form));
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuseKeeping(unknownGroup);
  const restored = await peopleEditor().restoreSection(
    target.id,
    target.version,
  );
  if (!restored.ok)
    return refuseKeeping(
      {
        name_taken:
          "A current group already has this name. Rename that group first, then restore this one.",
        conflict,
        unavailable: unavailableMessage("restore"),
      }[restored.reason],
    );
  publicDataChanged();
  redirect("/admin/people/groups?restored=1");
}

/**
 * Permanent delete of an archived, empty group (review 2): typed DELETE,
 * "manage people" holders only (D-6). The database refuses a group anyone,
 * archived or not, is still in.
 */
export async function deleteSectionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(purgeForbidden);
  const target = postedTarget(form);
  if (!target) return refuse(unknownGroup);
  if (form.get("confirmation") !== "DELETE") return refuse(typeDeleteToConfirm);
  const deleted = await peopleEditor().deleteSection(target.id, target.version);
  if (!deleted.ok)
    return refuse(
      {
        in_use: groupNotEmpty,
        conflict,
        unavailable: unavailableMessage("delete"),
      }[deleted.reason],
    );
  publicDataChanged();
  redirect("/admin/people/groups?deleted=1");
}

const unknownPerson = "Unknown person. Reload and try again.";

/**
 * Archive instead of delete (ADR 0013). It also turns the person's login off
 * in the same step (D-12), so the access guard applies: nobody archives
 * themselves or the last "manage people" holder.
 */
export async function archivePersonAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(unknownPerson);
  const archived = await peopleEditor().archivePerson(
    target.id,
    target.version,
  );
  if (!archived.ok) return refuse(accessFailures[archived.reason]);
  publicDataChanged();
  redirect("/admin/people?archived=1");
}

/** Brings an archived person back; their login stays off (any admin, D-6). */
export async function restorePersonAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(unknownPerson);
  const restored = await peopleEditor().restorePerson(
    target.id,
    target.version,
  );
  if (!restored.ok)
    return refuse(
      {
        conflict,
        unavailable: unavailableMessage("restore"),
        role_taken: roleTakenWords.restore,
      }[restored.reason],
    );
  publicDataChanged();
  redirect(`/admin/people/${target.id}?restored=1`);
}

/**
 * Permanent delete from Archived, typed DELETE, "manage people" holders only
 * (D-6). After the entry is gone, their login account is deleted too through
 * the server-only inviter (D-21), and their photo file unless something else
 * uses it.
 */
export async function purgePersonAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(purgeForbidden);
  const target = postedTarget(form);
  if (!target) return refuse(unknownPerson);
  if (form.get("confirmation") !== "DELETE") return refuse(typeDeleteToConfirm);
  // The login and the photo come from the database, never from the form.
  const { person, unavailable: down } = await peopleEditor().readPerson(
    target.id,
  );
  if (down) return refuse(unavailableMessage("delete"));
  if (!person?.archived_at) return refuse(conflict);
  const purged = await peopleEditor().purgePerson(target.id, target.version);
  if (!purged.ok)
    return refuse(
      { conflict, unavailable: unavailableMessage("delete") }[purged.reason],
    );
  const { access } = person;
  const login =
    access.state === "none"
      ? "none"
      : (await accountInviter().deleteAccount(access.userId)).ok
        ? "deleted"
        : "kept";
  const left = await removeUnusedFiles([person.photo_path]);
  publicDataChanged();
  redirect(
    withLeftFiles(`/admin/people?view=archived&deleted=1&login=${login}`, left),
  );
}

/**
 * "Remove photo" (ADR 0014): clears the photo and nothing else, which an
 * archived entry accepts too (D-26), then deletes the photo file unless
 * something else uses it.
 */
export async function removePhotoAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(unknownPerson);
  const { person, unavailable: down } = await peopleEditor().readPerson(
    target.id,
  );
  if (down) return refuse(unavailableMessage("remove the photo"));
  if (!person?.photo_path) return refuse(conflict);
  const row = personSchema.parse({ ...person, photo_path: "" });
  const saved = await peopleEditor().savePerson(row, target.version);
  if (!saved.ok)
    return refuse(
      {
        invalid: "Could not remove the photo. Reload and try again.",
        // Removing a photo changes no role.
        role_taken: conflict,
        conflict,
        unavailable: unavailableMessage("remove the photo"),
        // Removing a photo changes no group or role.
        ...executiveMoveRefusals,
      }[saved.reason],
    );
  const left = await removeUnusedFiles([person.photo_path]);
  publicDataChanged();
  redirect(withLeftFiles(`/admin/people/${target.id}?photo=removed`, left));
}
