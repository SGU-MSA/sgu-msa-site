/**
 * One-line Arabic (review fixes PR-3, 2026-10-05; replaces PR8 D-6's
 * 26-letter rule). An Arabic verse or dhikr (`ArabicLine`) is sized to fill
 * its box on one line, from the caller's largest size down to a readable
 * smallest one; only below that does it wrap, into two balanced lines. The
 * stylesheet does the sizing (`reminders.module.css`, `.arabic`) from the
 * text's width on one line in em, `--arabic-em`: estimated here on the
 * server, then measured in the browser once the font has loaded.
 */

/** Width per letter (harakat and other marks not counted), on the wide side, for the first paint. */
export const ARABIC_EM_PER_LETTER = 0.39;
/** Room left so a text that just fits never drops its last word (the `* 1.03` in the stylesheet). */
export const ARABIC_FIT_SLACK = 1.03;

/** Harakat, Quranic annotation signs and every other combining mark. */
const MARKS = /\p{M}/gu;

/** A text's estimated width on one line, in em (before the browser measures it). */
export function arabicEmEstimate(text: string): number {
  const letters = [...text.trim().replace(MARKS, "")].length;
  return Math.round(letters * ARABIC_EM_PER_LETTER * 100) / 100;
}

/**
 * The narrowest place a Qur'an verse shows: the margin note (`MarginNote`),
 * whose box is at most 18rem wide beside a page heading, holding the rubric,
 * the "?" and the text (`--arabic-reserve: 5rem`), at its smallest readable
 * size (`--arabic-min: 1.1rem`). Mirrors `.marginArabic` in
 * reminders.module.css (a test checks the two agree).
 */
export const MARGIN_NOTE = { widthRem: 18, reserveRem: 5, minRem: 1.1 };

/** The widest text, in em, that still fits one line in every place (`MARGIN_NOTE`). */
export const ONE_LINE_ARABIC_EM =
  (MARGIN_NOTE.widthRem - MARGIN_NOTE.reserveRem) /
  MARGIN_NOTE.minRem /
  ARABIC_FIT_SLACK;

/**
 * Whether a text this wide (in em, measured or estimated) fits on one line
 * everywhere a verse shows. The fixed verse library keeps only the whole
 * verses whose estimate fits (Review 3 E; `scripts/page-text-seed.mjs
 * --fetch-verses`): at most 29 letters, spaces and signs.
 */
export function fitsOneLine(em: number): boolean {
  return em <= ONE_LINE_ARABIC_EM;
}
