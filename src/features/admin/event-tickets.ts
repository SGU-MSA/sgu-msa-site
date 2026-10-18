import "server-only";
import { contentEditor, paymentItemEditor } from "@/lib/runtime/providers";

/** One ticket an event may sell (PR6 WP-9). */
export type TicketChoice = { id: string; name: string; archived: boolean };

/**
 * The tickets an event's form offers (PR6 WP-9, D-65; any board member):
 * every current ticket no other event sells (archived events count, as in
 * the database's `events_one_per_ticket_item`), plus the event's own ticket
 * even if that ticket was archived since, so saving unchanged keeps it.
 * Funds are never offered. `unavailable`: the lists could not be read.
 */
export async function ticketChoices(
  eventId: string,
): Promise<{ choices: TicketChoice[]; unavailable: boolean }> {
  const [current, archived, events, archivedEvents] = await Promise.all([
    paymentItemEditor().listItems(),
    paymentItemEditor().listItems("archived"),
    contentEditor().listRecords("events"),
    contentEditor().listRecords("events", "archived"),
  ]);
  if (
    current.unavailable ||
    archived.unavailable ||
    events.unavailable ||
    archivedEvents.unavailable
  )
    return { choices: [], unavailable: true };
  const all = [...events.records, ...archivedEvents.records];
  const own = all.find((event) => event.id === eventId)?.ticket_payment_item_id;
  const taken = new Set(
    all
      .filter((event) => event.id !== eventId)
      .map((event) => event.ticket_payment_item_id)
      .filter(Boolean),
  );
  const choices = [
    ...current.items
      // A merch size is sold on the Merch page, never by an event (PR5c).
      .filter(
        (item) =>
          item.kind === "priced" && !item.merch_item_id && !taken.has(item.id),
      )
      .map((item) => ({ id: item.id, name: item.name, archived: false })),
    ...archived.items
      .filter((item) => item.kind === "priced" && item.id === own)
      .map((item) => ({ id: item.id, name: item.name, archived: true })),
  ];
  return { choices, unavailable: false };
}

/**
 * Which event sells each ticket ("Used by (event)" on the Tickets screen,
 * PR6 WP-6/WP-9): the title of the current or archived event per ticket id.
 */
export async function ticketUsers(): Promise<Map<string, string>> {
  const [events, archivedEvents] = await Promise.all([
    contentEditor().listRecords("events"),
    contentEditor().listRecords("events", "archived"),
  ]);
  return new Map(
    [...events.records, ...archivedEvents.records]
      .filter((event) => event.ticket_payment_item_id)
      .map((event) => [event.ticket_payment_item_id, event.title]),
  );
}
