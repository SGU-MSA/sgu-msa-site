import type { Step } from "react-joyride";

/** The board pages with a "Show me how" tour (PR4 D-10). */
export type TourId =
  "dashboard" | "prayer" | "content" | "people" | "handover" | "activity";

/** The one tour that starts by itself, on a first visit (PR4 D-8). */
export const firstVisitTour: TourId = "dashboard";

/**
 * A tour step: the element marked `data-tour="<id>"` (with several ids, the
 * first of them on the page), a title and one short text.
 */
const step = (
  ids: string | string[],
  title: string,
  content: string,
): Step => ({
  target: [ids]
    .flat()
    .map((id) => `[data-tour="${id}"]`)
    .join(", "),
  title,
  content,
});

/**
 * Every tour's steps, in order (PR4 D-10; ADR 0008: they change with the
 * screens in the same PR). Each text stays at 25 words or fewer
 * (tests/tour.test.ts). A step whose element is not on the page (for
 * example Archive on a new item) is left out when the tour starts.
 */
export const tourSteps: Record<TourId, Step[]> = {
  dashboard: [
    step(
      "dashboard-content",
      "Your content",
      "Events, announcements, community news and newsletters each have a card. Open one to add, edit or publish items.",
    ),
    step(
      "dashboard-prayer",
      "Prayer & iqamah",
      "Set iqamah times, the weekly Jumu’ah and changes for one date. Prayer start times are calculated automatically.",
    ),
    step(
      "dashboard-people",
      "People",
      "Add team members, choose who appears on the public team list, and give someone a dashboard login.",
    ),
    step(
      "dashboard-activity",
      "Recent changes",
      "See who changed what and when, to check an edit or find something to put back.",
    ),
    step(
      "dashboard-handover",
      "New board term",
      "The hand-over checklist for each new board, and who holds each shared login.",
    ),
    step(
      "dashboard-help",
      "Help",
      "Where to find the board handbook, and every “Show me how” tour. “Show me how” at the top of a page replays its tour.",
    ),
  ],
  prayer: [
    step(
      "prayer-note",
      "Start times are automatic",
      "Prayer start (adhan) times are calculated for the Musallah. You only set when the congregation prays.",
    ),
    step(
      "prayer-daily",
      "Daily iqamah",
      "For each prayer choose Fixed time, such as 12:30, or After adhan, such as 20 minutes after the start.",
    ),
    step(
      "prayer-jumuah",
      "Jumu’ah",
      "Each Friday’s Jumu’ah prayers, with a khutbah and iqamah time each. Add a prayer for a second Jumu’ah; drag ⠿ to change the order.",
    ),
    step(
      "prayer-dates",
      "Changes for one date",
      "Add a date to change that day’s iqamah or one Friday’s Jumu’ah. The next day goes back to normal by itself.",
    ),
    step(
      "prayer-jumuah-notice",
      "Urgent notice for Jumu’ah",
      "When one Friday’s Jumu’ah changes, choose whether to also show an urgent notice on every page until after Jumu’ah.",
    ),
    step(
      "prayer-save",
      "Save and History",
      "Save prayer settings keeps the three numbered sections. History, below it, lists earlier versions you can restore.",
    ),
    step(
      "prayer-location",
      "Musallah location",
      "Drag the dot to the musallah entrance. The website map, the directions and the prayer start times all use this one pin.",
    ),
    step(
      "prayer-location-save",
      "Save location",
      "Saves only the pin, separately from the prayer settings. A dot dropped outside Grenada jumps back.",
    ),
  ],
  content: [
    step(
      "content-preview",
      "Preview",
      "Preview opens the whole page as visitors will see it, with what you typed, before saving. Choose Desktop, Tablet or Phone. Close keeps everything typed.",
    ),
    step(
      "content-title",
      "Name",
      "The name visitors see first. Keep it short and clear.",
    ),
    step(
      "content-date",
      "Date and time",
      "When it happens or when it shows on the website. All times are Grenada time.",
    ),
    step(
      "content-priority",
      "How important is it?",
      "Normal shows in Community updates. Featured adds the homepage strip. Urgent shows under the menu on every page until its Hide at time.",
    ),
    step(
      "content-status",
      "Is it still happening?",
      "Postponed (new date not known yet) or Cancelled keeps the event’s page and tells visitors. A cancelled event needs a short reason.",
    ),
    step(
      "content-announce",
      "Also post an announcement?",
      "Asked when a published event gets a new date or is cancelled. Yes shows an urgent notice on every page until Hide at.",
    ),
    step(
      "content-visibility",
      "Who can see it?",
      "“Only the board” keeps a private draft. “Everyone on the website” publishes it.",
    ),
    step(
      "content-save",
      "Save",
      "Nothing is saved until you press Save. A box that needs fixing turns red and says why under it.",
    ),
    // Archive alone where no item can be made from this one.
    step(
      ["content-duplicate", "content-archive"],
      "Create from this, or archive",
      "“Create from this” opens a new one with these details and no date. Archive takes it off the website; you can restore it later.",
    ),
  ],
  people: [
    step(
      "people-add",
      "Add a person",
      "Add a team member with their group and role.",
    ),
    step(
      "people-public",
      "On the About page?",
      "Shows whether someone is on the About page. The Executive board always is; for others, tick “Show on public page” when editing them.",
    ),
    step(
      "people-login",
      "Dashboard login",
      "Shows whether someone can sign in to this dashboard. Invite them, or turn their login off, when editing them.",
    ),
    step(
      "people-order",
      "Change the order",
      "Drag ⠿ next to a name, then click Save order. “View all” on About follows this order. The Executive board is listed by role.",
    ),
    step(
      "people-groups",
      "Edit groups",
      "Add, rename, reorder or archive the team's groups. The Executive board and the General board are always kept.",
    ),
  ],
  handover: [
    step(
      "handover-steps",
      "Tick each step",
      "Tick a step when it is done. The day is kept, and Recent changes shows who ticked it.",
    ),
    step(
      "handover-new-term",
      "Start a new term",
      "When a new board takes over, start a new term: every tick is cleared and the steps stay.",
    ),
    step(
      "handover-edit",
      "Edit the steps",
      "Add, reword, reorder or archive steps so the list fits how your board hands over.",
    ),
    step(
      "handover-logins",
      "Shared logins",
      "Who holds each shared account and its 2-step phone. Names only: never write passwords or codes.",
    ),
  ],
  activity: [
    step(
      "activity-filters",
      "Find a change",
      "Choose who, what and which days, then press Show. Older changes keeps your filters.",
    ),
    step(
      "activity-feed",
      "Each change",
      "What changed, who changed it and when, in Grenada time. Nobody can edit or remove these entries.",
    ),
  ],
};

/**
 * Where each tour plays, as the Help page lists them (final plan B: the
 * board's how-to is the handbook; the tours are the live guidance). `?tour=1`
 * starts the tour on arrival.
 */
export const tourPages: Record<TourId, { href: string; label: string }> = {
  dashboard: { href: "/admin/dashboard?tour=1", label: "The dashboard" },
  content: {
    href: "/admin/content/events/new?tour=1",
    label: "Add an event or an announcement",
  },
  prayer: { href: "/admin/prayer-times?tour=1", label: "Prayer & iqamah" },
  people: { href: "/admin/people?tour=1", label: "People and logins" },
  handover: { href: "/admin/handover?tour=1", label: "New board term" },
  activity: { href: "/admin/activity?tour=1", label: "Recent changes" },
};
