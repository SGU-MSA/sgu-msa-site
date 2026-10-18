"use server";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/backend/server";
import { storedFileName } from "@/lib/community/schema";
import { contentEditor } from "@/lib/runtime/providers";
import {
  sessionExpired,
  systemText,
  unavailableMessage,
} from "@/lib/system-text";
import type { EditorState } from "../actions";
import { refuse } from "../fields";
import { photoLibrary } from "./photo-library";

const words = systemText.photos;

/** A photo the chooser offers: its stored name and where it is used. */
export type PhotoChoice = { name: string; label: string };

/**
 * The uploaded photos for "Choose from uploaded photos" (photo library,
 * 2026-10-06), newest first, each named by its first use. Read when the
 * chooser opens, so the editors load nothing extra. Any board member.
 */
export async function photoChoicesAction(): Promise<
  { ok: true; photos: PhotoChoice[] } | { ok: false; error: string }
> {
  if (!(await currentAdmin())) return { ok: false, error: sessionExpired };
  const library = await photoLibrary();
  if (library.unavailable) return { ok: false, error: words.pickerFailed };
  return {
    ok: true,
    photos: library.files
      .filter((file) => file.kind === "photo")
      .map((file) => ({
        name: file.name,
        label: file.uses[0]?.label ?? words.notUsedYet,
      })),
  };
}

/**
 * Deletes a stored file nothing uses (photo library, 2026-10-06). Any board
 * member (D-23). `community_file_in_use()` decides, the rule the storage
 * policy deletes by; a file still in use is refused and says so.
 */
export async function deleteFileAction(
  _previous: EditorState,
  form: FormData,
): Promise<EditorState> {
  if (!(await currentAdmin())) return refuse(sessionExpired);
  const name = storedFileName.safeParse(form.get("name"));
  if (!name.success) return refuse("Unknown file. Reload and try again.");
  const inUse = await contentEditor().fileInUse(name.data);
  if (inUse === null) return refuse(unavailableMessage("delete"));
  if (inUse) return refuse(words.inUse);
  const removed = await contentEditor().removeFile(name.data);
  if (!removed.ok) return refuse(unavailableMessage("delete"));
  redirect("/admin/photos?deleted=1");
}
