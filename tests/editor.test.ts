import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { ContentEditor } from "../src/lib/backend/providers/contract";
import {
  createSampleAdminAuth,
  createSampleContentEditor,
} from "../src/lib/backend/providers/sample";
import { supabaseAdminAuth } from "../src/lib/backend/providers/supabase";
import type { ContentProvider } from "../src/lib/community/providers/contract";
import { createMockContentProvider } from "../src/lib/community/providers/mock";
import { demoAdmin, demoMusallahPin } from "../src/lib/demo/fixtures";
import { createSamplePlacesProvider } from "../src/lib/maps/providers/sample";
import { sandboxStore } from "../src/lib/demo/store";
import {
  startFrom,
  isVisible,
  localDate,
  prayerSettingsSchema,
  recordFormSchema,
  recordSchema,
  type Collection,
  type CommunityRecord,
} from "../src/lib/community/schema";
import { z } from "zod";
import {
  contentFieldList,
  contentFieldNames,
  contentFormRecord,
  hiddenContentFields,
} from "../src/features/admin/fields";
import {
  boxReason,
  problemsOf,
} from "../src/features/admin/form-check/problems";
import { boxesNeedFixing, fixBeforeSaving } from "../src/lib/system-text";
import {
  initialKeptForm,
  keepTyped,
  recordFromTyped,
  typedValues,
} from "../src/features/admin/form-state";

/** A kind's save check, its messages naming the form's boxes (Q57). */
const formSchema = (
  kind: Collection,
  chosen: { image: boolean; file: boolean },
) => recordFormSchema(kind, chosen, contentFieldNames(kind));

/**
 * Conformance suite for the write port (ADR 0012 rule 6) on every non-network
 * adapter pair: an editor and the public reader of the same data. Records use
 * fresh ids, so the suite works on a shared store.
 */
function contentEditorConformance(
  name: string,
  make: () => { editor: ContentEditor; reader: ContentProvider; today: string },
) {
  const draft = (today: string, changes: Partial<CommunityRecord> = {}) =>
    recordSchema.parse({
      id: randomUUID(),
      title: "Sandbox event",
      date: today,
      start_time: "17:00",
      location: "Example venue",
      published: true,
      ...changes,
    });

  test(`${name}: insert, update with the loaded version, stale version conflicts`, async () => {
    const { editor, today } = make();
    const row = draft(today);
    assert.deepEqual(await editor.saveRecord("events", row, null), {
      ok: true,
    });
    assert.deepEqual(await editor.saveRecord("events", row, null), {
      ok: false,
      reason: "conflict",
    });
    const loaded = (await editor.readRecord("events", row.id)).record;
    assert.ok(loaded);
    assert.equal(loaded.title, "Sandbox event");
    assert.ok(loaded.updated_at);
    const listed = await editor.listRecords("events");
    assert.equal(listed.unavailable, false);
    assert.ok(listed.records.some((r) => r.id === row.id && r.updated_at));

    const renamed = { ...row, title: "Renamed event" };
    assert.deepEqual(
      await editor.saveRecord("events", renamed, loaded.updated_at),
      { ok: true },
    );
    const after = (await editor.readRecord("events", row.id)).record;
    assert.equal(after?.title, "Renamed event");
    assert.notEqual(after?.updated_at, loaded.updated_at);
    // A second editor still holding the old version must not overwrite.
    assert.deepEqual(
      await editor.saveRecord("events", row, loaded.updated_at),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await editor.saveRecord("events", draft(today), "unknown-version"),
      { ok: false, reason: "conflict" },
    );
  });

  test(`${name}: prayer settings save with the loaded version`, async () => {
    const { editor, reader } = make();
    const loaded = await editor.readPrayer();
    assert.ok(loaded);
    prayerSettingsSchema.parse(loaded.settings);
    const changed = { ...loaded.settings, fajr: "05:41" };
    assert.deepEqual(await editor.savePrayerSettings(changed, loaded.version), {
      ok: true,
    });
    assert.deepEqual(
      await editor.savePrayerSettings(loaded.settings, loaded.version),
      { ok: false, reason: "conflict" },
    );
    assert.equal((await editor.readPrayer())?.settings.fajr, "05:41");
    assert.equal((await reader.getPrayerSettings()).settings.fajr, "05:41");
  });

  test(`${name}: a stored prayer with both a fixed time and minutes is read as stored (D-14 amendment)`, async () => {
    const { editor, reader } = make();
    const loaded = (await editor.readPrayer())!;
    // A row saved before PR4 (the port stores it; only a board save refuses it).
    const legacy = {
      ...loaded.settings,
      fajr: "05:30",
      iqamah_offsets: { ...loaded.settings.iqamah_offsets, fajr: 20 },
    };
    assert.deepEqual(await editor.savePrayerSettings(legacy, loaded.version), {
      ok: true,
    });
    for (const settings of [
      (await editor.readPrayer())!.settings,
      (await reader.getPrayerSettings()).settings,
    ]) {
      assert.equal(settings.fajr, "05:30");
      assert.equal(settings.iqamah_offsets.fajr, 20);
    }
    // Put the shared store back as it was.
    const again = (await editor.readPrayer())!;
    assert.deepEqual(
      await editor.savePrayerSettings(loaded.settings, again.version),
      { ok: true },
    );
  });

  test(`${name}: uploads are normalized, then served only while a visible record uses them`, async () => {
    const { editor, reader, today } = make();
    assert.equal(await editor.upload("image", new File([], "empty.png")), null);
    await assert.rejects(
      editor.upload(
        "file",
        new File(["not a pdf"], "x.pdf", { type: "application/pdf" }),
      ),
      /Choose a PDF, or a JPEG, PNG or WebP image\./,
    );
    await assert.rejects(
      editor.upload(
        "file",
        new File([new Uint8Array(3 * 1024 * 1024 + 1)], "big.pdf", {
          type: "application/pdf",
        }),
      ),
      /3 MB/,
    );
    const png = await sharp({
      create: { width: 64, height: 32, channels: 3, background: "#806020" },
    })
      .png()
      .toBuffer();
    const name = await editor.upload(
      "image",
      new File([new Uint8Array(png)], "photo.png", { type: "image/png" }),
    );
    assert.match(name ?? "", /^[a-f0-9-]{36}\.webp$/);
    assert.equal((await reader.getMedia(name!)).file, null, "unreferenced");

    const row = draft(today, {
      image_path: name!,
      image_alt: "A plain test image",
      published: false,
    });
    await editor.saveRecord("news_posts", row, null);
    assert.equal((await reader.getMedia(name!)).file, null, "draft only");
    const { record } = await editor.readRecord("news_posts", row.id);
    await editor.saveRecord(
      "news_posts",
      { ...row, published: true },
      record!.updated_at,
    );
    const served = await reader.getMedia(name!);
    assert.equal(served.unavailable, false);
    assert.equal(served.file?.type, "image/webp");
    const meta = await sharp(
      new Uint8Array(await served.file!.arrayBuffer()),
    ).metadata();
    assert.equal(meta.format, "webp");
  });

  test(`${name}: the photo library lists every upload, reads any of them, and says which are in use`, async () => {
    const { editor, reader, today } = make();
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#204060" },
    })
      .png()
      .toBuffer();
    const upload = () =>
      editor.upload(
        "image",
        new File([new Uint8Array(png)], "photo.png", { type: "image/png" }),
      );
    const before = (await reader.getStorageUse()).bytes ?? 0;
    const older = (await upload())!;
    const newer = (await upload())!;
    const { files, unavailable } = await editor.listFiles();
    assert.equal(unavailable, false);
    const names = files.map((file) => file.name);
    assert.ok(names.indexOf(newer) < names.indexOf(older), "newest first");
    const listed = files.find((file) => file.name === newer)!;
    assert.ok(listed.bytes > 0);
    assert.ok(listed.uploadedAt);
    const after = (await reader.getStorageUse()).bytes ?? 0;
    assert.ok(after - before >= listed.bytes, "the space counts the uploads");
    // The board reads a file no published item uses yet; visitors cannot.
    assert.equal((await editor.readFile(newer)).file?.type, "image/webp");
    assert.equal((await reader.getMedia(newer)).file, null);
    assert.equal(await editor.fileInUse(newer), false);
    const row = draft(today, {
      image_path: newer,
      image_alt: "A reused photo",
      published: false,
    });
    await editor.saveRecord("events", row, null);
    assert.equal(await editor.fileInUse(newer), true, "a draft uses it too");
    // Storage keeps a used file; an unused one goes.
    await editor.removeFile(newer);
    await editor.removeFile(older);
    const left = (await editor.listFiles()).files.map((file) => file.name);
    assert.ok(left.includes(newer));
    assert.ok(!left.includes(older));
  });

  test(`${name}: archive hides an item, restore brings it back as a draft (D-13)`, async () => {
    const { editor, reader, today } = make();
    const row = draft(today, { title: "Archive me" });
    await editor.saveRecord("events", row, null);
    const loaded = (await editor.readRecord("events", row.id)).record!;
    assert.equal(loaded.archived_at, null);
    assert.deepEqual(await editor.archiveRecord("events", row.id, "stale"), {
      ok: false,
      reason: "conflict",
    });
    assert.deepEqual(
      await editor.archiveRecord("events", row.id, loaded.updated_at),
      { ok: true },
    );
    const ids = async (view?: "current" | "archived") =>
      (await editor.listRecords("events", view)).records.map((r) => r.id);
    assert.ok(!(await ids()).includes(row.id));
    assert.ok(!(await ids("current")).includes(row.id));
    assert.ok((await ids("archived")).includes(row.id));
    assert.ok(
      !(await reader.getRecords("events")).records.some((r) => r.id === row.id),
    );
    const archived = (await editor.readRecord("events", row.id)).record!;
    assert.ok(archived.archived_at);
    assert.equal(isVisible(archived, "events", new Date()), false);
    // Archiving twice, or restoring a current item, is a conflict.
    assert.deepEqual(
      await editor.archiveRecord("events", row.id, archived.updated_at),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await editor.restoreRecord("events", row.id, archived.updated_at),
      { ok: true },
    );
    const restored = (await editor.readRecord("events", row.id)).record!;
    assert.equal(restored.archived_at, null);
    assert.equal(restored.published, false);
    assert.deepEqual(
      await editor.restoreRecord("events", row.id, restored.updated_at),
      { ok: false, reason: "conflict" },
    );
  });

  test(`${name}: permanent delete only from Archived, with the current version`, async () => {
    const { editor, today } = make();
    const row = draft(today);
    await editor.saveRecord("newsletters", row, null);
    const current = (await editor.readRecord("newsletters", row.id)).record!;
    assert.deepEqual(
      await editor.purgeRecord("newsletters", row.id, current.updated_at),
      { ok: false, reason: "conflict" },
    );
    await editor.archiveRecord("newsletters", row.id, current.updated_at);
    const archived = (await editor.readRecord("newsletters", row.id)).record!;
    assert.deepEqual(
      await editor.purgeRecord("newsletters", row.id, current.updated_at),
      { ok: false, reason: "conflict" },
    );
    assert.deepEqual(
      await editor.purgeRecord("newsletters", row.id, archived.updated_at),
      { ok: true },
    );
    assert.equal((await editor.readRecord("newsletters", row.id)).record, null);
  });

  test(`${name}: "Create from this" starts an unpublished, not featured item with no date (review fixes P3)`, async () => {
    const { editor, today } = make();
    const row = draft(today, { title: "x".repeat(160), featured: true });
    await editor.saveRecord("announcements", row, null);
    const original = (await editor.readRecord("announcements", row.id)).record!;
    const copy = { ...startFrom(original, randomUUID()), date: today };
    assert.equal(startFrom(original, randomUUID()).date, "");
    assert.equal(copy.title, original.title);
    assert.equal(copy.published, false);
    assert.equal(copy.featured, false);
    assert.equal(copy.updated_at, undefined);
    assert.equal(copy.archived_at, null);
    assert.deepEqual(await editor.saveRecord("announcements", copy, null), {
      ok: true,
    });
  });

  test(`${name}: removeFile keeps a file in use and deletes it once unused`, async () => {
    const { editor, reader, today } = make();
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#204060" },
    })
      .png()
      .toBuffer();
    const name = (await editor.upload(
      "image",
      new File([new Uint8Array(png)], "photo.png", { type: "image/png" }),
    ))!;
    const row = draft(today, { image_path: name, image_alt: "A test image" });
    await editor.saveRecord("news_posts", row, null);
    assert.deepEqual(await editor.removeFile(name), { ok: true });
    assert.ok((await reader.getMedia(name)).file, "still used, still served");
    const current = (await editor.readRecord("news_posts", row.id)).record!;
    await editor.archiveRecord("news_posts", row.id, current.updated_at);
    const archived = (await editor.readRecord("news_posts", row.id)).record!;
    await editor.purgeRecord("news_posts", row.id, archived.updated_at);
    assert.deepEqual(await editor.removeFile(name), { ok: true });
    // A new item naming the same file finds nothing to serve: it is gone.
    await editor.saveRecord("news_posts", { ...row, id: randomUUID() }, null);
    assert.equal((await reader.getMedia(name)).file, null);
  });

  test(`${name}: edits are visible to the public reader, drafts are not`, async () => {
    const { editor, reader, today } = make();
    const published = draft(today, { title: "Visible sandbox edit" });
    const hidden = draft(today, {
      title: "Hidden sandbox draft",
      published: false,
    });
    await editor.saveRecord("events", published, null);
    await editor.saveRecord("events", hidden, null);
    const { records } = await reader.getRecords("events");
    assert.ok(records.some((r) => r.id === published.id));
    assert.ok(!records.some((r) => r.id === hidden.id));
    const dates = records.map((r) => r.date);
    assert.deepEqual(dates, [...dates].sort(), "events in date order");
  });
}

const seed = new Date("2026-09-11T12:00:00Z");
contentEditorConformance("sample adapters", () => ({
  editor: createSampleContentEditor(seed),
  reader: createMockContentProvider(seed),
  today: localDate(seed),
}));

test("sample pin: saves with the loaded version, conflicts when stale, logs the move, and never blocks a prayer save (PR7)", async () => {
  // Its own seed: a store no other test touches.
  const own = new Date("2032-03-01T12:00:00Z");
  const editor = createSampleContentEditor(own);
  const places = createSamplePlacesProvider(own);
  const loaded = (await editor.readMusallahPin())!;
  assert.deepEqual(loaded.pin, demoMusallahPin);
  const prayer = (await editor.readPrayer())!;
  const moved = { id: 1 as const, latitude: 12.0031, longitude: -61.7719 };
  assert.deepEqual(await editor.saveMusallahPin(moved, loaded.version), {
    ok: true,
  });
  assert.deepEqual(await editor.saveMusallahPin(moved, loaded.version), {
    ok: false,
    reason: "conflict",
  });
  assert.deepEqual((await places.musallahEntrance()).place, {
    latitude: 12.0031,
    longitude: -61.7719,
  });
  // Separate rows and versions (D-4): the prayer save loaded before the move still saves.
  assert.deepEqual(
    await editor.savePrayerSettings(
      { ...prayer.settings, notice: "Moved pin" },
      prayer.version,
    ),
    { ok: true },
  );
  const [entry] = sandboxStore(own).activity.filter(
    (row) => row.area === "musallah_location",
  );
  assert.deepEqual(
    [
      entry.action,
      entry.highlight,
      entry.before?.latitude,
      entry.after?.latitude,
    ],
    ["updated", false, demoMusallahPin.latitude, 12.0031],
  );
});

test("sample removeFile: any admin, not only manage people, deletes an unused file (D-23)", async () => {
  const own = new Date("2031-01-01T12:00:00Z");
  const store = sandboxStore(own);
  store.admins.get(demoAdmin.userId)!.can_manage_people = false;
  const editor = createSampleContentEditor(own);
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#204060" },
  })
    .png()
    .toBuffer();
  const name = (await editor.upload(
    "image",
    new File([new Uint8Array(png)], "unused.png", { type: "image/png" }),
  ))!;
  assert.ok(store.media.has(name));
  assert.deepEqual(await editor.removeFile(name), { ok: true });
  assert.equal(store.media.has(name), false);
});

test("sample adapters share one store: a second instance sees the first one's edits", async () => {
  const id = randomUUID();
  await createSampleContentEditor(seed).saveRecord(
    "events",
    recordSchema.parse({ id, title: "Shared", date: localDate(seed) }),
    null,
  );
  assert.ok(
    (await createSampleContentEditor(seed).readRecord("events", id)).record,
  );
});

// The sandbox accepts only admin/admin (cleanup-outdated D-3); the live site
// rejects that username before any network call.
for (const [email, password] of [
  ["admin", "wrong"],
  ["wrong", "admin"],
  ["someone@example.invalid", "anything"],
]) {
  test(`sample AdminAuth rejects ${email} / ${password}`, async () => {
    const auth = createSampleAdminAuth(seed);
    assert.equal(await auth.signIn({ email, password }), "invalid");
  });
}

test("sample AdminAuth sends no email and stores no password", async () => {
  const auth = createSampleAdminAuth(seed);
  assert.deepEqual(
    await auth.requestPasswordReset("anyone@example.invalid", "http://x"),
    { ok: true, delivery: "sandbox" },
  );
  // No link is ever sent in the sandbox, so none is valid.
  assert.equal(await auth.verifyEmailLink("token", "invite"), "expired");
  assert.equal(await auth.verifyEmailLink("token", "recovery"), "expired");
  assert.equal(await auth.setPassword("short"), "weak");
});

test("Supabase AdminAuth refuses a weak password without a network call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network call");
  });
  assert.equal(await supabaseAdminAuth.setPassword("password"), "weak");
  assert.equal(fetch.mock.callCount(), 0);
});

test("Supabase AdminAuth rejects admin / admin without a network call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network call");
  });
  assert.equal(
    await supabaseAdminAuth.signIn({ email: "admin", password: "admin" }),
    "invalid",
  );
  assert.equal(fetch.mock.callCount(), 0);
});

// Review 2 (2026-10-05): a refused save keeps what was typed and shows each
// problem on its own box, with one short line at the top.
test("problemsOf: one problem per box, keyed by the box's path", () => {
  const schema = z
    .object({
      a: z.string().min(1, "A: add it."),
      b: z.string(),
      list: z.array(z.object({ c: z.string().min(1, "C: fill in.") })),
    })
    .superRefine((_, ctx) => {
      ctx.addIssue({ code: "custom", message: "B: wrong.", path: ["b"] });
      ctx.addIssue({ code: "custom", message: "A: again.", path: ["a"] });
      ctx.addIssue({ code: "custom", message: "Other.", path: [] });
    });
  const error = schema.safeParse({ a: "", b: "", list: [{ c: "" }] }).error!;
  assert.deepEqual(problemsOf(error), {
    a: "A: add it.",
    "list.0.c": "C: fill in.",
    b: "B: wrong.",
    "": "Other.",
  });
  assert.deepEqual(problemsOf(error, { b: "b_box" }).b_box, "B: wrong.");
  assert.equal(boxesNeedFixing, "Some boxes need fixing.");
  // The Pages Preview still lists what a save would refuse.
  assert.equal(fixBeforeSaving(1), "Please fix 1 thing before saving:");
});

test("boxReason: the line under a box drops the box's own name", () => {
  assert.equal(boxReason("Event name: fill in this box."), "Fill in this box.");
  assert.equal(
    boxReason(
      "Sign-up link: use a secure web address (starting with https://).",
    ),
    "Use a secure web address (starting with https://).",
  );
  assert.equal(
    boxReason("Also post an announcement?: choose Yes or No."),
    "Choose Yes or No.",
  );
  assert.equal(boxReason("Name is required."), "Name is required.");
  assert.equal(
    boxReason("Paste the Go2Pay page link, for example go2pay.gd/557."),
    "Paste the Go2Pay page link, for example go2pay.gd/557.",
  );
});

test("recordFormSchema: a refused event save returns all its problems, named, in form order", () => {
  const parsed = formSchema("events", {
    image: true,
    file: false,
  }).safeParse({
    id: randomUUID(),
    title: "",
    date: "2026-10-20",
    start_time: "13:00",
    // On its start day an event ends after it starts (review 2).
    end_time: "13:00",
    url: "http://example.com",
    image_path: `${randomUUID()}.webp`,
    published: true,
  });
  assert.equal(parsed.success, false);
  assert.deepEqual(problemsOf(parsed.error!), {
    title: "Event name: fill in this box.",
    end_time: "End time: choose a time after the start time.",
    // The stored picture and the newly chosen one ask once.
    image_alt:
      "Describe the picture: write one sentence about the picture for people who cannot see it.",
    location: "Place: add where it happens, or save as a draft.",
    url: "Sign-up link: use a secure web address (starting with https://).",
  });
});

test("recordFormSchema: a link that is not a web address is refused, not thrown", () => {
  for (const url of ["notaurl", "https://exa mple", "http://"]) {
    const parsed = formSchema("announcements", {
      image: false,
      file: false,
    }).safeParse({
      id: randomUUID(),
      title: "Notice",
      date: "2026-10-20",
      url,
    });
    assert.deepEqual(
      problemsOf(parsed.error!),
      { url: "Link: use a secure web address (starting with https://)." },
      url,
    );
  }
});

test("contentFieldNames: a refused save names the boxes each form shows (Q57)", () => {
  assert.equal(contentFieldNames("events").title, "Event name");
  assert.equal(contentFieldNames("events").date, "Start date");
  assert.equal(contentFieldNames("events").end_date, "End date");
  assert.equal(contentFieldNames("events").end_time, "End time");
  assert.equal(contentFieldNames("announcements").date, "Show from");
  assert.equal(contentFieldNames("announcements").expires_on, "Hide after");
  assert.equal(contentFieldNames("newsletters").title, "Issue name");
  assert.equal(contentFieldNames("newsletters").url, "The newsletter");
  // A field the form does not show keeps its plain name.
  assert.equal(contentFieldNames("events").summary, "Summary");
  const announcement = formSchema("announcements", {
    image: false,
    file: false,
  }).safeParse({ id: randomUUID(), title: "", date: "2026-10-20" });
  assert.deepEqual(problemsOf(announcement.error!), {
    title: "Headline: fill in this box.",
  });
  // Every message of a shown box starts with that box's label.
  for (const kind of [
    "events",
    "announcements",
    "news_posts",
    "newsletters",
  ] as const) {
    const names = contentFieldNames(kind);
    for (const field of contentFieldList(kind))
      if (field.name in names)
        assert.ok(
          field.label.startsWith(names[field.name as keyof typeof names]),
          `${kind}.${field.name}`,
        );
  }
});

test("recordFormSchema: kind and chosen-file rules", () => {
  const base = { id: randomUUID(), title: "Issue 1", date: "2026-10-20" };
  const newsletter = (chosen: boolean, changes = {}) =>
    formSchema("newsletters", { image: false, file: chosen }).safeParse({
      ...base,
      ...changes,
    });
  assert.deepEqual(
    newsletter(false).error?.issues.map((issue) => issue.message),
    ["The newsletter: choose a PDF or an image, or add a link."],
  );
  assert.equal(newsletter(true).success, true);
  assert.equal(newsletter(false, { url: "https://example.com" }).success, true);
  // A draft event needs no start time or place; other kinds never do.
  assert.equal(
    formSchema("events", { image: false, file: false }).safeParse(base).success,
    true,
  );
  assert.equal(
    formSchema("announcements", { image: false, file: false }).safeParse({
      ...base,
      published: true,
    }).success,
    true,
  );
});

test("keepTyped: a refusal keeps the typed text, not files, and re-mounts the form", () => {
  const form = new FormData();
  form.set("title", "Typed title");
  form.set("image", new File(["x"], "photo.png"));
  const values = typedValues(form);
  assert.deepEqual(values, { title: "Typed title" });
  const first = keepTyped(initialKeptForm, values)("Refused.");
  // People refusals keep their exact PR3 shape (no issues key).
  assert.deepEqual(first, {
    error: "Refused.",
    notice: null,
    values,
    attempt: 1,
  });
  assert.deepEqual(
    keepTyped(first, values)(null, { title: "Title: add a title." }),
    {
      error: null,
      notice: null,
      fields: { title: "Title: add a title." },
      values,
      attempt: 2,
    },
  );
});

test("recordFromTyped: a checkbox is ticked only when posted as on", () => {
  assert.deepEqual(recordFromTyped({ title: "T", published: "on" }), {
    title: "T",
    published: true,
    featured: false,
  });
});

test("contentFields: each kind shows only the approved boxes (PR4 D-7)", () => {
  const names = (kind: Parameters<typeof contentFieldList>[0]) =>
    contentFieldList(kind).map((field) => field.name);
  assert.deepEqual(names("events"), [
    "title",
    // Review 2: Starts (date, optional time) and Ends (both optional).
    "date",
    "start_time",
    "end_date",
    "end_time",
    "location",
    // Review fixes P3: a category and a term from the Lists.
    "category_id",
    "term_id",
    "body",
    "image",
    "image_alt",
    "url",
    // PR6 WP-9: the event's ticket.
    "ticket_payment_item_id",
    "season_id",
    // PR5a: "Is it still happening?" (status and reason).
    "status",
  ]);
  assert.deepEqual(names("announcements"), [
    "title",
    "summary",
    "body",
    // PR5a: "How important is it?" (priority with Show from, Hide after or Hide at).
    "priority",
    "image",
    "image_alt",
    "url",
  ]);
  assert.deepEqual(names("news_posts"), [
    "title",
    "summary",
    "body",
    "date",
    "image",
    "image_alt",
    "url",
    "featured",
    "expires_on",
  ]);
  assert.deepEqual(names("newsletters"), ["title", "date", "summary", "file"]);
  // Removed boxes keep their stored value in hidden inputs; each PR5a field
  // is edited by its own kind's box and kept hidden by the other kinds.
  const status = ["status", "status_note"];
  assert.deepEqual(hiddenContentFields("events"), [
    "summary",
    "expires_on",
    "featured",
    "urgent_until",
  ]);
  assert.deepEqual(hiddenContentFields("announcements"), [
    "start_time",
    "end_date",
    "end_time",
    "location",
    ...status,
    "ticket_payment_item_id",
    "season_id",
    "category_id",
    "term_id",
  ]);
  assert.deepEqual(hiddenContentFields("newsletters"), [
    "body",
    "expires_on",
    "start_time",
    "end_date",
    "end_time",
    "location",
    "image_alt",
    "featured",
    "urgent_until",
    ...status,
    "ticket_payment_item_id",
    "season_id",
    "category_id",
    "term_id",
  ]);
});

test("event dates: no start time is all day; the end comes after the start (review 2)", () => {
  const event = (changes: Partial<Record<string, unknown>>) =>
    formSchema("events", { image: false, file: false }).safeParse({
      id: randomUUID(),
      title: "Welcome dinner",
      date: "2026-10-20",
      location: "Charter Hall",
      published: true,
      ...changes,
    });
  // A published event needs no start time any more: it is all day.
  assert.equal(event({}).success, true);
  assert.equal(event({ end_date: "2026-10-22" }).success, true);
  // Over two days the end time may be earlier than the start time.
  assert.equal(
    event({ start_time: "22:00", end_date: "2026-10-21", end_time: "03:00" })
      .success,
    true,
  );
  const refused = (changes: Partial<Record<string, unknown>>) =>
    problemsOf(event(changes).error!);
  assert.deepEqual(refused({ end_date: "2026-10-19" }), {
    end_date: "End date: choose the start date or a later one.",
  });
  assert.deepEqual(refused({ start_time: "22:00", end_time: "03:00" }), {
    end_time: "End time: choose a time after the start time.",
  });
  assert.deepEqual(refused({ end_time: "18:00" }), {
    end_time: "End time: add a start time first.",
  });
});

test("contentFormRecord: an event's short summary moves into an empty description", () => {
  const event = recordSchema.parse({
    id: randomUUID(),
    title: "Dinner",
    date: "2026-10-20",
    summary: "Meet the board.",
  });
  assert.deepEqual(
    { ...contentFormRecord("events", event) },
    { ...event, body: "Meet the board.", summary: "" },
  );
  // A description already shown to visitors stays; other kinds keep the summary.
  const both = { ...event, body: "Full text." };
  assert.equal(contentFormRecord("events", both).body, "Full text.");
  assert.equal(contentFormRecord("announcements", event), event);
});

test("contentFormRecord: an old Hide after date is emptied only where the form has no box for it (D-15)", () => {
  const item = recordSchema.parse({
    id: randomUUID(),
    title: "Old item",
    date: "2026-09-01",
    expires_on: "2026-09-05",
  });
  assert.equal(contentFormRecord("events", item).expires_on, "");
  assert.equal(contentFormRecord("newsletters", item).expires_on, "");
  // Announcements and community news show the box, so the date stays.
  assert.equal(
    contentFormRecord("announcements", item).expires_on,
    "2026-09-05",
  );
  assert.equal(contentFormRecord("news_posts", item).expires_on, "2026-09-05");
});

/**
 * The text a content form posts for a stored item, before the board types
 * anything: every item field, shown or hidden, as `ContentEditor` fills it
 * from `contentFormRecord`.
 */
function postedValues(kind: "events" | "newsletters", stored: CommunityRecord) {
  return Object.fromEntries(
    Object.entries(contentFormRecord(kind, stored)).map(([name, value]) => [
      name,
      typeof value === "boolean" ? (value ? "on" : "off") : String(value ?? ""),
    ]),
  );
}

for (const [kind, stored, typed] of [
  [
    "events",
    // Moving the event past its old hidden date used to refuse the save.
    {
      title: "Old event with a hidden date",
      date: "2026-09-12",
      expires_on: "2026-09-13",
      start_time: "17:00",
      location: "Example venue",
    },
    { date: "2026-09-20" },
  ],
  [
    "newsletters",
    // A past hidden date used to take the issue out of the archive.
    {
      title: "Old issue with a hidden date",
      date: "2026-09-01",
      expires_on: "2026-09-05",
      url: "https://example.com/issue.pdf",
    },
    { title: "Old issue, renamed" },
  ],
] as const) {
  test(`sandbox: saving an old ${kind} item from its form clears its hidden Hide after date (D-15)`, async () => {
    const editor = createSampleContentEditor(seed);
    const reader = createMockContentProvider(seed);
    const id = randomUUID();
    const row = recordSchema.parse({ id, published: true, ...stored });
    assert.deepEqual(await editor.saveRecord(kind, row, null), { ok: true });
    const loaded = (await editor.readRecord(kind, id)).record!;
    const values: Record<string, string> = {
      ...postedValues(kind, loaded),
      ...typed,
    };
    assert.equal(values.expires_on, "");
    // Before D-15 the form posted the stored date back.
    const before = formSchema(kind, {
      image: false,
      file: false,
    }).safeParse(recordFromTyped({ ...values, expires_on: row.expires_on }));
    assert.ok(
      !before.success || !isVisible(before.data as CommunityRecord, kind, seed),
      "the old date refused the save or hid the item",
    );
    const parsed = formSchema(kind, { image: false, file: false }).parse(
      recordFromTyped(values),
    );
    assert.deepEqual(
      await editor.saveRecord(kind, parsed, loaded.updated_at ?? null),
      { ok: true },
    );
    assert.equal((await editor.readRecord(kind, id)).record?.expires_on, "");
    const shown = (await reader.getRecords(kind)).records.find(
      (record) => record.id === id,
    );
    assert.ok(shown && isVisible(shown, kind, seed), "visitors see it");
  });
}
