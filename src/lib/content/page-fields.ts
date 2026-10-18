/**
 * The Pages screens' field lists (PR5b): for every page-text document, the
 * sections and boxes the board edits, with their labels, hints, examples,
 * required and length rules. The editor draws itself from these lists and
 * the save rules (`pageTextSaveSchema`) are built from them, never retyped.
 *
 * Pure (no server-only import): the browser editor and the server action
 * share it. Anything a list does not name is developer-owned
 * (`developerOwnedPaths`: navigation, footer links, the logo, filter lists;
 * D-22): kept as stored on save, and always read from `content/*.yaml`.
 */
import { z } from "../validation/zod";
import { googleFormsOnly, isGoogleFormUrl } from "../integrations/google-forms";
import { photoSourcePattern } from "../media/photo-list";
import { outOfDate } from "../system-text";
import {
  editorialDocuments,
  type EditorialDocuments,
  type PageTextKey,
} from "./documents";
import {
  hiddenSections,
  isLayoutKey,
  layoutIds,
  pageLayouts,
  starterSections,
  storedSections,
  type LayoutKey,
  type PageLayout,
} from "./page-layouts";
import { listSlugPattern, type ListName } from "../community/lists";
import {
  iconNameSchema,
  reminderPlaces,
  verseReferencePattern,
  type ReminderPlace,
} from "./schemas";

export { pageTextKeys, type PageTextKey } from "./documents";

/* ------------------------------------------------------------------ kinds */

type Base = {
  /** Dotted path from the document (or the list item) root: "hero.title". */
  path: string;
  label: string;
  hint?: string;
  /** Shown as the empty box's placeholder; never saved (D-26). */
  example: string;
  /** An empty required box is refused; an empty optional box hides its block (edge G9). */
  required?: boolean;
  /** Most characters (one line: 160, longer text: 2,000 unless set). */
  max?: number;
  /** Lines a "text" box shows before scrolling (3 unless set). */
  rows?: number;
};

export type PageField =
  /** One line of text. */
  | (Base & { kind: "line" })
  /** A few sentences; line breaks kept. */
  | (Base & { kind: "text" })
  /** Paragraphs, split on blank lines; stored as a list of strings. */
  | (Base & { kind: "paragraphs" })
  /** One entry per line; stored as a list of strings. */
  | (Base & { kind: "lines" })
  /** A page of this site (`sitePaths`) or a secure web address. */
  | (Base & { kind: "link"; mailto?: true })
  | (Base & { kind: "email" })
  /** A Google Forms link (D-25). */
  | (Base & { kind: "google-form" })
  /** A photo with its description and the "old photo" tick. */
  | (Base & { kind: "image" })
  | (Base & { kind: "icon" })
  /** A sign-up form key from the forms list. */
  | (Base & { kind: "form" })
  /** A verse of the verse library, by reference, or none. */
  | (Base & { kind: "verse" })
  | (Base & { kind: "yesno" })
  | (Base & {
      kind: "choice";
      options: readonly (readonly [value: string, label: string])[];
    })
  /**
   * One option of the board's Lists (review fixes P3), stored by its slug;
   * the editor offers the list's options as they are now.
   */
  | (Base & { kind: "list-option"; list: ListName })
  /** A list of items the board adds, removes and reorders. */
  | (Base & {
      kind: "list";
      /** What one item is called ("Question"). */
      itemName: string;
      item: readonly PageField[];
      maxItems: number;
    })
  /**
   * Fixed entries keyed by a developer-made key (the sign-up forms): the
   * board edits each entry, never adds or removes one.
   */
  | (Base & {
      kind: "entries";
      item: readonly PageField[];
      /** Where each entry shows, by key. */
      where: Readonly<Record<string, string>>;
    });

export type PageSection = {
  /**
   * The section's id: the page section it edits (`page-layouts.ts`), unique
   * within its document.
   */
  id: string;
  title: string;
  note?: string;
  fields: readonly PageField[];
};

export type PageDocumentFields = {
  /** The Pages list and the screen's title. */
  title: string;
  /** What the page is, on the Pages list. */
  summary: string;
  /** The public page it changes ("/about"), when it is one page. */
  publicPath: string | null;
  sections: readonly PageSection[];
};

/** One line of text: at most this many characters unless the field says. */
export const LINE_MAX = 160;
/** Longer text and each paragraph. */
export const TEXT_MAX = 2000;

/**
 * The required boxes that may stay empty while their section is hidden on
 * the page (review 3 B: "required boxes only apply when shown"). A photo or
 * a choice stays required: the stored page needs one to read back.
 */
const emptiedWhenHidden = (field: PageField) =>
  field.kind !== "image" && field.kind !== "choice";

/* ------------------------------------------------------------- helpers -- */

type Options = Partial<Pick<Base, "hint" | "required" | "max" | "rows">>;
const line = (path: string, label: string, example: string, o: Options = {}) =>
  ({ kind: "line", path, label, example, ...o }) as const satisfies PageField;
const text = (path: string, label: string, example: string, o: Options = {}) =>
  ({ kind: "text", path, label, example, ...o }) as const satisfies PageField;
const paragraphs = (
  path: string,
  label: string,
  example: string,
  o: Options = {},
) =>
  ({
    kind: "paragraphs",
    path,
    label,
    example,
    hint: "Leave an empty line between paragraphs.",
    ...o,
  }) as const satisfies PageField;
const link = (path: string, label: string, example: string, o: Options = {}) =>
  ({
    kind: "link",
    path,
    label,
    example,
    hint: "A page of this site, such as /prayer, or a web address starting with https://.",
    ...o,
  }) as const satisfies PageField;
const image = (path: string, label: string, o: Options = {}) =>
  ({
    kind: "image",
    path,
    label,
    example: "Students sharing iftar in the Musallah",
    ...o,
  }) as const satisfies PageField;
const icon = (path = "icon") =>
  ({
    kind: "icon",
    path,
    label: "Icon",
    example: "prayer",
    required: true,
  }) as const satisfies PageField;
const list = (
  path: string,
  label: string,
  itemName: string,
  item: readonly PageField[],
  maxItems = 30,
) =>
  ({
    kind: "list",
    path,
    label,
    itemName,
    item,
    maxItems,
    example: itemName,
  }) as const satisfies PageField;
const confirmedChoice = {
  kind: "choice",
  path: "status",
  label: "Confirmed?",
  example: "details_pending",
  required: true,
  options: [
    ["confirmed", "Confirmed: show the details"],
    ["details_pending", "Not yet: hidden from visitors"],
  ],
} as const satisfies PageField;

/** The top of most pages: small heading, title, short description. */
const top = (
  example: { eyebrow: string; title: string; description: string },
  photo = false,
  more: readonly PageField[] = [],
): PageSection => ({
  id: "top",
  title: "Top of the page",
  fields: [
    line("hero.eyebrow", "Small heading above", example.eyebrow),
    line("hero.title", "Page title", example.title, { required: true }),
    text("hero.description", "Short description", example.description, {
      max: 400,
    }),
    ...(photo ? [image("hero.image", "Photo at the top")] : []),
    ...more,
  ],
});

/** Pages of this site a link box may point at, with an optional #part or ?filter. */
export const sitePaths = [
  "/",
  "/calendar",
  "/prayer",
  "/resources",
  "/get-involved",
  "/community",
  "/about",
  "/donate",
  "/contact",
  "/faq",
  "/merch",
  "/ramadan",
  "/support",
  "/privacy",
] as const;

/** A link box's value: a page of this site, a file under /documents/, or https. */
export function isPageLink(value: string, mailto = false): boolean {
  if (/\s/.test(value)) return false;
  if (value.startsWith("/")) {
    if (/^\/documents\/[a-z0-9._-]+$/i.test(value)) return true;
    const path = value.replace(/[?#].*$/, "");
    return (sitePaths as readonly string[]).includes(path);
  }
  if (mailto && /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}

/** A stored photo: a starter image or an uploaded one (one rule, `photo-list.ts`). */
export { photoSourcePattern };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ----------------------------------------------------------- the lists -- */

export const placeNames: Record<ReminderPlace, string> = {
  home: "Home: under the welcome",
  home_events: "Home: beside this week’s events",
  home_community: "Home: beside community updates",
  home_giving: "Home: beside giving",
  prayer: "Prayer & Musallah",
  events: "Events and each event’s page",
  get_involved: "Get involved",
  donate: "Donate",
  resources: "Resources",
  community: "Community updates and each update’s page",
  about: "About",
  ramadan: "Ramadan",
  support: "Support",
  footer: "Bottom of every page",
};

export const pageFields: Readonly<Record<PageTextKey, PageDocumentFields>> = {
  home: {
    title: "Home",
    summary:
      "The welcome, this week’s heading, the Jumu’ah heading and note, ways to help, and feature cards.",
    publicPath: "/",
    sections: [
      {
        id: "welcome",
        title: "Welcome",
        fields: [
          line(
            "hero.eyebrow",
            "Small heading above",
            "Faith. Knowledge. Community.",
            {
              required: true,
            },
          ),
          line("hero.headline", "Headline", "A little closer.", {
            required: true,
          }),
          line(
            "hero.emphasis",
            "Second line (in italics)",
            "To faith. To each other.",
          ),
          paragraphs(
            "hero.body",
            "Welcome text",
            "Welcome to your Muslim home away from home.",
          ),
          image("hero.image", "Photo", { required: true }),
          line("hero.primary_cta.label", "First button", "What’s happening", {
            required: true,
            max: 40,
          }),
          link("hero.primary_cta.href", "First button goes to", "/calendar", {
            required: true,
          }),
          line(
            "hero.secondary_cta.label",
            "Second button",
            "Find the Musallah",
            {
              required: true,
              max: 40,
            },
          ),
          link("hero.secondary_cta.href", "Second button goes to", "/prayer", {
            required: true,
          }),
          line("hero.aside.arabic", "Word in Arabic", "شكر", {
            required: true,
            max: 40,
          }),
          line(
            "hero.aside.transliteration",
            "The word in English letters",
            "Shukr",
            {
              required: true,
              max: 40,
            },
          ),
          text(
            "hero.aside.quote",
            "Its line",
            "Give thanks in ease and in hardship.",
            {
              required: true,
              max: 300,
            },
          ),
        ],
      },
      {
        id: "week",
        title: "This week",
        fields: [
          line("week.heading", "Heading", "Upcoming at MSA", {
            required: true,
          }),
          line(
            "week.empty_message",
            "Text when no events are listed",
            "No public events currently listed.",
            {
              required: true,
            },
          ),
        ],
      },
      {
        // The photo of "Your first visit" (photo library, 2026-10-06); its
        // words stay fixed.
        id: "visit",
        title: "Your first visit",
        note: "Only the photo can be changed here; the words are fixed.",
        fields: [image("visit.image", "Photo", { required: true })],
      },
      {
        id: "contribution",
        title: "Ways to help",
        fields: [
          line(
            "contribution.heading",
            "Heading",
            "Our community, built by students",
            {
              required: true,
            },
          ),
          list("contribution.items", "Ways to help", "Way to help", [
            icon(),
            line("title", "Title", "Volunteer", { required: true }),
            line(
              "short_description",
              "One line",
              "Serve at events and initiatives.",
              {
                required: true,
                max: 200,
              },
            ),
            link("href", "Goes to", "/get-involved#volunteer", {
              required: true,
            }),
          ]),
        ],
      },
      {
        id: "features",
        title: "Feature cards",
        fields: [
          list(
            "features",
            "Feature cards",
            "Card",
            [
              line("eyebrow", "Small heading above", "Seasonal community", {
                required: true,
              }),
              line("title", "Title", "Ramadan at SGU", { required: true }),
              text(
                "description",
                "Short description",
                "Schedules, iftars, volunteering and donations.",
                {
                  required: true,
                  max: 300,
                },
              ),
              line("cta", "Link text", "Visit Ramadan hub", {
                required: true,
                max: 40,
              }),
              link("href", "Goes to", "/ramadan", { required: true }),
              image("image", "Photo", { required: true }),
            ],
            6,
          ),
        ],
      },
    ],
  },
  about: {
    title: "About",
    summary: "Mission, what the MSA does, the team heading and note, contact.",
    publicPath: "/about",
    sections: [
      top({
        eyebrow: "Who we are",
        title: "About SGU MSA",
        description: "Your Muslim home away from home.",
      }),
      {
        id: "mission",
        title: "Our mission",
        fields: [
          line("mission.heading", "Heading", "Our Mission", { required: true }),
          paragraphs(
            "mission.body",
            "Text",
            "We keep a place to pray and a community that notices when someone is missing.",
          ),
        ],
      },
      {
        id: "what_we_do",
        title: "What we do",
        fields: [
          line("what_we_do.heading", "Heading", "What We Do", {
            required: true,
          }),
          list("what_we_do.items", "What we do", "Item", [
            icon(),
            line("title", "Title", "Prayer & Jumu’ah", { required: true }),
            text(
              "description",
              "One line",
              "Daily iqamah times and weekly Jumu’ah.",
              {
                required: true,
                max: 300,
              },
            ),
          ]),
        ],
      },
      {
        id: "team",
        title: "Our team",
        note: "The people themselves come from People.",
        fields: [
          line("board.heading", "Heading", "Our team", { required: true }),
          text(
            "board.note",
            "Note under the heading",
            "The MSA board is elected by students each year.",
            {
              max: 400,
            },
          ),
        ],
      },
      {
        id: "at_sgu",
        title: "MSA at SGU",
        fields: [
          line("at_sgu.heading", "Heading", "MSA at SGU", { required: true }),
          paragraphs(
            "at_sgu.body",
            "Text",
            "The organization is recognized as a student organization at SGU.",
          ),
          image("at_sgu.image", "Photo"),
        ],
      },
      {
        id: "contact",
        title: "Contact",
        fields: [
          line("contact.heading", "Heading", "Contact", { required: true }),
          text(
            "contact.body",
            "Text",
            "For anything the site does not answer, email the MSA directly.",
            {
              max: 400,
            },
          ),
          {
            kind: "email",
            path: "contact.email",
            label: "Email",
            example: "so-msa@sgu.edu",
          },
          text(
            "contact.note",
            "Note",
            "Replies may take a few days during examination periods.",
            {
              max: 400,
            },
          ),
        ],
      },
    ],
  },
  prayer: {
    title: "Prayer & Musallah",
    summary:
      "The top of the Prayer page, the lines under the iqamah times, Jumu’ah, and the Musallah directions, photos, information and helpers.",
    publicPath: "/prayer",
    sections: [
      top(
        {
          eyebrow: "Worship at SGU",
          title: "Prayer & Musallah",
          description:
            "Daily iqamah times, Jumu’ah information, and directions.",
        },
        true,
      ),
      {
        id: "times",
        title: "Iqamah times",
        note: "The times themselves are set on Prayer & iqamah.",
        fields: [
          line("heading", "Heading", "Daily Iqamah Times", { required: true }),
          text(
            "schedule_note",
            "Line under the times (when Prayer & iqamah has no notice)",
            "Congregation times set by the MSA.",
            {
              required: true,
              max: 400,
            },
          ),
          text(
            "no_schedule_note",
            "Line while no times are published",
            "A current congregation schedule has not yet been published.",
            {
              required: true,
              max: 400,
            },
          ),
          text(
            "unavailable_note",
            "Line when the times cannot be loaded",
            "Please check with the MSA before travelling.",
            {
              required: true,
              max: 400,
            },
          ),
        ],
      },
    ],
  },
  jumuah: {
    title: "Jumu’ah",
    summary: "The Jumu’ah heading and note on Home and the Prayer page.",
    publicPath: "/prayer",
    sections: [
      {
        id: "jumuah",
        title: "Jumu’ah",
        note: "The khutbah and iqamah times are set on Prayer & iqamah.",
        fields: [
          line("heading", "Heading", "Jumu’ah", { required: true }),
          text(
            "note",
            "Note",
            "Please arrive a few minutes before the khutbah begins.",
            {
              max: 400,
            },
          ),
        ],
      },
    ],
  },
  musallah: {
    title: "Musallah directions",
    summary: "Written directions, Musallah information, helpers, photos.",
    publicPath: "/prayer",
    sections: [
      {
        id: "directions",
        title: "Directions",
        fields: [
          line("route.heading", "Heading", "Find the Musallah", {
            required: true,
          }),
          text(
            "route.subheading",
            "Text under the heading",
            "Follow the written directions below.",
            {
              max: 400,
            },
          ),
          line(
            "route.directions_heading",
            "Directions heading",
            "Written directions",
            {
              required: true,
            },
          ),
          {
            kind: "lines",
            path: "route.directions",
            label: "Steps",
            hint: "One step per line.",
            example: "Start at the bus stop by Charter Hall.",
          },
          text(
            "route.landmark_note",
            "Last line",
            "Your destination is the SGU Musallah.",
            {
              max: 400,
            },
          ),
        ],
      },
      {
        id: "facilities",
        title: "Musallah information",
        fields: [
          line("facilities.heading", "Heading", "Musallah information", {
            required: true,
          }),
          text(
            "facilities.note",
            "Note",
            "Details are published here as they are confirmed.",
            {
              max: 400,
            },
          ),
          list("facilities.items", "Musallah information", "Detail", [
            icon(),
            line("label", "Name", "Wudu", { required: true }),
            confirmedChoice,
            text("detail", "Details", "Held weekly at the Musallah.", {
              max: 400,
            }),
          ]),
        ],
      },
      {
        id: "helpers",
        title: "Musallah helpers",
        fields: [
          line("helper_cta.eyebrow", "Small heading above", "Musallah Helpers"),
          line("helper_cta.heading", "Heading", "Help care for the space.", {
            required: true,
          }),
          text(
            "helper_cta.body",
            "Text",
            "Students help keep the Musallah welcoming.",
            {
              required: true,
              max: 400,
            },
          ),
          {
            kind: "form",
            path: "helper_cta.form",
            label: "Sign-up form",
            example: "musallah_helper",
            required: true,
          },
        ],
      },
      {
        id: "gallery",
        title: "Photos of the way",
        fields: [
          {
            kind: "list",
            path: "gallery",
            label: "Photos of the way",
            itemName: "Photo",
            example: "Photo",
            maxItems: 12,
            item: [image("", "Photo", { required: true })],
          },
        ],
      },
    ],
  },
  events: {
    title: "Events page",
    summary: "The top of the Events page and its empty line.",
    publicPath: "/calendar",
    sections: [
      top({
        eyebrow: "What’s happening",
        title: "Calendar",
        description: "MSA programming alongside SGU dates.",
      }),
      {
        id: "events",
        title: "Events list",
        note: "The events themselves are on Events.",
        fields: [
          line(
            "empty_message",
            "Text when no events are listed",
            "No public events currently listed.",
            {
              required: true,
            },
          ),
        ],
      },
    ],
  },
  community: {
    title: "Community page",
    summary: "The heading of Community updates and its empty lines.",
    publicPath: "/community",
    sections: [
      {
        id: "top",
        title: "Top of the page",
        fields: [
          line("eyebrow", "Small heading above", "Stay connected"),
          line("title", "Page title", "Community updates", { required: true }),
          text(
            "description",
            "Short description",
            "News, notices, and moments from Muslim life at SGU.",
            {
              max: 400,
            },
          ),
        ],
      },
      {
        id: "updates",
        title: "Updates list",
        note: "The updates themselves are Announcements and Community news.",
        fields: [
          line(
            "empty_title",
            "Text when nothing is listed",
            "There are no current updates.",
            {
              required: true,
            },
          ),
          line(
            "empty_hint",
            "Line under it",
            "New community news and notices will appear here.",
          ),
        ],
      },
    ],
  },
  newsletters: {
    title: "Newsletter archive",
    summary: "The newsletter archive’s heading and note.",
    publicPath: "/resources",
    sections: [
      {
        id: "archive",
        title: "Newsletter archive",
        note: "The issues themselves are on Newsletters.",
        fields: [
          line("heading", "Heading", "Newsletter Archive", { required: true }),
          text("note", "Note", "Past editions of the MSA newsletter.", {
            max: 400,
          }),
        ],
      },
    ],
  },
  resources: {
    title: "Resources",
    summary:
      "The resources library: guides, notices and links, and the newsletter archive’s heading and note.",
    publicPath: "/resources",
    sections: [
      top({
        eyebrow: "Publication library",
        title: "Resources",
        description: "Newsletters, guides, and reference material.",
      }),
      {
        // The search box and the shelf are one part of the page (review 3 B).
        id: "library",
        title: "Resources",
        fields: [
          line(
            "search_placeholder",
            "Hint in the search box",
            "Search resources…",
            {
              required: true,
              max: 60,
            },
          ),
          line(
            "empty_message",
            "Text when nothing matches",
            "No resources match this search.",
            {
              required: true,
            },
          ),
          list(
            "items",
            "Resources",
            "Resource",
            [
              line("title", "Title", "Jumu’ah at SGU", { required: true }),
              {
                kind: "list-option",
                list: "resource_categories",
                path: "category",
                label: "Category",
                example: "guide",
                hint: "Change these choices on Dashboard → Lists.",
              },
              text(
                "description",
                "Short description",
                "Where Jumu’ah is held and what time to arrive.",
                {
                  required: true,
                  max: 400,
                },
              ),
              line("updated_label", "Date line", "Archive · April 2026", {
                max: 60,
              }),
              link("resource_url", "Link", "/prayer#jumuah", {
                hint: "A page of this site, such as /prayer, or a web address starting with https://. Without a link, visitors don’t see this resource.",
              }),
              {
                kind: "yesno",
                path: "archived",
                label: "Archived",
                example: "No",
                hint: "Archived resources are hidden from visitors and stay here.",
              },
              image("image", "Photo"),
            ],
            60,
          ),
        ],
      },
    ],
  },
  "get-involved": {
    title: "Get involved",
    summary: "The ways to get involved, each with its sign-up form.",
    publicPath: "/get-involved",
    sections: [
      // The introduction is part of the page top (review 3 B).
      top(
        {
          eyebrow: "Contribute",
          title: "Get Involved",
          description: "Every part of the MSA is run by students.",
        },
        false,
        [
          text(
            "intro",
            "Introduction",
            "Pick the pathway that fits the time you have.",
            { max: 600 },
          ),
        ],
      ),
      {
        id: "pathways",
        title: "Ways in",
        fields: [
          list(
            "pathways",
            "Ways in",
            "Way in",
            [
              line("number", "Number", "01", { max: 4 }),
              line("title", "Title", "Volunteer", { required: true }),
              line(
                "summary",
                "One line",
                "Turn up for the events that need hands.",
                {
                  required: true,
                  max: 200,
                },
              ),
              text(
                "body",
                "Text",
                "Setup, registration, food, cleanup, photography.",
                {
                  max: 1000,
                },
              ),
              icon(),
              {
                kind: "form",
                path: "form",
                label: "Sign-up form",
                example: "volunteer",
              },
              image("image", "Photo"),
              list(
                "steps",
                "Steps",
                "Step",
                [
                  line("label", "Step", "Apply", { required: true, max: 40 }),
                  text(
                    "detail",
                    "Details",
                    "Send your interest and a proposed topic.",
                    {
                      max: 300,
                    },
                  ),
                ],
                8,
              ),
              {
                kind: "lines",
                path: "fields",
                label: "What the form asks",
                hint: "One per line.",
                example: "Topic",
              },
              text(
                "note",
                "Note",
                "Submitting the form is an expression of interest.",
                {
                  max: 300,
                },
              ),
            ],
            20,
          ),
        ],
      },
    ],
  },
  forms: {
    title: "Sign-up forms",
    summary: "Each Google Form the site links to, open or closed.",
    publicPath: null,
    sections: [
      {
        id: "forms",
        title: "Sign-up forms",
        note: "Answers stay in the board’s Google account; the website stores none of them. Paste the form’s share link (Send → link icon). Each event’s own sign-up link stays in the event (“Sign-up link”).",
        fields: [
          {
            kind: "entries",
            path: "forms",
            label: "Sign-up forms",
            example: "Volunteer",
            where: {
              musallah_helper: "Prayer & Musallah",
              student_khutbah: "Get involved",
              host_halaqa: "Get involved",
              volunteer: "Get involved",
              mentor: "Get involved",
              incoming_student: "Get involved",
              submit_idea: "Get involved",
              ramadan_volunteer: "Ramadan page",
              ramadan_donor: "Ramadan page",
            },
            item: [
              line("label", "Form", "Volunteer", { required: true, max: 80 }),
              {
                kind: "google-form",
                path: "url",
                label: "Link",
                example: "https://forms.gle/…",
              },
              { kind: "yesno", path: "open", label: "Open", example: "Open" },
              text(
                "description",
                "Short description",
                "Help keep the Musallah welcoming.",
                {
                  max: 300,
                },
              ),
            ],
          },
        ],
      },
    ],
  },
  faq: {
    title: "FAQ",
    summary: "Common questions, on Home and the FAQ page.",
    publicPath: "/faq",
    sections: [
      top({
        eyebrow: "You asked, we answered",
        title: "Common Questions",
        description: "Practical answers about prayer and the Musallah.",
      }),
      {
        id: "faq",
        title: "On Home",
        fields: [
          line("eyebrow", "Small heading above", "You asked, we answered"),
          line("heading", "Heading", "Common Questions", { required: true }),
        ],
      },
      {
        id: "questions",
        title: "Questions",
        fields: [
          list(
            "items",
            "Questions",
            "Question",
            [
              line("question", "Question", "Where is the Musallah located?", {
                required: true,
                max: 200,
              }),
              text(
                "answer",
                "Answer",
                "A short walk from the Charter Hall bus stop.",
                {
                  required: true,
                },
              ),
            ],
            40,
          ),
        ],
      },
    ],
  },
  donate: {
    title: "Donate",
    summary: "The opening of the Donate page.",
    publicPath: "/donate",
    sections: [
      {
        id: "opening",
        title: "Opening",
        note: "The giving lines below it are set on the payments screens.",
        fields: [
          line("eyebrow", "Small heading above", "Giving at SGU MSA"),
          line("title", "Title", "Support", { required: true, max: 60 }),
          line("emphasis", "Title, second part (in italics)", "our community", {
            max: 60,
          }),
          text(
            "lede",
            "Thank-you line",
            "Thank you for wanting to support Muslim student life at SGU.",
            {
              max: 400,
            },
          ),
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    summary: "The Contact page. The email and social links are on Site-wide.",
    publicPath: "/contact",
    sections: [
      {
        id: "top",
        title: "Top of the page",
        fields: [
          line("eyebrow", "Small heading above", "Contact & visit"),
          line("title", "Page title", "You’re welcome here", {
            required: true,
          }),
          text(
            "description",
            "Short description",
            "Connect with the MSA or plan your first visit.",
            {
              max: 400,
            },
          ),
        ],
      },
      {
        id: "card",
        title: "Get in touch",
        fields: [
          line("card.heading", "Heading", "Get in touch", { required: true }),
          line(
            "card.email_intro",
            "Line above the email",
            "For community questions:",
          ),
          line(
            "card.no_email",
            "Text while there is no email",
            "Contact details will be published here.",
            {
              required: true,
            },
          ),
        ],
      },
      {
        id: "visit",
        title: "Find the Musallah",
        fields: [
          line("visit.heading", "Heading", "Find the Musallah", {
            required: true,
          }),
          text(
            "visit.body",
            "Text",
            "Follow the written directions on the Prayer & Musallah page.",
            {
              max: 400,
            },
          ),
          line("visit.link_label", "Link text", "View directions", {
            required: true,
            max: 40,
          }),
        ],
      },
    ],
  },
  support: {
    title: "Support",
    summary: "The Support page and its on/off switch.",
    publicPath: "/support",
    sections: [
      {
        id: "settings",
        title: "Show the page",
        fields: [
          {
            kind: "yesno",
            path: "enabled",
            label: "Show the Support page on the website",
            example: "Yes",
          },
          {
            kind: "yesno",
            path: "prototype_notice",
            label: "Show the “proposed service” label",
            example: "Yes",
          },
          line(
            "prototype_label",
            "The label",
            "Proposed Student Support Service",
            {
              required: true,
            },
          ),
          text(
            "governance_notice",
            "Line under the label",
            "This service is proposed by the MSA.",
            {
              max: 600,
            },
          ),
        ],
      },
      top({
        eyebrow: "Peer support",
        title: "Need someone to talk to?",
        description: "MSA can offer a familiar peer connection.",
      }),
      {
        id: "privacy",
        title: "Privacy",
        fields: [
          line("privacy.heading", "Heading", "Discreet & Respectful", {
            required: true,
          }),
          text(
            "privacy.body",
            "Text",
            "Conversations are handled with discretion and respect.",
            {
              required: true,
              max: 1000,
            },
          ),
        ],
      },
      {
        id: "contacts",
        title: "Who you can reach",
        fields: [
          line("contacts.heading", "Heading", "Who you can reach", {
            required: true,
          }),
          text(
            "contacts.note",
            "Note",
            "Contact details are published once the board confirms them.",
            {
              max: 400,
            },
          ),
          list(
            "contacts.items",
            "Who you can reach",
            "Contact",
            [
              line("role", "Role", "Sisters’ VP", { required: true }),
              text(
                "description",
                "One line",
                "First point of contact for sisters on campus.",
                {
                  max: 300,
                },
              ),
              confirmedChoice,
              {
                kind: "email",
                path: "email",
                label: "Email",
                example: "so-msa@sgu.edu",
              },
              line("phone", "Phone", "+1 473 555 0100", { max: 40 }),
              link("link", "Link", "https://"),
            ],
            12,
          ),
        ],
      },
      {
        id: "professional",
        title: "Professional support",
        fields: [
          line("professional.heading", "Heading", "Professional SGU Support", {
            required: true,
          }),
          text(
            "professional.body",
            "Text",
            "MSA peer support is not a substitute for professional care.",
            {
              max: 600,
            },
          ),
          list(
            "professional.items",
            "Professional support",
            "Service",
            [
              line("name", "Name", "SGU Psychological Services", {
                required: true,
              }),
              text(
                "description",
                "One line",
                "Free and confidential for students.",
                { max: 300 },
              ),
              confirmedChoice,
              link("url", "Link", "https://"),
            ],
            12,
          ),
        ],
      },
    ],
  },
  integrations: {
    title: "Go2Pay receipt note",
    summary: "The thank-you note you copy into each Go2Pay product's receipt.",
    publicPath: null,
    sections: [
      // PR6 D-32: the fund and ticket editors put "{name} ({category})."
      // before it in their copy box; the board pastes it into each Go2Pay
      // product's receipt note by hand.
      {
        id: "receipt",
        title: "Go2Pay receipt note",
        fields: [
          text(
            "payments.receipt_note",
            "Note on Go2Pay receipts",
            "Thank you for supporting the SGU MSA. JazakAllahu khayran.",
            {
              max: 120,
              // The starter note fills four lines on a phone (review PR-4).
              rows: 5,
              hint: "Copied into each fund's and ticket's Go2Pay page by hand, after its name. Changing it here does not change Go2Pay.",
            },
          ),
        ],
      },
    ],
  },
  site: {
    title: "Site-wide",
    summary:
      "Organisation name, tagline, email, social links, search description.",
    publicPath: null,
    sections: [
      {
        id: "organisation",
        title: "Organisation",
        fields: [
          line("brand.name", "Full name", "SGU Muslim Students Association", {
            required: true,
          }),
          line("brand.short_name", "Short name", "SGU MSA", {
            required: true,
            max: 40,
          }),
          line(
            "brand.university",
            "Name with the university",
            "St. George’s University Muslim Students Association",
            {
              required: true,
            },
          ),
          line("brand.tagline", "Tagline", "Faith. Knowledge. Community.", {
            required: true,
          }),
          {
            kind: "email",
            path: "brand.email",
            label: "Email",
            example: "so-msa@sgu.edu",
          },
        ],
      },
      {
        id: "social",
        title: "Social links",
        fields: [
          list(
            "social",
            "Social links",
            "Link",
            [
              line("label", "Name", "MSA on Instagram", {
                required: true,
                max: 60,
              }),
              {
                ...link("url", "Link", "https://www.instagram.com/sgumsa", {
                  required: true,
                }),
                hint: "A web address starting with https://, or mailto: and an email address.",
                mailto: true,
              },
              {
                kind: "choice",
                path: "kind",
                label: "Icon",
                example: "instagram",
                required: true,
                options: [
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["whatsapp", "WhatsApp"],
                  ["email", "Email"],
                  ["other", "Other"],
                ],
              },
            ],
            10,
          ),
        ],
      },
      {
        id: "search",
        title: "Search engines",
        fields: [
          text(
            "meta.description",
            "Description in search results",
            "Prayer times, Jumu’ah, events and community for Muslim students at SGU.",
            {
              required: true,
              max: 300,
            },
          ),
        ],
      },
    ],
  },
  "reminder-places": {
    title: "Verse on each page",
    summary: "Which Qur’an verse shows in each place.",
    publicPath: null,
    sections: [
      {
        id: "places",
        title: "Verse on each page",
        note: "Chosen from the site’s verse library; the Arabic is never typed.",
        fields: reminderPlaces.map(
          (place) =>
            ({
              kind: "verse",
              path: `places.${place}`,
              label: placeNames[place],
              example: "94:5",
            }) as const,
        ),
      },
    ],
  },
  // PR5c: the Merch page's opening; collections, items and sizes are on the Merch screen.
  merch: {
    title: "Merch",
    summary: "The opening of the Merch page.",
    publicPath: "/merch",
    sections: [
      top(
        {
          eyebrow: "Three collections",
          title: "Merch",
          description: "What the MSA has made, and what students wear now.",
        },
        false,
        [
          line(
            "garment_note",
            "Note about the shirts",
            "All MSA shirts are long-sleeve.",
          ),
        ],
      ),
    ],
  },
};

/**
 * A page section's name in Pages (review 3 B): its own title in the layout,
 * else the title of the Pages section that edits it.
 */
export function pageSectionTitle(key: LayoutKey, id: string): string {
  const entry = (pageLayouts[key] as PageLayout).sections.find(
    (section) => section.id === id,
  );
  if (!entry) return id;
  if (entry.title) return entry.title;
  const source = entry.source;
  return source.from === "text"
    ? (pageFields[source.key].sections.find((section) => section.id === id)
        ?.title ?? id)
    : id;
}

/**
 * The section a box is in, by the box's path ("features.0.image" → the
 * Feature cards section's id), or the section whose "Show this section on
 * the page" box a `sections.<id>` problem names (review 3 B). Null when
 * the path is in no section.
 */
export function sectionOfPath(key: PageTextKey, path: string): string | null {
  if (path.startsWith("sections.")) return path.slice("sections.".length);
  const owner = pageFields[key].sections.find((section) =>
    section.fields.some(
      (field) =>
        !field.path || path === field.path || path.startsWith(`${field.path}.`),
    ),
  );
  return owner?.id ?? null;
}

/* --------------------------------------------------------- reading paths -- */

type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value at a dotted path ("" is the root itself), or undefined. */
export function valueAt(root: Json, path: string): Json {
  if (!path) return root;
  let value: Json = root;
  for (const part of path.split(".")) {
    if (!isObject(value)) return undefined;
    value = value[part];
  }
  return value;
}

/** Whether every part of a dotted path is present (a null value counts). */
function hasPath(root: Json, path: string): boolean {
  if (!path) return true;
  let value: Json = root;
  for (const part of path.split(".")) {
    if (!isObject(value) || !(part in value)) return false;
    value = value[part];
  }
  return true;
}

/** A copy of `root` with `value` at a dotted path (objects made as needed). */
export function withValueAt(root: Json, path: string, value: Json): Json {
  if (!path) return value;
  const [head, ...rest] = path.split(".");
  const object = isObject(root) ? root : {};
  return {
    ...object,
    [head]: withValueAt(object[head], rest.join("."), value),
  };
}

/* ------------------------------------------------------------- merging -- */

/** A short id for a new list item, from its first words ("volunteer-2"). */
function newItemId(item: Record<string, Json>, taken: Set<string>) {
  // Named after what the board reads first: its title, question or name.
  const words = ["title", "label", "question", "name", "role"]
    .map((key) => item[key])
    .find(
      (value): value is string =>
        typeof value === "string" && value.trim() !== "",
    );
  const base =
    (words ?? "item")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/** Normalised typed text: Windows line breaks as `\n`, trimmed. */
const clean = (value: Json) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : value;

/**
 * The value of one field as it will be stored: typed text cleaned, an empty
 * optional box as null (the block hides), paragraphs and lines without empty
 * entries; photos keep the stored keys the editor does not show (focal point,
 * credit, year). Lists keep each stored item's other keys by id; new items
 * get an id.
 */
function storedValue(
  field: PageField,
  posted: Json,
  stored: Json,
  relaxed = false,
): Json {
  switch (field.kind) {
    case "paragraphs":
    case "lines":
      return Array.isArray(posted)
        ? posted.map(clean).filter((entry) => entry !== "")
        : posted;
    case "yesno":
      return posted === true;
    case "image": {
      if (!isObject(posted) || !clean(posted.src)) return undefined;
      const base = isObject(stored) && stored.src === posted.src ? stored : {};
      // Older documents may still carry the retired `historical`/`year` keys.
      const { historical: _historical, year: _year, ...kept } = base;
      return {
        ...kept,
        src: clean(posted.src),
        alt: clean(posted.alt) ?? "",
      };
    }
    case "list": {
      if (!Array.isArray(posted)) return posted;
      const before = new Map(
        (Array.isArray(stored) ? stored : [])
          .filter(isObject)
          .filter((item) => typeof item.id === "string")
          .map((item) => [item.id as string, item]),
      );
      const ids = new Set<string>();
      // A photo list stores the photos themselves (no item object around them).
      if (field.item.length === 1 && field.item[0].path === "")
        return posted.map((entry, index) =>
          storedValue(
            field.item[0],
            entry,
            Array.isArray(stored) ? stored[index] : undefined,
            relaxed,
          ),
        );
      return posted
        .map((entry) => {
          if (!isObject(entry)) return entry;
          const id =
            typeof entry.id === "string" && entry.id && !ids.has(entry.id)
              ? entry.id
              : null;
          if (id) ids.add(id);
          const old = id ? before.get(id) : undefined;
          let item: Json = { ...(old ?? {}) };
          for (const part of field.item)
            item = withValueAt(
              item,
              part.path,
              storedValue(
                part,
                valueAt(entry, part.path),
                valueAt(old, part.path),
                relaxed,
              ),
            );
          return item;
        })
        .map((item) =>
          isObject(item) && typeof item.id !== "string"
            ? { id: newItemId(item, ids), ...item }
            : item,
        );
    }
    case "entries": {
      if (!isObject(posted) || !isObject(stored)) return stored;
      // The keys are the stored ones: entries are never added or removed here.
      return Object.fromEntries(
        Object.entries(stored).map(([key, old]) => {
          let entry: Json = { ...(isObject(old) ? old : {}) };
          for (const part of field.item)
            entry = withValueAt(
              entry,
              part.path,
              storedValue(
                part,
                valueAt(posted[key], part.path),
                valueAt(old, part.path),
              ),
            );
          return [key, entry];
        }),
      );
    }
    default: {
      // An empty optional box is left out: the page hides that block, or
      // shows the document's own default line where it has one. An empty
      // required box of a hidden section is kept empty (review 3 B).
      const value = clean(posted);
      if (value !== "" && value !== null) return value;
      return relaxed && field.required && emptiedWhenHidden(field)
        ? ""
        : undefined;
    }
  }
}

/**
 * The document to save: the stored document with every field of the field
 * list taken from what the form posted. `outOfDate` when the form lacks a
 * field of today's list (a screen loaded before the list changed; PR4
 * precedent), so the board is asked to reload instead of losing text.
 */
export function mergePageText(
  key: PageTextKey,
  stored: Json,
  posted: Json,
  hidden: ReadonlySet<string> = hiddenSections(key, posted),
): { ok: true; document: Json } | { ok: false; reason: "out_of_date" } {
  const { sections } = pageFields[key];
  if (
    !isObject(posted) ||
    sections.some((section) =>
      section.fields.some((field) => !hasPath(posted, field.path)),
    ) ||
    (isLayoutKey(key) && !isPageSections(key, posted.sections))
  )
    return { ok: false, reason: "out_of_date" };
  let document: Json = structuredClone(isObject(stored) ? stored : {});
  for (const section of sections)
    for (const field of section.fields)
      document = withValueAt(
        document,
        field.path,
        storedValue(
          field,
          valueAt(posted, field.path),
          valueAt(stored, field.path),
          hidden.has(section.id),
        ),
      );
  // The page's sections: their order and which are shown (review 3 B).
  if (isLayoutKey(key))
    document = withValueAt(
      document,
      "sections",
      storedSections(posted).map(({ id, shown }) => ({ id, shown })),
    );
  return { ok: true, document };
}

/**
 * Whether `value` is a page's `sections`: each of its sections once, shown
 * or not. Anything else comes from a screen older than the page's sections.
 */
function isPageSections(key: PageTextKey, value: Json): boolean {
  if (!isLayoutKey(key) || !Array.isArray(value)) return false;
  const ids: readonly string[] = layoutIds(key);
  const entries = storedSections({ sections: value });
  return (
    entries.length === value.length &&
    entries.length === ids.length &&
    new Set(entries.map((entry) => entry.id)).size === ids.length &&
    entries.every((entry) => ids.includes(entry.id))
  );
}

/* --------------------------------------------------------------- rules -- */

const atMost = (label: string, count: number) =>
  `${label}: use ${count.toLocaleString("en-US")} characters or fewer.`;
/** Field names in messages: the box's label, after its list item ("Question 2 · Answer"). */
const named = (prefix: string, label: string) =>
  prefix ? `${prefix} · ${label}` : label;

type Problem = { path: string; message: string };

/** A box's path inside its list or entry: "items.1.answer", "photos.0". */
const inner = (path: string, ...parts: (string | number)[]) =>
  [path, ...parts].filter((part) => part !== "").join(".");

/**
 * Every problem of one field's value, top to bottom, each at the path of its
 * own box ("items.1.answer"), so the editor shows it on that box (review 2).
 */
function fieldProblems(
  field: PageField,
  value: Json,
  prefix: string,
  path: string,
  relaxed = false,
): Problem[] {
  const label = named(prefix, field.label);
  const problem = (message: string): Problem[] => [{ path, message }];
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (field.kind === "yesno" || field.kind === "entries") {
    if (field.kind === "yesno") return [];
    return Object.entries(isObject(value) ? value : {}).flatMap(
      ([key, entry]) =>
        field.item.flatMap((part) =>
          fieldProblems(
            part,
            valueAt(entry, part.path),
            named(prefix, String(valueAt(entry, "label") || key)),
            inner(path, key, part.path),
            relaxed,
          ),
        ),
    );
  }
  if (empty)
    return field.required && (!relaxed || !emptiedWhenHidden(field))
      ? problem(
          field.kind === "image"
            ? `${label}: choose a photo.`
            : field.kind === "list"
              ? `${label}: add at least one ${field.itemName.toLowerCase()}.`
              : `${label}: fill in this box.`,
        )
      : [];
  const max = field.max ?? (field.kind === "line" ? LINE_MAX : TEXT_MAX);
  switch (field.kind) {
    case "line":
    case "text":
      return typeof value === "string" && value.length > max
        ? problem(atMost(label, max))
        : [];
    case "paragraphs":
    case "lines":
      return Array.isArray(value) &&
        value.some((entry) => typeof entry === "string" && entry.length > max)
        ? problem(
            `${label}: keep each ${field.kind === "lines" ? "line" : "paragraph"} to ${max.toLocaleString("en-US")} characters or fewer.`,
          )
        : [];
    case "link":
      return typeof value === "string" && !isPageLink(value, field.mailto)
        ? problem(
            field.mailto
              ? `${label}: use a web address starting with https://, or mailto: and an email address.`
              : `${label}: use a page of this site (such as /prayer) or a web address starting with https://.`,
          )
        : [];
    case "email":
      return typeof value === "string" && !emailPattern.test(value)
        ? problem(`${label}: use an email address such as name@example.com.`)
        : [];
    case "google-form":
      return typeof value === "string" && !isGoogleFormUrl(value)
        ? problem(googleFormsOnly(label))
        : [];
    case "image":
      if (!isObject(value) || typeof value.src !== "string")
        return problem(`${label}: choose a photo.`);
      if (!photoSourcePattern.test(value.src))
        return problem(`${label}: choose the photo again.`);
      return typeof value.alt !== "string" || !value.alt
        ? problem(`${label}: describe the photo in one sentence.`)
        : value.alt.length > 250
          ? problem(atMost(`${label} description`, 250))
          : [];
    case "icon":
      return iconNameSchema.safeParse(value).success
        ? []
        : problem(`${label}: choose an icon.`);
    case "form":
      return typeof value === "string" && /^[a-z0-9_]{1,40}$/.test(value)
        ? []
        : problem(`${label}: choose a sign-up form.`);
    case "list-option":
      return typeof value === "string" && listSlugPattern.test(value)
        ? []
        : problem(`${label}: choose one from the list.`);
    case "verse":
      return typeof value === "string" && verseReferencePattern.test(value)
        ? []
        : problem(`${label}: choose a verse from the library.`);
    case "choice":
      return field.options.some(([option]) => option === value)
        ? []
        : problem(`${label}: choose one.`);
    case "list":
      if (!Array.isArray(value))
        return problem(`${label}: reload and try again.`);
      return [
        ...(value.length > field.maxItems
          ? problem(`${label}: keep ${field.maxItems} or fewer.`)
          : []),
        ...value.flatMap((item, index) =>
          field.item.flatMap((part) =>
            fieldProblems(
              part,
              valueAt(item, part.path),
              named(prefix, `${field.itemName} ${index + 1}`),
              inner(path, index, part.path),
              relaxed,
            ),
          ),
        ),
      ];
  }
}

/**
 * The document's problems against its field list, top to bottom. In a
 * section hidden on its page (`hidden`, by section id; review 3 B) the
 * required boxes may stay empty, except a photo or a choice.
 */
export function pageTextProblems(
  key: PageTextKey,
  document: Json,
  hidden: ReadonlySet<string> = hiddenSections(key, document),
): Problem[] {
  return pageFields[key].sections.flatMap((section) =>
    section.fields.flatMap((field) =>
      fieldProblems(
        field,
        valueAt(document, field.path),
        // Several sections have a "Heading": messages name the section.
        section.title,
        field.path,
        hidden.has(section.id),
      ),
    ),
  );
}

/**
 * The problems of one section with every required box applied, as if it
 * were shown (review 3 B): a page shows a section of another page text only
 * once these are fixed there.
 */
export function sectionProblems(
  key: PageTextKey,
  document: Json,
  section: string,
): Problem[] {
  const fields =
    pageFields[key].sections.find((entry) => entry.id === section)?.fields ??
    [];
  return pageTextProblems(key, document, new Set()).filter((problem) =>
    fields.some(
      (field) =>
        !field.path ||
        problem.path === field.path ||
        problem.path.startsWith(`${field.path}.`),
    ),
  );
}

/**
 * The save rules of one document: the field list's rules (required boxes,
 * lengths, links, Google Forms links, photo descriptions), then the
 * document's own schema, so what is saved reads back the same.
 */
export function pageTextSaveSchema<K extends PageTextKey>(
  key: K,
  hidden?: ReadonlySet<string>,
): z.ZodType<EditorialDocuments[K]> {
  const { schema } = editorialDocuments[key];
  return z
    .unknown()
    .superRefine((document, ctx) => {
      for (const { path, message } of pageTextProblems(
        key,
        document,
        hidden ?? hiddenSections(key, document),
      ))
        ctx.addIssue({ code: "custom", message, path: [path] });
    })
    .pipe(schema as z.ZodType<EditorialDocuments[K]>) as unknown as z.ZodType<
    EditorialDocuments[K]
  >;
}

/**
 * The Preview's document (PR5b WP4): what typing so far would save
 * (`mergePageText` over the editor's own document, then the save rules), or
 * the problems a save would list. Photos chosen but not yet saved are not in
 * it: the page shows the photo that is there now. Pure (browser).
 */
export function previewPageText<K extends PageTextKey>(
  key: K,
  typed: Json,
  hidden: ReadonlySet<string> = hiddenSections(key, typed),
):
  | { ok: true; document: EditorialDocuments[K] }
  | { ok: false; problems: string[] } {
  const merged = mergePageText(key, typed, typed, hidden);
  if (!merged.ok) return { ok: false, problems: [outOfDate] };
  const result = pageTextSaveSchema(key, hidden).safeParse(merged.document);
  return result.success
    ? { ok: true, document: result.data }
    : {
        ok: false,
        problems: [
          ...new Set(result.error.issues.map((issue) => issue.message)),
        ],
      };
}

/** An empty value of a field, for a box that has nothing stored yet. */
function emptyValue(field: PageField): Json {
  switch (field.kind) {
    case "paragraphs":
    case "lines":
    case "list":
      return [];
    case "yesno":
      return false;
    case "entries":
      return {};
    default:
      return null;
  }
}

/**
 * The document as the editor starts it: every field of the list present
 * (missing ones empty), so the form always posts every field and an empty
 * optional block can be filled in.
 */
export function withEveryField(key: PageTextKey, document: Json): Json {
  let filled: Json = structuredClone(isObject(document) ? document : {});
  for (const section of pageFields[key].sections)
    for (const field of section.fields)
      if (valueAt(filled, field.path) === undefined)
        filled = withValueAt(filled, field.path, emptyValue(field));
  // A page's sections, each once (review 3 B).
  if (isLayoutKey(key) && !isPageSections(key, valueAt(filled, "sections")))
    filled = withValueAt(filled, "sections", starterSections(key));
  return filled;
}

/**
 * Whether a document names an uploaded photo: any `src` equal to
 * `/media/<file>`, at any depth. Mirror of `page_text_names_file()` (the
 * storage rules) for the sandbox and the file clean-up.
 */
export function documentNamesPhoto(document: Json, file: string): boolean {
  const src = `/media/${file}`;
  const visit = (value: Json): boolean =>
    Array.isArray(value)
      ? value.some(visit)
      : isObject(value)
        ? value.src === src || Object.values(value).some(visit)
        : false;
  return visit(document);
}

/** The uploaded photos a document names (`/media/<file>` sources), each once. */
export function photosIn(document: Json): string[] {
  const found = new Set<string>();
  const visit = (value: Json) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isObject(value)) {
      if (typeof value.src === "string" && value.src.startsWith("/media/"))
        found.add(value.src.slice("/media/".length));
      Object.values(value).forEach(visit);
    }
  };
  visit(document);
  return [...found];
}

/* -------------------------------------------------------------- photos -- */

/** A path with list positions: "features.0.image" → ["features", 0, "image"]. */
export function pathSegments(path: string): (string | number)[] {
  return path
    ? path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
}

function getIn(root: Json, at: readonly (string | number)[]): Json {
  let value = root;
  for (const part of at)
    value =
      Array.isArray(value) && typeof part === "number"
        ? value[part]
        : isObject(value)
          ? value[String(part)]
          : undefined;
  return value;
}

function setIn(
  root: Json,
  at: readonly (string | number)[],
  value: Json,
): Json {
  if (!at.length) return value;
  const [head, ...rest] = at;
  if (Array.isArray(root) && typeof head === "number") {
    const copy = [...root];
    copy[head] = setIn(root[head], rest, value);
    return copy;
  }
  const object = isObject(root) ? root : {};
  return { ...object, [head]: setIn(object[String(head)], rest, value) };
}

/** Whether a posted photo's name ("photo:<path>") names a photo box of this page. */
export function isPhotoPath(key: PageTextKey, path: string): boolean {
  const at = pathSegments(path);
  const walk = (
    fields: readonly PageField[],
    rest: (string | number)[],
  ): boolean =>
    fields.some((field) => {
      const own = pathSegments(field.path);
      if (own.some((part, index) => rest[index] !== part)) return false;
      const after = rest.slice(own.length);
      if (field.kind === "image") return after.length === 0;
      if (field.kind === "list")
        return typeof after[0] === "number" && walk(field.item, after.slice(1));
      return false;
    });
  return walk(
    pageFields[key].sections.flatMap((section) => section.fields),
    at,
  );
}

/**
 * A stand-in source for a photo chosen in this save, so the save rules see
 * a photo there; the action puts the stored name in after the upload.
 */
export const chosenPhotoSource =
  "/media/00000000-0000-0000-0000-000000000000.webp";

/**
 * The posted document with a chosen photo at each of `paths`: its typed
 * description and "old photo" tick kept. Null when a path is not a photo box.
 */
export function withChosenPhotos(
  key: PageTextKey,
  posted: Json,
  paths: readonly string[],
): Json | null {
  let document = posted;
  for (const path of paths) {
    if (!isPhotoPath(key, path)) return null;
    const at = pathSegments(path);
    const photo = getIn(document, at);
    document = setIn(document, at, {
      ...(isObject(photo) ? photo : {}),
      src: chosenPhotoSource,
    });
  }
  return document;
}

/** The document with the stored photo `name` at `path` (after its upload). */
export function withPhotoSource(document: Json, path: string, name: string) {
  const at = pathSegments(path);
  const photo = getIn(document, at);
  return setIn(document, at, {
    ...(isObject(photo) ? photo : {}),
    src: `/media/${name}`,
  });
}

/**
 * An earlier version as History restores it: a photo replaced since then is
 * no longer stored (its file is deleted when replaced), so it keeps the photo
 * that is there now, or none (PR5b, E-8).
 */
export function keepCurrentPhotos(earlier: Json, current: Json): Json {
  const kept = new Set(photosIn(current));
  const visit = (value: Json, at: (string | number)[]): Json => {
    if (Array.isArray(value))
      return value.map((item, index) => visit(item, [...at, index]));
    if (!isObject(value)) return value;
    if (
      typeof value.src === "string" &&
      value.src.startsWith("/media/") &&
      !kept.has(value.src.slice("/media/".length))
    ) {
      const now = getIn(current, at);
      return isObject(now) && typeof now.src === "string" ? now : undefined;
    }
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [
        name,
        visit(item, [...at, name]),
      ]),
    );
  };
  return visit(earlier, []);
}

/**
 * What a History restore saves, and what its confirmation previews (PR5b
 * D-12, E-8; review 3 D): the earlier text in every box, with the photos
 * that are there now (`keepCurrentPhotos`), checked by the save rules like
 * any save. Sections hidden in the restored version, or by the page that
 * shows them (`elsewhere`, review 3 B), are not checked: their words are
 * kept as they are. Refused with the first problem when the earlier version
 * breaks a rule, or `outOfDate` when it no longer fits the page's boxes.
 */
export function restoredPageText<K extends PageTextKey>(
  key: K,
  earlier: Json,
  current: Json,
  elsewhere: Iterable<string> = [],
):
  | { ok: true; document: EditorialDocuments[K] }
  | { ok: false; problem: string } {
  const restored = withEveryField(key, keepCurrentPhotos(earlier, current));
  const hidden = new Set([...hiddenSections(key, restored), ...elsewhere]);
  const merged = mergePageText(key, current, restored, hidden);
  if (!merged.ok) return { ok: false, problem: outOfDate };
  const parsed = pageTextSaveSchema(key, hidden).safeParse(merged.document);
  return parsed.success
    ? { ok: true, document: parsed.data }
    : { ok: false, problem: parsed.error.issues[0]?.message ?? outOfDate };
}
