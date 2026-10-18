import type { VersionedStep } from "@/lib/backend/providers/contract";
import { dashboardLink } from "@/lib/community/handover";
import { collectionLabels } from "../fields";
import type { ChecklistStep } from "./StepChecklist";

/**
 * The dashboard pages a hand-over step can link to, as the board chooses
 * them (never typed, Q39). Each matches `dashboardLink`, the database's
 * check (so no page with "_" in its address, such as Community news).
 */
export const stepPages = [
  ["/admin/people", "People"],
  ["/admin/prayer-times", "Prayer & iqamah"],
  ["/admin/content/events", collectionLabels.events],
  ["/admin/content/announcements", collectionLabels.announcements],
  ["/admin/content/newsletters", collectionLabels.newsletters],
  ["/admin/activity", "Recent changes"],
  ["/admin/help", "Help"],
  ["/admin/dashboard", "Dashboard"],
] as const satisfies readonly (readonly [string, string])[];

/** A step's link as the checklist shows it: "Open People →"; null for none. */
export function stepLinkLabel(link: string): string | null {
  if (!link || !dashboardLink.test(link)) return null;
  const page = stepPages.find(([href]) => href === link)?.[1];
  return page ? `Open ${page} →` : "Open the page →";
}

/** A step as the checklist and "Edit the steps" show it. */
export function checklistStep(step: VersionedStep): ChecklistStep {
  return {
    id: step.id,
    title: step.title,
    details: step.details,
    link: step.link,
    position: step.position,
    done_on: step.done_on,
    version: step.updated_at,
  };
}
