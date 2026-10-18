import { verseReferencePattern } from "../content/schemas";

/** The highest surah number. */
const SURAHS = 114;

/**
 * A verse reference as the library stores it ("94:5"), or null: unknown
 * form, surah 0 or over 114, or verse 0. Spaces and a leading zero are
 * tidied ("094 : 05" → "94:5"). Pure.
 */
export function parseVerseReference(
  value: string,
): { surah: number; ayah: number; reference: string } | null {
  const text = value.trim().replace(/\s+/g, "");
  if (!verseReferencePattern.test(text)) return null;
  const [surah, ayah] = text.split(":").map(Number);
  if (surah < 1 || surah > SURAHS || ayah < 1) return null;
  return { surah, ayah, reference: `${surah}:${ayah}` };
}

/** At most this many characters of search words are used. */
export const VERSE_SEARCH_WORDS_MAX = 100;

/**
 * What the verse chooser's search box asks for (Review 3 E): a verse number
 * ("94:5"), a surah number ("94": its verses in the library), words to
 * find ("patience", "صبر"), or nothing usable. Anything shaped like a number
 * is a number, so a wrong one is named as such instead of being searched as
 * words. Pure.
 */
export function verseQuery(
  value: string,
):
  | { kind: "reference"; reference: string }
  | { kind: "surah"; surah: number }
  | { kind: "words"; words: string }
  | { kind: "empty" }
  | { kind: "invalid"; typed: string } {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { kind: "empty" };
  if (/^\d{1,3}$/.test(text)) {
    const surah = Number(text);
    return surah >= 1 && surah <= SURAHS
      ? { kind: "surah", surah }
      : { kind: "invalid", typed: text };
  }
  if (/^\d{1,3}\s*:\s*\d{1,3}$/.test(text)) {
    const parsed = parseVerseReference(text);
    return parsed
      ? { kind: "reference", reference: parsed.reference }
      : { kind: "invalid", typed: text.replace(/\s/g, "") };
  }
  return { kind: "words", words: text.slice(0, VERSE_SEARCH_WORDS_MAX) };
}
