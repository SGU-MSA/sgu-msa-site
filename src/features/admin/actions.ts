"use server";
import { calculatePrayers } from "@/lib/prayer/calculate";
import { redirect } from "next/navigation";
import { redirectSaved } from "./save-state/saved-flash";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import type { Place } from "@/lib/maps";
import type {
  UploadField,
  WriteResult,
} from "@/lib/backend/providers/contract";
import {
  collectionSchema,
  musallahPinSchema,
  restoredPrayerSettings,
  storedFileName,
  type CommunityRecord,
  type PrayerSettings,
} from "@/lib/community/schema";
import { contentForm } from "./content-form";
import { prayerForm } from "./prayer-form";
import {
  activityLog,
  adminAuth,
  clock,
  contentEditor,
  deploymentProfile,
  placesProvider,
} from "@/lib/runtime/providers";
import { ticketChoices } from "./event-tickets";
import { eventSeasonChoices } from "./event-seasons";
import { eventListChoices } from "./event-lists";
import { removeUnusedFiles, withLeftFiles } from "./file-cleanup";
import type { FieldProblems } from "./form-check/problems";
import { jumuahNotices, postNotices, prayerSavedPath } from "./jumuah-notices";
import {
  keepTyped,
  typedNumber,
  typedValues,
  type KeptFormState,
} from "./form-state";
import {
  categoryWords,
  purgeForbidden,
  refuse,
  seasonWords,
  termWords,
  ticketWords,
  typeDeleteToConfirm,
} from "./fields";
import {
  chooseFileAgain,
  outOfDate,
  sessionExpired,
  staleScreen,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import { versionBefore } from "@/lib/community/activity";

export type SignInState = { error: string | null };
/**
 * A form's answer: the refusal (a reason, and the problems by box, shown on
 * each box: review 2, 2026-10-05) or the notice.
 */
export type EditorState = {
  error: string | null;
  notice: string | null;
  fields?: FieldProblems;
};

const unsuccessful = {
  error: "Sign-in unsuccessful. Check your credentials or try again later.",
};

/** Whether the form carries a file chosen in `field`. */
function chosenFile(form: FormData, field: UploadField) {
  const file = form.get(field);
  return file instanceof File && file.size > 0;
}

/** Stores an attached file through the write port; null when none was chosen. */
async function upload(form: FormData, field: UploadField) {
  const file = form.get(field);
  return file instanceof File ? contentEditor().upload(field, file) : null;
}

export async function signInAction(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  // The sandbox signs in with a username (cleanup-outdated D-3); the live site with an email.
  const login =
    deploymentProfile().adminPortal === "sample"
      ? z.string().min(1).max(254)
      : z.email().max(254);
  const parsed = z
    .object({ email: login, password: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const result = await adminAuth().signIn(parsed.data);
  if (result === "invalid") return unsuccessful;
  if (result === "not-admin")
    return {
      error:
        "This account does not have board access. Ask a board member who can manage people.",
    };
  redirect("/admin/dashboard");
}

export async function signOutAction() {
  await adminAuth().signOut();
  redirect("/admin");
}

/**
 * Saves an item from the content editor. A refusal lists every problem at
 * once and keeps the typed values (`KeptFormState`, PR4 WP-3).
 */
export async function saveRecordAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const kind = collectionSchema.safeParse(values.collection);
  if (!kind.success) return refuseKeeping("Unknown content type.");
  const chosen = {
    image: chosenFile(form, "image"),
    file: chosenFile(form, "file"),
  };
  const again = chosen.image
    ? chooseFileAgain("picture")
    : chosen.file
      ? chooseFileAgain("newsletter file")
      : null;
  // An event as saved: for its announcement question (review 2) and the
  // deployment skew check (PR5a Failure Modes): a screen loaded before the
  // event status box posts no status; it may save only an event still
  // scheduled.
  let saved: CommunityRecord | null = null;
  if (kind.data === "events" && values.version) {
    const id = z.uuid().safeParse(values.id);
    if (!id.success) return refuseKeeping(staleScreen);
    const { record, unavailable } = await contentEditor().readRecord(
      "events",
      id.data,
    );
    if (unavailable) return refuseKeeping(unavailableMessage("save"));
    if (values.status === undefined && record && record.status !== "scheduled")
      return refuseKeeping(staleScreen);
    saved = record;
  }
  const parsed = contentForm({
    kind: kind.data,
    values,
    chosen,
    saved,
    // An urgent notice must end later than now (D-1, E-13).
    now: clock().now(),
  });
  // Each problem shows on its box (review 2).
  if (!parsed.ok) return refuseKeeping(again, parsed.fields);
  const { row, notice } = parsed;
  const withAgain = (message: string) =>
    again ? `${message} ${again}` : message;
  // An event sells only a ticket (never a fund) that no other event sells
  // (PR6 WP-9; the database's unique index is the authority).
  if (kind.data === "events" && row.ticket_payment_item_id) {
    const tickets = await ticketChoices(row.id);
    if (tickets.unavailable)
      return refuseKeeping(withAgain(unavailableMessage("save")));
    if (!tickets.choices.some(({ id }) => id === row.ticket_payment_item_id))
      return refuseKeeping(again, {
        ticket_payment_item_id: ticketWords.notListed,
      });
  }
  // An event belongs to a current season, or keeps its own (PR5c).
  if (kind.data === "events" && row.season_id) {
    const seasons = await eventSeasonChoices(saved?.season_id ?? "");
    if (seasons.unavailable)
      return refuseKeeping(withAgain(unavailableMessage("save")));
    if (!seasons.choices.some(({ id }) => id === row.season_id))
      return refuseKeeping(again, { season_id: seasonWords.notListed });
  }
  // A category and a term from their own Lists (review fixes P3; the
  // database's `events_list_options` is the authority).
  if (kind.data === "events" && (row.category_id || row.term_id)) {
    const lists = await eventListChoices();
    if (lists.unavailable)
      return refuseKeeping(withAgain(unavailableMessage("save")));
    const listed = (choices: readonly { id: string }[], id: string) =>
      !id || choices.some((choice) => choice.id === id);
    const problems = {
      ...(listed(lists.categories, row.category_id)
        ? {}
        : { category_id: categoryWords.notListed }),
      ...(listed(lists.terms, row.term_id)
        ? {}
        : { term_id: termWords.notListed }),
    };
    if (Object.keys(problems).length) return refuseKeeping(again, problems);
  }
  try {
    row.image_path = (await upload(form, "image")) ?? row.image_path;
    row.file_path = (await upload(form, "file")) ?? row.file_path;
    const result = await contentEditor().saveRecord(
      kind.data,
      row,
      values.version || null,
    );
    if (!result.ok)
      return result.reason === "ticket_taken"
        ? refuseKeeping(again, { ticket_payment_item_id: ticketWords.taken })
        : refuseKeeping(
            withAgain(
              result.reason === "conflict"
                ? "Could not save. Another editor may have changed this item; reload before trying again. Your entered text is still here."
                : unavailableMessage("save"),
            ),
          );
  } catch (error) {
    return refuseKeeping(
      withAgain(
        error instanceof Error
          ? error.message
          : "Could not save. Please try again.",
      ),
    );
  }
  // The event is kept even when its announcement cannot be posted.
  const posted = notice
    ? await postNotices([notice], (announcement) =>
        contentEditor().saveRecord("announcements", announcement, null),
      )
    : true;
  publicDataChanged();
  return redirectSaved(
    `/admin/content/${kind.data}${posted ? "" : "?notice=failed"}`,
  );
}

const unknownItem = "Unknown item. Reload and try again.";
/** Why an archive, restore or permanent delete did not happen. */
const notDone = (
  verb: string,
): Record<Extract<WriteResult, { ok: false }>["reason"], string> => ({
  conflict: staleScreen,
  unavailable: unavailableMessage(verb),
});

/** The item an archive, restore or delete form names, with the version on screen. */
function itemTarget(form: FormData) {
  const kind = collectionSchema.safeParse(form.get("collection"));
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  return kind.success && id.success && version.success
    ? { kind: kind.data, id: id.data, version: version.data }
    : null;
}

/** Archive replaces delete (ADR 0013): hidden from the site with its files, restorable. */
export async function archiveRecordAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = itemTarget(form);
  if (!target) return refuse(unknownItem);
  const archived = await contentEditor().archiveRecord(
    target.kind,
    target.id,
    target.version,
  );
  if (!archived.ok) return refuse(notDone("archive")[archived.reason]);
  publicDataChanged();
  redirect(`/admin/content/${target.kind}?archived=1`);
}

/** Brings an archived item back as an unpublished draft (D-13); any admin (D-6). */
export async function restoreRecordAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = itemTarget(form);
  if (!target) return refuse(unknownItem);
  const restored = await contentEditor().restoreRecord(
    target.kind,
    target.id,
    target.version,
  );
  if (!restored.ok) return refuse(notDone("restore")[restored.reason]);
  publicDataChanged();
  redirect(`/admin/content/${target.kind}?restored=1`);
}

/**
 * Permanent delete from Archived, typed DELETE, "manage people" holders only
 * (D-6; the database decides). Its stored files go too unless another item
 * still uses them.
 */
export async function purgeRecordAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  const admin = await currentAdmin();
  if (!admin) return refuse(sessionExpired);
  if (!admin.canManagePeople) return refuse(purgeForbidden);
  const target = itemTarget(form);
  if (!target) return refuse(unknownItem);
  if (form.get("confirmation") !== "DELETE") return refuse(typeDeleteToConfirm);
  // The file names come from the database, never from the form.
  const { record, unavailable } = await contentEditor().readRecord(
    target.kind,
    target.id,
  );
  if (unavailable) return refuse(notDone("delete").unavailable);
  if (!record?.archived_at) return refuse(staleScreen);
  const purged = await contentEditor().purgeRecord(
    target.kind,
    target.id,
    target.version,
  );
  if (!purged.ok) return refuse(notDone("delete")[purged.reason]);
  const left = await removeUnusedFiles([record.image_path, record.file_path]);
  publicDataChanged();
  redirect(
    withLeftFiles(
      `/admin/content/${target.kind}?view=archived&deleted=1`,
      left,
    ),
  );
}

/**
 * Deletes a stored file that nothing uses any more, when the clean-up after a
 * permanent delete or a photo removal failed ("Try Remove again"). Any admin
 * (D-23); storage keeps a file a row still names.
 */
export async function removeFileAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const name = storedFileName.safeParse(form.get("name"));
  if (!name.success) return refuse("Unknown file. Reload and try again.");
  const removed = await contentEditor().removeFile(name.data);
  return removed.ok
    ? { error: null, notice: "File removed." }
    : refuse(
        "Could not remove the file. Check your connection, then try Remove again.",
      );
}

/**
 * The check every prayer save and every pin move runs: at the musallah pin
 * (PR7), the fixed calculation (ADR 0017) must give all prayer starts in
 * order today and on every one-date change. Without a pin (it could not be
 * read) there is nothing to check.
 */
function calculationProblem(
  pin: Place | null,
  settings: Pick<PrayerSettings, "exceptions">,
): string | null {
  return pin &&
    [
      clock().now(),
      ...settings.exceptions.map(
        (row) => new Date(`${row.date}T12:00:00-04:00`),
      ),
    ].some((date) => calculatePrayers(pin, date).length !== 12)
    ? "Prayer start times cannot be calculated for these coordinates. Check the Musallah location."
    : null;
}

/** Someone else saved the prayer settings since this page loaded. */
const prayerConflict =
  "Could not save. Reload to get the latest schedule before editing.";

/**
 * Saves the Prayer & iqamah screen (PR4 WP-4): one form, one version check.
 * A refusal lists every problem at once and keeps the typed values
 * (`KeptFormState`). A changed Friday's Jumu'ah may also post an urgent
 * notice (`jumuahNotices`), saved after the prayer settings.
 */
export async function savePrayerAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const parsed = prayerForm(form);
  // A page loaded before this screen changed posts other fields (deployment skew).
  if (!parsed.ok)
    return "fields" in parsed
      ? refuseKeeping(null, parsed.fields)
      : refuseKeeping(outOfDate);
  const settings = parsed.settings;
  const { place } = await placesProvider().musallahEntrance();
  const problem = calculationProblem(place, settings);
  if (problem) return refuseKeeping(problem);
  const current = await contentEditor().readPrayer();
  if (!current) return refuseKeeping(unavailableMessage("save"));
  // Before the notice question: an out-of-date page compared its Fridays with
  // settings it never showed, so it hears "reload", not a question it lacks.
  if (current.version !== values.version) return refuseKeeping(prayerConflict);
  const { notices, problems } = jumuahNotices(
    form,
    settings,
    current.settings,
    clock().now(),
  );
  if (Object.keys(problems).length) return refuseKeeping(null, problems);
  const saved = await contentEditor().savePrayerSettings(
    settings,
    values.version ?? "",
  );
  if (!saved.ok)
    return refuseKeeping(
      saved.reason === "conflict" ? prayerConflict : unavailableMessage("save"),
    );
  // The prayer change is kept even when a notice cannot be posted.
  const allPosted = await postNotices(notices, (notice) =>
    contentEditor().saveRecord("announcements", notice, null),
  );
  publicDataChanged();
  return redirectSaved(prayerSavedPath(allPosted));
}

/** Someone else moved the pin since this page loaded (PR7). */
const pinConflict =
  "Someone else saved the location first. Reload to see it, then try again.";

/**
 * Moves the musallah pin (PR7 D-4, D-5): the "Musallah location" section's
 * own form, version and row, so a prayer save and a pin move never block
 * each other. The pin must be in Grenada (D-9) and give every prayer start
 * today and on each one-date change; the move is logged by the database.
 */
export async function saveMusallahPinAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const parsed = musallahPinSchema.safeParse({
    id: 1,
    latitude: typedNumber(values.latitude),
    longitude: typedNumber(values.longitude),
  });
  // The pin has no box: its one problem shows under the map.
  if (!parsed.success)
    return refuseKeeping(null, { pin: parsed.error.issues[0].message });
  const prayer = await contentEditor().readPrayer();
  if (!prayer) return refuseKeeping(unavailableMessage("save"));
  const problem = calculationProblem(parsed.data, prayer.settings);
  if (problem) return refuseKeeping(null, { pin: problem });
  const saved = await contentEditor().saveMusallahPin(
    parsed.data,
    values.version ?? "",
  );
  if (!saved.ok)
    return refuseKeeping(
      saved.reason === "conflict" ? pinConflict : unavailableMessage("save"),
    );
  publicDataChanged();
  return redirectSaved("/admin/prayer-times#musallah-location");
}

/**
 * Prayer history (ADR 0013; review 3 D): puts back the settings as they were
 * before a logged change. The version is read again from the log (the form
 * names only the entry), checked against today's rules like any save, and
 * saved with the version on screen and the time of the version it puts back
 * (`restored_from`), so the log names it "Restored to the version of …".
 */
export async function restorePrayerVersionAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const entryId = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(form.get("entry"));
  const version = z.string().min(1).safeParse(form.get("version"));
  if (!entryId.success || !version.success) return refuse(staleScreen);
  // The entry and the change before it, which dates the version before it.
  const { entries, unavailable } = await activityLog().list({
    area: "prayer_settings",
    before: entryId.data + 1,
    limit: 2,
  });
  if (unavailable) return refuse(unavailableMessage("load that version"));
  const [entry, previous] = entries;
  const earlier =
    entry?.id === entryId.data ? versionBefore(entry, previous ?? null) : null;
  if (!earlier) return refuse(staleScreen);
  const current = await contentEditor().readPrayer();
  if (!current) return refuse(unavailableMessage("load that version"));
  const parsed = restoredPrayerSettings(earlier.snapshot);
  if (!parsed.success)
    return refuse(
      systemText.pages.restoreRefused(parsed.error.issues[0].message),
    );
  const { place } = await placesProvider().musallahEntrance();
  const problem = calculationProblem(place, parsed.data);
  if (problem) return refuse(problem);
  const saved = await contentEditor().savePrayerSettings(
    parsed.data,
    version.data,
    earlier.savedAt,
  );
  if (!saved.ok)
    return refuse(
      "Could not restore. Reload to get the latest schedule before restoring.",
    );
  publicDataChanged();
  redirect("/admin/prayer-times?restored=1");
}
