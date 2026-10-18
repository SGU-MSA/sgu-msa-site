/**
 * The sections of each public page the board edits in Pages (review 3 B,
 * 2026-10-05): which sections a page has below its top, in the starter
 * order, and where each section's words are edited. The page's text
 * document stores the board's choices as `sections`: every section of the
 * page once, in the order visitors see them, each shown or hidden
 * (`pageSectionsSchema`). The page top is not in the list: it is always
 * first and always shown.
 *
 * A section's id is the id of the Pages section that edits its words
 * (`PageSection.id` in `page-fields.ts`), in this document or in another
 * one (`from: "text"`), or names a part of the page whose content comes
 * from another dashboard screen (`from: "screen"`) or whose words only the
 * site owner changes (`from: "fixed"`).
 *
 * Pure, no imports at run time: the schemas, the save rules, the public
 * pages and the editor all read it.
 */
import type { PageTextKey } from "./documents";

/** Where a page section's content is edited. */
export type SectionSource =
  /** Pages: a section of this document (`key` is the page's own) or of another one. */
  | { from: "text"; key: PageTextKey }
  /** Another dashboard screen, such as Announcements. */
  | { from: "screen"; href: string; screen: string }
  /** Words the board cannot change (ask the site owner). */
  | { from: "fixed" };

export type LayoutSection = {
  id: string;
  /** The row's name in Pages; a Pages section's own title when left out. */
  title?: string;
  source: SectionSource;
  /**
   * More Pages sections of the same page text drawn inside this one (the
   * FAQ's questions in Common questions on Home): edited in this row, shown
   * and hidden with it.
   */
  with?: readonly string[];
  /**
   * A full-width band (an inked strip across the page, such as About's
   * Contact): always the last section, never dragged (review fixes P3: a
   * band in the middle split the page's layout). It can still be hidden.
   */
  band?: true;
};

/** A Pages section of a page text. */
export type SectionRef = { key: PageTextKey; section: string };

export type PageLayout = {
  /** The Pages section of the page top: always first, always shown. */
  top: string;
  /**
   * Other Pages sections of this document that are settings, not a part of
   * the page (Support: "Show the page"): listed above the top, never moved.
   */
  settings?: readonly string[];
  sections: readonly LayoutSection[];
  /**
   * Pages sections of other page texts the page draws inside its own parts
   * (the Jumu'ah heading in Home's prayer block): edited on this page below
   * its top, never moved or hidden here.
   */
  inside?: readonly SectionRef[];
};

const text = (key: PageTextKey) => ({ from: "text", key }) as const;
const fixed = { from: "fixed" } as const;

/**
 * Every page with sections, by the document that holds its top. The order is
 * the starter order (the page as it was before the board could move
 * sections).
 */
export const pageLayouts = {
  home: {
    top: "welcome",
    sections: [
      { id: "week", source: text("home") },
      { id: "contribution", source: text("home") },
      {
        id: "updates",
        title: "Community updates",
        source: {
          from: "screen",
          href: "/admin/content/announcements",
          screen: "Announcements and Community news",
        },
      },
      { id: "visit", source: text("home") },
      { id: "features", source: text("home") },
      {
        id: "faq",
        title: "Common questions",
        source: text("faq"),
        with: ["questions"],
      },
      {
        id: "giving",
        title: "Support our community",
        source: fixed,
        band: true,
      },
    ],
    inside: [{ key: "jumuah", section: "jumuah" }],
  },
  about: {
    top: "top",
    sections: [
      { id: "mission", source: text("about") },
      { id: "what_we_do", source: text("about") },
      { id: "team", source: text("about") },
      { id: "at_sgu", source: text("about") },
      { id: "contact", source: text("about"), band: true },
    ],
  },
  prayer: {
    top: "top",
    sections: [
      { id: "times", source: text("prayer") },
      { id: "jumuah", source: text("jumuah") },
      { id: "directions", source: text("musallah") },
      { id: "gallery", source: text("musallah") },
      { id: "facilities", source: text("musallah") },
      { id: "helpers", source: text("musallah"), band: true },
    ],
  },
  events: {
    top: "top",
    sections: [{ id: "events", source: text("events") }],
  },
  community: {
    top: "top",
    sections: [{ id: "updates", source: text("community") }],
  },
  resources: {
    top: "top",
    sections: [
      { id: "library", source: text("resources") },
      { id: "archive", source: text("newsletters") },
    ],
  },
  "get-involved": {
    top: "top",
    sections: [{ id: "pathways", source: text("get-involved") }],
  },
  faq: {
    top: "top",
    sections: [{ id: "questions", source: text("faq") }],
  },
  contact: {
    top: "top",
    sections: [
      { id: "card", source: text("contact") },
      { id: "visit", source: text("contact") },
    ],
  },
  support: {
    top: "top",
    settings: ["settings"],
    sections: [
      { id: "privacy", source: text("support") },
      { id: "contacts", source: text("support") },
      { id: "professional", source: text("support") },
    ],
  },
} as const satisfies Partial<Record<PageTextKey, PageLayout>>;

/** A document that holds a page's sections. */
export type LayoutKey = keyof typeof pageLayouts;

/** The section ids of one page. */
export type SectionId<K extends LayoutKey> =
  (typeof pageLayouts)[K]["sections"][number]["id"];

/** One entry of a page's stored `sections`. */
export type ShownSection<Id extends string = string> = {
  id: Id;
  shown: boolean;
};

export const isLayoutKey = (key: string): key is LayoutKey =>
  Object.hasOwn(pageLayouts, key);

/** The section ids of a page, in the starter order. */
export function layoutIds<K extends LayoutKey>(key: K): SectionId<K>[] {
  return pageLayouts[key].sections.map(
    (section: LayoutSection) => section.id,
  ) as SectionId<K>[];
}

/** A page's starter `sections`: the starter order, everything shown. */
export function starterSections<K extends LayoutKey>(
  key: K,
): ShownSection<SectionId<K>>[] {
  return layoutIds(key).map((id) => ({ id, shown: true }));
}

/** A page's band sections (`LayoutSection.band`), always last. */
export function bandIds(key: LayoutKey): string[] {
  return pageLayouts[key].sections
    .filter((section: LayoutSection) => section.band)
    .map((section: LayoutSection) => section.id);
}

/**
 * `sections` with the page's bands moved to the end, in the starter order
 * (review fixes P3): every read and save of a page's sections goes through
 * it (`pageSectionsSchema`), so a band is never in the middle of a page.
 */
export function withBandsLast<S extends { id: string }>(
  key: LayoutKey,
  sections: readonly S[],
): S[] {
  const bands = bandIds(key);
  return [
    ...sections.filter((section) => !bands.includes(section.id)),
    ...bands.flatMap((id) => sections.filter((section) => section.id === id)),
  ];
}

/** The ids of the shown sections, in the board's order. */
export function shownIds<Id extends string>(
  sections: readonly ShownSection<Id>[],
): Id[] {
  return sections.filter((section) => section.shown).map(({ id }) => id);
}

/**
 * One place a Pages section of `key` is drawn: on `page`, in the row `row`
 * of that page's list (shown or hidden with it), or always (`row` null: an
 * `inside` part).
 */
export type SectionPlace = {
  page: LayoutKey;
  section: string;
  row: string | null;
};

/** Every place a Pages section of `key` is drawn, in `pageLayouts` order. */
export function placesOf(key: PageTextKey): SectionPlace[] {
  const places: SectionPlace[] = [];
  for (const [page, layout] of Object.entries(pageLayouts) as [
    LayoutKey,
    PageLayout,
  ][]) {
    for (const entry of layout.sections)
      if (entry.source.from === "text" && entry.source.key === key)
        for (const section of [entry.id, ...(entry.with ?? [])])
          places.push({ page, section, row: entry.id });
    for (const ref of layout.inside ?? [])
      if (ref.key === key)
        places.push({ page, section: ref.section, row: null });
  }
  return places;
}

/**
 * The pages that show the words of one Pages section (shared text, option
 * A, 2026-10-06): editing it on any of them changes it on all of them.
 */
export function pagesShowing(key: PageTextKey, section: string): LayoutKey[] {
  return [
    ...new Set(
      placesOf(key)
        .filter((place) => place.section === section)
        .map((place) => place.page),
    ),
  ];
}

/**
 * The Pages sections of other page texts a page draws (its rows, the
 * sections drawn inside them, its `inside` parts), each with the row that
 * shows it (null: always shown), in the page's starter order.
 */
export function drawnOn(
  page: PageTextKey,
): (SectionRef & { row: string | null })[] {
  if (!isLayoutKey(page)) return [];
  const layout: PageLayout = pageLayouts[page];
  return [
    ...(layout.inside ?? []).map((ref) => ({ ...ref, row: null })),
    ...layout.sections.flatMap((entry) =>
      entry.source.from === "text" && entry.source.key !== page
        ? [entry.id, ...(entry.with ?? [])].map((section) => ({
            key: (entry.source as { key: PageTextKey }).key,
            section,
            row: entry.id,
          }))
        : [],
    ),
  ];
}

/**
 * The other page texts whose sections a page shows (Jumu'ah and Musallah
 * directions on Prayer & Musallah; the FAQ and Jumu'ah on Home), in the
 * page's starter order. The page's editor edits those sections in place and
 * saves them with the page; their words stay in their own document
 * (dashboard polish, 2026-10-06).
 */
export function sharedTexts(key: PageTextKey): PageTextKey[] {
  return [...new Set(drawnOn(key).map((ref) => ref.key))];
}

/**
 * The pages the Preview of `page`'s editor can show (shared text, option
 * A): the page itself, then every other page that draws a section edited
 * there (its own text's sections, or a shared text's it draws).
 */
export function previewPages(page: PageTextKey): LayoutKey[] {
  return [
    ...new Set([
      ...(isLayoutKey(page) ? [page] : []),
      ...placesOf(page).map((place) => place.page),
      ...drawnOn(page).flatMap((ref) => pagesShowing(ref.key, ref.section)),
    ]),
  ];
}

/** The other pages whose stored `sections` show or hide a section of `key`. */
export const showingPages = (key: PageTextKey): LayoutKey[] => [
  ...new Set(
    placesOf(key)
      .filter((place) => place.page !== key && place.row !== null)
      .map((place) => place.page),
  ),
];

/**
 * The page whose `sections` show, hide and move a Pages section of another
 * document (Musallah directions on Prayer & Musallah), or null.
 */
export function layoutOwner(
  key: PageTextKey,
  section: string,
): LayoutKey | null {
  for (const [owner, layout] of Object.entries(pageLayouts) as [
    LayoutKey,
    PageLayout,
  ][])
    if (
      owner !== key &&
      layout.sections.some(
        (entry) =>
          entry.id === section &&
          entry.source.from === "text" &&
          entry.source.key === key,
      )
    )
      return owner;
  return null;
}

/**
 * The Pages sections of `key` that are hidden everywhere they are drawn
 * (`placesOf`): a section is hidden only when every page that draws it
 * hides it, by the page's stored `sections` (`document` for `key`'s own
 * page, `owners` for the others, by document). A page not given, or a part
 * drawn always (`inside`), counts as shown. Hidden sections may keep an
 * empty required box (review 3 B).
 */
export function hiddenSections(
  key: PageTextKey,
  document: unknown,
  owners: Partial<Record<LayoutKey, unknown>> = {},
): Set<string> {
  const documents: Partial<Record<LayoutKey, unknown>> = {
    ...owners,
    ...(isLayoutKey(key) ? { [key]: document } : {}),
  };
  const hiddenRows = (page: LayoutKey) =>
    new Set(
      storedSections(documents[page])
        .filter((entry) => !entry.shown)
        .map((entry) => entry.id),
    );
  const shown = new Set<string>();
  const drawn = new Set<string>();
  for (const place of placesOf(key)) {
    drawn.add(place.section);
    if (place.row === null || !hiddenRows(place.page).has(place.row))
      shown.add(place.section);
  }
  return new Set([...drawn].filter((section) => !shown.has(section)));
}

/** The `sections` a document holds, read loosely (an entry needs an id and shown). */
export function storedSections(document: unknown): ShownSection[] {
  const sections =
    typeof document === "object" && document !== null
      ? (document as { sections?: unknown }).sections
      : undefined;
  return Array.isArray(sections)
    ? sections.filter(
        (entry): entry is ShownSection =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as ShownSection).id === "string" &&
          typeof (entry as ShownSection).shown === "boolean",
      )
    : [];
}
