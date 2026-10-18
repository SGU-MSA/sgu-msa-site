import test from "node:test";
import assert from "node:assert/strict";

import {
  merchCollectionSchema,
  merchItemSchema,
  merchPage,
  sizeItemName,
} from "../src/lib/community/merch";
import { paymentItemSchema } from "../src/lib/community/payments";
import { photoListForm } from "../src/lib/media/photo-list";
import { demoMerch } from "../src/lib/demo/fixtures";

// PR5c: merch from the dashboard (D-9, D-27; P-72 B).
const collection = (id: string, era: "current" | "past", position: number) =>
  merchCollectionSchema.parse({
    id: `00000000-0000-4000-8000-00000000c00${id}`,
    name: `Collection ${id}`,
    era,
    position,
  });
const item = (id: string, collectionId: string, position: number) =>
  merchItemSchema.parse({
    id: `00000000-0000-4000-8000-00000000d00${id}`,
    collection_id: collectionId,
    name: `Item ${id}`,
    position,
  });

test("the Merch page: the first current collection leads; the rest follow in the board's order", () => {
  const past = collection("1", "past", 1);
  const now = collection("2", "current", 3);
  const later = collection("3", "current", 2);
  const items = [
    item("1", now.id, 2),
    item("2", now.id, 1),
    item("3", past.id, 1),
  ];
  const sizes = new Map([
    [items[0].id, [{ label: "M", giveHref: "/donate/m/give" as const }]],
    [items[2].id, [{ label: "L", giveHref: "/donate/l/give" as const }]],
  ]);
  const page = merchPage([now, past, later], items, sizes);
  assert.equal(page.state, "ready");
  if (page.state !== "ready") return;
  assert.equal(page.lead?.id, later.id, "the first current one by order");
  assert.deepEqual(
    page.others.map((other) => other.id),
    [past.id, now.id],
  );
  const current = page.others[1];
  assert.deepEqual(
    current.items.map((row) => row.name),
    ["Item 2", "Item 1"],
    "items in the board's order",
  );
  assert.deepEqual(
    current.items[1].sizes.map((size) => size.label),
    ["M"],
  );
  // A past collection is not for sale: no size buttons, whatever is open.
  assert.deepEqual(page.others[0].items[0].sizes, []);
});

test("no current collection: nothing leads", () => {
  const page = merchPage([collection("1", "past", 1)], [], new Map());
  assert.ok(page.state === "ready" && page.lead === null);
});

test("a size is saved as '<item> · <size>', at most 80 characters", () => {
  assert.equal(
    sizeItemName("Shukr long-sleeve", " M "),
    "Shukr long-sleeve · M",
  );
  assert.equal(sizeItemName("x".repeat(90), "XL").length, 80);
});

test("a merch size is a priced, General, season-less item with a label", () => {
  const base = {
    id: "00000000-0000-4000-8000-0000000006aa",
    slug: "shirt-m",
    name: "Shirt · M",
    kind: "priced",
    category: "general",
    about: "",
    listed: true,
    position: 1,
    merch_item_id: "00000000-0000-4000-8000-0000000007b3",
    size_label: "M",
  };
  assert.ok(paymentItemSchema.safeParse(base).success);
  const problem = (change: object) =>
    paymentItemSchema.safeParse({ ...base, ...change }).error?.issues[0]
      ?.message;
  assert.equal(problem({ size_label: "" }), "Size: fill in this box.");
  assert.equal(
    problem({ merch_item_id: "", size_label: "M" }),
    "Size: only a merch item has sizes.",
  );
  assert.equal(
    problem({ kind: "fund" }),
    "A merch size is sold like a ticket.",
  );
});

test("photo lists: stored or new photos, each described, at most the limit; new ones need their file", () => {
  const stored = {
    src: "/media/00000000-0000-4000-8000-000000000001.webp",
    alt: "Front",
  };
  const ok = photoListForm({
    list: "photos",
    posted: JSON.stringify([stored, { src: "new:a", alt: "Back" }]),
    max: 12,
    chosen: new Set(["a"]),
  });
  assert.deepEqual(ok, {
    ok: true,
    photos: [stored, { src: "new:a", alt: "Back" }],
    added: ["a"],
  });
  const refused = photoListForm({
    list: "photos",
    posted: JSON.stringify([
      { ...stored, alt: " " },
      { src: "new:b", alt: "Lost" },
      { src: "https://example.com/x.webp", alt: "x" },
    ]),
    max: 2,
    chosen: new Set(),
  });
  assert.deepEqual(refused, {
    ok: false,
    fields: {
      "photos.0.alt": "Photo description: describe the photo in one sentence.",
      "photos.1.file": "Photo: choose the photo again.",
      "photos.2.file": "Photo: choose the photo again.",
      photos: "Photos: keep 2 photos or fewer.",
    },
  });
  assert.equal(
    photoListForm({ list: "photos", posted: "{", max: 2, chosen: new Set() })
      .ok,
    false,
  );
});

test("the sandbox's starter merch passes the database's rules", () => {
  const { collections, items } = demoMerch();
  assert.equal(collections.filter((row) => row.era === "current").length, 1);
  assert.ok(items.every((row) => row.photos.length >= 1));
});
