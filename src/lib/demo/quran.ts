import library from "../quran/verse-library.json";
import type { QuranVerse } from "../quran/verse";

/**
 * The sandbox's verse library: the same fixed verses as the live database
 * (Review 3 E; `202610150003_quran_verses.sql` is generated from
 * `verse-library.json`), in Qur'an order. Read-only, like the live table.
 */
export const sandboxVerseLibrary: readonly QuranVerse[] = library.verses.map(
  (verse) => ({
    reference: `${verse.surah}:${verse.ayah}`,
    surahName: library.surahs[verse.surah - 1],
    arabic: verse.arabic,
    meaning: verse.meaning,
  }),
);
