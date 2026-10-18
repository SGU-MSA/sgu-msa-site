import { getForms } from "../content";
import { formDestination } from "./form-destination";
import type { LinkDestination } from "./types";

export { googleFormsOnly, isGoogleFormUrl } from "./google-forms";

/**
 * Resolves a form key from the sign-up forms list (page text `forms`) into
 * something renderable, for a page that has not read the list itself.
 * `formDestination` is the single reader of an entry (pages that already hold
 * the list, and the Pages preview, call it directly).
 *
 * No React component knows a form URL. A closed form carries its closed
 * line; a missing or unsafe link carries none (`formDestination`).
 */
export async function resolveForm(key: string): Promise<LinkDestination> {
  return formDestination(await getForms(), key);
}
