import "server-only";
import { groupLists } from "@/lib/community/lists";
import { contentEditor } from "@/lib/runtime/providers";
import type { TicketChoice } from "./event-tickets";

/** One option an event's Category or Term box offers (review fixes P3, Lists). */
export type ListChoice = TicketChoice;

/** The event form's Category and Term choices, or unavailable. */
export type EventListChoices = {
  categories: ListChoice[];
  terms: ListChoice[];
  unavailable: boolean;
};

/**
 * The Category and Term an event's form offers (review fixes P3; any board
 * member): the board's event categories and terms, in their order on Lists.
 * `unavailable`: the lists could not be read (the form keeps the stored
 * choice).
 */
export async function eventListChoices(): Promise<EventListChoices> {
  const { options, unavailable } = await contentEditor().listOptions();
  if (unavailable) return { categories: [], terms: [], unavailable: true };
  const lists = groupLists(options);
  const choice = ({ id, name }: { id: string; name: string }) => ({
    id,
    name,
    archived: false,
  });
  return {
    categories: lists.event_categories.map(choice),
    terms: lists.terms.map(choice),
    unavailable: false,
  };
}
