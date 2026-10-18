#!/usr/bin/env node
// PR5b-WP1: the one-time seed of `public.page_texts` from the starter text in content/*.yaml, and
// (Review 3 E, 2026-10-06) the fixed Qur'an verse library. Run by a developer; its output is pasted
// into a migration. After that the live site owns its page text: editing the YAML changes only the
// sandbox. The verse library never changes (ADR 0026).
//
//   npx tsx scripts/page-text-seed.mjs                  → the page_texts insert statements (stdout)
//   npx tsx scripts/page-text-seed.mjs --fetch-verses   → fetches, once, the whole Qur'an from
//       api.alquran.cloud (two requests: quran-uthmani and en.sahih) and writes
//       src/lib/quran/verse-library.json: every WHOLE verse whose Arabic fits one line where a verse
//       shows (`fitsOneLine(arabicEmEstimate(arabic))`, the rule `ArabicLine` sizes by: at most
//       ONE_LINE_ARABIC_EM ≈ 11.47em at 0.39em per letter, so at most 29 letters, spaces and signs,
//       harakat not counted). The text is kept exactly as the service gives it, except the basmala it
//       puts before a surah's first verse (not part of that verse; kept for 1:1) and a leading
//       byte-order mark.
//   npx tsx scripts/page-text-seed.mjs --verses         → the quran_verses insert statement, from the
//       committed src/lib/quran/verse-library.json (no network).
//
// Every document is validated by its schema and by the board's save rules (page-fields.ts), so
// the seeded text is text the board can save again unchanged. Nothing is written to a database.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { pageTextKeys } from "../src/lib/content/documents.ts";
import {
  mergePageText,
  pageTextSaveSchema,
  withEveryField,
} from "../src/lib/content/page-fields.ts";
import { arabicEmEstimate, fitsOneLine } from "../src/shared/ui/arabicFit.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (key) =>
  load(fs.readFileSync(path.join(root, "content", `${key}.yaml`), "utf8"));
/** A dollar-quoted SQL literal whose tag never occurs in the text. */
const quoted = (value) => {
  const tag = "$seed$";
  if (value.includes(tag)) throw new Error("Seed text contains the quote tag.");
  return `${tag}${value}${tag}`;
};

function pageTexts() {
  const lines = [];
  for (const key of pageTextKeys) {
    const raw = read(key);
    const merged = mergePageText(key, raw, withEveryField(key, raw));
    if (!merged.ok)
      throw new Error(`${key}: the field list does not fit the starter text.`);
    const parsed = pageTextSaveSchema(key).safeParse(merged.document);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `  · ${issue.message}`)
        .join("\n");
      throw new Error(
        `${key}.yaml does not pass the board's save rules:\n${problems}`,
      );
    }
    lines.push(
      `insert into public.page_texts (key, document) values ('${key}', ${quoted(JSON.stringify(parsed.data))}::jsonb);`,
    );
  }
  return lines;
}

const service = "https://api.alquran.cloud/v1";
const libraryFile = path.join(root, "src/lib/quran/verse-library.json");
/** The basmala the service puts before a surah's first verse (not part of it; PR5b E-5). */
const basmala = "بسم الله الرحمن الرحيم";
const bare = (text) =>
  text
    .normalize("NFC")
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/ٱ/g, "ا");
const withoutBasmala = (text) => {
  const words = text.split(" ");
  return bare(words.slice(0, 4).join(" ")) === basmala
    ? words.slice(4).join(" ")
    : text;
};

/** One whole edition of the Qur'an, surah by surah. */
async function edition(name) {
  const response = await fetch(`${service}/quran/${name}`);
  if (!response.ok)
    throw new Error(`${name}: the service answered ${response.status}.`);
  return (await response.json()).data.surahs;
}

async function fetchVerses() {
  const [arabic, meaning] = await Promise.all([
    edition("quran-uthmani"),
    edition("en.sahih"),
  ]);
  if (arabic.length !== 114 || meaning.length !== 114)
    throw new Error("The service did not give 114 surahs.");
  const verses = [];
  let total = 0;
  for (const [index, surah] of arabic.entries()) {
    const number = index + 1;
    if (surah.number !== number || meaning[index].number !== number)
      throw new Error(`Surah ${number} is out of order.`);
    for (const [at, ayah] of surah.ayahs.entries()) {
      const translation = meaning[index].ayahs[at];
      if (ayah.numberInSurah !== translation.numberInSurah)
        throw new Error(`${number}:${ayah.numberInSurah} does not match.`);
      total++;
      let text = ayah.text.replace(/^\uFEFF/, "");
      if (ayah.numberInSurah === 1 && number !== 1)
        text = withoutBasmala(text);
      if (!fitsOneLine(arabicEmEstimate(text))) continue;
      verses.push({
        surah: number,
        ayah: ayah.numberInSurah,
        arabic: text,
        meaning: translation.text,
      });
    }
  }
  const library = {
    surahs: arabic.map((surah) => surah.englishName),
    verses,
  };
  fs.writeFileSync(libraryFile, `${JSON.stringify(library, null, 2)}\n`);
  return [
    `Wrote ${path.relative(root, libraryFile)}: ${verses.length} of ${total} verses fit one line.`,
  ];
}

function verses() {
  const library = JSON.parse(fs.readFileSync(libraryFile, "utf8"));
  const rows = library.verses.map(
    (verse) =>
      `  (${verse.surah}, ${verse.ayah}, ${quoted(library.surahs[verse.surah - 1])}, ${quoted(verse.arabic)}, ${quoted(verse.meaning)})`,
  );
  return [
    `insert into public.quran_verses (surah, ayah, surah_name, arabic, meaning) values\n${rows.join(",\n")};`,
  ];
}

const statements = process.argv.includes("--fetch-verses")
  ? await fetchVerses()
  : process.argv.includes("--verses")
    ? verses()
    : pageTexts();
console.log(statements.join("\n"));
