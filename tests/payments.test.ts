import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseRuntimeConfig } from "../src/lib/runtime/config";
import { planWiring } from "../src/lib/runtime/wiring";
import { createSampleContentEditor } from "../src/lib/backend/providers/sample";
import { eventEntry } from "../src/lib/community/event-entry";
import {
  GIVE_BUTTON,
  TICKET_BUTTON,
  ticketOnSale,
} from "../src/lib/community/payment-policy";
import {
  startFrom,
  recordFromRow,
  recordSchema,
  recordToRow,
} from "../src/lib/community/schema";
import { DEMO_TICKET_ID } from "../src/lib/demo/fixtures";

/**
 * PR6 WP-9: the old single `DONATION_URL` link is retired (every Give and
 * Buy goes through `/donate/<slug>/give`), and an event sells a ticket.
 */

const live = {
  NODE_ENV: "development",
  SITE_DEMO_MODE: "false",
  SUPABASE_URL: "https://staging1234.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging",
  SUPABASE_SECRET_KEY: "off",
  GO2PAY_API_KEY: "off",
  CRON_SECRET: "off",
  MSA_GMAIL_ADDRESS: "off",
  GMAIL_APP_PASSWORD: "off",
  SITE_URL: "http://localhost:3000",
};

test("DONATION_URL is retired: not required, and a leftover value is not read", () => {
  const without = parseRuntimeConfig(live);
  const leftover = parseRuntimeConfig({
    ...live,
    DONATION_URL: "https://pay.example.org/donate",
  });
  assert.deepEqual(leftover, without);
  assert.ok(!("donation" in without));
  assert.ok(!("donationLink" in planWiring(without)));
});

test("the buttons read Give on Go2Pay and See price and buy (P-72 B: no price on our pages; review fixes P4)", () => {
  assert.equal(GIVE_BUTTON, "Give on Go2Pay");
  assert.equal(TICKET_BUTTON, "See price and buy");
});

const event = (changes: Record<string, unknown> = {}) =>
  recordSchema.parse({
    id: randomUUID(),
    title: "Welcome dinner",
    date: "2026-10-10",
    start_time: "18:00",
    end_time: "20:00",
    location: "Charter Hall",
    published: true,
    ticket_payment_item_id: DEMO_TICKET_ID,
    ...changes,
  });

test("ticketOnSale (D-23, D-81): until the event ends, never once cancelled, paused while postponed", () => {
  const before = new Date("2026-10-10T21:00:00Z"); // 5 PM Grenada
  const after = new Date("2026-10-11T00:30:00Z"); // 8:30 PM Grenada
  assert.equal(ticketOnSale(event(), before), true);
  assert.equal(ticketOnSale(event(), after), false);
  assert.equal(
    ticketOnSale(event({ status: "cancelled", status_note: "Storm" }), before),
    false,
  );
  assert.equal(
    ticketOnSale(event({ status: "postponed" }), before),
    false,
    "postponed, new date not known yet: the ticket pauses",
  );
  assert.equal(
    ticketOnSale(event({ status: "scheduled", date: "2026-10-10" }), before),
    true,
    "the new date set and Scheduled again: it sells again (review 2)",
  );
});

test("an event's ticket is an events-only column, empty as null", () => {
  const row = recordToRow("events", event());
  assert.equal(row.ticket_payment_item_id, DEMO_TICKET_ID);
  assert.equal(
    recordToRow("events", event({ ticket_payment_item_id: "" }))
      .ticket_payment_item_id,
    null,
  );
  assert.ok(
    !("ticket_payment_item_id" in recordToRow("announcements", event())),
  );
  assert.equal(
    recordFromRow({ ...row, ticket_payment_item_id: null })
      .ticket_payment_item_id,
    "",
  );
  assert.equal(eventEntry(event()).ticket_payment_item_id, DEMO_TICKET_ID);
  assert.equal(
    eventEntry(event({ ticket_payment_item_id: "" })).ticket_payment_item_id,
    null,
  );
});

test("a ticket that is not an id is refused, naming the Ticket box", () => {
  const parsed = recordSchema.safeParse({
    ...event(),
    ticket_payment_item_id: "not-an-id",
  });
  assert.equal(parsed.success, false);
  assert.match(
    parsed.error?.issues[0]?.message ?? "",
    /^Ticket: choose one of the tickets listed\.$/,
  );
});

test("an event made from another has no ticket (one event per ticket)", () => {
  assert.equal(startFrom(event(), randomUUID()).ticket_payment_item_id, "");
});

test("sandbox: a second event selling the same ticket is ticket_taken", async () => {
  const editor = createSampleContentEditor(new Date("2026-10-05T12:00:00Z"));
  const ticket = randomUUID();
  const first = event({ ticket_payment_item_id: ticket });
  assert.deepEqual(await editor.saveRecord("events", first, null), {
    ok: true,
  });
  assert.deepEqual(
    await editor.saveRecord(
      "events",
      event({ ticket_payment_item_id: ticket }),
      null,
    ),
    { ok: false, reason: "ticket_taken" },
  );
  // The event that sells it may save again with its ticket.
  const { record } = await editor.readRecord("events", first.id);
  assert.deepEqual(
    await editor.saveRecord(
      "events",
      { ...first, title: "Welcome dinner (moved)" },
      record!.updated_at!,
    ),
    { ok: true },
  );
});
