import { quranEdition, type QuranVerse } from "../quran/verse";
import { systemText } from "../system-text";
import type { Reminder, ReminderPlace } from "./schemas";

/**
 * The verse a place names (PR5b D-24), from the library's answer, or null:
 * the library could not be read, or it has no such verse (logged for the
 * developer; the page shows no verse). Pure.
 */
export function placedVerse(
  place: ReminderPlace,
  reference: string,
  found: { verse: QuranVerse | null; unavailable: boolean },
): QuranVerse | null {
  if (found.unavailable) return null;
  if (!found.verse)
    console.warn(
      `[content] The verse ${reference} placed in "${place}" is not in the verse library.`,
    );
  return found.verse;
}

/**
 * A library verse as the reminder primitives draw it (`MarginNote`,
 * `VerseBand`, the footer): the whole verse in Arabic, its "?" meaning, the
 * reference with the surah's name, and the translator credit. Pure.
 */
export function verseReminder(verse: QuranVerse): Reminder {
  return {
    id: `q${verse.reference}`,
    arabic: verse.arabic,
    meaning: verse.meaning,
    reference: systemText.verses.reference(verse.reference, verse.surahName),
    source: quranEdition.source,
    credit: systemText.verses.credit(quranEdition.translator),
  };
}
