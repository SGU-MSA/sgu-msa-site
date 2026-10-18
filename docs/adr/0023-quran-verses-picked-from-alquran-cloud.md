# 0023. Qur'an verses: the board picks from api.alquran.cloud; text saved unaltered; no typing

- Status: Superseded by [0026](0026-fixed-quran-verse-library.md)
- Date: 2026-10-05

## Context

Each public page can show one Qur'an verse beside a section, and the footer shows one on every page ([ADR 0018](0018-design-direction-quiet-paper.md)). Until PR5b the verses were typed into `content/reminders.yaml` and picked by id in code, so the board could not change them, and a typed verse can carry a typing mistake. The board wants to choose verses itself ([ADR 0002](0002-product-principles.md)), and the user ruled that the board "never types, chooses from options" (PR5b contract D-24, answers Q37 and Q39 of 2026-10-05). The project uses free tools only ([ADR 0009](0009-free-tools-only.md)). Full reasoning: [PR5b contract](../contracts/pr5b-page-text-forms-reminders.md).

## Decision

- **The board searches and picks; nobody types Qur'an text.** The dashboard screen Pages → Qur'an verses searches api.alquran.cloud (free, no key, no account) by number ("2:255", or up to `VERSE_RANGE_MAX = 3` verses in a row such as "2:255-257") or by words in English or Arabic. "Use this verse" sends only the reference; the server fetches the Uthmani Arabic and the Saheeh International meaning itself and stores them, with the reference, the surah's name and the translator, in `public.quran_verses`.
- **Text saved unaltered and fixed.** The stored text is exactly what the service gave (only the basmala the service puts before a surah's first verse is left out: it is not part of that verse). The database refuses any later change to it (SGU11); a wrong verse is archived and picked again. No delete (ADR 0013).
- **Public pages read only our database.** Which verse shows where is the page text `reminder-places`; pages read it and the library through `reminderFor(place)` and never call the service. If the service is down, only the dashboard search stops.
- **Credit:** every verse's "?" names it and says "Translation: Saheeh International", as the service's terms ask.
- **Rejected:** a reviewed fixed list kept by developers (the board could not add verses); the board typing verses (mistakes in scripture); the Quran Foundation API (quran.com v4), because it needs a registered app with OAuth credentials and forbids keeping its content more than a week without its sync service.
- The dhikr of the hour and the tasbih are not Qur'an verses and stay developer-owned in `content/reminders.yaml`.
- This supersedes, for Qur'an verses only, ADR 0018's line that verse strings are reviewed by the board before launch: the board now picks each verse from the service, which is that review. The rest of ADR 0018 stands.

## Consequences

- The Qur'an service sits behind the `QuranSource` port (`src/lib/quran/providers/`, adapters `alquran-cloud` and `sample`), chosen only in `src/lib/runtime/providers.ts`; dashboard server actions are its only callers (5 s timeout, no retry, search on submit only).
- The verse library starts empty: a page shows no verse until the board picks one (release checklist).
- Changing the translation or the Arabic edition is a developer change and a new ADR; verses already saved keep their text.
- The service is free and run by volunteers with no uptime promise; the public site does not depend on it.
