import type { z } from "zod";
import type { AccessResult, ListView } from "@/lib/backend/providers/contract";
import {
  eventStatusNames,
  JUMUAH_NOTICE_MINUTES_AFTER,
  recordFieldNames,
  recordSchema,
  type Collection,
  type CommunityRecord,
} from "@/lib/community/schema";
import type { Access } from "@/lib/community/people";
import { listWords } from "@/lib/community/lists";
import { staleScreen, systemText, unavailableMessage } from "@/lib/system-text";
import type { EditorState } from "./actions";
/** A refused action: the reason, no notice. */
export const refuse = (error: string): EditorState => ({ error, notice: null });
/** A form with no answer yet. */
export const initialEditorState: EditorState = { error: null, notice: null };
export const collectionLabels: Record<Collection, string> = {
  events: "Events",
  announcements: "Announcements",
  news_posts: "Community news",
  newsletters: "Newsletters",
};
/** A person's login state, as the People list shows it. */
export const accessStateLabels: Record<Access["state"], string> = {
  none: "No login",
  invited: "Invited",
  active: "Login active",
  deactivated: "Login deactivated",
};
/**
 * Why an access change is refused: the access guard's answers (PR3 contract,
 * Failure Modes; D-19). The access panel shows the same words next to a
 * control that would be refused.
 */
export const accessRefusals = {
  self: systemText.sguCodes.SGU01,
  self_money: systemText.sguCodes.SGU09,
  last_manager: systemText.sguCodes.SGU02,
  person_archived: "Restore this person first.",
  forbidden: systemText.sguCodes.SGU03,
  not_executive: systemText.sguCodes.SGU14,
} as const;
/**
 * The team list's words in the person form (review fixes P4, user
 * 2026-10-07): the Executive board is always on About, with a photo; the
 * others have "Show on public page", by name and role only.
 */
export const teamListWords = {
  executiveListed:
    "Everyone in the Executive board is on the About page, with their photo when one is added.",
  showLabel: "Show on public page",
  showHint:
    "Lists their name and role under “View all” on the About page. Untick it for someone who doesn’t want their name online.",
  photoHint: "Shows above their name on the About page.",
  addPhoto:
    "No photo yet. Add one: the About page shows the Executive board with their photos.",
  photoExecutiveOnly:
    "Only Executive board members have a photo. Choose the Executive board, or save without a photo.",
  photoGoes:
    "Moving them out of the Executive board hides their photo. It shows again if they come back.",
} as const;
/** "Change email" on a person's login (review fixes P4). */
export const changeEmailWords = {
  summary: "Change email",
  label: "New email",
  explain:
    "They sign in with the new email from now on. Their password stays the same.",
  explainInvited:
    "The invite is sent again to the new email. The link sent to the old one stops working.",
  button: "Change email",
  same: "This is already their email. Type the new one.",
  taken: "Another login already uses this email. Use a different email.",
  off: "Email changes are switched off on this computer (SUPABASE_SECRET_KEY is off). Nothing was changed.",
  done: (email: string) =>
    `Email changed to ${email}. They sign in with it from now on; their password is the same.`,
} as const;
/**
 * Archiving a person means "No longer on the team" (review fixes P4, the
 * plan's default): hidden from the public site, login off, history kept,
 * restorable.
 */
export const leftTeamWords = {
  summary: "No longer on the team?",
  button: "No longer on the team",
  explain:
    "They come off the About page and their login is turned off: they are signed out on every device. Their entry and their past changes are kept under Archived, where any board member can restore them. A restored person’s login stays off until someone who can manage people reactivates it.",
  done: "Marked as no longer on the team. They are off the About page and their login is off; find them under Archived.",
  archivedIntro:
    "No longer on the team: off the About page, their login is off, and their entry and history are kept. Restore them to edit the entry again; their login stays off until it is reactivated.",
  listIntro:
    "People no longer on the team: off the About page, their login is off, and their history is kept. View one to restore them or remove their photo.",
} as const;
/** On the People list, an Executive board member with no photo (review fixes P4). */
export const noPhotoBadge = "No photo yet";
/** Under Group when a move would turn the person's permissions off (2026-10-06). */
export const leavingExecutive =
  "Moving them out of the Executive board turns off their Manage people and Manage money.";
/**
 * Why a People save that moves someone out of the Executive board was
 * refused (2026-10-06): the move turns off their "manage people", so the
 * access guard applies; and the Executive board moves need "manage people".
 */
export const executiveMoveRefusals = {
  forbidden: systemText.sguCodes.SGU15,
  self: "You cannot move yourself out of the Executive board while you can manage people. Ask another person who can manage people.",
  last_manager:
    "This person is the last one who can manage people, so they stay in the Executive board. Give Manage people to another executive first.",
} as const;
/**
 * The question under Role when the chosen Executive board role is taken
 * (user, 2026-10-06: one current person per role). Yes moves the holder to
 * the General board with no role title, in the same save.
 */
export const roleTakenWords = {
  question: (holder: string, role: string, name: string) =>
    `${holder} is ${role}. Make ${name || "this person"} ${role} instead?`,
  explain: (holder: string) =>
    `${holder} moves to the General board, with no role title. Nobody is deleted.`,
  yes: "Yes",
  cancel: "Cancel",
  confirmed: (holder: string, role: string) =>
    `When you save, this person becomes ${role} and ${holder} moves to the General board.`,
  taken: (holder: string, role: string) => `${holder} is ${role}.`,
  // Why the holder stays (the access guard; "manage people" is for executives).
  self: executiveMoveRefusals.self,
  last_manager: (holder: string) =>
    `${holder} is the last person who can manage people, so they stay in the Executive board. Give Manage people to another executive first.`,
  forbidden:
    "Only a board member who can manage people can give this role to someone else.",
  /** In the question at Save while it is open, or the role cannot be given. */
  answer: "Answer Yes or Cancel first.",
  chooseAnother: "Choose another role, or Cancel.",
  /** The server found a holder the screen did not show (someone saved meanwhile). */
  stale: (holder: string, role: string) =>
    `${holder} is ${role} now. Reload the page, then choose again.`,
  /** Restore of a person whose role someone else holds now. */
  restore:
    "Someone else holds this person's Executive board role now. Move that person out of the role first, then restore.",
} as const;
/** Every refusal of an access change (`set_access`, or archiving a person, D-12). */
export const accessFailures: Record<
  Extract<AccessResult, { ok: false }>["reason"],
  string
> = {
  ...accessRefusals,
  conflict: staleScreen,
  unavailable: unavailableMessage("save"),
};
/** Only "manage people" holders may permanently delete (D-6). */
export const purgeForbidden =
  "Only a board member who can manage people can delete permanently.";
/** A group someone (archived or not) is still in cannot be deleted (review 2). */
export const groupNotEmpty =
  "Only an empty group can be deleted. Move or permanently delete the people in it first.";
/** A permanent delete without the typed DELETE. */
export const typeDeleteToConfirm = "Type DELETE to confirm.";
/** An invite or reset link that no longer works (PR3 contract, Failure Modes). */
export const expiredLink =
  "This link has expired or was already used. Ask for a new invite or use Forgot password.";
/**
 * The forgot-password answer for every outcome, the sandbox's included: the
 * same whether or not the email has an account (D-1). Supabase Auth succeeds
 * for an unknown email without sending anything, so a failed send (rate
 * limit, email not set up) happens only for real accounts and is never shown
 * (WP-D Must-not: never reveal whether an email has an account).
 */
export const resetRequested =
  "If this email belongs to a board account, a reset link is on its way. Check your inbox and spam folder.";
/** The Current or Archived tab of a board list. */
export type { ListView };
/** The `?view=` of a board list (Current or Archived tab); anything else is current. */
export function listView(value: string | string[] | undefined): ListView {
  return value === "archived" ? "archived" : "current";
}
/** The `?file=` names of files left over after a clean-up failed (`FileCleanup`). */
export function leftFiles(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : [value].flat();
}
/**
 * One box of a content form: the item field it edits, its label and hint.
 * `image` is the picture upload; `file` is the newsletter's "PDF or link"
 * choice, which also edits `url`.
 */
export type ContentField = {
  name: ContentTextField | "image" | "file" | "priority" | "status";
  label: string;
  hint?: string;
  /** An example in the empty box, never saved (D-26). */
  placeholder?: string;
  /** Shown under the closed "More options". */
  more?: true;
  /**
   * A box that edits several item fields (`priority`, `status`): the label of
   * each, so a refused save names the part the board sees (Q57).
   */
  parts?: Partial<Record<ContentTextField, string>>;
};
/** Boxes side by side, with one hint under the row. */
export type ContentRow = { row: readonly ContentField[]; hint?: string };

const describePicture: ContentField = {
  name: "image_alt",
  label: "Describe the picture",
  hint: "One sentence, for people using screen readers.",
  placeholder: "Students sharing iftar in the Musallah",
};
const link: ContentField = {
  name: "url",
  label: "Link (optional)",
  placeholder: "https://",
};

/** Announcement priority (PR5a D-1): Normal, Featured or Urgent, with its dates. */
export const priorityBox = {
  name: "priority",
  label: "How important is it?",
  parts: {
    date: "Show from",
    expires_on: "Hide after (optional)",
    urgent_until: "Hide at (exact time)",
  },
} as const satisfies ContentField;
/** The three priorities, as the announcement form offers them (mockup `announcement-editor`). */
export const priorityChoices = [
  ["normal", "Normal", "In Community updates only."],
  ["featured", "Featured", "Also in the homepage notice strip."],
  ["urgent", "Urgent", "On every page, under the menu."],
] as const;
/** Under Featured when it has no "Hide after" date: a warning, not a refusal (D-17). */
export const featuredWithoutEnd =
  "Featured notices with no Hide after date stay on Home until you change them.";
/** Under "Hide at" (mockup `announcement-editor`). */
export const urgentEndHint = "Required for Urgent. Grenada time.";

/** Event status (PR5a D-2; review 2, 2026-10-05): Scheduled, Postponed or Cancelled. */
export const statusBox = {
  name: "status",
  label: "Is it still happening?",
  parts: { status_note: "Reason (required for Cancelled)" },
} as const satisfies ContentField;
/**
 * The three statuses, as the event form offers them (mockup `event-status`;
 * review 2: a known new date is just a new date, so Postponed means "new
 * date not known yet").
 */
export const statusChoices = [
  ["scheduled", eventStatusNames.scheduled, "Happening as planned."],
  ["postponed", eventStatusNames.postponed, "New date not known yet."],
  [
    "cancelled",
    eventStatusNames.cancelled,
    "Not happening. The page stays up.",
  ],
] as const;
/** The cancelled reason's example (contract, Design → Event status). */
export const cancelReasonExample = "Speaker’s flight was cancelled";
const picture: ContentField = { name: "image", label: "Picture (optional)" };
/**
 * An event's ticket (PR6 WP-9, D-65): a priced item from Payments → Tickets,
 * sold on the event page with "See price and buy ↗" (P-72 B).
 */
export const ticketBox = {
  name: "ticket_payment_item_id",
  label: "Ticket (optional)",
  hint: "Make the ticket first in Payments → Tickets. Each ticket belongs to one event.",
} as const satisfies ContentField;
/** The ticket box's words (PR6 WP-9). */
export const ticketWords = {
  none: "No ticket",
  archived: (name: string) => `${name} (archived)`,
  notListed: "Ticket: choose one of the tickets listed.",
  taken:
    "Ticket: another event already sells this ticket. Each event needs its own ticket.",
  unavailable:
    "The tickets could not be loaded. Check your connection and reload.",
} as const;

/**
 * "Create from this event" (review fixes P3; was Duplicate): a new item's
 * form with this one's saved details and no date.
 */
export const createFromWords = {
  label: (kind: Collection) =>
    `Create from this ${kind === "events" ? "event" : "announcement"}`,
  explain: (kind: Collection) =>
    `Opens a new ${kind === "events" ? "event" : "announcement"} with these saved details and no date. Choose the date, check the rest, then save.`,
  /** Above the new item's form. */
  started: (title: string) => `Started from “${title}”. Choose the date.`,
} as const;

/** An event's season (PR5c): its season's page lists it. */
export const seasonBox = {
  name: "season_id",
  label: "Season (optional)",
  hint: "The season’s page lists this event, for example the Ramadan page.",
} as const satisfies ContentField;
/** The season box's words (PR5c). */
export const seasonWords = {
  none: "No season",
  archived: (name: string) => `${name} (archived)`,
  notListed: "Season: choose one of the seasons listed.",
  unavailable:
    "The seasons could not be loaded. Check your connection and reload.",
} as const;

/**
 * An event's category and term (review fixes P3): one of the board's Lists
 * (Dashboard → Lists), for the Events page's filters.
 */
export const categoryBox = {
  name: "category_id",
  label: "Category (optional)",
} as const satisfies ContentField;
export const termBox = {
  name: "term_id",
  label: "Term (optional)",
} as const satisfies ContentField;
/** The category and term boxes' words (review fixes P3). */
export const categoryWords = {
  none: listWords.noCategory,
  archived: (name: string) => name,
  notListed: "Category: choose one from the list.",
  unavailable: listWords.unavailable,
} as const;
export const termWords = {
  none: listWords.noTerm,
  archived: (name: string) => name,
  notListed: "Term: choose one from the list.",
  unavailable: listWords.unavailable,
} as const;
/** Under the category and term row. */
export const listsHint = "Change these choices on Dashboard → Lists.";

/**
 * Which boxes each content kind shows, top to bottom, with their labels and
 * hints (PR4 D-7). UX only: every kind keeps the same item fields
 * (`recordSchema`); a field a kind does not show keeps its stored value
 * (`hiddenContentFields`).
 */
export const contentFields: Record<
  Collection,
  readonly (ContentField | ContentRow)[]
> = {
  events: [
    {
      name: "title",
      label: "Event name",
      placeholder: "Iftar at the Musallah",
    },
    // Starts and Ends (review 2, 2026-10-05): no start time is all day; no
    // end date is the start date.
    {
      row: [
        { name: "date", label: "Start date" },
        { name: "start_time", label: "Start time (optional)" },
      ],
      hint: "Grenada time. Leave the time empty for an all-day event.",
    },
    {
      row: [
        { name: "end_date", label: "End date (optional)" },
        { name: "end_time", label: "End time (optional)" },
      ],
      hint: "Leave the end date empty when it ends on the start day.",
    },
    {
      name: "location",
      label: "Place",
      placeholder: "Musallah, Charter Hall",
    },
    { row: [categoryBox, termBox], hint: listsHint },
    {
      name: "body",
      label: "What is it about?",
      placeholder: "Open to everyone. Bring a friend.",
    },
    picture,
    describePicture,
    { ...link, label: "Sign-up link (optional)" },
    ticketBox,
    seasonBox,
    statusBox,
  ],
  announcements: [
    {
      name: "title",
      label: "Headline",
      placeholder: "Musallah closed until 3:00 PM today",
    },
    {
      name: "summary",
      label: "One-line summary",
      hint: "Shown on the homepage strip and in lists.",
      placeholder: "Dhuhr in Charter Hall, room 2.",
    },
    {
      name: "body",
      label: "Full message",
      placeholder:
        "Facilities are cleaning the carpets. Dhuhr jama’ah is in Charter Hall, room 2.",
    },
    priorityBox,
    picture,
    describePicture,
    link,
  ],
  news_posts: [
    {
      name: "title",
      label: "Headline",
      placeholder: "Welcome back, new students",
    },
    {
      name: "summary",
      label: "One-line summary",
      placeholder: "Our first social of the term, in photos.",
    },
    {
      name: "body",
      label: "Full story",
      placeholder: "Thank you to everyone who came to the welcome social.",
    },
    {
      name: "date",
      label: "Date",
      hint: "A future date publishes it on that day.",
    },
    picture,
    describePicture,
    link,
    { name: "featured", label: "Pin to the top of Community updates" },
    { name: "expires_on", label: "Hide after (optional)", more: true },
  ],
  newsletters: [
    {
      name: "title",
      label: "Issue name",
      placeholder: "Newsletter, October 2026",
    },
    { name: "date", label: "Issue date" },
    {
      name: "summary",
      label: "Short description (optional)",
      placeholder: "Events, reminders and news from this term.",
    },
    { name: "file", label: "The newsletter" },
  ],
};

/** A kind's boxes, top to bottom, rows flattened. */
export function contentFieldList(kind: Collection): ContentField[] {
  return contentFields[kind].flatMap((entry) =>
    "row" in entry ? entry.row : [entry],
  );
}

/**
 * Item fields that are not typed into a content form: the id, the stored
 * picture and PDF (posted on their own) and "Who can see it?".
 */
const notTypedFields = ["id", "image_path", "file_path", "published"] as const;
type ContentTextField = Exclude<
  keyof z.infer<typeof recordSchema>,
  (typeof notTypedFields)[number]
>;
/**
 * The item fields a content form posts as text, shown or hidden: every
 * `recordSchema` field but `notTypedFields`, so a new column is never left
 * out of a form (and wiped by its default on save).
 */
const contentTextFields = recordSchema
  .keyof()
  .options.filter(
    (name): name is ContentTextField =>
      !(notTypedFields as readonly string[]).includes(name),
  );

/**
 * The item fields a box edits: the newsletter choice edits the PDF and the
 * link; the priority box the featured flag, its dates and the urgent end; the
 * status box the status and its reason.
 */
const editedBy = (name: ContentField["name"]): string[] =>
  name === "image"
    ? ["image_path"]
    : name === "file"
      ? ["file_path", "url"]
      : name === "priority"
        ? ["featured", "date", "expires_on", "urgent_until"]
        : name === "status"
          ? ["status", "status_note"]
          : [name];

/**
 * The text fields a kind does not show: the form posts their stored value in
 * hidden inputs, so saving keeps them (D-7).
 */
export function hiddenContentFields(kind: Collection) {
  const shown = new Set(
    contentFieldList(kind).flatMap((f) => editedBy(f.name)),
  );
  return contentTextFields.filter((name) => !shown.has(name));
}

/**
 * The names a kind's refused save gives each item field: the label of the box
 * that edits it, without "(optional)", so "Event name: …" matches the form
 * (Q57, 2026-10-05). Fields the kind does not show keep `recordFieldNames`.
 */
export function contentFieldNames(kind: Collection) {
  const names = { ...recordFieldNames };
  // "Hide after (optional)" and "Hide at (exact time)" name "Hide after" and "Hide at".
  const bare = (label: string) => label.replace(/ \([^)]*\)$/, "");
  for (const field of contentFieldList(kind)) {
    if (field.parts) {
      for (const [name, label] of Object.entries(field.parts))
        if (name in names) names[name as keyof typeof names] = bare(label);
      continue;
    }
    for (const name of editedBy(field.name))
      if (name in names) names[name as keyof typeof names] = bare(field.label);
  }
  return names;
}

/**
 * An item as its form starts: an event shows one description, so its short
 * summary moves into the description when that is empty and saves as empty
 * (D-7); visitors see the same text (`body || summary`). A kind whose form
 * has no "Hide after" box (events, newsletters) saves an old one as empty, so
 * a date nobody can see no longer hides the item or refuses its save (D-15).
 */
export function contentFormRecord(
  kind: Collection,
  record: CommunityRecord,
): CommunityRecord {
  const form =
    kind === "events"
      ? { ...record, body: record.body || record.summary, summary: "" }
      : record;
  return contentFieldList(kind).some((field) =>
    editedBy(field.name).includes("expires_on"),
  )
    ? form
    : { ...form, expires_on: "" };
}

/**
 * Prayer & iqamah's own words (review fixes P2): the line beside each
 * prayer that shows, as the board types, the adhan and the iqamah it gives
 * today, and the Jumu'ah prayers lists. New wording (release checklist,
 * "You or the founder must decide").
 */
export const prayerEditorWords = {
  /** "Adhan 12:31 PM", before the arrow. */
  adhan: (time: string) => `Adhan ${time}`,
  /** "Iqamah 12:45 PM today", after the arrow (or alone without an adhan). */
  iqamah: (time: string) => `Iqamah ${time} today`,
  /** After today's iqamah when it comes from a one-date change for today. */
  changed: "(one-date change)",
  /** After the arrow while the box is empty or unfinished. */
  noIqamah: "Iqamah not set",
  /** After the arrow, before the date ("Tue 20 Oct"), when "Times start on" is later than today. */
  starts: "No iqamah today. Starts",
  /** After the arrow, before the date, when "Times end on" has passed. */
  ended: "No iqamah today. Ended",
  /** After the arrow when a time is typed but today has none (no dates yet). */
  notToday: "No iqamah today",
  /** The weekly list with no prayer. */
  noWeekly: "No weekly Jumu’ah. Add a prayer to show one.",
  add: "+ Add a Jumu’ah prayer",
  remove: "Remove",
  /** Under a changed Friday's list of prayers. */
  fridayHint:
    "Change a time, or remove a prayer to cancel it on this Friday only.",
} as const;

/**
 * The Jumu'ah question (PR5a D-3, D-19; mockup `jumuah-notice`), asked under
 * a Friday change that is new or edited in this save.
 */
export const jumuahNoticeWords = {
  question: "Also show an urgent notice on every page?",
  required: "Required — choose one.",
  text: "Notice text (you can change it)",
  end: "Hide at (exact time)",
  endHint: `Grenada time. Prefilled with ${JUMUAH_NOTICE_MINUTES_AFTER} minutes after that Friday’s iqamah; it then disappears by itself.`,
  /** Refused when the question was shown and not answered. */
  unanswered: "Also show an urgent notice?: choose Yes or No.",
  /** After the prayer save, when the notice could not be saved (contract, Design → Jumu'ah question). */
  failed:
    "The Jumu’ah change is saved, but the urgent notice could not be posted. Post it from Announcements.",
} as const;

/**
 * The event question (review 2, 2026-10-05; the Jumu'ah pattern): asked when
 * a published event gets a new date or is cancelled. It posts an urgent
 * notice like the Jumu'ah one.
 */
export const eventNoticeWords = {
  question: "Also post an announcement?",
  required: jumuahNoticeWords.required,
  text: "Announcement text (you can change it)",
  end: jumuahNoticeWords.end,
  endHint:
    "Grenada time. Prefilled with the end of the event’s day; it then disappears by itself.",
  unanswered: "Also post an announcement?: choose Yes or No.",
  failed:
    "The event is saved, but the announcement could not be posted. Post it from Announcements.",
} as const;
/** The event question's boxes in the event form. */
export const eventNoticeBoxes = {
  answer: "announce",
  text: "announce_text",
  on: "announce_on",
  at: "announce_at",
} as const;

/**
 * Under a photo box when the chosen photo is HEIC and this browser cannot open
 * it (PR5a D-29): the save stops, nothing is uploaded, typed text stays.
 */
export const heicCannotOpen =
  "This photo is in HEIC format, which this browser can't open. Share it from the phone as JPEG (or take a screenshot), then choose it again.";

/**
 * The New board term and dashboard notice when fewer than `MIN_MANAGERS`
 * active people can manage people (PR5a D-27; a warning, never a lock).
 */
export function managerShortNotice(active: number) {
  return active === 0
    ? "No active person can manage people. Ask the site owner to give Manage people to two board members."
    : `Only ${active} active ${active === 1 ? "person" : "people"} can manage people. Give a second person Manage people.`;
}

/** "Remove login" on a deactivated person's page (PR5a D-27 e). */
export const removeLoginWords = {
  summary: "Remove login",
  explain:
    "This deletes their login account for good; it cannot be turned back on. Their People entry and their history in Recent changes stay. To give them access again later, send a new invite.",
  confirm: (name: string) => `Type “${name}” to confirm`,
  button: "Remove login",
  wrongName: "Type their name exactly as shown to confirm.",
  forbidden: "Only a board member who can manage people can remove a login.",
  /** The inviter is off (sandbox off, a developer's computer; contract, Failure Modes). */
  off: "Logins can't be removed here.",
  done: "Login removed. Their People entry and their history stay.",
} as const;
