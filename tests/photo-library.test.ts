import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileUses } from "../src/features/admin/photos/photo-uses";
import { collections } from "../src/lib/community/schema";
import {
  sizeLabel,
  STORAGE_LIMIT_BYTES,
  storageLevel,
  storagePercent,
} from "../src/lib/media/storage-space";

// The photo library (2026-10-06): the space rule and where each file is used.
const photo = (n: number) =>
  `${String(n).repeat(8)}-1111-4111-8111-111111111111.webp`;

test("space: whole percent of the free 1 GB, warnings at 80% and 95%", () => {
  assert.equal(STORAGE_LIMIT_BYTES, 1_000_000_000);
  assert.equal(storagePercent(0), 0);
  assert.equal(storagePercent(12_400_000), 1);
  assert.equal(storageLevel(799_999_999), null);
  assert.equal(storageLevel(800_000_000), 80);
  assert.equal(storageLevel(949_999_999), 80);
  assert.equal(storageLevel(950_000_000), 95);
  assert.equal(storageLevel(1_200_000_000), 95);
  assert.equal(sizeLabel(0), "0 KB");
  assert.equal(sizeLabel(245_300), "245 KB");
  assert.equal(sizeLabel(1_240_000), "1.2 MB");
  assert.equal(sizeLabel(812_000_000), "812 MB");
  assert.equal(sizeLabel(1_000_000_000), "1.00 GB");
});

test("fileUses: items, people and page texts, archived ones marked, each place once", () => {
  const uses = fileUses({
    records: [
      {
        kind: "events",
        id: "e1",
        title: "Iftar night",
        image_path: photo(1),
        file_path: "",
        archived_at: null,
      },
      {
        kind: "newsletters",
        id: "n1",
        title: "Spring newsletter",
        image_path: photo(1),
        file_path: photo(2).replace(".webp", ".pdf"),
        archived_at: "2026-10-01T00:00:00Z",
      },
    ],
    people: [
      {
        id: "p1",
        full_name: "Omar Haddad",
        photo_path: photo(3),
        archived_at: null,
      },
      { id: "p2", full_name: "No photo", photo_path: null, archived_at: null },
    ],
    pages: [
      {
        key: "home",
        document: {
          hero: { image: { src: `/media/${photo(1)}` } },
          features: [
            { image: { src: `/media/${photo(1)}` } },
            { image: { src: "/images/home/hero-campus-dusk.webp" } },
          ],
        },
      },
    ],
    seasons: [
      {
        id: "s1",
        name: "Ramadan",
        photos: [{ src: `/media/${photo(7)}`, alt: "Iftar" }],
        archived_at: null,
      },
    ],
    merchItems: [
      {
        id: "m1",
        name: "Shukr long-sleeve",
        photos: [
          { src: `/media/${photo(7)}`, alt: "Front" },
          { src: "/images/merch/shukr-long-sleeve.webp", alt: "Back" },
        ],
        archived_at: "2026-10-02T00:00:00Z",
      },
    ],
  });
  assert.deepEqual(uses.get(photo(1)), [
    { label: "Event: Iftar night", href: "/admin/content/events/e1" },
    {
      label: "Newsletter: Spring newsletter (archived)",
      href: "/admin/content/newsletters/n1",
    },
    { label: "Page: Home", href: "/admin/pages/home" },
  ]);
  assert.deepEqual(uses.get(photo(2).replace(".webp", ".pdf")), [
    {
      label: "Newsletter: Spring newsletter (archived)",
      href: "/admin/content/newsletters/n1",
    },
  ]);
  assert.deepEqual(uses.get(photo(3)), [
    { label: "People: Omar Haddad", href: "/admin/people/p1" },
  ]);
  assert.deepEqual(uses.get(photo(7)), [
    { label: "Season page: Ramadan", href: "/admin/seasons/s1" },
    {
      label: "Merch item: Shukr long-sleeve (archived)",
      href: "/admin/merch/items/m1",
    },
  ]);
  assert.equal(uses.has(photo(4)), false, "unused files are not listed");
  assert.equal(uses.size, 4, "starter images are not uploads");
});

/**
 * The "where is this file used" rule lives in three places: the storage
 * rule `community_file_in_use()` (the real guard), the Photos screen's
 * `fileUses` and the sandbox's `sandboxFileInUse`. This reads the newest
 * SQL definition and fails when it checks a column the other two miss, so a
 * new photo box never shows as "Not used anywhere" with a Delete that the
 * server then refuses.
 */
test("fileUses and the sandbox cover every column community_file_in_use() checks", () => {
  const dir = join(process.cwd(), "supabase/migrations");
  const definitions = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) =>
      [
        ...readFileSync(join(dir, name), "utf8").matchAll(
          /function public\.community_file_in_use\(file_name text\)[\s\S]*?\$\$([\s\S]*?)\$\$/g,
        ),
      ].map((match) => match[1]),
    );
  const body = definitions.at(-1);
  assert.ok(body, "community_file_in_use() is defined in a migration");
  const checked = [
    ...body.matchAll(/from public\.(\w+) where (.*?file_name\)?)(?:\)\n|\);)/g),
  ].map(([, table, where]) => ({
    table,
    columns: [
      ...where.matchAll(/(\w+) = file_name/g),
      ...where.matchAll(/page_text_names_file\((\w+), file_name\)/g),
    ]
      .map(([, column]) => column)
      .sort(),
  }));
  const mirror = (table: string) =>
    (collections as readonly string[]).includes(table)
      ? ["file_path", "image_path"]
      : table === "people"
        ? ["photo_path"]
        : table === "page_texts"
          ? ["document"]
          : table === "seasons" || table === "merch_items"
            ? ["photos"]
            : [];
  const advice =
    "update fileUses (photo-uses.ts), sandboxFileInUse (providers/sample.ts) and this test";
  for (const { table, columns } of checked)
    assert.deepEqual(
      columns,
      mirror(table),
      `community_file_in_use() checks public.${table} (${columns.join(", ")}): ${advice}`,
    );
  assert.deepEqual(
    checked.map(({ table }) => table).sort(),
    [...collections, "merch_items", "page_texts", "people", "seasons"].sort(),
    `community_file_in_use() checks a different set of tables: ${advice}`,
  );
  // The sandbox mirror names the same columns.
  const sandbox = readFileSync(
    join(process.cwd(), "src/lib/backend/providers/sample.ts"),
    "utf8",
  ).match(/function sandboxFileInUse[\s\S]*?\n}\n/)?.[0];
  assert.ok(sandbox, "sandboxFileInUse is defined");
  for (const column of ["image_path", "file_path", "photo_path"])
    assert.ok(sandbox.includes(column), `sandboxFileInUse checks ${column}`);
  assert.ok(
    sandbox.includes("pageTexts"),
    "sandboxFileInUse checks page texts",
  );
  for (const rows of ["seasons", "merchItems"])
    assert.ok(
      sandbox.includes(`store.${rows}`),
      `sandboxFileInUse checks ${rows}`,
    );
  // And the Photos screen finds a file named by any collection's columns.
  for (const kind of collections) {
    const uses = fileUses({
      records: [
        {
          kind,
          id: "r1",
          title: "T",
          image_path: photo(5),
          file_path: photo(6),
          archived_at: null,
        },
      ],
      people: [],
      pages: [],
      seasons: [],
      merchItems: [],
    });
    assert.ok(uses.has(photo(5)) && uses.has(photo(6)), `${kind} uses found`);
  }
});
