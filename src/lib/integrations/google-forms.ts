/**
 * The Google Forms link rule (PR5b D-25): sign-ups go through the board's
 * Google Forms only. Pure (no server-only import), so the event save, the
 * forms list save and the browser hint share it; the database mirrors it in
 * `public.is_google_form_url` (`googleFormSqlPattern` and
 * `googleFormSqlRefused`), checked on events and on the sign-up forms list.
 */

/** `https://docs.google.com/forms/…` or `https://forms.gle/…`, nothing else. */
export function isGoogleFormUrl(value: string): boolean {
  if (/\s/.test(value) || refused.test(value) || !URL.canParse(value))
    return false;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    return false;
  // The raw text must start with the address itself: no other spellings of
  // the host (upper case, a trailing dot) that the database check would refuse.
  if (url.hostname === "docs.google.com")
    return (
      value.startsWith("https://docs.google.com/forms/") &&
      url.pathname.startsWith("/forms/") &&
      url.pathname.length > "/forms/".length
    );
  if (url.hostname === "forms.gle")
    return value.startsWith("https://forms.gle/") && url.pathname.length > 1;
  return false;
}

/** The SQL mirror of `isGoogleFormUrl` (`public.is_google_form_url`, PR5b migration). */
export const googleFormSqlPattern =
  "^https://(docs\\.google\\.com/forms/|forms\\.gle/)\\S+$";

/**
 * Refused anywhere in the link (case-insensitive): a backslash or a "." or
 * ".." path part, which a browser resolves to another address
 * (`/forms/../document/…` opens a Google Doc).
 */
export const googleFormSqlRefused = "[\\\\]|/(\\.|%2e){1,2}([/?#]|$)";
const refused = new RegExp(googleFormSqlRefused, "i");

/** The refusal of a link that is not a Google Forms link (D-25), naming the box. */
export const googleFormsOnly = (field: string) =>
  `${field}: use a Google Forms link (docs.google.com/forms/… or forms.gle/…).`;
