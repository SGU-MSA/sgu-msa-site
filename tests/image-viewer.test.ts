import test from "node:test";
import assert from "node:assert/strict";

import { servedAsIs } from "../src/shared/ui/imageSource";
import {
  keyTarget,
  loadsFullImage,
  openIndex,
  openLabel,
  photoAnnouncement,
  photoLabel,
} from "../src/shared/ui/imageViewerModel";

test("the open photo stays inside the list; null or an empty list is closed", () => {
  assert.equal(openIndex(null, 5), null);
  assert.equal(openIndex(0, 0), null);
  assert.equal(openIndex(2, 0), null);
  assert.equal(openIndex(Number.NaN, 5), null);
  assert.equal(openIndex(0, 5), 0);
  assert.equal(openIndex(4, 5), 4);
  assert.equal(openIndex(9, 5), 4);
  assert.equal(openIndex(-3, 5), 0);
  assert.equal(openIndex(1.7, 5), 1);
});

test("arrow keys move one photo and stop at the ends; Home and End jump", () => {
  assert.equal(keyTarget("ArrowRight", 1, 5), 2);
  assert.equal(keyTarget("ArrowLeft", 1, 5), 0);
  assert.equal(keyTarget("ArrowLeft", 0, 5), 0);
  assert.equal(keyTarget("ArrowRight", 4, 5), 4);
  assert.equal(keyTarget("Home", 3, 5), 0);
  assert.equal(keyTarget("End", 1, 5), 4);
  assert.equal(keyTarget("Enter", 1, 5), null);
  assert.equal(keyTarget("ArrowUp", 1, 5), null);
});

test("one photo has nothing to move between", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"])
    assert.equal(keyTarget(key, 0, 1), null);
});

test("only the open photo and its neighbours load a full-size image", () => {
  const loaded = [0, 1, 2, 3, 4].filter((i) => loadsFullImage(i, 2));
  assert.deepEqual(loaded, [1, 2, 3]);
  assert.deepEqual(
    [0, 1, 2, 3, 4].filter((i) => loadsFullImage(i, 0)),
    [0, 1],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4].filter((i) => loadsFullImage(i, 4)),
    [3, 4],
  );
});

test("names come from alt; the caption is only added to the announcement", () => {
  const shirt = { src: "/media/a.webp", alt: "Navy Shukr top, front" };
  assert.equal(photoLabel(shirt, 1, 5), "Photo 2 of 5: Navy Shukr top, front");
  assert.equal(
    openLabel(shirt, 1, 5),
    "Open photo 2 of 5: Navy Shukr top, front",
  );
  assert.equal(openLabel(shirt, 0, 1), "Open photo: Navy Shukr top, front");
  assert.equal(
    photoAnnouncement(shirt, 1, 5),
    "Photo 2 of 5: Navy Shukr top, front",
  );
  assert.equal(
    photoAnnouncement({ ...shirt, caption: " Back print detail " }, 1, 5),
    "Photo 2 of 5: Navy Shukr top, front. Back print detail",
  );
  assert.equal(
    photoLabel({ src: "/media/b.webp", alt: "  " }, 0, 2),
    "Photo 1 of 2",
  );
});

test("uploads and vectors skip the image optimizer; other images use it", () => {
  assert.equal(servedAsIs("/media/merch-front.webp"), true);
  assert.equal(servedAsIs("/images/placeholder/garment.svg"), true);
  assert.equal(servedAsIs("/images/approved/entrance.webp"), false);
});
