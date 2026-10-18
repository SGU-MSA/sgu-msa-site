import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SAVED_COOKIE, type SavedNote } from "./saved-note";

/**
 * Ends a successful save (review fixes P1, item 2): marks it for the
 * "Saved" toast and opens `path`, whose address stays clean (no
 * `?saved=1`). The mark is a cookie for the dashboard only, read once by
 * `SavedToast` and gone within a minute; it holds no data.
 */
export async function redirectSaved(
  path: string,
  note: SavedNote = "saved",
): Promise<never> {
  (await cookies()).set(SAVED_COOKIE, note, {
    path: "/admin",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false,
  });
  redirect(path);
}
