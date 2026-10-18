"use client";
import { useEffect, useRef, type ReactNode } from "react";

import { AboutChapters } from "@/features/about/AboutChapters";
import { CalendarBody } from "@/features/calendar/CalendarBody";
import { CommunityFrontPage } from "@/features/community/CommunityFrontPage";
import { ContactCallingCard } from "@/features/contact/ContactCallingCard";
import { FaqSheet } from "@/features/faq/FaqSheet";
import { HomeBody } from "@/features/home/HomeBody";
import { GetInvolvedBody } from "@/features/involve/GetInvolvedBody";
import { NowWearing } from "@/features/merch/NowWearing";
import { PrayerBody } from "@/features/prayer/PrayerBody";
import { ResourcesBody } from "@/features/resources/ResourcesBody";
import { SupportSections } from "@/features/support/SupportSections";
import type { EditorialDocuments } from "@/lib/content/documents";
import {
  pageFields,
  placeNames,
  previewPageText,
  type PageTextKey,
} from "@/lib/content/page-fields";
import { verseReminder } from "@/lib/content/reminders";
import {
  reminderPlaces,
  type ReminderPlacesContent,
} from "@/lib/content/schemas";
import type { QuranVerse } from "@/lib/quran/verse";
import { formDestination } from "@/lib/integrations/form-destination";
import { scheduleNotice } from "@/lib/prayer/congregation";
import { fixBeforeSaving, systemText } from "@/lib/system-text";
import { Footer } from "@/shared/layout/Footer";
import { pageSectionSelector } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { FormCtaView } from "@/shared/ui/FormCtaView";
import quiet from "@/shared/ui/page.module.css";
import { PaperLayers } from "@/shared/ui/PaperLayers";

import { hiddenSections, sharedTexts } from "@/lib/content/page-layouts";
import { hiddenOnPage, type PageTexts } from "./page-form";
import type { PreviewLive, PreviewLiveData } from "./preview-live";
import { VersePreview } from "./VersePreview";

/** The page's paper, as the public page wraps its body. */
function Paper({
  layers = false,
  children,
}: {
  layers?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={quiet.page}>
      {layers ? <PaperLayers /> : null}
      {children}
    </div>
  );
}

/**
 * "Verse on each page" (PR5b WP7, Review 3 E): each place with the verse chosen for it,
 * drawn by the margin note the pages use (its "?" holds the meaning, the
 * reference and the translator credit), or "No verse on this page".
 */
function VersePlacesPreview({
  places,
  verses,
}: {
  places: ReminderPlacesContent["places"];
  verses: readonly QuranVerse[];
}) {
  return (
    <Paper>
      <Container>
        {reminderPlaces.map((place) => {
          const verse = verses.find(
            (entry) => entry.reference === places[place],
          );
          return (
            <section
              key={place}
              className={`${quiet.rule} verse-preview-place`}
            >
              <h2 className={quiet.h2Small}>{placeNames[place]}</h2>
              {verse ? (
                <>
                  <VersePreview verse={verse} />
                  <p className={quiet.small}>
                    {verseReminder(verse).reference}
                  </p>
                </>
              ) : (
                <p className={quiet.small}>{systemText.pages.noVerse}</p>
              )}
            </section>
          );
        })}
      </Container>
    </Paper>
  );
}

/**
 * The parts of a page only the server draws (review 3 B), drawn by the
 * dashboard page for its preview: the featured notice and community updates
 * on Home, the "Find us on campus" map.
 */
export type PreviewSlots = {
  notice?: ReactNode;
  feed?: ReactNode;
  map?: ReactNode;
};

/**
 * A shared page text (`sharedTexts`), as typed, over the live data of a
 * page that shows it, by page (dashboard polish, 2026-10-06; shared text,
 * option A): the Preview of Prayer & Musallah draws the Jumu'ah and
 * Musallah directions words typed on it, Home the FAQ and the Jumu'ah
 * heading, and each page in the Preview's page switcher the words typed on
 * the screen that opened it.
 */
const jumuahOver = <L extends { gatherings: unknown; change: unknown }>(
  live: L,
  jumuah: EditorialDocuments["jumuah"],
): L => ({
  ...live,
  ...jumuah,
  gatherings: live.gatherings,
  change: live.change,
});
const sharedOver = {
  prayer: {
    jumuah: (
      live: PreviewLiveData["prayer"],
      jumuah: EditorialDocuments["jumuah"],
    ) => ({
      ...live,
      body: { ...live.body, jumuah: jumuahOver(live.body.jumuah, jumuah) },
    }),
    musallah: (
      live: PreviewLiveData["prayer"],
      musallah: EditorialDocuments["musallah"],
    ) => ({ ...live, body: { ...live.body, musallah } }),
  },
  home: {
    faq: (live: PreviewLiveData["home"], faq: EditorialDocuments["faq"]) => ({
      ...live,
      faq,
    }),
    jumuah: (
      live: PreviewLiveData["home"],
      jumuah: EditorialDocuments["jumuah"],
    ) => ({
      ...live,
      live: {
        ...live.live,
        today: {
          ...live.live.today,
          jumuah: jumuahOver(live.live.today.jumuah, jumuah),
        },
      },
    }),
  },
  resources: {
    newsletters: (
      live: PreviewLiveData["resources"],
      newsletters: EditorialDocuments["newsletters"],
    ) => ({
      ...live,
      newsletters: {
        ...newsletters,
        issues: live.newsletters.issues,
        unavailable: live.newsletters.unavailable,
      },
    }),
  },
} satisfies Partial<
  Record<
    PageTextKey,
    Partial<Record<PageTextKey, (live: never, document: never) => object>>
  >
>;

/**
 * The live data with each typed shared text over it, or the problems a
 * save would name in them.
 */
function withShared(
  live: PreviewLive,
  page: unknown,
  shared: PageTexts,
): { data: unknown; problems: string[] } {
  let data: unknown = live.data;
  const problems: string[] = [];
  const over: Partial<
    Record<PageTextKey, (live: unknown, document: unknown) => object>
  > = (sharedOver as Partial<Record<PageTextKey, object>>)[live.key] ?? {};
  for (const key of sharedTexts(live.key)) {
    const draw = over[key];
    if (!draw || shared[key] === undefined) continue;
    const typed = shared[key];
    const result = previewPageText(
      key,
      typed,
      new Set([
        ...hiddenSections(key, typed),
        ...hiddenOnPage(key, live.key, page),
      ]),
    );
    if (!result.ok) problems.push(...result.problems);
    else data = draw(data, result.document);
  }
  return { data, problems };
}

/**
 * Another page in the Preview's page switcher (shared text, option A): its
 * stored words, what it shows besides them, its server-drawn parts and its
 * sections hidden on other pages, read when the editor opens.
 */
export type OtherPagePreview = {
  key: PageTextKey;
  document: unknown;
  live: PreviewLive;
  slots: PreviewSlots;
  hidden: readonly string[];
};

type Preview<K extends PageTextKey> = (
  document: EditorialDocuments[K],
  live: PreviewLiveData[K],
  slots: PreviewSlots,
) => ReactNode;

/**
 * Each page drawn whole by its own public components (PR5b WP4, never a
 * copy of their markup) from the typed text, the live data the server read
 * (`previewLive`) and the server's slots: its sections in the board's order,
 * without the hidden ones (review 3 B). null: no picture yet (the Donate
 * opening waits for the Donate page to read it).
 */
const pagePreviews: { [K in PageTextKey]: Preview<K> | null } = {
  home: (home, live, slots) => (
    <Paper layers>
      <HomeBody
        home={home}
        faq={live.faq}
        live={live.live}
        givingOpen={live.givingOpen}
        verses={live.verses}
        notice={slots.notice}
        feed={slots.feed}
        map={slots.map}
      />
    </Paper>
  ),
  about: (about, live) => (
    <Paper layers>
      <AboutChapters about={about} team={live.team} verse={live.verse} />
    </Paper>
  ),
  prayer: (prayer, live, slots) => (
    <Paper layers>
      <PrayerBody
        {...live.body}
        prayer={{
          ...prayer,
          times: live.body.prayer.times,
          last_updated_label: live.body.prayer.last_updated_label,
          notice: scheduleNotice(prayer, live.schedule),
        }}
        map={slots.map}
      />
    </Paper>
  ),
  jumuah: (jumuah, live, slots) => (
    <Paper layers>
      <PrayerBody
        {...sharedOver.prayer.jumuah(live, jumuah).body}
        map={slots.map}
      />
    </Paper>
  ),
  musallah: (musallah, live, slots) => (
    <Paper layers>
      <PrayerBody
        {...sharedOver.prayer.musallah(live, musallah).body}
        map={slots.map}
      />
    </Paper>
  ),
  events: (events, live) => (
    <Paper>
      <CalendarBody
        content={events}
        entries={live.entries}
        lists={live.lists}
        today={live.today}
        unavailable={live.unavailable}
        verse={live.verse}
        subscribe={live.subscribe}
      />
    </Paper>
  ),
  community: (community, live) => (
    <CommunityFrontPage
      content={community}
      feed={live.feed}
      verse={live.verse}
    />
  ),
  newsletters: (newsletters, live) => (
    <Paper layers>
      <ResourcesBody
        content={live.resources}
        newsletters={
          sharedOver.resources.newsletters(live, newsletters).newsletters
        }
        initialCategory="all"
        categories={live.categories}
        verse={live.verse}
      />
    </Paper>
  ),
  resources: (resources, live) => (
    <Paper layers>
      <ResourcesBody
        content={resources}
        newsletters={live.newsletters}
        initialCategory="all"
        categories={live.categories}
        verse={live.verse}
      />
    </Paper>
  ),
  "get-involved": (content, live) => (
    <Paper layers>
      <GetInvolvedBody
        content={content}
        forms={live.forms}
        verse={live.verse}
      />
    </Paper>
  ),
  forms: (forms) => {
    const field = pageFields.forms.sections[0].fields[0];
    const where = field.kind === "entries" ? field.where : {};
    return (
      <Paper>
        <Container>
          {Object.entries(forms.forms).map(([key, entry]) => (
            <section key={key} className={quiet.rule}>
              <h2 className={quiet.h2Small}>{entry.label}</h2>
              {where[key] ? (
                <p className={quiet.small}>
                  {systemText.pages.shownOn(where[key])}
                </p>
              ) : null}
              <div className={quiet.actions}>
                <FormCtaView destination={formDestination(forms, key)} />
              </div>
            </section>
          ))}
        </Container>
      </Paper>
    );
  },
  faq: (faq) => (
    <Paper>
      <FaqSheet faq={faq} />
    </Paper>
  ),
  donate: null,
  contact: (contact, live, slots) => (
    <Paper layers>
      <ContactCallingCard
        content={contact}
        email={live.email}
        social={live.social}
        map={slots.map}
      />
    </Paper>
  ),
  support: (support) => <SupportSections support={support} />,
  integrations: null,
  site: (site, live) => (
    <Footer
      name={site.brand.name}
      shortName={site.brand.short_name}
      university={site.brand.university}
      tagline={site.brand.tagline}
      quickLinks={live.footer.quick_links}
      socialLinks={site.social}
      email={site.brand.email}
      year={live.year}
      adminLink={live.footer.admin_link ?? null}
    />
  ),
  "reminder-places": (document, live) => (
    <VersePlacesPreview places={document.places} verses={live.verses} />
  ),
  merch: (merch, live) => (
    <Paper layers>
      <NowWearing content={merch} data={live.data} />
    </Paper>
  ),
};

/**
 * Whether the Pages editor shows a Preview: a page with no picture yet
 * and no page on the website (the Go2Pay receipt note) has nothing to show.
 */
export const hasPagePreview = (key: PageTextKey) =>
  pagePreviews[key] !== null || pageFields[key].publicPath !== null;

/**
 * Preview of the Pages editor: the whole page as the typed text
 * would show it, scrolled to the section being edited (review 3 B), or what
 * a save would refuse. Inert inside `EditorPreview`.
 */
export function PagePreview({
  document,
  shared = {},
  live,
  slots,
  hidden,
  focus,
}: {
  /** The editor's document as typed. */
  document: unknown;
  /** The shared page texts the page shows, as typed (`sharedTexts`). */
  shared?: PageTexts;
  live: PreviewLive;
  slots: PreviewSlots;
  /** This document's sections hidden on another page (`hiddenSections`). */
  hidden: ReadonlySet<string>;
  /** The section being edited, to scroll to; none: the top of the page. */
  focus: string | null;
}) {
  const draw = pagePreviews[live.key] as Preview<PageTextKey> | null;
  const own = draw
    ? previewPageText(
        live.key,
        document,
        new Set([...hiddenSections(live.key, document), ...hidden]),
      )
    : null;
  const others = withShared(live, document, shared);
  const problems = [
    ...new Set([...(own && !own.ok ? own.problems : []), ...others.problems]),
  ];
  const result =
    own && problems.length ? { ok: false as const, problems } : own;
  const shown = useRef<HTMLDivElement>(null);
  // Opening the tab shows the section being edited (it has no box of its
  // own when it is drawn inside another, so its first child is used).
  useEffect(() => {
    if (!result?.ok || !focus) return;
    const section = shown.current?.querySelector(pageSectionSelector(focus));
    const target = section?.firstElementChild ?? null;
    target?.scrollIntoView({ block: "start" });
    // Once, when the tab opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!draw || !result)
    return <p className="muted">{systemText.pages.previewLater}</p>;
  if (!result.ok)
    return (
      <div role="note">
        {result.problems.length > 1 ||
        result.problems[0] !== systemText.messages.outOfDate ? (
          <p>{fixBeforeSaving(result.problems.length)}</p>
        ) : null}
        <ul>
          {result.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <div ref={shown}>
      {draw(result.document as never, others.data as never, slots)}
    </div>
  );
}
