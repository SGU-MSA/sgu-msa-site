import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionFacts,
  attentionItems,
  emailsDue,
  factsUnavailable,
  OPEN_LAST_CALL_AFTER_DAYS,
  SEASON_CONFIRM_FIRST_DAYS,
  warningEmail,
  type AttentionItem,
  type AttentionReads,
  type EmailStep,
  type SentSteps,
} from "../src/lib/community/attention";
import {
  paymentItemSchema,
  type PaymentItem,
} from "../src/lib/community/payments";
import { seasonSchema, type Season } from "../src/lib/community/seasons";
import { scheduleEndReminderDays } from "../src/lib/prayer/congregation";

// Daily check WP-3 (docs/contracts/daily-check-notifications.md, D-13): one
// policy for the dashboard box and the nightly email.
const END = "2026-10-15"; // a Thursday
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
const noGiving = { seasons: [], items: [], links: [] };
/** The reads with iqamah times ending on `end` (null: unreadable). */
const reads = (
  end: string | null,
  more: Partial<AttentionReads> = {},
): AttentionReads => ({
  prayer: end === null ? null : { valid_until: end, hijri_adjustment: 0 },
  giving: noGiving,
  storageBytes: 0,
  ...more,
});
const itemsOn = (today: string, end: string | null = END) =>
  attentionItems(attentionFacts(reads(end), today), today);
const nothingSent: SentSteps = new Map();
const sentAs = (key: string, steps: Partial<Record<EmailStep, string>>) =>
  new Map([[key, steps]]) as SentSteps;
const stepsOn = (today: string, sent: SentSteps = nothingSent) =>
  emailsDue(itemsOn(today), sent, today).map((due) => due.step);

test("iqamah: no item 8 days before the end, one from 7 days before", () => {
  assert.equal(scheduleEndReminderDays, 7);
  assert.deepEqual(itemsOn(addDays(END, -8)), []);
  const [item] = itemsOn(addDays(END, -7));
  assert.deepEqual(item, {
    key: "iqamah:2026-10-15",
    topic: "Prayer",
    timing: { type: "deadline", deadline: END, firstFrom: "2026-10-08" },
    title: "Iqamah times end on Thu 15 Oct (in 7 days)",
    detail: "After that day the website stops showing iqamah times.",
    href: "/admin/prayer-times",
    linkLabel: "Open Prayer & iqamah",
  });
  assert.equal(
    itemsOn(addDays(END, -1))[0].title,
    "Iqamah times end on Thu 15 Oct (tomorrow)",
  );
  assert.equal(itemsOn(END)[0].title, "Iqamah times end on Thu 15 Oct (today)");
  // No end date, or settings that could not be read: nothing.
  assert.deepEqual(itemsOn(END, ""), []);
  assert.deepEqual(itemsOn(END, null), []);
});

test("iqamah: after the end the dashboard keeps the item, and no email is due (D-3)", () => {
  const today = addDays(END, 1);
  const [item] = itemsOn(today);
  assert.equal(item.title, "Iqamah times ended on Thu 15 Oct — update them");
  assert.equal(item.key, "iqamah:2026-10-15");
  assert.deepEqual(stepsOn(today), []);
  assert.deepEqual(stepsOn(addDays(END, 30)), []);
});

test("iqamah: email 1 at 7 days, last call 1 day before, the end day only if missed", () => {
  assert.deepEqual(stepsOn(addDays(END, -7)), ["first"]);
  const first = sentAs("iqamah:2026-10-15", { first: addDays(END, -7) });
  for (let day = -6; day <= -2; day++)
    assert.deepEqual(stepsOn(addDays(END, day), first), [], `day ${day}`);
  assert.deepEqual(stepsOn(addDays(END, -1), first), ["last_call"]);
  const both = sentAs("iqamah:2026-10-15", {
    first: addDays(END, -7),
    last_call: addDays(END, -1),
  });
  assert.deepEqual(stepsOn(addDays(END, -1), both), []);
  assert.deepEqual(stepsOn(END, both), []);
  // Vercel skipped the night before: the end day still gets the last call.
  assert.deepEqual(stepsOn(END, first), ["last_call"]);
});

test("a missed email 1 is skipped once the last call is due (catch-up)", () => {
  assert.deepEqual(stepsOn(addDays(END, -1)), ["last_call"]);
  assert.deepEqual(stepsOn(END), ["last_call"]);
  // A missed night in the middle: email 1 goes the next night instead.
  assert.deepEqual(stepsOn(addDays(END, -5)), ["first"]);
  // Before an item's lead time, nothing (stage 2 lists some items earlier).
  const [item] = itemsOn(addDays(END, -7));
  assert.deepEqual(emailsDue([item], nothingSent, addDays(END, -8)), []);
});

test("a new end date is a new problem with its own two emails", () => {
  const old = sentAs("iqamah:2026-10-15", {
    first: "2026-10-08",
    last_call: "2026-10-14",
  });
  const today = "2026-10-15";
  const moved = attentionItems(
    attentionFacts(reads("2026-10-20"), today),
    today,
  );
  assert.equal(moved[0].key, "iqamah:2026-10-20");
  assert.deepEqual(
    emailsDue(moved, old, today).map((due) => due.step),
    ["first"],
  );
});

test("a problem with no deadline: email 1, then a last call 3 nights later, then nothing", () => {
  const open: AttentionItem = {
    key: "close-in-go2pay:example",
    topic: "Go2Pay",
    timing: { type: "open" },
    title: "Example",
    detail: "Example.",
    href: "/admin",
    linkLabel: "Open",
  };
  const night1 = "2026-11-01";
  const due = (today: string, steps: Partial<Record<EmailStep, string>>) =>
    emailsDue([open], sentAs(open.key, steps), today).map((d) => d.step);
  assert.deepEqual(due(night1, {}), ["first"]);
  assert.equal(OPEN_LAST_CALL_AFTER_DAYS, 3);
  assert.deepEqual(due(addDays(night1, 1), { first: night1 }), []);
  assert.deepEqual(due(addDays(night1, 2), { first: night1 }), []);
  assert.deepEqual(due(addDays(night1, 3), { first: night1 }), ["last_call"]);
  assert.deepEqual(
    due(addDays(night1, 4), { first: night1, last_call: addDays(night1, 3) }),
    [],
  );
  assert.deepEqual(
    due(addDays(night1, 40), { first: night1, last_call: addDays(night1, 3) }),
    [],
  );
});

test("the email: approved wording, singular and plural subject, no personal data", () => {
  const today = addDays(END, -7);
  const due = emailsDue(itemsOn(today), nothingSent, today);
  const one = warningEmail(due, "https://sgu-msa-site.vercel.app");
  assert.equal(one.subject, "SGU MSA website: 1 thing needs attention");
  assert.equal(
    one.text,
    [
      "1. [Prayer] Iqamah times end on Thu 15 Oct (in 7 days). After that day the website stops showing iqamah times.",
      "   Fix it: https://sgu-msa-site.vercel.app/admin/prayer-times",
      "",
      "Sent to the MSA Gmail by the website's nightly check.",
      "It only writes when something needs fixing.",
      "",
    ].join("\n"),
  );
  const two = warningEmail(
    [...due, { ...due[0], item: { ...due[0].item, topic: "Seasons" } }],
    "https://example.org",
  );
  assert.equal(two.subject, "SGU MSA website: 2 things need attention");
  assert.match(two.text, /^1\. \[Prayer\][\s\S]*\n\n2\. \[Seasons\]/);
  assert.doesNotMatch(two.text, /@|\$|amount/i);
});

// Stage 2 (WP-8): season days, funds to close in Go2Pay, funds waiting for
// "Running again", and the photo space. Ramadan 1448 is expected from Mon 8
// Feb to Mon 8 Mar 2027 and Eid al-Fitr on Tue 9 Mar 2027 (adjustment 0).
const season = (fields: Partial<Season>): Season =>
  seasonSchema.parse({
    id: "00000000-0000-4000-8000-00000000a001",
    name: "Ramadan",
    hijri_month: 9,
    hijri_first_day: 1,
    hijri_last_day: null,
    ...fields,
  });
const ramadan = season({});
const eid = season({
  id: "00000000-0000-4000-8000-00000000a002",
  name: "Eid al-Fitr",
  hijri_month: 10,
  hijri_first_day: 1,
  hijri_last_day: 1,
});
let n = 0;
const fund = (fields: Partial<PaymentItem> = {}): PaymentItem =>
  paymentItemSchema.parse({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    slug: `fund-${n}`,
    name: `Fund ${n}`,
    kind: "fund",
    category: "sadaqah",
    about: "",
    listed: true,
    position: 1,
    ...fields,
  });
const givingOn = (
  today: string,
  giving: NonNullable<AttentionReads["giving"]>,
) => attentionItems(attentionFacts(reads("", { giving }), today), today);

test("a season day still expected: listed from 3 days before, email 1 then the last call; confirmed: nothing", () => {
  assert.equal(SEASON_CONFIRM_FIRST_DAYS, 3);
  const giving = { seasons: [eid], items: [], links: [] };
  assert.deepEqual(givingOn("2027-03-05", giving), []);
  const [item] = givingOn("2027-03-06", giving);
  assert.deepEqual(item, {
    key: `season:${eid.id}:day:1448`,
    topic: "Seasons",
    timing: {
      type: "deadline",
      deadline: "2027-03-09",
      firstFrom: "2027-03-06",
    },
    title: "Eid al-Fitr is still “expected” on Tue 9 Mar 2027",
    detail: "Confirm the day once the moon is announced.",
    href: `/admin/seasons/${eid.id}`,
    linkLabel: "Open Eid al-Fitr",
  });
  const steps = (today: string, sent: SentSteps = nothingSent) =>
    emailsDue(givingOn(today, giving), sent, today).map((due) => due.step);
  assert.deepEqual(steps("2027-03-06"), ["first"]);
  const first = sentAs(item.key, { first: "2027-03-06" });
  assert.deepEqual(steps("2027-03-07", first), []);
  assert.deepEqual(steps("2027-03-08", first), ["last_call"]);
  // Confirmed by the board: nothing to do.
  const confirmed = {
    ...giving,
    seasons: [
      { ...eid, board_starts_on: "2027-03-10", board_ends_on: "2027-03-10" },
    ],
  };
  assert.deepEqual(givingOn("2027-03-08", confirmed), []);
  // Ramadan: its first and its last day, each its own problem.
  const both = { seasons: [ramadan], items: [], links: [] };
  assert.equal(
    givingOn("2027-02-05", both)[0].title,
    "Ramadan’s first day is still “expected” on Mon 8 Feb 2027",
  );
  assert.equal(
    givingOn("2027-03-07", both)[0].title,
    "Ramadan’s last day is still “expected” on Mon 8 Mar 2027",
  );
  assert.notEqual(
    givingOn("2027-02-05", both)[0].key,
    givingOn("2027-03-07", both)[0].key,
  );
});

test("an ended fund: close it in Go2Pay, listed for 7 days, at most two emails; hidden or archived: nothing", () => {
  const ended = fund({ name: "Flood relief", shows_until: "2026-10-01" });
  const link = {
    go2pay_product_id: 557,
    payment_item_id: ended.id,
    added_at: "2026-09-01T00:00:00Z",
  };
  const giving = { seasons: [], items: [ended], links: [link] };
  assert.deepEqual(givingOn("2026-10-01", giving), [], "still open that day");
  const [item] = givingOn("2026-10-02", giving);
  assert.deepEqual(item, {
    key: `close-in-go2pay:${ended.id}:2026-10-01`,
    topic: "Go2Pay",
    timing: { type: "open" },
    title: "“Flood relief” ended on Thu 1 Oct: close its Go2Pay page",
    detail:
      "Until it is closed in Go2Pay, old shared links still take payments.",
    href: `/admin/payments/funds/${ended.id}`,
    linkLabel: "Open the fund",
  });
  assert.equal(givingOn("2026-10-08", giving).length, 1);
  assert.deepEqual(givingOn("2026-10-09", giving), [], "after 7 days");
  // Unticked "Show", or archived: no longer the board's to-do.
  for (const other of [
    { ...ended, listed: false },
    { ...ended, archived_at: "2026-10-02T00:00:00Z" },
  ])
    assert.deepEqual(givingOn("2026-10-02", { ...giving, items: [other] }), []);
  // A ticket names the ticket's page.
  const ticket = fund({
    kind: "priced",
    category: "general",
    name: "Banquet",
    shows_until: "2026-10-01",
  });
  const [sold] = givingOn("2026-10-02", { ...giving, items: [ticket] });
  assert.equal(sold.href, `/admin/payments/tickets/${ticket.id}`);
  assert.equal(sold.linkLabel, "Open the ticket");
});

test("a fund waiting for Running again: from 45 days before its season, the last call the day before", () => {
  const iftar = fund({
    name: "Iftar fund",
    season_id: ramadan.id,
    season_year: 1447,
  });
  const giving = { seasons: [ramadan], items: [iftar], links: [] };
  assert.deepEqual(
    givingOn("2026-12-24", giving).filter((i) => i.key.startsWith("rerun:")),
    [],
  );
  const [item] = givingOn("2026-12-25", giving).filter((i) =>
    i.key.startsWith("rerun:"),
  );
  assert.deepEqual(item, {
    key: `rerun:${iftar.id}:1448`,
    topic: "Seasons",
    timing: {
      type: "deadline",
      deadline: "2027-02-08",
      firstFrom: "2026-12-25",
    },
    title:
      "“Iftar fund” is waiting for “Running again”: Ramadan starts on Mon 8 Feb 2027",
    detail:
      "Until “Running again” is ticked, the fund stays closed this season.",
    href: `/admin/payments/funds/${iftar.id}`,
    linkLabel: "Open the fund",
  });
  assert.deepEqual(
    emailsDue([item], nothingSent, "2026-12-25").map((d) => d.step),
    ["first"],
  );
  assert.deepEqual(
    emailsDue([item], nothingSent, "2027-02-07").map((d) => d.step),
    ["last_call"],
  );
  // Ticked for this year: nothing.
  assert.deepEqual(
    givingOn("2027-01-10", {
      ...giving,
      items: [{ ...iftar, season_year: 1448 }],
    }).filter((i) => i.key.startsWith("rerun:")),
    [],
  );
});

test("photo space: nothing below 80%, then one item for the highest level reached", () => {
  const today = "2026-11-01";
  const on = (bytes: number) =>
    attentionItems(
      attentionFacts(reads("", { storageBytes: bytes }), today),
      today,
    );
  assert.deepEqual(on(799_999_999), []);
  assert.deepEqual(on(800_000_000), [
    {
      key: "storage:80",
      topic: "Photos",
      timing: { type: "open" },
      title: "Photo space is 80% full (800 MB of 1 GB)",
      detail:
        "When it is full, no more photos or PDFs can be uploaded. Delete the ones nothing uses.",
      href: "/admin/photos",
      linkLabel: "Open Photos",
    },
  ]);
  const [full] = on(970_000_000);
  assert.equal(full.key, "storage:95");
  assert.equal(full.title, "Photo space is 97% full (970 MB of 1 GB)");
});

test("facts: a read that failed is unavailable (season days and funds need the prayer settings)", () => {
  const today = "2026-11-01";
  assert.equal(factsUnavailable(attentionFacts(reads(""), today)), false);
  for (const failed of [
    reads(null),
    reads("", { giving: null }),
    reads("", { storageBytes: null }),
  ])
    assert.equal(factsUnavailable(attentionFacts(failed, today)), true);
  const noPrayer = attentionFacts(reads(null), today);
  assert.equal(noPrayer.seasons, "unavailable");
  assert.equal(noPrayer.closedFunds, "unavailable");
  // The dashboard still lists what could be read.
  assert.equal(
    attentionItems(
      attentionFacts(reads(null, { storageBytes: 960_000_000 }), today),
      today,
    )[0].key,
    "storage:95",
  );
});
