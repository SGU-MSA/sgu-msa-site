import "server-only";
import { currentAdmin } from "@/lib/backend/server";
import {
  listActivity,
  listAdminPeople,
  listAdminSections,
} from "@/lib/backend/admin-content";
import { readAttention } from "@/lib/backend/attention-reads";
import { actorLabel, recentPrayerChange } from "@/lib/community/activity";
import { attentionFacts, attentionItems } from "@/lib/community/attention";
import {
  executivesWithoutPhoto,
  managerContinuity,
  nobodyEditsPages,
} from "@/lib/community/people";
import { localDate } from "@/lib/community/schema";
import { clock, deploymentProfile } from "@/lib/runtime/providers";
import { weekdayDateLabel } from "@/lib/time/date-label";
import { formatTimeOfDay } from "@/lib/time/time-of-day";
import {
  boardNotifications,
  type BoardNotification,
} from "./board-notifications";

/** "Wed 7 Oct at 6:02 AM" in Grenada: dated like the daily check's lines. */
const changedOn = (at: Date) =>
  `${weekdayDateLabel(localDate(at))} at ${formatTimeOfDay(at)}`;

/**
 * The signed-in board member's notifications, read from current state on
 * every load (review fixes P1, item 5), or null when signed out. A part that
 * cannot be read adds nothing; its own screen says why.
 */
export async function readNotifications(): Promise<BoardNotification[] | null> {
  const admin = await currentAdmin();
  if (!admin) return null;
  const now = clock().now();
  const today = localDate(now);
  const [reads, people, groups, activity] = await Promise.all([
    readAttention(),
    listAdminPeople(),
    listAdminSections(),
    listActivity({ limit: 1, area: "prayer_settings" }),
  ]);
  const prayer = recentPrayerChange(activity.entries, now);
  const executiveId =
    groups.sections.find((group) => group.kind === "executive")?.id ?? null;
  return boardNotifications({
    // The same list, from the same reads, the nightly check emails (D-3).
    attention: attentionItems(attentionFacts(reads, today), today),
    warningEmailsOff: deploymentProfile().warningEmailsOff,
    managers: people.unavailable ? null : managerContinuity(people.people),
    nobodyEditsPages:
      !people.unavailable &&
      !groups.unavailable &&
      nobodyEditsPages(people.people, groups.sections),
    canManagePeople: admin.canManagePeople,
    executivesWithoutPhoto:
      people.unavailable || groups.unavailable
        ? []
        : executivesWithoutPhoto(people.people, executiveId).map((person) => ({
            id: person.id,
            name: person.full_name,
            role: person.role_title,
          })),
    prayerChange: prayer
      ? {
          id: prayer.id,
          actor: actorLabel(prayer),
          when: changedOn(new Date(prayer.occurred_at)),
        }
      : null,
  });
}
