import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { zipStream, type ZipEntry } from "../src/lib/media/zip";
import { csvFile } from "../src/lib/csv";
import { recordSchema } from "../src/lib/community/schema";
import { personSchema, sectionSchema } from "../src/lib/community/people";
import { paymentItemSchema } from "../src/lib/community/payments";
import type { ListName } from "../src/lib/community/lists";
import {
  missingFilesSheet,
  safeName,
  termContents,
  termFolder,
  zipFileName,
  type TermData,
} from "../src/features/admin/term-export/term-contents";
import {
  termExportSchema,
  termRangeSchema,
} from "../src/features/admin/term-export/term-form";
import {
  downloadStarted,
  downloadToken,
  newDownloadToken,
} from "../src/features/admin/term-export/download-mark";
import { createSampleContentEditor } from "../src/lib/backend/providers/sample";
import { createSupabaseContentEditor } from "../src/lib/backend/providers/supabase";
import { sandboxStore } from "../src/lib/demo/store";
import { demoAdmin } from "../src/lib/demo/fixtures";
import { systemText } from "../src/lib/system-text";
import { unzip } from "./support/unzip";

// Term export (review fixes P5): the zip, its folders and spreadsheets, and
// the sandbox's "Free up space".

async function zipOf(entries: ZipEntry[]) {
  async function* list() {
    yield* entries;
  }
  return Buffer.from(await new Response(zipStream(list())).arrayBuffer());
}

const when = new Date("2026-12-20T15:30:00Z");
const bytes = (text: string) => new TextEncoder().encode(text);

test("the zip opens with its folders, compressed spreadsheets and stored photos", async () => {
  const photo = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
  const sheet = "Title,Date\r\n" + "Iftar,2026-03-01\r\n".repeat(200);
  const zip = await zipOf([
    {
      path: "2026/Fall/Events.csv",
      data: bytes(sheet),
      modified: when,
      compress: true,
    },
    {
      path: "2026/Fall/Events/2026-09-12 Eid – ‘Īd.webp",
      data: photo,
      modified: when,
    },
    {
      path: "2026/Fall/Empty.csv",
      data: new Uint8Array(),
      modified: when,
      compress: true,
    },
  ]);
  const entries = unzip(zip);
  assert.deepEqual(
    entries.map((entry) => entry.path),
    [
      "2026/Fall/Events.csv",
      "2026/Fall/Events/2026-09-12 Eid – ‘Īd.webp",
      "2026/Fall/Empty.csv",
    ],
  );
  assert.equal(entries[0].data.toString("utf8"), sheet);
  assert.deepEqual(new Uint8Array(entries[1].data), photo);
  assert.equal(entries[2].data.length, 0);
  // The spreadsheet is deflated; the photo is stored as it is.
  assert.ok(zip.length < sheet.length + photo.length);
  // Names are UTF-8 (flag bit 11) and dated in Grenada time (11:30 AM).
  assert.equal(zip.readUInt16LE(6) & 0x0800, 0x0800);
  assert.equal(zip.readUInt16LE(10) >> 11, 11);
});

test("a zip with two entries of one name, or a file that fails, fails the download", async () => {
  await assert.rejects(
    zipOf([
      { path: "a.csv", data: bytes("x"), modified: when },
      { path: "a.csv", data: bytes("y"), modified: when },
    ]),
  );
  async function* failing(): AsyncGenerator<ZipEntry> {
    yield { path: "a.csv", data: bytes("x"), modified: when };
    throw new Error("A file could not be read.");
  }
  await assert.rejects(new Response(zipStream(failing())).arrayBuffer());
});

test("folders are Year/Term from the From day and the name; names are safe on every computer", () => {
  assert.equal(
    termFolder({ name: "2026 Fall", from: "2026-08-24" }),
    "2026/Fall",
  );
  assert.equal(
    termFolder({ name: "Fall 2026", from: "2026-08-24" }),
    "2026/Fall",
  );
  assert.equal(
    termFolder({ name: "Term 1", from: "2027-01-04" }),
    "2027/Term 1",
  );
  assert.equal(termFolder({ name: "2026", from: "2026-01-04" }), "2026/2026");
  assert.equal(
    termFolder({ name: "Spring 2025", from: "2026-01-04" }),
    "2026/Spring 2025",
  );
  assert.equal(
    termFolder({ name: "A/B: C?", from: "2026-01-04" }),
    "2026/A-B- C-",
  );
  assert.equal(zipFileName({ name: "2026 Fall" }), "2026 Fall.zip");
  assert.equal(safeName(" ..  "), "Untitled");
  assert.equal(safeName("x".repeat(200)).length, 80);
});

test("the form rules: a name, two real days, To not before From, in plain words", () => {
  assert.equal(
    termExportSchema.safeParse({
      name: " 2026 Fall ",
      from: "2026-08-24",
      until: "2026-12-18",
    }).data?.name,
    "2026 Fall",
  );
  const refused = termExportSchema.safeParse({
    name: "",
    from: "2026-08-24",
    until: "2026-08-23",
  });
  assert.deepEqual(
    refused.error?.issues.map((issue) => issue.message),
    [
      "Name of the term: fill in this box.",
      "To: choose the From day or a later one.",
    ],
  );
  assert.equal(
    termRangeSchema.safeParse({ from: "2026-02-30", until: "2026-03-01" }).error
      ?.issues[0].message,
    "From: choose a valid date.",
  );
});

test("the download mark: a token of letters and digits, found only in its own cookie", () => {
  const token = newDownloadToken();
  assert.equal(downloadToken(token), token);
  assert.equal(downloadToken("x; Path=/"), null);
  assert.equal(
    downloadStarted(`a=1; term-export-started=${token}`, token),
    true,
  );
  assert.equal(downloadStarted("term-export-started=other", token), false);
});

const record = (fields: Record<string, unknown>) => ({
  ...recordSchema.parse({ id: randomUUID(), ...fields }),
  id: randomUUID(),
  archived_at: null as string | null,
});
const photoName = () => `${randomUUID()}.webp`;
const pdfName = () => `${randomUUID()}.pdf`;

test("termContents: six spreadsheets, rows in plain words, and each file once under a readable name", () => {
  const shared = photoName();
  const pdf = pdfName();
  const executive = sectionSchema.parse({
    id: randomUUID(),
    name: "Executive board",
    position: 1,
    kind: "executive",
  });
  const season = randomUUID();
  const option = (list: ListName, name: string, slug: string) => ({
    id: randomUUID(),
    list,
    name,
    slug,
    position: 1,
  });
  const social = option("event_categories", "Social", "social");
  const fall = option("terms", "2026 Fall", "2026-fall");
  const data: TermData = {
    records: {
      events: [
        {
          ...record({
            title: "Welcome dinner",
            date: "2026-09-12",
            start_time: "18:30",
            end_time: "21:00",
            location: "Musallah",
            image_path: shared,
            image_alt: "Students at dinner",
            published: true,
            season_id: season,
            category_id: social.id,
            term_id: fall.id,
          }),
          archived_at: "2026-10-02T03:00:00Z",
        },
        record({
          title: "Welcome dinner",
          date: "2026-09-12",
          image_path: photoName(),
          image_alt: "Second",
        }),
      ],
      news_posts: [
        record({
          title: "=SUM(1,2)",
          date: "2026-09-20",
          image_path: shared,
          image_alt: "Same photo",
        }),
      ],
      newsletters: [
        record({ title: "Fall issue", date: "2026-10-01", file_path: pdf }),
      ],
    },
    seasons: new Map([[season, "Ramadan"]]),
    people: [
      {
        ...personSchema.parse({
          id: randomUUID(),
          full_name: "Sara Malik",
          role_title: "President",
          section_id: executive.id,
          position: 1,
          show_on_public: true,
          photo_path: photoName(),
        }),
        archived_at: null,
      },
    ],
    sections: [{ ...executive, archived_at: null }],
    paymentItems: [
      {
        ...paymentItemSchema.parse({
          id: randomUUID(),
          slug: "iftar",
          name: "Iftar",
          kind: "fund",
          category: "sadaqah",
          about: "Meals",
          listed: true,
          position: 1,
        }),
        archived_at: null,
      },
    ],
    links: [],
    resources: [
      {
        id: "r1",
        title: "Prayer guide",
        category: "guide",
        description: "How to pray",
        resource_url: "https://example.org/guide",
        archived: false,
      },
    ],
    lists: {
      event_categories: [social],
      terms: [fall],
      resource_categories: [option("resource_categories", "Guide", "guide")],
    },
  };
  const { sheets, files } = termContents(data);
  assert.deepEqual(
    sheets.map((sheet) => sheet.path),
    [
      "Events.csv",
      "Community news.csv",
      "Newsletters.csv",
      "People.csv",
      "Funds.csv",
      "Resources.csv",
    ],
  );
  assert.deepEqual(
    files.map((file) => file.path),
    [
      "Events/2026-09-12 Welcome dinner.webp",
      "Events/2026-09-12 Welcome dinner (2).webp",
      "Newsletters/2026-10-01 Fall issue.pdf",
      "People/Sara Malik.webp",
    ],
  );
  const events = sheets[0].text;
  assert.ok(
    events.startsWith(
      "﻿Title,Date,End date,Start time,End time,Place,Status,Reason,Season,Category,Term,",
    ),
  );
  const first = events.split("\r\n")[1];
  assert.match(
    first,
    /^Welcome dinner,2026-09-12,,6:30\sPM,9:00\sPM,Musallah,Scheduled,,Ramadan,Social,2026 Fall,/,
  );
  // An event with no category or term leaves both cells empty.
  assert.match(
    events.split("\r\n")[2],
    /^Welcome dinner,2026-09-12,,,,,Scheduled,,,,,/,
  );
  assert.match(
    first,
    /,Yes,,2026-10-01,Events\/2026-09-12 Welcome dinner\.webp,Students at dinner,$/,
  );
  // The photo already in the zip is named, not copied again; formulas stay text.
  assert.match(
    sheets[1].text,
    /^﻿Title[^\r]*\r\n"'=SUM\(1,2\)",2026-09-20,.*,Events\/2026-09-12 Welcome dinner\.webp,Same photo,\r\n$/,
  );
  assert.match(
    sheets[3].text,
    /Sara Malik,Executive board,President,Yes,,People\/Sara Malik\.webp/,
  );
  assert.match(sheets[4].text, /Iftar,Fund,Sadaqah,Meals,Yes,,,,,/);
  assert.match(
    sheets[5].text,
    /Prayer guide,Guide,How to pray,https:\/\/example\.org\/guide,,No,/,
  );
  assert.equal(
    missingFilesSheet(["Events/a.webp"]).text,
    csvFile(["File"], [["Events/a.webp"]], { bom: true }),
  );
});

test("sample Free up space: managers only; clears archived items in the days, keeps what others use, logs each change", async () => {
  const own = new Date("2033-05-01T12:00:00Z");
  const store = sandboxStore(own);
  const editor = createSampleContentEditor(own);
  const files = [photoName(), pdfName(), photoName(), photoName()];
  for (const name of files)
    store.media.set(name, {
      bytes: new Uint8Array([1]),
      contentType: "image/webp",
      uploadedAt: own.toISOString(),
    });
  const add = (
    kind: "events" | "news_posts",
    fields: Record<string, unknown>,
    archived: boolean,
  ) => {
    const row = {
      ...recordSchema.parse({ id: randomUUID(), ...fields }),
      updated_at: randomUUID(),
      archived_at: archived ? own.toISOString() : null,
    };
    store.records[kind].set(row.id, row);
    return row.id;
  };
  const gone = add(
    "events",
    {
      title: "Old",
      date: "2026-09-10",
      image_path: files[0],
      image_alt: "Old",
      file_path: files[1],
    },
    true,
  );
  const shared = add(
    "news_posts",
    {
      title: "Shared",
      date: "2026-09-11",
      image_path: files[2],
      image_alt: "Shared",
    },
    true,
  );
  add(
    "events",
    {
      title: "Current",
      date: "2026-09-12",
      image_path: files[2],
      image_alt: "Shared",
    },
    false,
  );
  const outside = add(
    "events",
    {
      title: "Later",
      date: "2027-01-10",
      image_path: files[3],
      image_alt: "Later",
    },
    true,
  );
  const range = { from: "2026-08-01", until: "2026-12-31" };

  const dated = await editor.listRecordsDated("events", range);
  assert.deepEqual(
    dated.records.map((row) => row.title),
    ["Old", "Current"],
  );

  store.admins.get(demoAdmin.userId)!.can_manage_people = false;
  assert.deepEqual(await editor.releaseArchivedFiles(range), {
    ok: false,
    reason: "forbidden",
  });
  assert.equal(store.records.events.get(gone)!.image_path, files[0]);

  store.admins.get(demoAdmin.userId)!.can_manage_people = true;
  const released = await editor.releaseArchivedFiles(range);
  assert.deepEqual(released, { ok: true, files: [files[0], files[1]].sort() });
  const cleared = store.records.events.get(gone)!;
  assert.deepEqual(
    [
      cleared.image_path,
      cleared.file_path,
      cleared.title,
      Boolean(cleared.archived_at),
    ],
    ["", "", "Old", true],
  );
  // The shared photo stays, and so does its link on the archived item.
  assert.equal(store.records.news_posts.get(shared)!.image_path, files[2]);
  assert.equal(store.records.events.get(outside)!.image_path, files[3]);
  assert.equal(
    store.activity.filter((row) => row.action === "updated").length,
    1,
  );
  for (const name of released.ok ? released.files : [])
    await editor.removeFile(name);
  assert.deepEqual([...store.media.keys()].sort(), [files[2], files[3]].sort());
});

test("Supabase adapter: Free up space maps the database's refusal; a gone file is missing, a failed read fails the zip", async () => {
  const answers: Record<string, { data: unknown; error: unknown }> = {
    forbidden: { data: null, error: { code: "42501" } },
    down: { data: null, error: { code: "08006" } },
    ok: { data: [`${"a".repeat(36)}.webp`], error: null },
  };
  let answer = answers.forbidden;
  const downloads: Record<string, { data: Blob | null; error: unknown }> = {
    "here.webp": { data: new Blob(["x"]), error: null },
    "gone.webp": { data: null, error: { status: 400 } },
    "broken.webp": { data: null, error: { status: 500 } },
  };
  const client = {
    rpc: async () => answer,
    storage: {
      from: () => ({ download: async (name: string) => downloads[name] }),
    },
  };
  const editor = createSupabaseContentEditor(
    { now: () => when },
    (async () => client) as never,
  );
  const range = { from: "2026-08-01", until: "2026-12-31" };
  assert.deepEqual(await editor.releaseArchivedFiles(range), {
    ok: false,
    reason: "forbidden",
  });
  answer = answers.down;
  assert.deepEqual(await editor.releaseArchivedFiles(range), {
    ok: false,
    reason: "unavailable",
  });
  answer = answers.ok;
  assert.deepEqual(await editor.releaseArchivedFiles(range), {
    ok: true,
    files: [`${"a".repeat(36)}.webp`],
  });
  const read = async (names: string[]) => {
    const found: (string | null)[] = [];
    for await (const { file } of editor.readFiles(names))
      found.push(file ? await file.text() : null);
    return found;
  };
  assert.deepEqual(await read(["here.webp", "gone.webp"]), ["x", null]);
  await assert.rejects(read(["here.webp", "broken.webp"]));
});

test("Free up space: the server removes nothing until “I opened the zip and can see the photos” is ticked", () => {
  // The action reads the site configuration when loaded and the sign-in
  // through `next/headers`: run it in a fresh sandbox Node process with a
  // stand-in for the cookies (as tests/remove-login.test.ts does).
  const script = `
    const headers = require.resolve("next/headers");
    const { sandboxStore } = require("./src/lib/demo/store.ts");
    const { recordSchema } = require("./src/lib/community/schema.ts");
    const store = sandboxStore(new Date(process.env.SITE_DEMO_DATE));
    const session = { get: () => ({ value: store.session }) };
    require.cache[headers] = {
      id: headers, filename: headers, loaded: true,
      exports: { cookies: async () => session, headers: async () => new Headers() },
    };
    const { freeUpSpaceAction } = require("./src/features/admin/term-export/term-export-actions.ts");
    const photo = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";
    store.media.set(photo, {
      bytes: new Uint8Array([1]), contentType: "image/webp",
      uploadedAt: "2026-10-01T12:00:00.000Z",
    });
    const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    store.records.news_posts.set(id, {
      ...recordSchema.parse({ id, title: "Old", date: "2031-03-03", image_path: photo, image_alt: "Old" }),
      updated_at: "2026-10-01T12:00:00.000Z",
      archived_at: "2026-10-01T12:00:00.000Z",
    });
    const days = { from: "2031-03-01", until: "2031-03-31" };
    (async () => {
      const results = [];
      for (const opened of [false, "yes", true]) {
        const result = await freeUpSpaceAction({ ...days, opened });
        results.push({
          ok: result.ok,
          error: result.ok ? null : result.error,
          kept: store.media.has(photo) && store.records.news_posts.get(id).image_path === photo,
        });
      }
      process.stdout.write(JSON.stringify(results));
    })();`;
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      script,
    ],
    {
      env: {
        PATH: process.env.PATH ?? "",
        NODE_ENV: "development",
        SITE_URL: "http://localhost:3000",
        SITE_DEMO_MODE: "true",
        SITE_DEMO_DATE: "2026-10-08T14:00:00Z",
        CRON_SECRET: "off",
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  const refusal = {
    ok: false,
    error: systemText.termExport.openFirst,
    kept: true,
  };
  assert.deepEqual(JSON.parse(run.stdout), [
    refusal,
    refusal,
    { ok: true, error: null, kept: false },
  ]);
});
