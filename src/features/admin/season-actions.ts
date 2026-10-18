"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "./save-state/saved-flash";
import { publicDataChanged } from "./public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import { seasonEditor } from "@/lib/runtime/providers";
import type { EditorState } from "./actions";
import { keepTyped, typedValues, type KeptFormState } from "./form-state";
import { refuse } from "./fields";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
  unknownSignUpForm,
} from "@/lib/system-text";
import { SEASON_PHOTOS_MAX } from "@/lib/media/photo-limits";
import { getForms } from "@/lib/content";
import {
  confirmedDayProblems,
  seasonFromForm,
  seasonPreview,
} from "./payment-forms";
import { adminSeasonContext } from "@/lib/backend/admin-payments";
import { seasonRefusals } from "./payment-words";
import {
  checkedPhotoList,
  removeDroppedPhotos,
  storeNewPhotos,
} from "./photo-list-save";
import { removeUnusedFiles } from "./file-cleanup";

/**
 * Seasons (PR6 WP-5, D-12, D-15; ADR 0021): any board member adds a season,
 * changes its Islamic-calendar rule or typed days, confirms the first and
 * last day after moon sighting (or clears them), archives and restores it.
 * Saving moves every fund tied to the season at once. The season's public
 * page (PR5c: intro, schedule, sign-up form, photos) is saved with it; new
 * photos go through the upload pipeline, and photos it no longer names are
 * deleted afterwards. The database decides (RLS, the version check, one
 * current season per name, SGU08) and logs every change; a change to the
 * days is highlighted.
 */

const list = "/admin/seasons";

export async function saveSeasonAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const checked = checkedPhotoList(
    form,
    "photos",
    SEASON_PHOTOS_MAX,
    seasonFromForm(values),
  );
  if (!checked.ok) return refuseKeeping(checked.error, checked.fields);
  const { row, again } = checked;
  // A confirmed day stays within 5 days of the expected day (review fixes
  // P4): the form greys the others out; one typed by keyboard is refused here.
  const context = await adminSeasonContext();
  const reach = confirmedDayProblems(
    values,
    seasonPreview(values, context.today, context.adjustment),
  );
  if (Object.keys(reach).length) return refuseKeeping(again, reach);
  // The sign-up form is one of the forms list's (Pages → Sign-up forms).
  const forms = await getForms();
  if (row.sign_up_form && !forms.forms[row.sign_up_form])
    return refuseKeeping(again, { sign_up_form: unknownSignUpForm });
  const version = values.version || null;
  const current = await seasonEditor().listSeasons();
  if (current.unavailable) return refuseKeeping(unavailableMessage("save"));
  const before = current.seasons.find((known) => known.id === row.id);
  if (version ? !before : before) return refuseKeeping(staleScreen);
  const stored = await storeNewPhotos(checked.photos, checked.files);
  if (!stored.ok) return refuseKeeping(stored.error);
  const saved = await seasonEditor().saveSeason(
    { ...row, photos: stored.photos },
    version,
  );
  if (!saved.ok) {
    // Nothing names the new photos: they go again.
    await removeUnusedFiles(stored.uploaded);
    return refuseKeeping(seasonRefusals[saved.reason]);
  }
  await removeDroppedPhotos(before?.photos ?? [], stored.photos);
  publicDataChanged();
  return redirectSaved(list);
}

function postedTarget(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  return id.success && version.success
    ? { id: id.data, version: version.data }
    : null;
}

/** Refused while a current fund or ticket uses the season (SGU08). */
export async function archiveSeasonAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await seasonEditor().archiveSeason(target.id, target.version);
  if (!result.ok) return refuse(seasonRefusals[result.reason]);
  publicDataChanged();
  redirect(`${list}?archived=1`);
}

/** Refused when a current season has its name. */
export async function restoreSeasonAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await seasonEditor().restoreSeason(target.id, target.version);
  if (!result.ok) return refuse(seasonRefusals[result.reason]);
  publicDataChanged();
  redirect(`${list}?restored=1`);
}
