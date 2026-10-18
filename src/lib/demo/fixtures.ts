import { handoverStepSchema, sharedLoginSchema } from "../community/handover";
import {
  go2payOrderSchema,
  paymentItemSchema,
  type PaymentItem,
} from "../community/payments";
import { seasonSchema } from "../community/seasons";
import { merchCollectionSchema, merchItemSchema } from "../community/merch";
import { listOptionSchema } from "../community/lists";
import { personSchema, sectionSchema } from "../community/people";
import {
  emptyPrayer,
  localDate,
  recordSchema,
  type CommunityRecord,
  type Collection,
  type MusallahPin,
  type PrayerSettings,
} from "../community/schema";

/** The Grenada date `offset` days from `now`. */
function dayFrom(now: Date, offset: number) {
  const d = new Date(`${localDate(now)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** The ticket the "Welcome dinner" event sells (`demoPaymentItems` number 10). */
export const DEMO_TICKET_ID = "00000000-0000-4000-8000-000000000610";
/** The typed season the "Islamic Awareness Week" event belongs to (PR5c). */
export const DEMO_AWARENESS_WEEK_ID = "00000000-0000-4000-8000-0000000005a4";
/** The current collection's shirt, which has sizes (PR5c). */
export const DEMO_SHUKR_ITEM_ID = "00000000-0000-4000-8000-0000000007b3";

/**
 * The Lists (review fixes P3): the starter event categories and resource
 * kinds as `202610160002_lists.sql` adds them (same names and slugs), and
 * two terms the board would add.
 */
export function demoListOptions() {
  const rows: [string, string, string, string, number][] = [
    ["a1", "event_categories", "MSA", "msa", 1],
    ["a2", "event_categories", "Academic", "academic", 2],
    ["a3", "event_categories", "Informational", "informational", 3],
    ["a4", "event_categories", "Faith", "faith", 4],
    ["a5", "event_categories", "Social", "social", 5],
    ["b1", "terms", "2026 Fall", "2026-fall", 1],
    ["b2", "terms", "2027 Spring", "2027-spring", 2],
    ["c1", "resource_categories", "Newsletter", "newsletter", 1],
    ["c2", "resource_categories", "Infographic", "infographic", 2],
    ["c3", "resource_categories", "Guide", "guide", 3],
    ["c4", "resource_categories", "Academic", "academic", 4],
    ["c5", "resource_categories", "Faith", "faith", 5],
    ["c6", "resource_categories", "Ramadan", "ramadan", 6],
    ["c7", "resource_categories", "Incoming students", "incoming-students", 7],
  ];
  return rows.map(([id, list, name, slug, position]) =>
    listOptionSchema.parse({
      id: `00000000-0000-4000-8000-0000000009${id}`,
      list,
      name,
      slug,
      position,
    }),
  );
}
/** A sample list option's id (`demoListOptions`), such as "a1" for MSA. */
const demoOption = (key: string) => `00000000-0000-4000-8000-0000000009${key}`;

/**
 * Relative dates keep the preview populated tomorrow without writing any
 * database. The content reads like the live site's (review fixes PR-1): no
 * "example", "sample" or "demo" labels, just ordinary club news.
 */
export function demoRecords(kind: Collection, now: Date) {
  const day = (offset: number) => dayFrom(now, offset);
  const samples: Record<
    Collection,
    Array<{
      title: string;
      summary: string;
      offset: number;
      /** The second paragraph of the full text. */
      body: string;
      /** Events only: where it happens. */
      location?: string;
      /** PR5a samples: event status, times over two days, urgent notices. */
      extra?: Partial<CommunityRecord>;
    }>
  > = {
    events: [
      {
        title: "Welcome to the community",
        summary:
          "Meet other Muslim students, the board and the volunteers over dinner.",
        body: "New and returning students are all welcome. Food is halal and free; bring a friend.",
        location: "Charter Hall",
        offset: 2,
      },
      {
        title: "An evening of reflection",
        summary: "A short reminder on gratitude, then tea and conversation.",
        body: "Brothers and sisters are welcome. We start right after Maghrib.",
        location: "SGU Musallah",
        offset: 5,
      },
      {
        title: "Community volunteer morning",
        summary: "Help clean and tidy the Musallah before the new term begins.",
        body: "Gloves and supplies are provided. Come for an hour or stay the whole morning.",
        location: "SGU Musallah",
        offset: 9,
      },
      {
        title: "A gathering to remember",
        summary: "Our end-of-term dinner with games and a short talk.",
        body: "Thank you to everyone who came and helped set up.",
        location: "Charter Hall",
        offset: -12,
      },
      {
        title: "Beach clean-up",
        summary:
          "A morning cleaning Grand Anse Beach with other student clubs.",
        body: "Meet at the bus stop by the main gate. Wear sunscreen and bring water.",
        location: "Grand Anse Beach",
        offset: 3,
        extra: {
          status: "cancelled",
          status_note: "Tropical storm warning, campus closed.",
        },
      },
      {
        title: "Welcome dinner",
        summary: "A sit-down dinner to welcome this term’s new students.",
        body: "Seating is limited, so please get your ticket early.",
        location: "Charter Hall",
        offset: 11,
        // Sells the "Welcome dinner ticket" (PR6 WP-9).
        extra: { ticket_payment_item_id: DEMO_TICKET_ID },
      },
      {
        title: "Qur'an night",
        summary: "Recitation and reflection on Surah Al-Kahf.",
        body: "All levels are welcome. Bring your own mushaf if you have one.",
        location: "SGU Musallah",
        offset: 6,
        extra: { status: "postponed" },
      },
      {
        title: "Night of prayer",
        summary: "Qiyam al-layl with short reminders, from 10 PM to 3 AM.",
        body: "Suhoor is served before Fajr. Sisters have their own space.",
        location: "SGU Musallah",
        offset: 8,
        extra: { start_time: "22:00", end_date: day(9), end_time: "03:00" },
      },
      {
        title: "Islamic Awareness Week",
        summary:
          "Three days of stalls, talks and free food on the campus green.",
        body: "Bring your questions and your friends. Every day from morning to evening.",
        location: "Campus green",
        offset: 13,
        extra: {
          start_time: "",
          end_date: day(15),
          end_time: "",
          // Listed on the season's page (PR5c).
          season_id: DEMO_AWARENESS_WEEK_ID,
        },
      },
    ],
    announcements: [
      {
        title: "Dhuhr is in Charter Hall today",
        summary:
          "The Musallah is being cleaned, so Dhuhr is in Charter Hall today. The iqamah time stays the same.",
        body: "The Musallah reopens for Asr.",
        offset: 0,
        extra: {
          expires_on: "",
          urgent_until: new Date(
            now.getTime() + 2 * 60 * 60 * 1000,
          ).toISOString(),
        },
      },
      {
        title: "No water at the Musallah this week",
        summary:
          "Campus maintenance has turned the water off at the Musallah. Please make wudu before you come.",
        body: "We will post here as soon as the water is back on.",
        offset: 0,
        extra: {
          expires_on: "",
          urgent_until: new Date(`${day(3)}T10:00:00-04:00`).toISOString(),
        },
      },
    ],
    news_posts: [
      {
        title: "Small moments. Stronger connections.",
        summary:
          "Highlights from welcome week: a full Musallah for Jumu’ah, Friday football and dinner with new students.",
        body: "Thank you to every volunteer who cooked, cleaned and welcomed people at the door.",
        offset: -2,
      },
      {
        title: "Meet the people who make it possible",
        summary:
          "This term’s volunteers keep the Musallah clean, set up for Jumu’ah and run the welcome desk.",
        body: "Want to help? See Get Involved for the volunteer form.",
        offset: -5,
      },
    ],
    newsletters: [
      {
        title: "The community letter",
        summary:
          "Term dates, the Jumu’ah rota, a new halaqa series and photos from welcome week.",
        body: "Read it online or pick up a printed copy at the Musallah.",
        offset: -3,
      },
    ],
  };
  return samples[kind].map((row, i) =>
    recordSchema.parse({
      id: `00000000-0000-4000-8000-${String((["events", "announcements", "news_posts", "newsletters"].indexOf(kind) + 1) * 100 + i).padStart(12, "0")}`,
      title: row.title,
      summary: row.summary,
      body: `${row.summary}\n\n${row.body}`,
      date: day(row.offset),
      expires_on: kind === "announcements" ? day(7) : "",
      start_time: kind === "events" ? "17:00" : "",
      end_time: kind === "events" ? "18:30" : "",
      location: row.location ?? "",
      published: true,
      // The first one, unless it is urgent (an urgent notice is never featured).
      featured: i === 0 && !row.extra?.urgent_until,
      // Review fixes P3: a category and the current term (none is Academic,
      // so its button is hidden on the Events page: it has no events).
      ...(kind === "events"
        ? {
            category_id: demoOption(
              ["a1", "a4", "a5", "a1", "a5", "a1", "a4", "a4", "a3"][i] ?? "a1",
            ),
            term_id: demoOption("b1"),
          }
        : {}),
      ...row.extra,
    }),
  );
}

/**
 * The sandbox's musallah pin: the same starting pin as the database (the
 * Google place "MSA Mosque" the user gave, PR7 D-3, E-9), so help pictures
 * show the real campus.
 */
export const demoMusallahPin: MusallahPin = {
  id: 1,
  latitude: 12.0025521,
  longitude: -61.7723834,
};

/** Fictional congregation clocks; prayer starts follow the sandbox pin (`demoMusallahPin`). */
export function demoPrayer(now: Date): PrayerSettings {
  return {
    ...emptyPrayer,
    hijri_adjustment: 0,
    valid_from: localDate(now),
    valid_until: localDate(now),
    fajr: "05:30",
    dhuhr: "12:30",
    asr: "15:45",
    maghrib: "18:20",
    isha: "19:45",
    // Two Jumu'ah prayers, so every page shows how several read (review fixes P2).
    jumuah_sessions: [
      { khutbah: "12:45", iqamah: "13:00" },
      { khutbah: "13:45", iqamah: "14:00" },
    ],
    notice: "",
  };
}

/** The sandbox's one board account (D-6); it exists only in sample runs. */
export const demoAdmin = {
  userId: "00000000-0000-4000-8000-00000000ad00",
  email: "omar.haddad@sgu-msa.invalid",
  /** Its People entry, the President (Omar Haddad). */
  personId: "00000000-0000-4000-8000-00000000a001",
} as const;

/**
 * The three team groups, as the starter data sets them up
 * (`202610150002_starter_data.sql`): the permanent Executive board and
 * General board, and Advisors/Faculty. New people in the Executive board
 * start as shown on the public page.
 */
export function demoSections() {
  return (
    [
      [
        "00000000-0000-4000-8000-00000000c001",
        "Executive board",
        1,
        true,
        "executive",
      ],
      [
        "00000000-0000-4000-8000-00000000c002",
        "General board",
        2,
        true,
        "general",
      ],
      [
        "00000000-0000-4000-8000-00000000c003",
        "Advisors/Faculty",
        3,
        true,
        null,
      ],
    ] as const
  ).map(([id, name, position, shown_by_default, kind]) =>
    sectionSchema.parse({ id, name, position, shown_by_default, kind }),
  );
}

/**
 * The sample team, built from the founder's roles (user, 2026-10-05): the
 * Executive board (always on the public page) and most of the General board
 * listed; one General board member and the faculty advisor not (review fixes
 * P4: "View all" on About). The sandbox admin's own entry is the
 * President. Fictional names.
 */
export function demoPeople() {
  const [executive, general, advisors] = demoSections();
  const listed = { show_on_public: true };
  const hidden = { show_on_public: false };
  const person = (
    id: string,
    full_name: string,
    role_title: string,
    section_id: string,
    position: number,
    shown: typeof listed | typeof hidden,
  ) => ({
    id: `00000000-0000-4000-8000-00000000${id}`,
    full_name,
    role_title,
    section_id,
    position,
    ...shown,
  });
  return [
    person("a001", "Omar Haddad", "President", executive.id, 1, listed),
    person(
      "a010",
      "Bilal Ahmed",
      "Vice President (Brothers)",
      executive.id,
      2,
      listed,
    ),
    person(
      "a002",
      "Aisha Rahman",
      "Vice President (Sisters)",
      executive.id,
      3,
      listed,
    ),
    person("a011", "Maryam Siddiqui", "Treasurer", executive.id, 4, listed),
    person("a012", "Hamza Ali", "Secretary", executive.id, 5, listed),
    person(
      "a004",
      "Yusuf Ibrahim",
      "Musallah coordinator",
      general.id,
      1,
      listed,
    ),
    person(
      "a005",
      "Zainab Hussain",
      "Social media manager",
      general.id,
      2,
      listed,
    ),
    person(
      "a006",
      "Idris Bello",
      "Brothers coordinator",
      general.id,
      3,
      listed,
    ),
    person("a007", "Huda Karim", "Sisters coordinator", general.id, 4, listed),
    person("a008", "Sara Malik", "T1 rep", general.id, 5, listed),
    person("a009", "Adam Yusuf", "Pre-med term rep", general.id, 6, hidden),
    person("a003", "Karim Mansour", "Faculty advisor", advisors.id, 1, hidden),
  ].map((row) => personSchema.parse(row));
}

/** The sandbox sign-in (cleanup-outdated D-3); only the sample `AdminAuth` reads it. */
export const sandboxCredentials = {
  username: "admin",
  password: "admin",
} as const;

/**
 * A second sandbox sign-in, for the end-to-end tests of the money gates
 * (PR6 WP-6, WP-7) and the manager gates (term export, review fixes P5):
 * the same People entry (the President), without "Manage money" and
 * "Manage people".
 */
export const sandboxNoMoneyCredentials = {
  username: "board",
  password: "board",
} as const;

/**
 * The New board term sample (PR5a): the migration's six starter steps, two
 * ticked this term.
 */
export function demoHandoverSteps(now: Date) {
  return [
    [
      "Invite the new board",
      "People → Add → Send invite. Give “manage people” to at least two.",
      "/admin/people",
    ],
    [
      "Turn off leaving members’ logins",
      "Deactivate, or archive if they also leave the team list.",
      "/admin/people",
    ],
    [
      "Update the team list",
      "Role titles, order, groups and “Show on public page?”.",
      "/admin/people",
    ],
    [
      "Change shared passwords",
      "Instagram, MSA Gmail, Go2Pay. Then set “Last changed” below. Never write passwords here.",
      "",
    ],
    [
      "Check content",
      "Upcoming events, iqamah end date, old notices.",
      "/admin/prayer-times",
    ],
    [
      "Tell the site owner who the new board is",
      "Website accounts and the MSA Gmail keep two owners with recovery access.",
      "",
    ],
  ].map(([title, details, link], index) =>
    handoverStepSchema.parse({
      id: `00000000-0000-4000-8000-00000000d00${index + 1}`,
      title,
      details,
      link,
      position: index + 1,
      done_on: index < 2 ? dayFrom(now, -1) : "",
    }),
  );
}

/** Two sample shared logins, held by sample People (names only, never a password). */
export function demoSharedLogins(now: Date) {
  return [
    {
      id: "00000000-0000-4000-8000-00000000e001",
      service: "MSA Gmail",
      holder_person_id: demoAdmin.personId,
      second_factor_person_id: "00000000-0000-4000-8000-00000000a002",
      last_changed_on: dayFrom(now, -26),
    },
    {
      id: "00000000-0000-4000-8000-00000000e002",
      service: "Instagram",
      holder_person_id: "00000000-0000-4000-8000-00000000a002",
      last_changed_on: dayFrom(now, -260),
      note: "The recovery email is the MSA Gmail.",
    },
  ].map((row) => sharedLoginSchema.parse(row));
}

/**
 * The migration's three starter seasons (PR6 D-15), with no confirmed days
 * yet, Ramadan's page as the migration seeds it (PR5c) but with schedule
 * times, and a typed season with its own page, around the "Islamic
 * Awareness Week" event.
 */
export function demoSeasons(now = new Date()) {
  const ramadanPage = {
    has_page: true,
    intro:
      "A month of worship, community, service, and gratitude.\n\nSetting up iftar, organizing the Musallah, and helping run nightly programmes — there is a place for every level of availability.",
    // With times, so no row shows a pending label (review fixes P3).
    schedule: [
      ["Community iftar", "Every night at Maghrib", "SGU Musallah"],
      ["Tarawih at the Musallah", "Every night after Isha", "SGU Musallah"],
      ["Qiyam nights", "The last ten nights", "SGU Musallah"],
      ["Ramadan halaqa series", "Saturdays after Asr", ""],
    ].map(([what, when, where]) => ({ what, when, where })),
    sign_up_form: "ramadan_volunteer",
    photos: [
      [
        "hero-lanterns",
        "Ramadan Mubarak sign lit by candlelight inside the SGU Musallah",
      ],
      [
        "gallery-mubarak-sign",
        "A Ramadan Mubarak sign set up by the MSA inside the Musallah",
      ],
      [
        "gallery-isra-miraj",
        "MSA programme graphic for a Night of Al-Isra’ Wal-Mi‘raj halaqa",
      ],
      [
        "gallery-halaqa",
        "MSA halaqa graphic: Ramadan on the Island — Balancing Ibadah and Academia",
      ],
      [
        "gallery-bake-sale",
        "MSA bake sale graphic raising funds ahead of Ramadan",
      ],
    ].map(([file, alt]) => ({ src: `/images/ramadan/${file}.webp`, alt })),
  };
  return [
    seasonSchema.parse({
      id: "00000000-0000-4000-8000-0000000005a1",
      name: "Ramadan",
      slug: "ramadan",
      hijri_month: 9,
      hijri_first_day: 1,
      hijri_last_day: null,
      ...ramadanPage,
    }),
    ...(
      [
        ["00000000-0000-4000-8000-0000000005a2", "Eid al-Fitr", 10, 1, 1],
        ["00000000-0000-4000-8000-0000000005a3", "Eid al-Adha", 12, 10, 10],
      ] as const
    ).map(([id, name, month, first, last]) =>
      seasonSchema.parse({
        id,
        name,
        slug: name.toLowerCase().replaceAll(" ", "-"),
        hijri_month: month,
        hijri_first_day: first,
        hijri_last_day: last,
      }),
    ),
    seasonSchema.parse({
      id: DEMO_AWARENESS_WEEK_ID,
      name: "Islamic Awareness Week",
      slug: "islamic-awareness-week",
      hijri_month: null,
      hijri_first_day: null,
      hijri_last_day: null,
      board_starts_on: dayFrom(now, 13),
      board_ends_on: dayFrom(now, 15),
      has_page: true,
      intro:
        "Three days of stalls, talks and free food on the campus green. Bring your questions and your friends.",
      schedule: [
        {
          what: "Welcome stall",
          when: "Every day, 10 AM – 4 PM",
          where: "Campus green",
        },
        {
          what: "Talk: Islam in daily life",
          when: "Second day, after Asr",
          where: "Charter Hall",
        },
      ],
      sign_up_form: "volunteer",
    }),
  ];
}

/**
 * The migration's starter merch (PR5c): three collections of one shirt
 * each, with the old merch photos.
 */
export function demoMerch() {
  const collections = [
    {
      id: "00000000-0000-4000-8000-0000000007a1",
      name: "Green Collection",
      arabic: "قلب سليم",
      quote:
        "No act of devotion is accepted until the heart of the worshipper is cleansed of false belief and ill intention.",
      description: "The first MSA collection.",
      era: "past",
      position: 1,
    },
    {
      id: "00000000-0000-4000-8000-0000000007a2",
      name: "Maroon Collection",
      arabic: "حيث تطمئن القلوب",
      quote: "In remembrance, hearts find ease.",
      era: "past",
      position: 2,
    },
    {
      id: "00000000-0000-4000-8000-0000000007a3",
      name: "Shukr",
      arabic: "شكر",
      quote:
        "Give thanks in ease and in hardship, for what reaches you is by decree.",
      description: "The current MSA collection.",
      era: "current",
      position: 3,
    },
  ].map((row) => merchCollectionSchema.parse(row));
  const photo = (file: string, alt: string) => ({
    src: `/images/merch/${file}.webp`,
    alt,
  });
  const items = [
    {
      id: "00000000-0000-4000-8000-0000000007b1",
      collection_id: collections[0].id,
      name: "Green long-sleeve",
      description:
        "A dark green long-sleeve carrying the sound heart — a reminder that intention comes before action.",
      colorway: "Forest green",
      photos: [
        photo(
          "green-order-sheet",
          "SGU MSA green long-sleeve order sheet showing the Qalb Saleem front design",
        ),
      ],
    },
    {
      id: "00000000-0000-4000-8000-0000000007b2",
      collection_id: collections[1].id,
      name: "Maroon long-sleeve",
      description:
        "A maroon long-sleeve with an arched mosque and tree printed across the back, worn across campus and the island.",
      colorway: "Maroon",
      photos: [
        photo(
          "maroon-waterfront",
          "Two students in the maroon MSA long-sleeve seated at the waterfront, the back print visible",
        ),
        photo(
          "maroon-order-sheet",
          "Maroon MSA long-sleeve order sheet showing the front and back of the shirt",
        ),
        photo(
          "maroon-back-detail",
          "Close view of the arch and tree print on the back of the maroon long-sleeve",
        ),
        photo(
          "maroon-full",
          "Students wearing the maroon MSA long-sleeve on campus",
        ),
      ],
    },
    {
      id: DEMO_SHUKR_ITEM_ID,
      collection_id: collections[2].id,
      name: "Shukr long-sleeve",
      description:
        "A navy long-sleeve carrying Shukr across the back beneath a stamp panel — gratitude as the posture a student keeps in both directions.",
      colorway: "Navy",
      photos: [
        photo(
          "shukr-back",
          "The Shukr back print on the navy MSA long-sleeve, worn by two students",
        ),
        photo(
          "shukr-front",
          "Front of the navy Shukr long-sleeve with the MSA crest at the chest",
        ),
        photo(
          "shukr-detail",
          "Detail of the Shukr stamp panel printed on the back of the long-sleeve",
        ),
        photo(
          "shukr-full",
          "A student wearing the navy Shukr long-sleeve on the campus field",
        ),
        photo(
          "shukr-pair",
          "Two students wearing the navy Shukr long-sleeve on campus",
        ),
      ],
    },
  ].map((row) =>
    merchItemSchema.parse({ garment: "Long-sleeve", position: 1, ...row }),
  );
  return { collections, items };
}

/**
 * Sample funds and tickets (PR6 Private Implementation), each with its own
 * sample Go2Pay product number (9001…, never a real product): the four
 * category funds, Iftar under the heading "Ramadan", one closing tomorrow,
 * one ended (still to close in Go2Pay), one archived, one tied to the Eid
 * al-Fitr season, and two event tickets. Dates are relative to the seed so
 * the sandbox looks the same any day.
 */
export function demoPaymentItems(now: Date): {
  item: PaymentItem;
  product: number;
  archived: boolean;
}[] {
  const shown = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const fund = (
    n: number,
    fields: Partial<PaymentItem> &
      Pick<PaymentItem, "slug" | "name" | "category">,
    archived = false,
  ) => ({
    item: paymentItemSchema.parse({
      id: `00000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`,
      kind: "fund",
      about: "",
      listed: true,
      position: n,
      first_shown_at: fields.listed === false ? null : shown,
      ...fields,
    }),
    product: 9000 + n,
    archived,
  });
  const [, eidAlFitr] = demoSeasons();
  return [
    fund(1, {
      slug: "msa-musallah",
      name: "MSA & Musallah",
      category: "general",
      about: "Keeps the Musallah and the MSA running.",
    }),
    fund(2, {
      slug: "iftar",
      name: "Iftar",
      category: "sadaqah",
      about: "Helps pay for iftar at the Musallah.",
      heading: "Ramadan",
      shows_from: dayFrom(now, -3),
      shows_until: dayFrom(now, 25),
    }),
    fund(3, {
      slug: "zakat-al-fitr",
      name: "Zakat al-Fitr",
      category: "zakat_al_fitr",
      about: "US$10 per person in your household.",
    }),
    fund(4, {
      slug: "zakat-al-mal",
      name: "Zakat al-Mal",
      category: "zakat_al_mal",
      about: "Passed on to people in need.",
    }),
    fund(5, {
      slug: "sadaqah",
      name: "Sadaqah",
      category: "sadaqah",
      about: "Used where it helps most.",
    }),
    fund(6, {
      slug: "study-circle-books",
      name: "Study circle books",
      category: "general",
      about: "Books for the weekly study circle.",
      shows_until: dayFrom(now, 1),
    }),
    fund(7, {
      slug: "flood-relief",
      name: "Flood relief",
      category: "sadaqah",
      about: "Help for students affected by the floods.",
      shows_until: dayFrom(now, -3),
    }),
    fund(
      8,
      {
        slug: "old-general-fund",
        name: "Old general fund",
        category: "general",
        about: "Replaced by MSA & Musallah.",
      },
      true,
    ),
    fund(9, {
      slug: "eid-gifts",
      name: "Eid gifts",
      category: "sadaqah",
      about: "Gifts for children at the Eid prayer.",
      season_id: eidAlFitr.id,
    }),
    {
      ...fund(10, {
        slug: "welcome-dinner-ticket",
        name: "Welcome dinner ticket",
        category: "general",
        kind: "priced",
        about: "One ticket per person, dinner included.",
        first_shown_at: null,
      }),
      product: 9101,
    },
    {
      ...fund(11, {
        slug: "charity-dinner-ticket",
        name: "Charity dinner ticket",
        category: "general",
        kind: "priced",
        about: "Dinner and a talk; proceeds go to Sadaqah.",
        first_shown_at: null,
      }),
      product: 9102,
    },
    // The Shukr long-sleeve's sizes (PR5c), each its own Go2Pay product.
    ...(["S", "M", "L"] as const).map((size, index) => ({
      ...fund(12 + index, {
        slug: `shukr-long-sleeve-${size.toLowerCase()}`,
        name: `Shukr long-sleeve · ${size}`,
        category: "general",
        kind: "priced",
        about: "",
        first_shown_at: null,
        merch_item_id: DEMO_SHUKR_ITEM_ID,
        size_label: size,
      }),
      product: 9201 + index,
    })),
  ];
}

/**
 * Sample Go2Pay orders for the fake gateway (PR6): gifts with one note, one
 * partial refund, one unfinished attempt (not counted) and a ticket sale.
 * Made-up names, never real people; marked as live orders, so Payments looks
 * like the live site (review fixes PR-1).
 */
export function demoOrders(now: Date) {
  const at = (days: number) => `${dayFrom(now, -days)} 10:30:00`;
  return [
    [7001, 9001, 25, 0, "PAID", "For the Musallah carpets.", 2, "Bilal Ahmed"],
    [7002, 9002, 30, 0, "PAID", "", 3, "Hana Yusuf"],
    [7003, 9003, 40, 0, "PAID", "", 4, "Ibrahim Khan"],
    [7004, 9004, 100, 20, "PARTIAL REFUND", "", 5, "Sara Malik"],
    [7005, 9001, 50, 0, "REQUIRES_PAYMENT_METHOD", "", 1, "Tariq Hussain"],
    [7006, 9101, 30, 0, "PAID", "", 6, "Layla Farouk"],
    [7007, 9005, 15, 15, "REFUNDED", "", 8, "Zaid Rahman"],
  ].map(([id, product, amount, refunded, status, note, days, giver]) =>
    go2payOrderSchema.parse({
      id,
      product_id: product,
      first_name: String(giver).split(" ")[0],
      last_name: String(giver).split(" ")[1],
      qty: product === 9101 ? 2 : 1,
      subtotal: String(amount),
      customer_total: ((Number(amount) * 1.039 + 0.3) as number).toFixed(2),
      refunded: String(refunded),
      status,
      note,
      created: at(Number(days)),
      test_mode: 0,
    }),
  );
}
