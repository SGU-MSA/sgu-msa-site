import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { layoutPages, layoutViewports } from "./support/viewports";

// The layout gate's screenshot baselines are only valid when they render in the
// official Playwright image that matches the installed @playwright/test.
const installed = JSON.parse(
  readFileSync("node_modules/@playwright/test/package.json", "utf8"),
).version as string;
const scripts = JSON.parse(readFileSync("package.json", "utf8"))
  .scripts as Record<string, string>;

test("layout gate scripts use the Playwright image matching the installed version", () => {
  const image = `mcr.microsoft.com/playwright:v${installed}-noble`;
  assert.ok(scripts["test:layout"].includes(image), "test:layout image");
  assert.ok(
    scripts["test:layout:update"].includes(image),
    "test:layout:update image",
  );
  assert.ok(scripts["test:layout:update"].includes("--update-snapshots"));
});

test("layout gate covers the device classes and every public page once", () => {
  const names = layoutViewports.map((v) => v.name);
  assert.equal(new Set(names).size, names.length, "no duplicate viewport");
  for (const wanted of ["320x568", "844x390", "1366x768", "3840x2160"])
    assert.ok(names.includes(wanted), `${wanted} is in the matrix`);
  assert.equal(new Set(layoutPages).size, layoutPages.length);
  assert.ok(layoutPages.includes("/admin/login"));
});
