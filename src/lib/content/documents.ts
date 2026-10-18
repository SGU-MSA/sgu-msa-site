/**
 * The editorial documents: one schema and one fallback per document.
 *
 * Every `EditorialSource` adapter (YAML today, Supabase in PR5) parses through
 * `parseEditorialDocument`, so a document validates and degrades the same way
 * whatever stores it. Keys are the `content/*.yaml` basenames.
 */
import type { z } from "zod";
import {
  aboutSchema,
  communitySchema,
  contactSchema,
  donateSchema,
  eventsFileSchema,
  faqSchema,
  formsSchema,
  getInvolvedSchema,
  homeSchema,
  integrationsSchema,
  jumuahSchema,
  merchSchema,
  musallahSchema,
  newslettersSchema,
  prayerSchema,
  reminderPlaces,
  reminderPlacesSchema,
  remindersSchema,
  resourcesSchema,
  siteSchema,
  supportSchema,
  type AboutContent,
  type CommunityContent,
  type ContactContent,
  type DonateContent,
  type EventsContent,
  type FAQContent,
  type FormsContent,
  type GetInvolvedContent,
  type HomeContent,
  type IntegrationsContent,
  type JumuahContent,
  type MerchContent,
  type MusallahContent,
  type NewslettersContent,
  type PrayerContent,
  type ReminderPlacesContent,
  type RemindersContent,
  type ResourcesContent,
  type SiteContent,
  type SupportContent,
} from "./schemas";
import { starterSections } from "./page-layouts";

/** Document key → validated shape. */
export type EditorialDocuments = {
  site: SiteContent;
  prayer: PrayerContent;
  jumuah: JumuahContent;
  musallah: MusallahContent;
  events: EventsContent;
  faq: FAQContent;
  resources: ResourcesContent;
  newsletters: NewslettersContent;
  merch: MerchContent;
  support: SupportContent;
  forms: FormsContent;
  home: HomeContent;
  about: AboutContent;
  "get-involved": GetInvolvedContent;
  integrations: IntegrationsContent;
  reminders: RemindersContent;
  donate: DonateContent;
  contact: ContactContent;
  community: CommunityContent;
  "reminder-places": ReminderPlacesContent;
};

export type EditorialKey = keyof EditorialDocuments;

/**
 * The documents the board edits from the dashboard (PR5b): one
 * `public.page_texts` row each, in this order on the Pages screen. The
 * season pages (Ramadan's included) are the seasons' own (PR5c); `reminders` (the dhikr of the hour and the
 * tasbih) stays developer-owned YAML (D-24).
 */
export const pageTextKeys = [
  "home",
  "about",
  "prayer",
  "jumuah",
  "musallah",
  "events",
  "community",
  "newsletters",
  "resources",
  "get-involved",
  "forms",
  "faq",
  "donate",
  "contact",
  "support",
  "integrations",
  "site",
  "reminder-places",
  "merch",
] as const satisfies readonly EditorialKey[];
export type PageTextKey = (typeof pageTextKeys)[number];

/** Whether a document is stored in `page_texts` (the dhikr and tasbih stay YAML). */
export function isPageTextKey(key: string): key is PageTextKey {
  return (pageTextKeys as readonly string[]).includes(key);
}

/**
 * The developer-owned parts of page-text documents (D-22): no Pages field
 * edits them, so they always come from `content/*.yaml` (a developer change
 * and a deploy), laid over whatever the stored row or the fallback holds.
 * A test checks that every YAML part is either a board field or listed here.
 */
export const developerOwnedPaths: Partial<
  Record<PageTextKey, readonly string[]>
> = {
  site: ["brand.logo", "meta.keywords", "navigation", "header_cta", "footer"],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `document` with its developer-owned parts taken from `developer` (the YAML
 * document). A part is set only where its parent object exists in both and
 * the YAML has it, so the result keeps the document's validated shape.
 */
export function withDeveloperParts<K extends EditorialKey>(
  key: K,
  document: EditorialDocuments[K],
  developer: EditorialDocuments[K],
): EditorialDocuments[K] {
  const paths = isPageTextKey(key) ? developerOwnedPaths[key] : undefined;
  if (!paths) return document;
  const result: unknown = structuredClone(document);
  for (const path of paths) {
    const segments = path.split(".");
    const last = segments.pop()!;
    let target: unknown = result;
    let source: unknown = developer;
    for (const segment of segments) {
      target = isRecord(target) ? target[segment] : undefined;
      source = isRecord(source) ? source[segment] : undefined;
    }
    if (isRecord(target) && isRecord(source) && source[last] !== undefined)
      target[last] = structuredClone(source[last]);
  }
  return result as EditorialDocuments[K];
}

type EditorialDocument<T> = { schema: z.ZodType<T>; fallback: T };

/** One document as an adapter read it: `unavailable` when the fallback stands in. */
export type EditorialRead<K extends EditorialKey> = {
  document: EditorialDocuments[K];
  unavailable: boolean;
};

/* ------------------------------------------------------------- fallbacks --
 * Deliberately minimal. If a document is unreadable the page still renders
 * with honest "not configured" copy rather than crashing or inventing data.
 */

const emptyHero = {
  title: "SGU MSA",
  eyebrow: null,
  description: null,
  image: null,
};

export const editorialDocuments: {
  [K in EditorialKey]: EditorialDocument<EditorialDocuments[K]>;
} = {
  site: {
    schema: siteSchema,
    fallback: {
      brand: {
        name: "SGU Muslim Students Association",
        short_name: "SGU MSA",
        university: "St. George’s University Muslim Students Association",
        tagline: "Faith. Knowledge. Community.",
        email: null,
        logo: {
          src: "/images/brand/msa-logo.webp",
          alt: "SGU MSA logo",
          historical: false,
        },
      },
      navigation: [{ label: "Home", href: "/" }],
      header_cta: null,
      footer: {
        quick_links: [],
        admin_link: null,
      },
      social: [],
      meta: null,
    },
  },
  prayer: {
    schema: prayerSchema,
    fallback: {
      hero: { ...emptyHero, title: "Prayer & Musallah" },
      sections: starterSections("prayer"),
      heading: "Daily Iqamah Times",
      last_updated_label: null,
      notice: "Prayer times are subject to change.",
      schedule_note:
        "Congregation times set by the MSA; separate from calculated prayer start times.",
      no_schedule_note:
        "A current congregation schedule has not yet been published.",
      unavailable_note:
        "The schedule is temporarily unavailable. Please check with the MSA before travelling.",
      times: [],
    },
  },
  jumuah: {
    schema: jumuahSchema,
    fallback: {
      heading: "Jumu’ah",
      note: null,
      gatherings: [],
    },
  },
  musallah: {
    schema: musallahSchema,
    fallback: {
      route: {
        heading: "Find the Musallah",
        subheading: null,
        directions_heading: "Written directions",
        directions: [],
        landmark_note: null,
      },
      facilities: {
        heading: "Musallah information",
        note: null,
        items: [],
      },
      helper_cta: {
        eyebrow: null,
        heading: "Help care for the space.",
        body: "Students help keep the Musallah welcoming, organized, and ready for the community.",
        form: "musallah_helper",
      },
      gallery: [],
    },
  },
  events: {
    schema: eventsFileSchema,
    fallback: {
      hero: { ...emptyHero, title: "Calendar" },
      sections: starterSections("events"),
      empty_message: "No public events currently listed.",
    },
  },
  faq: {
    schema: faqSchema,
    fallback: {
      hero: null,
      sections: starterSections("faq"),
      eyebrow: null,
      heading: "Common Questions",
      items: [],
    },
  },
  resources: {
    schema: resourcesSchema,
    fallback: {
      hero: { ...emptyHero, title: "Resources" },
      sections: starterSections("resources"),
      search_placeholder: "Search resources…",
      empty_message: "No resources match this search.",
      items: [],
    },
  },
  newsletters: {
    schema: newslettersSchema,
    fallback: {
      heading: "Newsletter Archive",
      note: null,
      issues: [],
    },
  },
  merch: {
    schema: merchSchema,
    fallback: {
      hero: { ...emptyHero, title: "Merch" },
      garment_note: null,
    },
  },
  support: {
    schema: supportSchema,
    fallback: {
      enabled: false,
      sections: starterSections("support"),
      prototype_notice: true,
      prototype_label: "Proposed Student Support Service",
      governance_notice: null,
      hero: { ...emptyHero, title: "Need someone to talk to?" },
      privacy: { heading: "Discreet & Respectful", body: "" },
      contacts: {
        heading: "Who you can reach",
        note: null,
        items: [],
      },
      professional: {
        heading: "Professional SGU Support",
        body: null,
        items: [],
      },
    },
  },
  forms: {
    schema: formsSchema,
    fallback: { forms: {} },
  },
  home: {
    schema: homeSchema,
    fallback: {
      sections: starterSections("home"),
      hero: {
        eyebrow: "Faith. Knowledge. Community.",
        headline: "Muslim life",
        emphasis: "at SGU.",
        body: [],
        image: {
          src: "/images/placeholder/editorial.svg",
          alt: "",
          historical: false,
        },
        primary_cta: { label: "What’s happening", href: "/calendar" },
        secondary_cta: { label: "Find the Musallah", href: "/prayer" },
        aside: { arabic: "شكر", transliteration: "Shukr", quote: "" },
      },
      week: {
        heading: "This week at MSA",
        empty_message: "No public events currently listed.",
      },
      visit: {
        image: {
          src: "/images/placeholder/editorial.svg",
          alt: "",
          historical: false,
        },
      },
      contribution: { heading: "Our community, built by students", items: [] },
      features: [],
    },
  },
  about: {
    schema: aboutSchema,
    fallback: {
      hero: { ...emptyHero, title: "About SGU MSA" },
      sections: starterSections("about"),
      mission: { heading: "Our Mission", body: [] },
      what_we_do: { heading: "What We Do", items: [] },
      board: {
        heading: "Our team",
        note: null,
      },
      at_sgu: { heading: "MSA at SGU", body: [], image: null },
      contact: { heading: "Contact", body: null, email: null, note: null },
    },
  },
  "get-involved": {
    schema: getInvolvedSchema,
    fallback: {
      hero: { ...emptyHero, title: "Get Involved" },
      sections: starterSections("get-involved"),
      intro: null,
      pathways: [],
    },
  },
  integrations: {
    schema: integrationsSchema,
    fallback: {
      payments: { receipt_note: null },
    },
  },
  donate: {
    schema: donateSchema,
    fallback: {
      eyebrow: null,
      title: "Support our community",
      emphasis: null,
      lede: null,
    },
  },
  contact: {
    schema: contactSchema,
    fallback: {
      sections: starterSections("contact"),
      eyebrow: null,
      title: "Contact",
      description: null,
      card: {
        heading: "Get in touch",
        email_intro: null,
        no_email: "Contact details will be published here.",
      },
      visit: {
        heading: "Find the Musallah",
        body: null,
        link_label: "View directions",
      },
    },
  },
  community: {
    schema: communitySchema,
    fallback: {
      sections: starterSections("community"),
      eyebrow: null,
      title: "Community updates",
      description: null,
      empty_title: "There are no current updates.",
      empty_hint: null,
    },
  },
  // No verse in any place while the placements cannot be read.
  "reminder-places": {
    schema: reminderPlacesSchema,
    fallback: {
      places: Object.fromEntries(
        reminderPlaces.map((place) => [place, null]),
      ) as ReminderPlacesContent["places"],
    },
  },
  // No second copy of any Arabic text: an unreadable file shows no reminders
  // (and fails `npm run validate:content`, so it never reaches a deploy).
  reminders: {
    schema: remindersSchema,
    fallback: { dhikr: [], tasbih: null },
  },
};

export const editorialKeys = Object.keys(editorialDocuments) as EditorialKey[];

/**
 * Validates one raw document. A document that does not match its schema must
 * never white-screen the site: the problem is logged for the developer and
 * the caller receives the documented fallback, so a bad edit degrades one
 * section rather than the whole page. `source` names it in the log.
 */
export function parseEditorialDocument<K extends EditorialKey>(
  key: K,
  raw: unknown,
  source: string,
): EditorialRead<K> {
  const { schema, fallback } = editorialDocuments[key];
  const result = schema.safeParse(raw ?? {});
  if (result.success) return { document: result.data, unavailable: false };
  const issues = result.error.issues
    .slice(0, 8)
    .map((issue) => `  · ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  console.warn(
    `[content] ${source} did not match its schema; using fallback.\n${issues}`,
  );
  return { document: fallback, unavailable: true };
}

/** The fallback for a document that could not be read at all, logged. */
export function unreadableEditorialDocument<K extends EditorialKey>(
  key: K,
  source: string,
  error: unknown,
): EditorialRead<K> {
  console.warn(
    `[content] ${source} could not be read; using fallback.`,
    error instanceof Error ? error.message : error,
  );
  return { document: editorialDocuments[key].fallback, unavailable: true };
}
