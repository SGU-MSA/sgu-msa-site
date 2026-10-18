import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { contentForm } from "../src/features/admin/content-form";
import {
  contentFieldNames,
  eventNoticeWords,
} from "../src/features/admin/fields";
import {
  grenadaInstant,
  grenadaWallTime,
  recordFromTyped,
} from "../src/features/admin/form-state";
import { timeRange, whenLine } from "../src/features/calendar/format";
import {
  eventChange,
  eventNoticeEnd,
  eventNoticeText,
} from "../src/lib/community/event-notice";
import {
  currentUrgentNotices,
  recordSchema,
  type Collection,
  type CommunityRecord,
} from "../src/lib/community/schema";
import { demoRecords } from "../src/lib/demo/fixtures";
import {
  asksJumuahNotice,
  jumuahNoticeEnd,
  jumuahNoticeText,
  type FridayChange,
} from "../src/lib/prayer/jumuah-notice";

/**
 * A board save of typed values, as `saveRecordAction` and the form check it
 * (`contentForm`, with the server clock): the problems, one per box.
 */
function refusals(
  kind: Collection,
  values: Record<string, string>,
  now = new Date("2026-10-12T14:00:00Z"),
  saved: CommunityRecord | null = null,
) {
  const parsed = contentForm({
    kind,
    values: { id: randomUUID(), ...values },
    chosen: { image: false, file: false },
    saved,
    now,
  });
  return parsed.ok ? [] : Object.values(parsed.fields);
}

const announcement = {
  title: "Musallah closed until 3:00 PM today",
  date: "2026-10-12",
  published: "on",
};

test("priority box: Urgent sets an exact end in Grenada time and is neither featured nor date-limited (D-1)", () => {
  const typed = recordFromTyped({
    ...announcement,
    priority: "urgent",
    urgent_on: "2026-10-12",
    urgent_at: "15:00",
    expires_on: "2026-10-20",
    featured: "on",
  });
  assert.equal(typed.urgent_until, "2026-10-12T15:00:00-04:00");
  assert.equal(typed.featured, false);
  assert.equal(typed.expires_on, "");
  assert.deepEqual(
    refusals("announcements", {
      ...announcement,
      priority: "urgent",
      urgent_on: "2026-10-12",
      urgent_at: "15:00",
    }),
    [],
  );
  // Featured and Normal are never urgent.
  const featured = recordFromTyped({
    ...announcement,
    priority: "featured",
    urgent_until: "2026-10-12T15:00:00-04:00",
  });
  assert.equal(featured.featured, true);
  assert.equal(featured.urgent_until, "");
  assert.equal(recordFromTyped({ priority: "normal" }).featured, false);
  // Other kinds post no priority: the stored values stay.
  assert.equal(recordFromTyped({ featured: "on" }).featured, true);
});

test("priority box refusals: missing Hide at, a past time, a title over 80 characters (D-1, D-16)", () => {
  assert.deepEqual(
    refusals("announcements", {
      ...announcement,
      priority: "urgent",
      urgent_on: "2026-10-12",
    }),
    ["Hide at: choose a valid date and time."],
  );
  assert.deepEqual(
    refusals("announcements", {
      ...announcement,
      priority: "urgent",
      urgent_on: "2026-10-12",
      urgent_at: "09:00",
    }),
    ["Hide at: choose a time later than now."],
  );
  assert.deepEqual(
    refusals("announcements", {
      ...announcement,
      title: "x".repeat(81),
      priority: "urgent",
      urgent_on: "2026-10-13",
      urgent_at: "09:00",
    }),
    [
      "Headline: urgent notices fit 80 characters; put the rest in the details.",
    ],
  );
  // The same title is fine when the notice is not urgent.
  assert.deepEqual(
    refusals("announcements", {
      ...announcement,
      title: "x".repeat(81),
      priority: "normal",
    }),
    [],
  );
});

test("the announcement form names its dates as its boxes do (Q57)", () => {
  const names = contentFieldNames("announcements");
  assert.equal(names.date, "Show from");
  assert.equal(names.expires_on, "Hide after");
  assert.equal(names.urgent_until, "Hide at");
  assert.equal(contentFieldNames("events").status_note, "Reason");
});

const event = {
  title: "Beach clean-up",
  date: "2026-10-24",
  start_time: "08:00",
  location: "Grand Anse",
  published: "on",
};

test("status box: cancelled needs a reason; the reason is kept only while cancelled (D-20)", () => {
  assert.deepEqual(refusals("events", { ...event, status: "cancelled" }), [
    "Reason: fill in this box for a cancelled event.",
  ]);
  assert.deepEqual(
    refusals("events", {
      ...event,
      status: "cancelled",
      status_note: "Tropical storm warning",
    }),
    [],
  );
  assert.equal(
    recordFromTyped({ status: "scheduled", status_note: "Old reason" })
      .status_note,
    "",
  );
});

test("status: Postponed means the new date is not known yet; there is no earlier date (review 2)", () => {
  assert.deepEqual(refusals("events", { ...event, status: "postponed" }), []);
  assert.ok(
    !("moved_from" in recordFromTyped({ ...event, status: "postponed" })),
  );
});

/** The event as saved and published, for the announcement question. */
const savedEvent = recordSchema.parse({
  id: randomUUID(),
  title: "Beach clean-up",
  date: "2026-10-24",
  start_time: "08:00",
  location: "Grand Anse",
  published: true,
});
const published = { ...savedEvent, updated_at: "2026-10-05T12:00:00Z" };

test("announcement question: asked for a published event with a new date or cancelled (review 2)", () => {
  const typed = (values: Record<string, unknown> = {}) => ({
    title: "Beach clean-up",
    date: "2026-10-24",
    end_date: "",
    status: "scheduled",
    published: true,
    ...values,
  });
  assert.equal(eventChange(published, typed()), null);
  assert.equal(eventChange(published, typed({ date: "2026-10-31" })), "moved");
  assert.equal(
    eventChange(published, typed({ status: "cancelled" })),
    "cancelled",
  );
  // Postponed (no new date yet), a draft, a new event or one already cancelled: no question.
  assert.equal(eventChange(published, typed({ status: "postponed" })), null);
  assert.equal(
    eventChange(
      { ...published, published: false },
      typed({ date: "2026-10-31" }),
    ),
    null,
  );
  assert.equal(
    eventChange(published, typed({ date: "2026-10-31", published: false })),
    null,
  );
  assert.equal(eventChange(savedEvent, typed({ date: "2026-10-31" })), null);
  assert.equal(eventChange(null, typed({ date: "2026-10-31" })), null);
  assert.equal(
    eventChange(
      { ...published, status: "cancelled" },
      typed({ status: "cancelled" }),
    ),
    null,
  );

  // The prefills: the text, and the end of the day nobody should come on.
  assert.equal(
    eventNoticeText("moved", typed({ date: "2026-10-31" })),
    "Beach clean-up moves to Sat 31 Oct",
  );
  assert.equal(
    eventNoticeText("cancelled", typed()),
    "Cancelled: Beach clean-up",
  );
  assert.ok(
    eventNoticeText("cancelled", typed({ title: "x".repeat(200) })).length <=
      80,
  );
  assert.deepEqual(
    eventNoticeEnd("moved", published, typed({ date: "2026-10-31" })),
    { date: "2026-10-24", time: "23:59" },
  );
  assert.deepEqual(
    eventNoticeEnd("moved", published, typed({ date: "2026-10-20" })),
    { date: "2026-10-20", time: "23:59" },
  );
});

test("announcement question: must be answered; Yes posts an urgent notice with its own boxes' rules", () => {
  const moved = { ...event, date: "2026-10-31", status: "scheduled" };
  assert.deepEqual(refusals("events", moved, undefined, published), [
    eventNoticeWords.unanswered,
  ]);
  assert.deepEqual(
    refusals("events", { ...moved, announce: "no" }, undefined, published),
    [],
  );
  const yes = {
    ...moved,
    announce: "yes",
    announce_text: "Beach clean-up moves to Sat 31 Oct",
    announce_on: "2026-10-24",
    announce_at: "23:59",
  };
  const now = new Date("2026-10-12T14:00:00Z");
  const saved = contentForm({
    kind: "events",
    values: { id: randomUUID(), ...yes },
    chosen: { image: false, file: false },
    saved: published,
    now,
  });
  assert.ok(saved.ok && saved.notice);
  assert.equal(saved.notice.title, yes.announce_text);
  assert.equal(saved.notice.published, true);
  assert.equal(
    Date.parse(saved.notice.urgent_until),
    Date.parse("2026-10-24T23:59:00-04:00"),
  );
  const refused = contentForm({
    kind: "events",
    values: { id: randomUUID(), ...yes, announce_text: "", announce_at: "" },
    chosen: { image: false, file: false },
    saved: published,
    now,
  });
  assert.deepEqual(!refused.ok && refused.fields, {
    announce_text: "Notice text: fill in this box.",
    announce_at: "Hide at: choose a valid date and time.",
  });
});

test("event times: all day, the same day, and over several days (review 2)", () => {
  const at = (values: Record<string, string>) => ({
    date: "2026-10-10",
    ...values,
  });
  assert.equal(timeRange(at({})), "All day");
  assert.match(
    timeRange(at({ start_time: "17:00", end_time: "19:00" })),
    /^5:00\sPM – 7:00\sPM$/,
  );
  assert.match(
    timeRange(
      at({ start_time: "22:00", end_date: "2026-10-11", end_time: "03:00" }),
    ),
    /^10:00\sPM – Sun 11 Oct, 3:00\sAM$/,
  );
  assert.equal(timeRange(at({ end_date: "2026-10-12" })), "Until Mon 12 Oct");
  assert.match(
    whenLine(at({ start_time: "17:00", end_date: "2026-10-12" })),
    /^Sat 10 Oct, 5:00\sPM – Mon 12 Oct 2026$/,
  );
});

test("Hide at boxes show a stored end in Grenada time", () => {
  assert.deepEqual(grenadaWallTime("2026-10-12T19:00:00+00:00"), {
    date: "2026-10-12",
    time: "15:00",
  });
  assert.deepEqual(grenadaWallTime(grenadaInstant("2026-10-16", "23:30")), {
    date: "2026-10-16",
    time: "23:30",
  });
  assert.deepEqual(grenadaWallTime(""), { date: "", time: "" });
});

test("sandbox: the two sample urgent notices each leave the band at their own end (D-17)", () => {
  const seed = new Date("2026-10-12T14:00:00Z");
  const records = demoRecords("announcements", seed);
  const titles = (now: Date) =>
    currentUrgentNotices(records, now).map((record) => record.title);
  assert.equal(titles(seed).length, 2);
  // The first ends two hours after the seed; the second at 10:00 AM three days later.
  assert.equal(
    titles(new Date(seed.getTime() + 2 * 3600_000 + 60_000)).length,
    1,
  );
  assert.deepEqual(titles(new Date("2026-10-15T14:01:00Z")), []);
});

const friday = "2026-10-16";
const cancelled: FridayChange = {
  date: friday,
  jumuah: { change: "cancelled" },
};
const moved: FridayChange = {
  date: friday,
  jumuah: {
    change: "changed",
    sessions: [{ khutbah: "13:15", iqamah: "13:40" }],
  },
};
/** Two prayers on that Friday (review fixes P2). */
const twoMoved: FridayChange = {
  date: friday,
  jumuah: {
    change: "changed",
    sessions: [
      { khutbah: "13:15", iqamah: "13:40" },
      { khutbah: "14:15", iqamah: "14:30" },
    ],
  },
};
const usual = [
  { khutbah: "12:45", iqamah: "13:00" },
  { khutbah: "13:45", iqamah: "14:00" },
];

test("Jumu'ah question: asked only for a new or edited Friday change (D-3, D-19)", () => {
  assert.equal(asksJumuahNotice(cancelled, []), true);
  assert.equal(asksJumuahNotice(cancelled, [cancelled]), false);
  assert.equal(asksJumuahNotice(moved, [cancelled]), true);
  assert.equal(asksJumuahNotice(moved, [moved]), false);
  assert.equal(
    asksJumuahNotice(
      {
        ...moved,
        jumuah: {
          change: "changed",
          sessions: [{ khutbah: "13:15", iqamah: "14:00" }],
        },
      },
      [moved],
    ),
    true,
  );
  // Adding, removing or reordering a prayer is an edit too.
  assert.equal(asksJumuahNotice(twoMoved, [moved]), true);
  assert.equal(asksJumuahNotice(moved, [twoMoved]), true);
  assert.equal(asksJumuahNotice(twoMoved, [twoMoved]), false);
  assert.equal(
    asksJumuahNotice({ date: friday, jumuah: { change: "none" } }, []),
    false,
  );
  // Another Friday's saved change does not count.
  assert.equal(
    asksJumuahNotice(cancelled, [{ ...cancelled, date: "2026-10-23" }]),
    true,
  );
});

test("Jumu'ah question: prefilled text and Hide at, 30 minutes after that Friday's iqamah (D-19)", () => {
  assert.equal(
    jumuahNoticeText(cancelled),
    "No Jumu’ah at the Musallah this Friday (16 Oct)",
  );
  assert.match(
    jumuahNoticeText(moved),
    /^Jumu’ah this Friday \(16 Oct\) moves to 1:15\sPM$/,
  );
  assert.match(
    jumuahNoticeText(twoMoved),
    /^Jumu’ah this Friday \(16 Oct\) moves to 1:15\sPM and 2:15\sPM$/,
  );
  // Moved: that Friday's last iqamah; cancelled: the last usual one.
  assert.deepEqual(jumuahNoticeEnd(moved, usual), {
    date: friday,
    time: "14:10",
  });
  assert.deepEqual(jumuahNoticeEnd(twoMoved, usual), {
    date: friday,
    time: "15:00",
  });
  assert.deepEqual(jumuahNoticeEnd(cancelled, usual), {
    date: friday,
    time: "14:30",
  });
  assert.deepEqual(jumuahNoticeEnd(cancelled, []), { date: friday, time: "" });
});

/** Every route segment file under src/app. */
function routeFiles(dir = "src/app"): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return /^(page|layout|route)\.tsx?$/.test(name) ? [path] : [];
  });
}

test("the urgent band is read per visit, so it ends on time (E-1, review fixes PR-C)", () => {
  // The band streams in its own Suspense; the rest of the page is cached.
  const chrome = readFileSync("src/shared/layout/SiteChrome.tsx", "utf8");
  assert.match(chrome, /<Suspense fallback=\{null\}>\s*<UrgentNotices \/>/);
  // Its notices are filtered by the clock at request time, outside any cache.
  const managed = readFileSync("src/lib/community/managed.ts", "utf8");
  assert.match(
    managed,
    /currentUrgentNotices\(records, await requestNow\(\)\)/,
  );
  const queries = readFileSync("src/lib/community/queries.ts", "utf8");
  assert.match(queries, /const now = await requestNow\(\);/);
  // Cache Components replaces the old route settings; none may come back.
  for (const file of routeFiles()) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /export const (dynamic|revalidate|fetchCache) =|generateStaticParams/,
      file,
    );
  }
});
