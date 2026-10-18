/**
 * The fixed Qur'an verse library (Review 3 E, 2026-10-06; ADR 0026): every
 * whole verse short enough for one line, stored once in `quran_verses` and
 * never changed. The board only chooses which verse shows in each place.
 * Pure and browser-safe.
 */

/** One whole verse of the library. */
export type QuranVerse = {
  /** "94:5": surah and verse number. */
  reference: string;
  /** The surah's name in English letters ("Ash-Sharh"). */
  surahName: string;
  /** Uthmani script, exactly as api.alquran.cloud gave it. */
  arabic: string;
  /** The English meaning (Saheeh International), exactly as given. */
  meaning: string;
};

/**
 * Where every library verse's text comes from (the same for all of them):
 * the "?" credit names the translator, as the service's terms ask.
 * Changing it is a developer change and a new ADR.
 */
export const quranEdition = {
  translator: "Saheeh International",
  source: "api.alquran.cloud quran-uthmani + en.sahih",
} as const;
