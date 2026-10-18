# 0026. Qur'an verses: a fixed library of short whole verses; the board picks one per place

- Status: Accepted
- Date: 2026-10-06
- Supersedes: [ADR 0023](0023-quran-verses-picked-from-alquran-cloud.md)

## Context

[ADR 0023](0023-quran-verses-picked-from-alquran-cloud.md) let the board search api.alquran.cloud live and keep the verses it picked; review fixes PR-3 then let a verse show only some of its words, because most verses do not fit on one line beside a page heading. In his third review (2026-10-05/06, `.plans/review3-plan.md` section E) the user asked for something simpler: no trimming, no excerpts and no live calls to the Qur'an service; the site keeps a fixed library of whole verses short enough for one line, and the board picks a verse for each place from it. The board still never types Qur'an text ([ADR 0002](0002-product-principles.md)).

## Decision

- **A fixed verse library.** `public.quran_verses` holds every whole verse whose Arabic fits one line where a verse shows, by the rule `ArabicLine` sizes by (`fitsOneLine(arabicEmEstimate(arabic))` in `src/shared/ui/arabicFit.ts`: at most `ONE_LINE_ARABIC_EM` ≈ 11.47em at 0.39em per letter, so at most 29 letters, spaces and signs, harakat not counted). That is 1655 of the Qur'an's 6236 verses: the Uthmani Arabic (`quran-uthmani`) and the Saheeh International meaning (`en.sahih`) exactly as api.alquran.cloud gave them on 2026-10-06, with only the basmala the service puts before a surah's first verse left out (it is not part of that verse; 1:1 keeps it).
- **Fetched once, by a committed script.** `npx tsx scripts/page-text-seed.mjs --fetch-verses` writes `src/lib/quran/verse-library.json`; `--verses` turns it into the insert in `202610130001_one_room_verse_library.sql`. A test checks the two agree. The site never calls the Qur'an service at run time, from public pages or the dashboard.
- **Text never changes.** The table has no write grant for visitors, board members or the app's secret key, so it has no history, no archive and no restore. A wrong verse is a developer change with a new migration.
- **The board picks per place.** "Verse on each page" (page text `reminder-places`, with Preview, History and Restore) names one library verse, by reference ("94:5"), for each place. The board finds it inside the library by verse number, surah number or a word of its English meaning, surah name or Arabic (typed without harakat). Starter picks are pre-filled for the user to approve (release checklist).
- **Credit:** every verse's "?" names it and says "Translation: Saheeh International".
- **Rejected:** keeping the live search with excerpts (ADR 0023 and review fixes PR-3; the user asked for whole verses only), any verse length with wrapping (the user wants one line), measuring each verse in the browser's font to admit a few more (not repeatable in a script; the estimate errs on the wide side, so every library verse fits), a library in code only (the user asked for it in the database).
- The dhikr of the hour and the tasbih are not Qur'an verses and stay a fixed list in `content/reminders.yaml`.

## Consequences

- The `QuranSource` port, its `alquran-cloud` and `sample` adapters, the wiring choice `quran`, the excerpt columns and checks, the archive and the SGU11 error are gone (edited in place in `202610100001_page_texts.sql` and `202610130001_one_room_verse_library.sql`; no hosted database held real data).
- Public pages read one verse by reference (`ContentProvider.getVerse`, cached with no tag because it never changes); the dashboard reads the whole library (`getVerseLibrary`, in pages of 1000 rows, the Supabase API's limit) and searches it in the board's browser.
- Long verses (such as 2:255) cannot be shown. Changing the width rule, the translation or the Arabic edition is a developer change and a new ADR.
