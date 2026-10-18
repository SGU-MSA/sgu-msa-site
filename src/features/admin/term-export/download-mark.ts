/**
 * How the Term export screen knows its zip has started downloading (review
 * fixes P5): the browser keeps the page open while it saves the file, so the
 * screen sends a random token with Download, and the zip's response sets a
 * short-lived cookie (two minutes, dashboard only, no data) holding it. The
 * screen looks for its token, then says "The zip is downloading" and offers
 * "Free up space". Browser-safe.
 */
export const downloadStartedCookie = "term-export-started";

/** A token the screen made (letters and digits only), or null. */
export function downloadToken(value: string | null | undefined): string | null {
  return value && /^[a-z0-9]{8,40}$/i.test(value) ? value : null;
}

/** A new token for one Download click. */
export function newDownloadToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/** Whether the zip for `token` has started downloading (read in the browser). */
export function downloadStarted(cookie: string, token: string): boolean {
  return cookie
    .split("; ")
    .some((part) => part === `${downloadStartedCookie}=${token}`);
}
