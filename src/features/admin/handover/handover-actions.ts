"use server";
import { redirect } from "next/navigation";
import { redirectSaved } from "../save-state/saved-flash";
import { publicDataChanged } from "../public-refresh";
import { z } from "@/lib/validation/zod";
import { currentAdmin } from "@/lib/backend/server";
import type { WriteResult } from "@/lib/backend/providers/contract";
import { nextPosition } from "@/lib/community/order";
import { localDate } from "@/lib/community/schema";
import { clock, handoverEditor } from "@/lib/runtime/providers";
import type { EditorState } from "../actions";
import { keepTyped, typedValues, type KeptFormState } from "../form-state";
import { refuse } from "../fields";
import { loginFromForm, stepFromForm } from "./handover-forms";
import {
  sessionExpired,
  staleScreen,
  unavailableMessage,
} from "@/lib/system-text";

/**
 * New board term (PR5a D-5, D-27 d): any board member ticks, edits,
 * archives and restores the hand-over steps (reordering is "Save order",
 * `order-actions.ts`), starts a new term, and records
 * who holds each shared login (names from People, never a password). The
 * database decides (RLS, the version check, `archived_read_only`) and logs
 * every change.
 */

const failed =
  (verb: string) => (result: Extract<WriteResult, { ok: false }>) =>
    result.reason === "conflict" ? staleScreen : unavailableMessage(verb);

/** The row id and the version on screen that an archive or restore form posts. */
function postedTarget(form: FormData) {
  const id = z.uuid().safeParse(form.get("id"));
  const version = z.string().min(1).safeParse(form.get("version"));
  return id.success && version.success
    ? { id: id.data, version: version.data }
    : null;
}

/** The checklist (where ticks are saved) and "Edit the steps". */
const stepScreens = {
  checklist: "/admin/handover",
  steps: "/admin/handover/steps",
} as const;

/**
 * Saves a step: a tick from the checklist (the whole row with its `done`
 * box) or a reworded step from "Edit the steps". A step ticked before keeps
 * its "Done on" day; a new tick takes today's Grenada day. A new step goes
 * after every other step, archived ones included.
 */
export async function saveHandoverStepAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const version = values.version || null;
  // The order number comes from the database, never from the form: a step
  // keeps its place (an archived or vanished one is a stale screen), a new
  // step goes last.
  const [current, archived] = await Promise.all([
    handoverEditor().listSteps(),
    version ? null : handoverEditor().listSteps("archived"),
  ]);
  if (current.unavailable || archived?.unavailable)
    return refuseKeeping(unavailableMessage("save"));
  const position = version
    ? current.steps.find((step) => step.id === values.id)?.position
    : nextPosition([...current.steps, ...(archived?.steps ?? [])]);
  if (position === undefined) return refuseKeeping(staleScreen);
  const done = values.done === "on";
  const parsed = stepFromForm(
    values,
    position,
    done ? values.done_on || localDate(clock().now()) : "",
  );
  if (!parsed.ok) return refuseKeeping(null, parsed.fields);
  const saved = await handoverEditor().saveStep(parsed.row, version);
  if (!saved.ok) return refuseKeeping(failed("save")(saved));
  publicDataChanged();
  // A tick stays on the checklist, where focus stays on the tick box; the
  // refreshed page shows its "Done on" day.
  if (values.from === "checklist")
    return {
      error: null,
      notice: null,
      values: null,
      attempt: previous.attempt,
    };
  return redirectSaved(stepScreens.steps);
}

export async function archiveHandoverStepAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await handoverEditor().archiveStep(target.id, target.version);
  if (!result.ok) return refuse(failed("archive")(result));
  publicDataChanged();
  redirect(`${stepScreens.steps}?archived=1`);
}

export async function restoreHandoverStepAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await handoverEditor().restoreStep(target.id, target.version);
  if (!result.ok) return refuse(failed("restore")(result));
  publicDataChanged();
  redirect(`${stepScreens.steps}?restored=1`);
}

/** "Start a new term": clears every tick; the steps and the logins stay. */
export async function startNewTermAction(): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const result = await handoverEditor().startNewTerm();
  if (!result.ok) return refuse(failed("start a new term")(result));
  publicDataChanged();
  redirect(`${stepScreens.checklist}?started=1`);
}

/** Adds or edits who holds a shared login. Holders are chosen from People. */
export async function saveSharedLoginAction(
  previous: KeptFormState,
  form: FormData,
): Promise<KeptFormState> {
  const values = typedValues(form);
  const refuseKeeping = keepTyped(previous, values);
  if (!(await currentAdmin())) return refuseKeeping(sessionExpired);
  const parsed = loginFromForm(values, localDate(clock().now()));
  if (!parsed.ok) return refuseKeeping(null, parsed.fields);
  const saved = await handoverEditor().saveLogin(
    parsed.row,
    values.version || null,
  );
  if (!saved.ok) return refuseKeeping(failed("save")(saved));
  publicDataChanged();
  return redirectSaved(`${stepScreens.checklist}#logins`);
}

export async function archiveSharedLoginAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await handoverEditor().archiveLogin(target.id, target.version);
  if (!result.ok) return refuse(failed("archive")(result));
  publicDataChanged();
  redirect(`${stepScreens.checklist}?login=archived#logins`);
}

export async function restoreSharedLoginAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const target = postedTarget(form);
  if (!target) return refuse(staleScreen);
  const result = await handoverEditor().restoreLogin(target.id, target.version);
  if (!result.ok) return refuse(failed("restore")(result));
  publicDataChanged();
  redirect(`${stepScreens.checklist}?login=restored#logins`);
}
