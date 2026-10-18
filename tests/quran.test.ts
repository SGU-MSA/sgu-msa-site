import test from "node:test";
import assert from "node:assert/strict";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import {
  readVerseLibrary,
  VERSE_PAGE,
} from "../src/lib/community/providers/supabase";
import { sandboxVerseLibrary } from "../src/lib/demo/quran";
import {
  parseVerseReference,
  VERSE_SEARCH_WORDS_MAX,
  verseQuery,
} from "../src/lib/quran/reference";
import {
  arabicSkeleton,
  plainArabic,
  searchVerses,
  VERSE_RESULTS_MAX,
} from "../src/lib/quran/search";
import library from "../src/lib/quran/verse-library.json";

// Review 3 E (2026-10-06): the fixed verse library, its search inside the
// board's browser, and the two adapters that read it.

test("verse references: one whole verse, tidied, within the Qur'an's surahs", () => {
  assert.deepEqual(parseVerseReference(" 094 : 05 "), {
    surah: 94,
    ayah: 5,
    reference: "94:5",
  });
  for (const wrong of ["", "94", "94:5-6", "0:1", "115:1", "2:0", "a:b"])
    assert.equal(parseVerseReference(wrong), null, wrong);
});

test("the search box: a verse number, a surah number, words, or a wrong number named as one", () => {
  assert.deepEqual(verseQuery("  "), { kind: "empty" });
  assert.deepEqual(verseQuery("94 : 5"), {
    kind: "reference",
    reference: "94:5",
  });
  assert.deepEqual(verseQuery("112"), { kind: "surah", surah: 112 });
  assert.deepEqual(verseQuery("115"), { kind: "invalid", typed: "115" });
  assert.deepEqual(verseQuery("2:0"), { kind: "invalid", typed: "2:0" });
  assert.deepEqual(verseQuery("hardship  ease"), {
    kind: "words",
    words: "hardship ease",
  });
  const long = verseQuery("a".repeat(500));
  assert.equal(
    long.kind === "words" && long.words.length,
    VERSE_SEARCH_WORDS_MAX,
  );
});

test("plain Arabic: harakat, marks and letter forms folded so a phone keyboard finds the verse", () => {
  assert.equal(
    plainArabic("فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا"),
    "فان مع العسر يسرا",
  );
  assert.equal(plainArabic("ٱللَّهِ"), plainArabic("الله"));
  assert.equal(plainArabic("هُدًۭى"), "هدي");
  assert.equal(plainArabic("رَحْمَةٌۭ"), "رحمه");
  // Everyday and Uthmani spelling meet on one skeleton.
  for (const typed of ["صلاة", "صلوة", "صلاه"])
    assert.equal(arabicSkeleton(typed), "صلت", typed);
  assert.ok(arabicSkeleton("صَلَاتِهِمْ").includes("صلت"));
  assert.ok(arabicSkeleton("صَلَوَٰتِهِمْ").includes("صلت"));
  assert.equal(arabicSkeleton("السماوات"), arabicSkeleton("ٱلسَّمَٰوَٰتِ"));
  assert.equal(arabicSkeleton("ايمان"), arabicSkeleton("إِيمَٰن"));
});

test("searching the library: by number, by surah, by English or Arabic words, at most 20 shown", () => {
  const found = (typed: string) => searchVerses(sandboxVerseLibrary, typed);
  const one = found("94:5");
  assert.equal(one.kind, "found");
  assert.deepEqual(
    one.kind === "found" && one.verses.map((verse) => verse.reference),
    ["94:5"],
  );
  // A real verse too long for one line, and one that does not exist.
  assert.deepEqual(found("2:255"), {
    kind: "not_in_library",
    reference: "2:255",
  });
  assert.deepEqual(found("2:999"), {
    kind: "not_in_library",
    reference: "2:999",
  });
  assert.deepEqual(found("200:1"), { kind: "invalid", typed: "200:1" });
  const surah = found("112");
  assert.deepEqual(
    surah.kind === "found" && surah.verses.map((verse) => verse.reference),
    ["112:1", "112:2", "112:3", "112:4"],
  );
  // Every English word must be there; capitals do not matter.
  const ease = found("Hardship EASE");
  assert.deepEqual(
    ease.kind === "found" && ease.verses.map((verse) => verse.reference),
    ["94:5", "94:6"],
  );
  // Arabic typed without harakat, with a plain alef.
  const arabic = found("مع العسر");
  assert.deepEqual(
    arabic.kind === "found" && arabic.verses.map((verse) => verse.reference),
    ["94:5", "94:6"],
  );
  // Everyday spelling finds the Uthmani text: "prayer" in 23:2 and 23:9.
  for (const typed of ["صلاة", "صلوة", "صلاه", "صلاتهم"]) {
    const prayer = found(typed);
    assert.ok(prayer.kind === "found", typed);
    const references = prayer.verses.map((verse) => verse.reference);
    assert.ok(
      references.includes("23:2") && references.includes("23:9"),
      typed,
    );
  }
  // The surah's name counts as a word.
  assert.equal(found("Ash-Sharh").kind, "found");
  assert.deepEqual(found("zzzz"), { kind: "none" });
  // Many matches: the first 20 in Qur'an order, and how many there are.
  const many = found("Allah");
  assert.ok(many.kind === "found");
  assert.equal(many.verses.length, VERSE_RESULTS_MAX);
  assert.ok(many.total > VERSE_RESULTS_MAX);
  assert.equal(many.verses[0].reference, "1:1");
});

test("the sandbox reads the same fixed library as the live database, verse by verse", async () => {
  assert.equal(sandboxVerseLibrary.length, library.verses.length);
  assert.deepEqual(sandboxVerseLibrary[0], {
    reference: "1:1",
    surahName: "Al-Faatiha",
    arabic: library.verses[0].arabic,
    meaning: library.verses[0].meaning,
  });
  const provider = createMockContentProvider(new Date("2033-01-10T12:00:00Z"));
  const found = await provider.getVerse("94:5");
  assert.equal(
    found.verse?.meaning,
    "For indeed, with hardship [will be] ease.",
  );
  assert.equal((await provider.getVerse("2:255")).verse, null);
  const whole = await provider.getVerseLibrary();
  assert.equal(whole.verses.length, library.verses.length);
  assert.equal(whole.unavailable, false);
});

/** A Supabase client stand-in answering `from().select().order().order().range()` from `rows`. */
function pagedClient(rows: unknown[], failAt?: number) {
  const ranges: [number, number][] = [];
  const query = {
    select: () => query,
    order: () => query,
    range: async (from: number, to: number) => {
      ranges.push([from, to]);
      if (failAt === from)
        return { data: null, error: { message: "unreachable" } };
      return { data: rows.slice(from, to + 1), error: null };
    },
  };
  const client = { from: () => query } as unknown as Parameters<
    typeof readVerseLibrary
  >[0];
  return { client, ranges };
}

test("the live library is read a page of 1000 rows at a time, all of it or nothing", async () => {
  const rows = library.verses.map((verse) => ({
    reference: `${verse.surah}:${verse.ayah}`,
    surah_name: library.surahs[verse.surah - 1],
    arabic: verse.arabic,
    meaning: verse.meaning,
  }));
  const { client, ranges } = pagedClient(rows);
  const read = await readVerseLibrary(client);
  assert.equal(read.unavailable, false);
  assert.deepEqual(read.verses, sandboxVerseLibrary);
  assert.deepEqual(ranges, [
    [0, VERSE_PAGE - 1],
    [VERSE_PAGE, 2 * VERSE_PAGE - 1],
  ]);
  // A page that fails leaves no half library.
  const failing = pagedClient(rows, VERSE_PAGE);
  assert.deepEqual(await readVerseLibrary(failing.client), {
    verses: [],
    unavailable: true,
    provenance: "live",
  });
  assert.equal((await readVerseLibrary(null)).unavailable, true);
});
