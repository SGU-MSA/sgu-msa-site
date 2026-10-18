import test from "node:test";
import assert from "node:assert/strict";
import { formatTimeOfDay } from "../src/lib/time/time-of-day";
import { randomUUID } from "node:crypto";
import type {
  ActivityLog,
  ContentEditor,
  PeopleEditor,
} from "../src/lib/backend/providers/contract";
import { createSampleContentEditor } from "../src/lib/backend/providers/sample";
import {
  createSampleAccountInviter,
  createSampleActivityLog,
  createSamplePeopleEditor,
} from "../src/lib/backend/providers/sample-people";
import {
  activityDayBounds,
  activityFilterQuery,
  activityFiltersFrom,
  activityHref,
  ownerActor,
  activityEntrySchema,
  activityKinds,
  activityQuerySchema,
  activityTime,
  actorLabel,
  describeChange,
  historyList,
  matchesActivityQuery,
  restoredVersion,
  versionBefore,
  hiddenDifference,
  recentPrayerChange,
  shownText,
  unknownSection,
  removedLoginsIn,
  type ActivityRow,
} from "../src/lib/community/activity";
import { personSchema, type Person } from "../src/lib/community/people";
import { demoAdmin } from "../src/lib/demo/fixtures";
import { sandboxStore } from "../src/lib/demo/store";
import {
  localDate,
  prayerSaveSchema,
  recordSchema,
} from "../src/lib/community/schema";

const none = new Map<string, string>();
/** The People columns the log never keeps values of (D-5). */
const personalFields = ["full_name", "photo_path"];
const entry = (changes: Partial<ActivityRow>): ActivityRow =>
  activityEntrySchema.parse({
    id: 1,
    occurred_at: "2026-09-11T12:00:00Z",
    actor: null,
    area: "events",
    record_id: randomUUID(),
    action: "updated",
    before: null,
    after: null,
    highlight: false,
    ...changes,
  });

test("describeChange: an edit lists only the changed fields, before → after", () => {
  const row = { id: "x", title: "Old", published: true, updated_at: "a" };
  const change = describeChange(
    entry({
      before: row,
      after: { ...row, title: "New", published: false, updated_at: "b" },
    }),
    none,
  );
  assert.equal(change.label, "Edited event");
  assert.deepEqual(change.fields, [
    { name: "Title", before: "Old", after: "New", hidden: false },
    { name: "Published", before: "Yes", after: "No", hidden: false },
  ]);
});

test("describeChange: a moved musallah pin reads as an edit of the musallah location (PR7)", () => {
  const change = describeChange(
    entry({
      area: "musallah_location",
      record_id: "1",
      before: { id: 1, latitude: 12.0025521, longitude: -61.7723834 },
      after: { id: 1, latitude: 12.0031, longitude: -61.7723834 },
    }),
    none,
  );
  assert.equal(change.label, "Edited musallah location");
  assert.deepEqual(change.fields, [
    { name: "Latitude", before: "12.0025521", after: "12.0031", hidden: false },
  ]);
});

test("describeChange: People entries say which fields changed, never the values (D-4, D-5)", () => {
  const change = describeChange(
    entry({
      area: "people",
      before: { full_name: "[private]", position: 1 },
      after: { full_name: "[private]", position: 2 },
    }),
    none,
  );
  assert.equal(change.label, "Edited People entry");
  assert.deepEqual(change.fields, [
    { name: "Name", before: null, after: null, hidden: true },
    { name: "Order", before: "1", after: "2", hidden: false },
  ]);
  const access = describeChange(
    entry({
      area: "admins",
      action: "access_granted",
      after: {
        user_id: randomUUID(),
        person_id: randomUUID(),
        can_manage_people: true,
        can_manage_money: false,
      },
    }),
    none,
  );
  assert.equal(access.label, "Granted dashboard access");
  assert.deepEqual(access.fields, [
    { name: "Manage people", before: null, after: "Yes", hidden: false },
  ]);
});

test("describeChange: prayer settings read as text, never raw JSON", () => {
  const change = describeChange(
    entry({
      area: "prayer_settings",
      highlight: true,
      before: { fajr: "05:30", adjustments: { fajr: 0 } },
      after: { fajr: "05:41", adjustments: { fajr: 2 } },
    }),
    none,
  );
  assert.equal(change.label, "Edited prayer settings");
  assert.deepEqual(change.fields, [
    // Stored 24-hour times read on the 12-hour clock (review fixes P1).
    {
      name: "Fajr",
      before: formatTimeOfDay("05:30"),
      after: formatTimeOfDay("05:41"),
      hidden: false,
    },
    {
      name: "Prayer time adjustments",
      before: "Fajr: 0",
      after: "Fajr: 2",
      hidden: false,
    },
  ]);
  assert.ok(change.fields.every((field) => !field.after?.includes("{")));
});

test("describeChange: the Hijri date adjustment has a plain name", () => {
  const change = describeChange(
    entry({
      area: "prayer_settings",
      highlight: true,
      before: { hijri_adjustment: 0 },
      after: { hijri_adjustment: 1 },
    }),
    none,
  );
  assert.deepEqual(change.fields, [
    { name: "Hijri date adjustment", before: "0", after: "1", hidden: false },
  ]);
});

test("describeChange: names the item; People and access entries by their current People name (WP-E)", () => {
  const row = { id: "x", title: "Iftar night", updated_at: "a" };
  assert.equal(
    describeChange(
      entry({
        before: row,
        after: { ...row, title: "Iftar evening", updated_at: "b" },
      }),
      none,
    ).subject,
    "Iftar evening",
  );
  assert.equal(
    describeChange(entry({ action: "deleted", before: row, after: null }), none)
      .subject,
    "Iftar night",
  );
  assert.equal(
    describeChange(
      entry({
        area: "people_sections",
        action: "created",
        after: { id: "s", name: "Board", position: 1 },
      }),
      none,
    ).subject,
    "Board",
  );
  const personId = randomUUID();
  const sectionId = randomUUID();
  const names = new Map([
    [personId, "Amina Example"],
    [sectionId, "Advisors"],
  ]);
  const person = entry({
    area: "people",
    record_id: personId,
    before: { full_name: "[private]", section_id: randomUUID() },
    after: { full_name: "[private]", section_id: sectionId },
  });
  const change = describeChange(person, names);
  assert.equal(change.subject, "Amina Example");
  // The personal value stays hidden; the section id reads as its name.
  assert.deepEqual(change.fields[0], {
    name: "Name",
    before: null,
    after: null,
    hidden: true,
  });
  assert.equal(change.fields[1].after, "Advisors");
  // A section id that is not in names never shows as the raw id.
  assert.equal(change.fields[1].before, unknownSection);
  assert.equal(
    describeChange({ ...person, area: "admins" }, names).subject,
    "Amina Example",
  );
  // A permanently deleted person has no name any more (D-5).
  assert.equal(describeChange(person, none).subject, null);
  assert.equal(
    describeChange(
      entry({ area: "prayer_settings", after: { fajr: "05:00" } }),
      none,
    ).subject,
    null,
  );
});

test("describeChange: archive and login stamps read as Grenada time or No (WP-E)", () => {
  const row = { id: "x", title: "Event", archived_at: null };
  const archived = describeChange(
    entry({
      action: "archived",
      before: row,
      after: { ...row, archived_at: "2026-10-03T18:15:00Z" },
    }),
    none,
  );
  assert.equal(archived.fields[0].name, "Archived");
  assert.equal(archived.fields[0].before, "No");
  assert.match(archived.fields[0].after ?? "", /^Oct 3, 2026, 2:15\sPM$/);
  const access = describeChange(
    entry({
      area: "admins",
      action: "access_changed",
      before: { deactivated_at: "2026-10-03T18:15:00Z" },
      after: { deactivated_at: null },
    }),
    none,
  );
  assert.equal(access.fields[0].name, "Login turned off");
  assert.equal(access.fields[0].after, "No");
});

test("hiddenDifference: says why an edit would look the same in the list (WP-E)", () => {
  const long = "a".repeat(250);
  assert.equal(shownText(""), "(empty)");
  assert.equal(shownText(long), `${"a".repeat(200)}…`);
  // Windows line breaks from the form against plain ones in stored text.
  assert.equal(hiddenDifference("One\n\nTwo", "One\r\n\r\nTwo"), "spacing");
  assert.equal(hiddenDifference(`${long} end`, `${long} END`), "beyond");
  assert.equal(hiddenDifference("Old", "New"), null);
  assert.equal(hiddenDifference("", "New"), null);
});

test("actorLabel: People name, Site owner for no account, Former member when gone (WP-E)", () => {
  const row = entry({});
  assert.equal(actorLabel({ ...row, actorName: null }), "Site owner");
  const actor = randomUUID();
  assert.equal(
    actorLabel({ ...row, actor, actorName: "Omar Haddad" }),
    "Omar Haddad",
  );
  assert.equal(actorLabel({ ...row, actor, actorName: null }), "Former member");
});

test("activityTime: Grenada time (UTC−4)", () => {
  // ICU versions differ in the space before AM/PM (U+202F or a plain space).
  const plain = (iso: string) => activityTime(iso).replace(/\s/g, " ");
  assert.equal(plain("2026-10-03T18:15:00Z"), "Oct 3, 2026, 2:15 PM");
  assert.equal(plain("2026-10-04T02:30:00Z"), "Oct 3, 2026, 10:30 PM");
});

test("recentPrayerChange: the newest prayer change of the last 7 days only", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const prayer = (id: number, occurred_at: string) =>
    entry({ id, occurred_at, area: "prayer_settings", highlight: true });
  const event = entry({ id: 9, occurred_at: "2026-10-10T11:00:00Z" });
  const recent = prayer(8, "2026-10-03T12:00:00Z");
  assert.equal(recentPrayerChange([event, recent], now), recent);
  assert.equal(
    recentPrayerChange([prayer(7, "2026-10-03T11:59:59Z")], now),
    null,
  );
  assert.equal(recentPrayerChange([event], now), null);
  assert.equal(recentPrayerChange([], now), null);
});

/**
 * Conformance suite for the read-only log on every non-network adapter set:
 * every write through the editors appears once, newest first, with the
 * actor's name from People, and People entries without personal values.
 */
function activityLogConformance(
  name: string,
  make: () => {
    log: ActivityLog;
    content: ContentEditor;
    people: PeopleEditor;
    actorName: string;
    today: string;
  },
) {
  test(`${name}: each change appears once, newest first, with who and before → after`, async () => {
    const { log, content, actorName, today } = make();
    const row = recordSchema.parse({
      id: randomUUID(),
      title: "Logged event",
      date: today,
    });
    await content.saveRecord("events", row, null);
    const saved = (await content.readRecord("events", row.id)).record!;
    await content.saveRecord(
      "events",
      { ...row, title: "Logged event, renamed" },
      saved.updated_at,
    );
    // A save that changes nothing is not logged.
    const renamed = (await content.readRecord("events", row.id)).record!;
    await content.saveRecord(
      "events",
      { ...row, title: "Logged event, renamed" },
      renamed.updated_at,
    );
    const { entries, unavailable } = await log.list({
      limit: 10,
      area: "events",
      recordId: row.id,
    });
    assert.equal(unavailable, false);
    assert.deepEqual(
      entries.map((item) => item.action),
      ["updated", "created"],
    );
    assert.equal(entries[0].actorName, actorName);
    assert.equal(entries[0].before?.title, "Logged event");
    assert.equal(entries[0].after?.title, "Logged event, renamed");
    assert.ok(entries[0].id > entries[1].id);
  });

  test(`${name}: saving unchanged multi-line text from a form logs no change (D-28)`, async () => {
    const { log, content, today } = make();
    const id = randomUUID();
    // Stored with plain line breaks (sample texts, SQL); browsers send \r\n.
    await content.saveRecord(
      "news_posts",
      recordSchema.parse({
        id,
        title: "Line breaks",
        summary: "One\ntwo",
        body: "First line\n\nSecond paragraph",
        date: today,
      }),
      null,
    );
    const stored = (await content.readRecord("news_posts", id)).record!;
    const fromForm = recordSchema.parse({
      id,
      title: "Line breaks",
      summary: "One\r\ntwo",
      body: "First line\r\n\r\nSecond paragraph\r\n",
      date: today,
    });
    assert.equal(fromForm.body, "First line\n\nSecond paragraph");
    assert.equal(fromForm.summary, "One\ntwo");
    await content.saveRecord("news_posts", fromForm, stored.updated_at!);
    const { entries } = await log.list({ limit: 5, recordId: id });
    assert.deepEqual(
      entries.map((item) => item.action),
      ["created"],
    );
  });

  test(`${name}: saving an unchanged multi-line Schedule notice logs no change (D-30)`, async () => {
    const { log, content } = make();
    const prayer = (await content.readPrayer())!;
    await content.savePrayerSettings(
      { ...prayer.settings, notice: "Line one\nLine two" },
      prayer.version,
    );
    const stored = (await content.readPrayer())!;
    const fromForm = prayerSaveSchema.parse({
      ...stored.settings,
      notice: "Line one\r\nLine two\r\n",
    });
    assert.equal(fromForm.notice, "Line one\nLine two");
    const before = (await log.list({ limit: 1 })).entries[0].id;
    await content.savePrayerSettings(fromForm, stored.version);
    assert.equal((await log.list({ limit: 1 })).entries[0].id, before);
  });

  test(`${name}: a History restore names the version it put back; the next save clears it (review 3 D)`, async () => {
    const { log, content } = make();
    const names = new Map<string, string>();
    const prayer = (await content.readPrayer())!;
    await content.savePrayerSettings(
      { ...prayer.settings, notice: "Restore check" },
      prayer.version,
      "2026-10-05T18:14:00.000Z",
    );
    const [restore] = (await log.list({ limit: 1 })).entries;
    assert.equal(restore.action, "updated");
    const described = describeChange(restore, names);
    assert.equal(described.restoredFrom, "2026-10-05T18:14:00.000Z");
    assert.equal(described.label, "Restored prayer settings");
    // The marker is told by its own line, never as a changed box.
    assert.ok(
      described.fields.every((field) => field.name !== "Restored from"),
    );
    const restored = (await content.readPrayer())!;
    await content.savePrayerSettings(
      { ...restored.settings, notice: "" },
      restored.version,
    );
    const [edit] = (await log.list({ limit: 1 })).entries;
    assert.equal(edit.after?.restored_from, null);
    assert.equal(describeChange(edit, names).restoredFrom, null);
    assert.equal(describeChange(edit, names).label, "Edited prayer settings");
    const page = (await content.readPageText("faq"))!;
    await content.savePageText(
      "faq",
      { ...page.document, heading: "Restored heading" },
      page.version,
      "2026-10-04T13:00:00.000Z",
    );
    const [pageRestore] = (
      await log.list({ limit: 1, area: "page_texts", recordId: "faq" })
    ).entries;
    assert.equal(
      describeChange(pageRestore, names).restoredFrom,
      "2026-10-04T13:00:00.000Z",
    );
  });

  test(`${name}: page texts saved together, or none (dashboard polish)`, async () => {
    const { log, content } = make();
    const faq = (await content.readPageText("faq"))!;
    const jumuah = (await content.readPageText("jumuah"))!;
    const changes = (version: string) => [
      {
        key: "faq" as const,
        document: { ...faq.document, heading: "Together" },
        version: faq.version,
      },
      {
        key: "jumuah" as const,
        document: { ...jumuah.document, heading: "Together" },
        version,
      },
    ];
    // One stale version: nothing changes.
    assert.deepEqual(
      await content.savePageTexts(changes("2000-01-01T00:00:00.000Z")),
      { ok: false, reason: "conflict" },
    );
    assert.equal(
      (await content.readPageText("faq"))!.document.heading,
      faq.document.heading,
    );
    assert.deepEqual(await content.savePageTexts(changes(jumuah.version)), {
      ok: true,
    });
    assert.equal(
      (await content.readPageText("faq"))!.document.heading,
      "Together",
    );
    assert.equal(
      (await content.readPageText("jumuah"))!.document.heading,
      "Together",
    );
    const { entries } = await log.list({ limit: 2, area: "page_texts" });
    assert.deepEqual(entries.map((entry) => entry.record_id).sort(), [
      "faq",
      "jumuah",
    ]);
  });

  test(`${name}: archive, restore and permanent delete are logged; prayer changes highlighted`, async () => {
    const { log, content } = make();
    const row = recordSchema.parse({
      id: randomUUID(),
      title: "Archived event",
      date: "2026-01-01",
      published: true,
    });
    await content.saveRecord("events", row, null);
    let current = (await content.readRecord("events", row.id)).record!;
    await content.archiveRecord("events", row.id, current.updated_at);
    current = (await content.readRecord("events", row.id)).record!;
    await content.restoreRecord("events", row.id, current.updated_at);
    current = (await content.readRecord("events", row.id)).record!;
    await content.archiveRecord("events", row.id, current.updated_at);
    current = (await content.readRecord("events", row.id)).record!;
    await content.purgeRecord("events", row.id, current.updated_at);
    const { entries } = await log.list({ limit: 10, recordId: row.id });
    assert.deepEqual(
      entries.map((item) => item.action),
      ["deleted", "archived", "restored", "archived", "created"],
    );
    const prayer = (await content.readPrayer())!;
    await content.savePrayerSettings(
      { ...prayer.settings, fajr: "05:12" },
      prayer.version,
    );
    const [latest] = (await log.list({ limit: 1 })).entries;
    assert.equal(latest.area, "prayer_settings");
    assert.equal(latest.highlight, true);
    assert.equal(latest.after?.fajr, "05:12");
  });

  test(`${name}: People entries keep which fields changed, not the personal values`, async () => {
    const { log, people } = make();
    const { sections } = await people.listSections();
    const person = personSchema.parse({
      id: randomUUID(),
      full_name: "Private Name",
      section_id: sections.find((section) => section.kind === "general")!.id,
      position: 3,
      show_on_public: false,
    });
    await people.savePerson(person, null);
    const loaded = (await people.readPerson(person.id)).person!;
    await people.savePerson(
      { ...person, full_name: "Another Private Name", position: 4 },
      loaded.updated_at,
    );
    const { entries } = await log.list({ limit: 5, area: "people" });
    assert.ok(entries.length >= 2);
    assert.equal(entries[0].action, "updated");
    assert.deepEqual(entries[0].after, { full_name: "[private]", position: 4 });
    assert.ok(!JSON.stringify(entries).includes("Private Name"));
  });

  /** Frees the Secretary role, so a photo (Executive board only, review fixes P4) can be saved. */
  const executiveSeat = async (people: ReturnType<typeof make>["people"]) => {
    const { sections } = await people.listSections();
    const executive = sections.find((section) => section.kind === "executive")!;
    const holder = (await people.listPeople()).people.find(
      (person) =>
        person.section_id === executive.id && person.role_title === "Secretary",
    );
    if (holder)
      assert.equal(
        (await people.archivePerson(holder.id, holder.updated_at)).ok,
        true,
      );
    return { section_id: executive.id, role_title: "Secretary" };
  };

  test(`${name}: a new person's empty personal fields are not listed as changed (D-27)`, async () => {
    const { log, people } = make();
    const { sections } = await people.listSections();
    const created = async (changes: Partial<Person>) => {
      const person = personSchema.parse({
        id: randomUUID(),
        full_name: "Private Name",
        section_id: sections.find((section) => section.kind === "general")!.id,
        position: 3,
        show_on_public: false,
        ...changes,
      });
      await people.savePerson(person, null);
      const [entry] = (await log.list({ limit: 1, recordId: person.id }))
        .entries;
      assert.equal(entry.action, "created");
      return entry.after!;
    };
    const plain = await created({});
    assert.deepEqual(
      personalFields.filter((key) => key in plain),
      ["full_name"],
    );
    assert.equal(plain.full_name, "[private]");
    assert.equal(plain.show_on_public, false, "not personal: kept");
    const pictured = await created({
      ...(await executiveSeat(people)),
      photo_path: `${randomUUID()}.webp`,
    });
    for (const key of personalFields)
      assert.equal(pictured[key], "[private]", key);
  });

  test(`${name}: a deleted person's empty personal fields are not listed either (D-29)`, async () => {
    const { log, people } = make();
    const { sections } = await people.listSections();
    const deleted = async (changes: Partial<Person>) => {
      const person = personSchema.parse({
        id: randomUUID(),
        full_name: "Private Name",
        section_id: sections.find((section) => section.kind === "general")!.id,
        position: 3,
        show_on_public: false,
        ...changes,
      });
      await people.savePerson(person, null);
      let version = (await people.readPerson(person.id)).person!.updated_at;
      assert.equal((await people.archivePerson(person.id, version)).ok, true);
      version = (await people.readPerson(person.id)).person!.updated_at;
      assert.equal((await people.purgePerson(person.id, version)).ok, true);
      const [entry] = (await log.list({ limit: 1, recordId: person.id }))
        .entries;
      assert.equal(entry.action, "deleted");
      assert.equal(entry.after, null);
      return entry.before!;
    };
    const plain = await deleted({});
    assert.deepEqual(
      personalFields.filter((key) => key in plain),
      ["full_name"],
    );
    assert.equal(plain.full_name, "[private]");
    assert.equal(plain.show_on_public, false, "not personal: kept");
    const pictured = await deleted({
      ...(await executiveSeat(people)),
      photo_path: `${randomUUID()}.webp`,
    });
    for (const key of personalFields)
      assert.equal(pictured[key], "[private]", key);
    assert.ok(!JSON.stringify(pictured).includes("Private Name"));
  });

  test(`${name}: pages go back with before; entries cannot be changed through results`, async () => {
    const { log, content, today } = make();
    for (const title of ["One", "Two", "Three"])
      await content.saveRecord(
        "news_posts",
        recordSchema.parse({ id: randomUUID(), title, date: today }),
        null,
      );
    const first = await log.list({ limit: 2 });
    assert.equal(first.entries.length, 2);
    const older = await log.list({ limit: 2, before: first.entries[1].id });
    assert.ok(older.entries.every((item) => item.id < first.entries[1].id));
    first.entries[0].after!.title = "Tampered";
    first.entries[0].action = "deleted";
    const again = await log.list({ limit: 1 });
    assert.equal(again.entries[0].after?.title, "Three");
    assert.equal(again.entries[0].action, "created");
    await assert.rejects(log.list({ limit: 0 }));
    await assert.rejects(log.list({ limit: 51 }));
  });
}

let fresh = Date.parse("2031-01-01T12:00:00Z");
activityLogConformance("sample adapters", () => {
  const seed = new Date((fresh += 1000));
  return {
    log: createSampleActivityLog(seed),
    content: createSampleContentEditor(seed),
    people: createSamplePeopleEditor(seed),
    actorName: "Omar Haddad",
    today: localDate(seed),
  };
});

// PR5a (D-10, D-17): Recent changes filters, urgent highlights, New board term entries.

test("recentPrayerChange: an urgent notice is highlighted too, but is not a prayer change", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const urgent = entry({
    id: 9,
    occurred_at: "2026-10-05T11:00:00Z",
    area: "announcements",
    highlight: true,
  });
  const prayer = entry({
    id: 8,
    occurred_at: "2026-10-04T11:00:00Z",
    area: "prayer_settings",
    highlight: true,
  });
  assert.equal(recentPrayerChange([urgent, prayer], now), prayer);
  assert.equal(recentPrayerChange([urgent], now), null);
});

test("activityKinds: each kind names its tables; every logged table has one kind", () => {
  const areas: string[] = Object.values(activityKinds).flatMap(
    (kind) => kind.areas,
  );
  assert.equal(new Set(areas).size, areas.length, "no table in two kinds");
  for (const area of [
    "prayer_settings",
    "musallah_location",
    "events",
    "announcements",
    "news_posts",
    "newsletters",
    "people",
    "people_sections",
    "admins",
    "handover_steps",
    "shared_logins",
    "page_texts",
    "payment_items",
    "payment_item_links",
    "seasons",
    "merch_collections",
    "merch_items",
  ])
    assert.ok(areas.includes(area), area);
  assert.deepEqual(
    Object.values(activityKinds).map((kind) => kind.label),
    [
      "Prayer & iqamah",
      "Events",
      "Announcements",
      "News",
      "Newsletters",
      "People and logins",
      "New board term",
      "Pages",
      "Funds, tickets and seasons",
      "Merch",
    ],
  );
});

test("activity filters: who, what and Grenada days, both days included", () => {
  const query = activityQuerySchema.parse({
    limit: 25,
    actors: ["owner"],
    areas: ["events"],
    from: "2026-10-01",
    to: "2026-10-03",
  });
  assert.deepEqual(activityDayBounds(query), {
    since: "2026-10-01T04:00:00.000Z",
    until: "2026-10-04T04:00:00.000Z",
  });
  assert.deepEqual(activityDayBounds({}), {});
  for (const bad of [
    { actors: ["someone"] },
    { actors: "owner" },
    { areas: [] },
    { from: "2026-02-30" },
    { to: "3 Oct" },
  ])
    assert.equal(
      activityQuerySchema.safeParse({ limit: 25, ...bad }).success,
      false,
      JSON.stringify(bad),
    );
  const someone = randomUUID();
  const at = (occurred_at: string, changes: Partial<ActivityRow> = {}) =>
    entry({ occurred_at, area: "events", ...changes });
  // 1 Oct, 00:00 Grenada is 04:00 UTC; 3 Oct, 23:59 Grenada is 4 Oct, 03:59 UTC.
  assert.equal(matchesActivityQuery(at("2026-10-01T04:00:00Z"), query), true);
  assert.equal(matchesActivityQuery(at("2026-10-01T03:59:59Z"), query), false);
  assert.equal(matchesActivityQuery(at("2026-10-04T03:59:59Z"), query), true);
  assert.equal(matchesActivityQuery(at("2026-10-04T04:00:00Z"), query), false);
  assert.equal(
    matchesActivityQuery(at("2026-10-02T12:00:00Z", { actor: someone }), query),
    false,
  );
  assert.equal(
    matchesActivityQuery(
      at("2026-10-02T12:00:00Z", { actor: someone }),
      activityQuerySchema.parse({ limit: 25, actors: [someone] }),
    ),
    true,
  );
  // Several logins of one person (or the owner too); none matches nothing.
  const both = activityQuerySchema.parse({
    limit: 25,
    actors: [randomUUID(), someone, "owner"],
  });
  assert.equal(matchesActivityQuery(at("2026-10-02T12:00:00Z"), both), true);
  assert.equal(
    matchesActivityQuery(at("2026-10-02T12:00:00Z", { actor: someone }), both),
    true,
  );
  assert.equal(
    matchesActivityQuery(
      at("2026-10-02T12:00:00Z", { actor: someone }),
      activityQuerySchema.parse({ limit: 25, actors: [] }),
    ),
    false,
  );
  assert.equal(
    matchesActivityQuery(at("2026-10-02T12:00:00Z", { area: "people" }), query),
    false,
  );
});

test("sandbox Recent changes: filters by person, kind and day; the rest is kept", async () => {
  const seed = new Date("2034-05-01T12:00:00Z");
  const content = createSampleContentEditor(seed);
  const log = createSampleActivityLog(seed);
  const people = createSamplePeopleEditor(seed);
  const today = localDate(seed);
  await content.saveRecord(
    "events",
    recordSchema.parse({ id: randomUUID(), title: "Filtered", date: today }),
    null,
  );
  const { sections } = await people.listSections();
  await people.saveSection(
    {
      id: randomUUID(),
      name: "Filtered section",
      position: 9,
      shown_by_default: false,
      kind: null,
    },
    null,
  );
  assert.ok(sections.length);
  const list = (filters: Record<string, unknown>) =>
    log
      .list({ limit: 50, ...filters })
      .then(({ entries }) => entries.map((item) => item.area));
  assert.deepEqual(await list({}), ["people_sections", "events"]);
  assert.deepEqual(await list({ areas: [...activityKinds.events.areas] }), [
    "events",
  ]);
  assert.deepEqual(await list({ areas: [...activityKinds.people.areas] }), [
    "people_sections",
  ]);
  // The sandbox's only account made both; nothing was done by the site owner.
  assert.equal((await list({ actors: [demoAdmin.userId] })).length, 2);
  assert.deepEqual(await list({ actors: ["owner"] }), []);
  assert.deepEqual(await list({ actors: [] }), []);
  assert.equal((await list({ from: today, to: today })).length, 2);
  assert.deepEqual(await list({ to: "2034-04-30" }), []);
});

test("describeChange: urgent end in Grenada time, holders by People name, a shared login by its account", () => {
  const holder = randomUUID();
  const change = describeChange(
    entry({
      area: "shared_logins",
      before: {
        id: "x",
        service: "MSA Gmail",
        holder_person_id: holder,
        second_factor_person_id: null,
      },
      after: {
        id: "x",
        service: "MSA Gmail",
        holder_person_id: randomUUID(),
        second_factor_person_id: holder,
      },
    }),
    new Map([[holder, "Testname Holder"]]),
  );
  assert.equal(change.label, "Edited shared login");
  assert.equal(change.subject, "MSA Gmail");
  assert.deepEqual(
    change.fields.map((field) => [field.name, field.before, field.after]),
    [
      ["Holder", "Testname Holder", "Former member"],
      ["2-step phone", "", "Testname Holder"],
    ],
  );
  const urgent = describeChange(
    entry({
      area: "announcements",
      before: { title: "Notice", urgent_until: null },
      after: { title: "Notice", urgent_until: "2026-10-10T19:00:00+00:00" },
    }),
    none,
  );
  assert.deepEqual(
    urgent.fields.map((field) => [field.name, field.after]),
    [["Hide at", "Oct 10, 2026, 3:00 PM"]],
  );
  assert.equal(
    describeChange(entry({ area: "handover_steps", action: "created" }), none)
      .label,
    "Added New board term step",
  );
});

test("Recent changes filters: the address keeps who, what and the days; anything else is left out (D-10, E-9)", async () => {
  // "Who" is a People id; the query gets every login they have or had.
  const someone = randomUUID();
  const [oldLogin, newLogin] = [randomUUID(), randomUUID()];
  const loginsOf = (personId: string) =>
    personId === someone ? [oldLogin, newLogin] : [];
  const filters = activityFiltersFrom({
    who: someone,
    what: "prayer",
    from: "2026-09-01",
    to: "2026-10-04",
    before: "40",
  });
  assert.deepEqual(filters, {
    who: someone,
    what: "prayer",
    from: "2026-09-01",
    to: "2026-10-04",
  });
  assert.deepEqual(activityFilterQuery(filters, loginsOf), {
    actors: [oldLogin, newLogin],
    areas: ["prayer_settings", "musallah_location"],
    from: "2026-09-01",
    to: "2026-10-04",
  });
  // "Older changes" and "Newest changes" keep every filter.
  assert.equal(
    activityHref(filters, 40),
    `/admin/activity?who=${someone}&what=prayer&from=2026-09-01&to=2026-10-04&before=40`,
  );
  assert.equal(
    activityHref(filters),
    `/admin/activity?who=${someone}&what=prayer&from=2026-09-01&to=2026-10-04`,
  );
  assert.equal(activityHref({}), "/admin/activity");
  // The site owner, and every kind's tables.
  assert.deepEqual(
    activityFilterQuery(activityFiltersFrom({ who: ownerActor }), loginsOf),
    { actors: [ownerActor] },
  );
  // Someone with no login made no changes.
  assert.deepEqual(
    activityFilterQuery(activityFiltersFrom({ who: randomUUID() }), loginsOf),
    { actors: [] },
  );
  assert.deepEqual(
    activityFilterQuery(activityFiltersFrom({ what: "people" }), loginsOf)
      .areas,
    [...activityKinds.people.areas],
  );
  // Unknown or broken values are ignored, never an error.
  assert.deepEqual(
    activityFiltersFrom({
      who: "someone",
      what: "money",
      from: "2026-02-30",
      to: ["2026-10-01", "2026-10-02"],
    }),
    {},
  );
  // The filtered query is one the log accepts.
  assert.ok(
    activityQuerySchema.safeParse({
      limit: 26,
      ...activityFilterQuery(filters, loginsOf),
    }).success,
  );
});

test("Remove login: the person's past changes keep their name, and they stay in Who (contract: the person and their history stay)", async () => {
  const seed = new Date("2035-03-01T12:00:00Z");
  const people = createSamplePeopleEditor(seed);
  const inviter = createSampleAccountInviter(seed);
  const log = createSampleActivityLog(seed);
  const person = (await people.listPeople()).people.find(
    (entry) => entry.access.state === "none",
  )!;
  const email = `member-${randomUUID()}@example.invalid`;
  const perms = { canManagePeople: false, canManageMoney: false };
  const invite = () =>
    inviter.invite(email, "http://localhost:3000/x", {
      fullName: person.full_name,
      invitedBy: "Tester",
    });
  await invite();
  await people.grantAccess(person.id, email, perms);
  const login = async () => {
    const access = (await people.readPerson(person.id)).person!.access;
    assert.ok(access.state !== "none");
    return access;
  };
  const first = await login();
  // A change they made (the sandbox writes as its own account, so the entry is added as theirs).
  const store = sandboxStore(seed);
  const theirs = (actor: string) =>
    store.activity.push({
      ...entry({ area: "events", action: "created" }),
      id: store.activity.length + 1000,
      actor,
    });
  theirs(first.userId);
  const nameOn = async (actor: string) =>
    (await log.list({ limit: 50, actors: [actor] })).entries.map(
      (item) => item.actorName,
    );
  assert.deepEqual(await nameOn(first.userId), [person.full_name]);

  // Deactivate, then Remove login: the access row goes, the name stays.
  await people.setAccess({
    personId: person.id,
    ...perms,
    active: false,
    version: first.version,
  });
  assert.deepEqual(await inviter.deleteAccount(first.userId), { ok: true });
  assert.equal(
    (await people.readPerson(person.id)).person!.access.state,
    "none",
  );
  assert.deepEqual(await nameOn(first.userId), [person.full_name]);
  assert.deepEqual(removedLoginsIn(store.activity), [
    { userId: first.userId, personId: person.id },
  ]);

  // Invited again later: both logins are theirs, and "Who" lists them once.
  await invite();
  await people.grantAccess(person.id, email, perms);
  const second = await login();
  assert.notEqual(second.userId, first.userId);
  theirs(second.userId);
  const { logins, unavailable } = await log.logins();
  assert.equal(unavailable, false);
  assert.deepEqual(
    logins
      .filter((owner) => owner.personId === person.id)
      .map((owner) => owner.userId)
      .sort(),
    [first.userId, second.userId].sort(),
  );
  assert.ok(
    logins.some(
      (owner) =>
        owner.userId === demoAdmin.userId &&
        owner.personId === demoAdmin.personId,
    ),
  );
  assert.deepEqual(
    (
      await log.list({ limit: 50, actors: [first.userId, second.userId] })
    ).entries.map((item) => item.actorName),
    [person.full_name, person.full_name],
  );
});

test("History (review 3 D): each change offers the version before it, dated by the change before, replacing it and every newer one", () => {
  const page = (id: number, occurred_at: string, before: object | null) =>
    entry({
      id,
      occurred_at,
      area: "page_texts",
      record_id: "home",
      before: before as Record<string, unknown> | null,
      after: { key: "home", document: { id } },
    });
  const starting = {
    key: "home",
    document: { id: 0 },
    updated_at: "2026-10-01T10:00:00.000000+00:00",
  };
  const first = page(1, "2026-10-02T10:00:00Z", starting);
  const second = page(2, "2026-10-03T10:00:00Z", { document: { id: 1 } });
  const third = page(3, "2026-10-04T10:00:00Z", { document: { id: 2 } });
  // Read with one more than listed: the extra entry only dates the oldest listed.
  const { shown, versions } = historyList([third, second, first], 2);
  assert.deepEqual(
    shown.map((row) => row.id),
    [3, 2],
  );
  assert.deepEqual(versions, [
    { entryId: 3, savedAt: "2026-10-03T10:00:00Z", replaces: 1 },
    { entryId: 2, savedAt: "2026-10-02T10:00:00Z", replaces: 2 },
  ]);
  // The item's first change: its starting row is dated by its own updated_at.
  assert.deepEqual(historyList([second, first], 20).versions[1], {
    entryId: 1,
    savedAt: "2026-10-01T10:00:00.000000+00:00",
    replaces: 2,
  });
  assert.equal(
    versionBefore(page(4, "2026-10-04T10:00:00Z", { updated_at: "x" }), null),
    null,
  );
  assert.equal(
    versionBefore(page(5, "2026-10-04T10:00:00Z", null), null),
    null,
  );
  // Only a save that sets restored_from is a restore.
  const restore = (before: unknown, after: unknown, saved = true) =>
    restoredVersion(
      entry({
        area: "page_texts",
        before: { restored_from: before, updated_at: "2026-10-03T10:00:00Z" },
        after: {
          restored_from: after,
          updated_at: saved ? "2026-10-04T10:00:00Z" : "2026-10-03T10:00:00Z",
        },
      }),
    );
  assert.equal(restore(null, "2026-10-02T10:00:00Z"), "2026-10-02T10:00:00Z");
  // The same version restored twice in a row: the second is a restore too.
  assert.equal(
    restore("2026-10-02T10:00:00Z", "2026-10-02T10:00:00Z"),
    "2026-10-02T10:00:00Z",
  );
  // A change to the row that is not a save keeps it unlabelled.
  assert.equal(
    restore("2026-10-02T10:00:00Z", "2026-10-02T10:00:00Z", false),
    null,
  );
  assert.equal(restore("2026-10-02T10:00:00Z", null), null);
});
