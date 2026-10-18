/** What a "Copy link" press came to. */
export type CopyResult = "copied" | "failed";

/** The words shown and announced for each result. */
export const copyMessages = {
  copied: "Link copied",
  failed: "Couldn't copy — press and hold the link to copy it",
} as const;

/**
 * Copies `text` with the browser's clipboard. A blocked clipboard, an
 * insecure page or a missing API all give "failed", never an exception, so
 * the caller can show the link for the person to copy by hand.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = typeof navigator ===
  "undefined"
    ? undefined
    : navigator.clipboard,
): Promise<CopyResult> {
  try {
    if (!clipboard) return "failed";
    await clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
