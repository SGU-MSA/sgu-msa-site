import { z } from "../validation/zod";
import { dateSchema } from "../validation/date-time";
import { outOfDate } from "../system-text";
import { eventStatuses } from "../community/schema";
import { categoryTones } from "../community/lists";
import {
  layoutIds,
  withBandsLast,
  type LayoutKey,
  type SectionId,
} from "./page-layouts";

/**
 * A list whose bad entries are dropped rather than failing the whole file.
 *
 * Without this, one malformed event blanks the entire calendar and the site
 * renders "No public events currently listed." as though the MSA had cancelled
 * its programming. An editor should lose the entry they got wrong, not the
 * twenty they got right.
 */
export function tolerantArray<T>(itemSchema: z.ZodType<T>, label: string) {
  return z
    .array(z.unknown())
    .default([])
    .transform((items) => {
      const kept: T[] = [];
      items.forEach((item, index) => {
        const result = itemSchema.safeParse(item);
        if (result.success) {
          kept.push(result.data);
          return;
        }
        const issue = result.error.issues[0];
        const at = issue?.path.length ? `.${issue.path.join(".")}` : "";
        // Name the entry where we can — an index alone is hard to find in a long file.
        const record = item as Record<string, unknown> | null;
        const name =
          typeof record?.id === "string"
            ? `"${record.id}"`
            : typeof record?.src === "string"
              ? `"${record.src}"`
              : `#${index}`;
        console.warn(
          `[content] ${label} ${name}${at} dropped — ${issue?.message ?? "invalid entry"}`,
        );
      });
      return kept;
    });
}

/* ------------------------------------------------------------------ shared */

/** The icon family in components/ui/SiteIcon.tsx. A typo is caught here, not silently swapped for a sparkle. */
export const iconNameSchema = z.enum([
  "book",
  "building",
  "calendar",
  "coffee",
  "community",
  "compass",
  "droplets",
  "faith",
  "faq",
  "footsteps",
  "graduation",
  "halaqa",
  "help",
  "home",
  "idea",
  "mail",
  "map",
  "mentor",
  "merch",
  "message",
  "mic",
  "moon",
  "package",
  "phone",
  "prayer",
  "ramadan",
  "search",
  "sparkles",
  "sun",
  "sun-dim",
  "sunrise",
  "sunset",
  "support",
  "time",
  "users",
  "utensils",
  "video",
  "volunteer",
]);
export type IconName = z.infer<typeof iconNameSchema>;

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  focal_point: z.string().nullish(),
  credit: z.string().nullish(),
});
export type ContentImage = z.infer<typeof imageSchema>;

export const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const navItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  href: z.string().min(1),
});

export const heroSchema = z.object({
  eyebrow: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().nullish(),
  image: imageSchema.nullish(),
});

/**
 * A page's sections below its top (review 3 B, `page-layouts.ts`): each
 * section of the page once, in the order visitors see them, shown or
 * hidden. The board sets it in Pages; a hidden section keeps its text.
 */
export function pageSectionsSchema<K extends LayoutKey>(key: K) {
  const ids = layoutIds(key) as [SectionId<K>, ...SectionId<K>[]];
  return (
    z
      .array(z.object({ id: z.enum(ids), shown: z.boolean() }))
      .refine(
        (sections) =>
          sections.length === ids.length &&
          new Set(sections.map((section) => section.id)).size === ids.length,
        "Each section of the page is listed once.",
      )
      // A band (About's Contact) is always last (review fixes P3).
      .overwrite((sections) => withBandsLast(key, sections))
  );
}

/** `details_pending` renders a clean placeholder instead of invented facts. */
export const statusSchema = z
  .enum(["confirmed", "details_pending"])
  .default("details_pending");

/* -------------------------------------------------------------------- site */

export const siteSchema = z.object({
  brand: z.object({
    name: z.string(),
    short_name: z.string(),
    university: z.string(),
    tagline: z.string(),
    email: z.string().nullish(),
    logo: imageSchema,
  }),
  navigation: z.array(navItemSchema).min(1),
  header_cta: ctaSchema.nullish(),
  footer: z.object({
    quick_links: z.array(navItemSchema).default([]),
    admin_link: ctaSchema.nullish(),
  }),
  social: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        url: z.string(),
        kind: z
          .enum(["instagram", "facebook", "whatsapp", "email", "other"])
          .default("other"),
      }),
    )
    .default([]),
  meta: z
    .object({
      description: z.string(),
      keywords: z.array(z.string()).default([]),
    })
    .nullish(),
});
export type SiteContent = z.infer<typeof siteSchema>;

/* ------------------------------------------------------------------ prayer */

export const prayerSchema = z.object({
  hero: heroSchema,
  sections: pageSectionsSchema("prayer"),
  heading: z.string().default("Daily Iqamah Times"),
  last_updated_label: z.string().nullish(),
  notice: z.string().nullish(),
  /**
   * The schedule lines under the iqamah times (PR5b, `managedPrayer`): when
   * the board's own notice is empty, while no schedule is published, and
   * while the schedule cannot be read.
   */
  schedule_note: z
    .string()
    .default(
      "Congregation times set by the MSA; separate from calculated prayer start times.",
    ),
  no_schedule_note: z
    .string()
    .default("A current congregation schedule has not yet been published."),
  unavailable_note: z
    .string()
    .default(
      "The schedule is temporarily unavailable. Please check with the MSA before travelling.",
    ),
  times: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        time: z.string(),
        icon: iconNameSchema.nullish(),
      }),
    )
    .default([]),
});
export type PrayerContent = z.infer<typeof prayerSchema>;

export const jumuahSchema = z.object({
  heading: z.string().default("Jumu’ah"),
  note: z.string().nullish(),
  gatherings: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().nullish(),
        khutbah: z.string(),
        iqamah: z.string(),
        note: z.string().nullish(),
      }),
    )
    .default([]),
});
export type JumuahContent = z.infer<typeof jumuahSchema>;

export const musallahSchema = z.object({
  route: z.object({
    heading: z.string(),
    subheading: z.string().nullish(),
    directions_heading: z.string().default("Written directions"),
    directions: z.array(z.string()).default([]),
    landmark_note: z.string().nullish(),
  }),
  facilities: z.object({
    heading: z.string(),
    note: z.string().nullish(),
    items: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          icon: iconNameSchema.nullish(),
          status: statusSchema,
          detail: z.string().nullish(),
        }),
      )
      .default([]),
  }),
  helper_cta: z.object({
    eyebrow: z.string().nullish(),
    heading: z.string(),
    body: z.string(),
    form: z.string(),
  }),
  gallery: z.array(imageSchema).default([]),
});
export type MusallahContent = z.infer<typeof musallahSchema>;

/* ------------------------------------------------------------------ events */

/** An event category's colour: one of the five `--category-*` tokens (`categoryTone`). */
export const categoryToneSchema = z.enum(categoryTones);

/** One visibility system. `public` is the only value the public site renders. */
export const visibilitySchema = z
  .enum(["public", "internal", "draft"])
  .default("draft");

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: dateSchema,
  start_time: z.string().nullish(),
  /** The last day (review 2, 2026-10-05); missing means the start date. */
  end_date: z.string().nullish(),
  end_time: z.string().nullish(),
  /**
   * The event's category and term from the Lists (review fixes P3): each
   * option's slug (the filters' value), its name, and the category's colour.
   */
  category: z.string().nullish(),
  category_name: z.string().nullish(),
  category_tone: categoryToneSchema.nullish(),
  /** Closed set: a stray "msa " or "SGU MSA" must not silently flip the verification notice. */
  organization: z.enum(["MSA", "SGU"]).default("MSA"),
  term: z.string().nullish(),
  term_name: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  visibility: visibilitySchema,
  featured: z.boolean().default(false),
  registration_url: z.string().nullish(),
  source: z.string().nullish(),
  /** Whether the date has been checked against the owning authority. */
  verification_status: z
    .enum(["verified", "pending", "historical"])
    .default("verified"),
  image: imageSchema.nullish(),
  /** Dashboard events (PR5a D-20): missing means scheduled. */
  status: z.enum(eventStatuses).nullish(),
  status_note: z.string().nullish(),
  /** Dashboard events (PR6 WP-9): the ticket sold for it, a priced item's id. */
  ticket_payment_item_id: z.string().nullish(),
  /** When the event was last saved: the calendar file's SEQUENCE (E-8). */
  updated_at: z.string().nullish(),
});
export type SiteEvent = z.infer<typeof eventSchema>;

export const eventsFileSchema = z.object({
  hero: heroSchema,
  sections: pageSectionsSchema("events"),
  empty_message: z.string().default("No public events currently listed."),
});
export type EventsContent = z.infer<typeof eventsFileSchema>;

/* --------------------------------------------------------------------- faq */

export const faqSchema = z.object({
  hero: heroSchema.nullish(),
  sections: pageSectionsSchema("faq"),
  eyebrow: z.string().nullish(),
  heading: z.string().default("Common Questions"),
  items: tolerantArray(
    z.object({ id: z.string(), question: z.string(), answer: z.string() }),
    "faq.yaml → items",
  ),
});
export type FAQContent = z.infer<typeof faqSchema>;

/* --------------------------------------------------------------- resources */

export const resourcesSchema = z.object({
  hero: heroSchema,
  sections: pageSectionsSchema("resources"),
  search_placeholder: z.string().default("Search resources…"),
  empty_message: z.string().default("No resources match this search."),
  items: tolerantArray(
    z.object({
      id: z.string(),
      title: z.string(),
      /** A resource category's slug from the Lists (review fixes P3); "" for none. */
      category: z
        .string()
        .nullish()
        .transform((value) => value ?? ""),
      description: z.string(),
      updated_label: z.string().nullish(),
      resource_url: z.string().nullish(),
      image: imageSchema.nullish(),
      /** Hidden from visitors, kept in Pages → Resources (review fixes PR-1). */
      archived: z.boolean().default(false),
    }),
    "resources.yaml → items",
  ),
});
export type ResourcesContent = z.infer<typeof resourcesSchema>;

export const newslettersSchema = z.object({
  heading: z.string().default("Newsletter Archive"),
  note: z.string().nullish(),
  issues: tolerantArray(
    z.object({
      id: z.string(),
      label: z.string().default("Archive"),
      period: z.string(),
      edition: z.string().nullish(),
      summary: z.string().nullish(),
      file_url: z.string().nullish(),
    }),
    "newsletters.yaml → issues",
  ),
});
export type NewslettersContent = z.infer<typeof newslettersSchema>;

/* ------------------------------------------------------------------- merch */

/**
 * The Merch page's opening (PR5c): its top and the garment note. The
 * collections, items, photos and sizes are dashboard data (`merch.ts`).
 */
export const merchSchema = z.object({
  hero: heroSchema,
  garment_note: z.string().nullish(),
});
export type MerchContent = z.infer<typeof merchSchema>;

/* ----------------------------------------------------------------- support */

export const supportSchema = z.object({
  enabled: z.boolean().default(false),
  sections: pageSectionsSchema("support"),
  prototype_notice: z.boolean().default(true),
  prototype_label: z.string().default("Proposed Student Support Service"),
  /** The governance sentence. The paragraph most likely to be reworded during review. */
  governance_notice: z.string().nullish(),
  hero: heroSchema,
  privacy: z.object({
    heading: z.string().default("Discreet & Respectful"),
    body: z.string(),
  }),
  contacts: z.object({
    heading: z.string(),
    note: z.string().nullish(),
    items: z
      .array(
        z.object({
          id: z.string(),
          role: z.string(),
          description: z.string().nullish(),
          status: statusSchema,
          email: z.string().nullish(),
          phone: z.string().nullish(),
          link: z.string().nullish(),
        }),
      )
      .default([]),
  }),
  professional: z.object({
    heading: z.string().default("Professional SGU Support"),
    body: z.string().nullish(),
    items: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullish(),
          status: statusSchema,
          url: z.string().nullish(),
        }),
      )
      .default([]),
  }),
});
export type SupportContent = z.infer<typeof supportSchema>;

/* ------------------------------------------------------------------- forms */

/**
 * The sign-up forms list (PR5b D-7, D-25): each Google Form a fixed page links
 * to, open or closed. A closed form (or one without a link) hides its button
 * (review fixes P3). Links must be Google Forms links
 * (`isGoogleFormUrl`), checked when the board saves.
 */
export const formsSchema = z.object({
  forms: z.record(
    z.string(),
    z.object({
      label: z.string(),
      url: z.string().nullish(),
      open: z.boolean().default(true),
      description: z.string().nullish(),
    }),
  ),
});
export type FormsContent = z.infer<typeof formsSchema>;

/* -------------------------------------------------------------------- home */

export const homeSchema = z.object({
  sections: pageSectionsSchema("home"),
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    emphasis: z.string().nullish(),
    body: z.array(z.string()).default([]),
    image: imageSchema,
    primary_cta: ctaSchema,
    secondary_cta: ctaSchema,
    aside: z.object({
      arabic: z.string(),
      transliteration: z.string(),
      quote: z.string(),
    }),
  }),
  week: z.object({
    heading: z.string(),
    empty_message: z.string().default("No public events currently listed."),
  }),
  /** "Your first visit": its photo (the words are fixed). */
  visit: z.object({ image: imageSchema }),
  contribution: z.object({
    heading: z.string(),
    items: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          short_description: z.string(),
          icon: iconNameSchema.nullish(),
          href: z.string(),
        }),
      )
      .default([]),
  }),
  features: z
    .array(
      z.object({
        id: z.string(),
        eyebrow: z.string(),
        title: z.string(),
        description: z.string(),
        href: z.string(),
        cta: z.string(),
        image: imageSchema,
      }),
    )
    .default([]),
});
export type HomeContent = z.infer<typeof homeSchema>;

/* ------------------------------------------------------------------- about */

export const aboutSchema = z.object({
  hero: heroSchema,
  sections: pageSectionsSchema("about"),
  mission: z.object({
    heading: z.string(),
    body: z.array(z.string()).default([]),
  }),
  what_we_do: z.object({
    heading: z.string(),
    items: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          icon: iconNameSchema.nullish(),
        }),
      )
      .default([]),
  }),
  /** Team block copy; the people themselves come from People (`getTeam`, D-10). */
  board: z.object({
    heading: z.string(),
    note: z.string().nullish(),
  }),
  at_sgu: z.object({
    heading: z.string(),
    body: z.array(z.string()).default([]),
    image: imageSchema.nullish(),
  }),
  contact: z.object({
    heading: z.string(),
    body: z.string().nullish(),
    email: z.string().nullish(),
    note: z.string().nullish(),
  }),
});
export type AboutContent = z.infer<typeof aboutSchema>;

/* ------------------------------------------------------------ get involved */

export const getInvolvedSchema = z.object({
  hero: heroSchema,
  sections: pageSectionsSchema("get-involved"),
  intro: z.string().nullish(),
  pathways: z
    .array(
      z.object({
        id: z.string(),
        number: z.string().nullish(),
        title: z.string(),
        summary: z.string(),
        body: z.string().nullish(),
        icon: iconNameSchema.nullish(),
        form: z.string().nullish(),
        image: imageSchema.nullish(),
        steps: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              detail: z.string().nullish(),
            }),
          )
          .default([]),
        fields: z.array(z.string()).default([]),
        note: z.string().nullish(),
      }),
    )
    .default([]),
});
export type GetInvolvedContent = z.infer<typeof getInvolvedSchema>;

/* ------------------------------------------------------------ integrations */

export const integrationsSchema = z.object({
  payments: z.object({
    /**
     * PR6 D-32: the MSA's words for Go2Pay's "Note shown on receipt". The
     * fund and ticket editors put "{name} ({category})." before it in their
     * copy box; the board pastes it into each Go2Pay product by hand.
     */
    receipt_note: z.string().nullish(),
  }),
});
export type IntegrationsContent = z.infer<typeof integrationsSchema>;

/* ------------------------------------------------------------------ donate */

/** The Donate letter's opening (PR5b); PR6 owns the giving lines below it. */
export const donateSchema = z.object({
  eyebrow: z.string().nullish(),
  title: z.string(),
  /** The title's second part, set in italics ("our community"). */
  emphasis: z.string().nullish(),
  lede: z.string().nullish(),
});
export type DonateContent = z.infer<typeof donateSchema>;

/* ----------------------------------------------------------------- contact */

/** The Contact page (PR5b). The email and social links come from `site`. */
export const contactSchema = z.object({
  sections: pageSectionsSchema("contact"),
  eyebrow: z.string().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  card: z.object({
    heading: z.string(),
    email_intro: z.string().nullish(),
    /** Shown while the organisation has no email. */
    no_email: z.string(),
  }),
  visit: z.object({
    heading: z.string(),
    body: z.string().nullish(),
    link_label: z.string(),
  }),
});
export type ContactContent = z.infer<typeof contactSchema>;

/* --------------------------------------------------------------- community */

/** The Community updates page heading and empty state (PR5b). */
export const communitySchema = z.object({
  sections: pageSectionsSchema("community"),
  eyebrow: z.string().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  empty_title: z.string(),
  empty_hint: z.string().nullish(),
});
export type CommunityContent = z.infer<typeof communitySchema>;

/* --------------------------------------------------------- reminder places */

/**
 * The places on the site that can show a Qur'an verse (PR5b D-24). A new
 * place is code (a page must draw it); which verse shows there is the board's.
 */
export const reminderPlaces = [
  "home",
  "home_events",
  "home_community",
  "home_giving",
  "prayer",
  "events",
  "get_involved",
  "donate",
  "resources",
  "community",
  "about",
  "ramadan",
  "support",
  "footer",
] as const;
export type ReminderPlace = (typeof reminderPlaces)[number];

/** A verse reference as the verse library stores it: one whole verse, "94:5" (Review 3 E). */
export const verseReferencePattern = /^[0-9]{1,3}:[0-9]{1,3}$/;
/** Chosen from the verse library, never typed: a wrong one is a page loaded before an update. */
export const verseReferenceSchema = z
  .string()
  .regex(verseReferencePattern, outOfDate);

/** Which library verse (by reference) shows in each place; null = no verse. */
export const reminderPlacesSchema = z.object({
  places: z.object(
    Object.fromEntries(
      reminderPlaces.map((place) => [
        place,
        verseReferenceSchema.nullable().default(null),
      ]),
    ) as Record<
      ReminderPlace,
      z.ZodDefault<z.ZodNullable<typeof verseReferenceSchema>>
    >,
  ),
});
export type ReminderPlacesContent = z.infer<typeof reminderPlacesSchema>;

/* --------------------------------------------------------------- reminders */

/** The five times of day the Home hero's dhikr follows (`dhikrSlot` in src/lib/prayer). */
export const dhikrSlots = [
  "morning",
  "evening",
  "after-prayer",
  "friday",
  "night",
] as const;
export type DhikrSlotName = (typeof dhikrSlots)[number];

const text = z.string().trim().min(1);
const reminderFields = {
  id: text,
  arabic: text,
  meaning: text,
  reference: text,
  source: text,
};

/**
 * Arabic reminders (ADR 0018). Strict on purpose, unlike the tolerant page
 * lists: a reminder is never silently dropped or shown without its meaning,
 * reference and source, so a bad entry fails validation and the build.
 */
export const remindersSchema = z.object({
  /** Exactly one remembrance per time-of-day slot. */
  dhikr: z
    .array(z.object({ ...reminderFields, slot: z.enum(dhikrSlots) }))
    .superRefine((rows, ctx) => {
      for (const slot of dhikrSlots) {
        const count = rows.filter((row) => row.slot === slot).length;
        if (count !== 1)
          ctx.addIssue({
            code: "custom",
            message: `needs exactly one "${slot}" dhikr (found ${count})`,
          });
      }
    }),
  /** The three phrases at each 33 beads, with their meanings. Null only as the unavailable fallback. */
  tasbih: z
    .object({
      phrases: z.tuple([text, text, text]),
      meanings: z.tuple([text, text, text]),
      source: text,
    })
    .nullable(),
});
export type RemindersContent = z.infer<typeof remindersSchema>;
export type DhikrReminder = RemindersContent["dhikr"][number];
/** What every reminder primitive needs to show its Arabic and its "?" meaning. */
export type Reminder = Pick<
  DhikrReminder,
  "id" | "arabic" | "meaning" | "reference" | "source"
> & {
  /** A library verse's translator credit, under its meaning (PR5b D-24). */
  credit?: string;
};
