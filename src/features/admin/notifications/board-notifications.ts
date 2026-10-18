import type { AttentionItem } from "@/lib/community/attention";
import { systemText } from "@/lib/system-text";
import { managerShortNotice } from "../fields";

/** The line while the live site sends no warning emails (daily-check contract D-17). */
export const WARNING_EMAILS_OFF =
  "Warning emails are off: set up the MSA Gmail";

/**
 * One line in the dashboard's notifications (review fixes P1, item 5).
 * A "problem" stays until what it names is fixed (it is worked out again on
 * every load, so it goes by itself); an "info" line can be closed with ×.
 */
export type BoardNotification = Readonly<{
  /** Stable while the line says the same thing: a closed "info" line stays closed. */
  key: string;
  level: "problem" | "info";
  title: string;
  /** One more sentence, when the title is not enough. */
  detail?: string;
  /** The dashboard page that fixes it or shows more. */
  link?: Readonly<{ href: string; label: string }>;
}>;

/** What the notifications are worked out from, each read on every load. */
export type NotificationFacts = Readonly<{
  /** The daily check's list (`attentionItems`), the same one it emails. */
  attention: readonly AttentionItem[];
  /** The live site sends no warning emails (`deploymentProfile`). */
  warningEmailsOff: boolean;
  /** Active people who can manage people (`managerContinuity`); null: People could not be read. */
  managers: Readonly<{ active: number; short: boolean }> | null;
  /** Nobody can edit Pages (`nobodyEditsPages`); false when People could not be read. */
  nobodyEditsPages: boolean;
  /**
   * The signed-in board member has Manage people. Only they can fix the
   * manager and Pages-editor lines, so only they see them.
   */
  canManagePeople: boolean;
  /** The newest prayer-settings change of the last 7 days (`recentPrayerChange`). */
  prayerChange: Readonly<{ id: number; actor: string; when: string }> | null;
  /**
   * Current Executive board members with no photo (`executivesWithoutPhoto`),
   * in role order; empty when People could not be read.
   */
  executivesWithoutPhoto?: readonly Readonly<{
    id: string;
    name: string;
    role: string;
  }>[];
}>;

/**
 * The photo nudge (review fixes P4, user 2026-10-07): About shows the
 * Executive board with their photos. A new set of people is a new line.
 */
function photoNudge(
  people: NonNullable<NotificationFacts["executivesWithoutPhoto"]>,
): BoardNotification[] {
  if (!people.length) return [];
  const [first] = people;
  return [
    {
      key: `executive-photos:${people.map((person) => person.id).join(",")}`,
      level: "info",
      title:
        people.length === 1
          ? `Add a photo of ${first.name}, ${first.role}`
          : `Add photos of ${people.length} Executive board members`,
      detail:
        people.length === 1
          ? "The About page shows the Executive board with their photos."
          : `The About page shows the Executive board with their photos. No photo yet: ${people
              .map((person) => person.name)
              .join(", ")}.`,
      link:
        people.length === 1
          ? { href: `/admin/people/${first.id}`, label: "Add a photo" }
          : openPeople,
    },
  ];
}

const openPeople = { href: "/admin/people", label: "Open People" };

/**
 * Every notification, problems first, from facts read on this load: the
 * daily check's list (one policy, `attention.ts`), the warning-emails line,
 * the manager and Pages-editor warnings (for those with Manage people, who
 * can fix them), and a recent prayer change.
 */
export function boardNotifications(
  facts: NotificationFacts,
): BoardNotification[] {
  const problems: BoardNotification[] = [
    ...(facts.warningEmailsOff
      ? [
          {
            key: "warning-emails-off",
            level: "problem" as const,
            title: WARNING_EMAILS_OFF,
          },
        ]
      : []),
    ...facts.attention.map((item): BoardNotification => ({
      key: item.key,
      level: "problem",
      title: item.title,
      link: { href: item.href, label: item.linkLabel },
    })),
    ...(facts.canManagePeople && facts.managers?.short
      ? [
          {
            key: `managers:${facts.managers.active}`,
            level: "problem" as const,
            title: managerShortNotice(facts.managers.active),
            link: openPeople,
          },
        ]
      : []),
    ...(facts.canManagePeople && facts.nobodyEditsPages
      ? [
          {
            key: "nobody-edits-pages",
            level: "problem" as const,
            title: systemText.pageSections.nobodyCanEdit,
            link: openPeople,
          },
        ]
      : []),
  ];
  const info: BoardNotification[] = facts.prayerChange
    ? [
        {
          // A newer change is a new line, shown again even after × on the last one.
          key: `prayer-change:${facts.prayerChange.id}`,
          level: "info",
          title: "Prayer settings changed recently",
          detail: `${facts.prayerChange.actor} changed the prayer settings on ${facts.prayerChange.when} (Grenada time). Check that the times on the Prayer page are right.`,
          link: {
            href: "/admin/activity",
            label: "See what changed in Recent changes",
          },
        },
      ]
    : [];
  return [
    ...problems,
    ...info,
    ...photoNudge(facts.executivesWithoutPhoto ?? []),
  ];
}
