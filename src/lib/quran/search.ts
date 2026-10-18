import { verseQuery } from "./reference";
import type { QuranVerse } from "./verse";

/**
 * Finding a verse inside the fixed library (Review 3 E): by verse number,
 * by surah number, or by words of its English meaning, its surah's name or
 * its Arabic. Runs in the board's browser over the library the screen was
 * given; nothing is sent anywhere. Pure.
 */

/** At most this many verses are listed at once. */
export const VERSE_RESULTS_MAX = 20;

/** Harakat and Quranic marks, the small waw and yeh, tatweel and the verse and prostration signs. */
const NOT_LETTERS = /[\p{M}ۥۦـ۞۩]/gu;
/** Any Arabic letter. */
const ARABIC = /[؀-ۿ]/;

/**
 * Arabic as typed on a phone keyboard: no harakat or marks, and the alef,
 * yeh and teh marbuta forms folded together, so "صبر" finds "بِٱلصَّبْرِ"
 * and "الله" finds "ٱللَّهِ".
 */
export function plainArabic(text: string): string {
  return text
    .normalize("NFC")
    .replace(NOT_LETTERS, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Arabic reduced to the letters that stay put between everyday and Uthmani
 * spelling: teh marbuta, teh and a word-final heh as one letter, and no
 * alef or waw, so "صلاة", "صلوة" and "صلاه" all find "صَلَاتِهِمْ" and
 * "صَلَوَٰتِهِمْ", and "السماوات" would find "ٱلسَّمَٰوَٰتِ".
 */
export function arabicSkeleton(text: string): string {
  return plainArabic(text.replace(/ة/g, "ت"))
    .replace(/ه(?= |$)/g, "ت")
    .replace(/[او]/g, "");
}

/** A typed word whose skeleton is shorter than this is matched as typed only. */
const SKELETON_MIN = 3;

/** What the search box found, and how to say it. */
export type VerseSearch =
  | { kind: "empty" }
  | { kind: "invalid"; typed: string }
  | { kind: "not_in_library"; reference: string }
  | { kind: "none" }
  | { kind: "found"; verses: QuranVerse[]; total: number };

/** Each verse's words to search, worked out once per library. */
const indexes = new WeakMap<
  readonly QuranVerse[],
  { english: string; arabic: string; skeleton: string }[]
>();
function indexOf(library: readonly QuranVerse[]) {
  let index = indexes.get(library);
  if (!index) {
    index = library.map((verse) => ({
      english: `${verse.meaning} ${verse.surahName}`.toLowerCase(),
      arabic: plainArabic(verse.arabic),
      skeleton: arabicSkeleton(verse.arabic),
    }));
    indexes.set(library, index);
  }
  return index;
}

const found = (verses: QuranVerse[]): VerseSearch =>
  verses.length
    ? {
        kind: "found",
        verses: verses.slice(0, VERSE_RESULTS_MAX),
        total: verses.length,
      }
    : { kind: "none" };

/** The library's verses matching what was typed, in Qur'an order. */
export function searchVerses(
  library: readonly QuranVerse[],
  typed: string,
): VerseSearch {
  const query = verseQuery(typed);
  switch (query.kind) {
    case "empty":
    case "invalid":
      return query;
    case "reference": {
      const verse = library.find(
        (entry) => entry.reference === query.reference,
      );
      return verse
        ? found([verse])
        : { kind: "not_in_library", reference: query.reference };
    }
    case "surah":
      return found(
        library.filter((verse) =>
          verse.reference.startsWith(`${query.surah}:`),
        ),
      );
    case "words": {
      const words = query.words.split(" ");
      const arabic = words
        .filter((word) => ARABIC.test(word))
        .map((word) => ({
          plain: plainArabic(word),
          skeleton: arabicSkeleton(word),
        }))
        .filter((word) => word.plain);
      const english = words
        .filter((word) => !ARABIC.test(word))
        .map((word) => word.toLowerCase());
      const index = indexOf(library);
      return found(
        library.filter(
          (_, at) =>
            arabic.every(
              (word) =>
                index[at].arabic.includes(word.plain) ||
                (word.skeleton.length >= SKELETON_MIN &&
                  index[at].skeleton.includes(word.skeleton)),
            ) && english.every((word) => index[at].english.includes(word)),
        ),
      );
    }
  }
}
