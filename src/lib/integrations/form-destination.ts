import type { FormsContent } from "../content/schemas";
import { isExternalHref, safeHref } from "../url";
import type { LinkDestination } from "./types";

/**
 * One sign-up form of the forms list (page text `forms`) as something
 * renderable. Pure, with no server-only import: `resolveForm` (public pages)
 * and the Pages preview (browser) share it.
 *
 * A closed form, a form with no link or an unsafe link, or a key the list
 * does not have shows nothing, never a dead link or a "coming soon" line
 * (review fixes P3; was PR5b D-7's "Text while closed").
 */
export function formDestination(
  forms: FormsContent,
  key: string,
): LinkDestination {
  const entry = forms.forms[key];
  if (!entry)
    return {
      state: "unconfigured",
      label: key,
      reason: "missing",
    };
  if (!entry.open)
    return {
      state: "unconfigured",
      label: entry.label,
      reason: "closed",
    };
  const href = safeHref(entry.url);
  if (!href)
    return {
      state: "unconfigured",
      label: entry.label,
      reason: entry.url ? "unsafe" : "missing",
    };
  return {
    state: "ready",
    label: entry.label,
    href,
    external: isExternalHref(href),
    placeholder: false,
  };
}
