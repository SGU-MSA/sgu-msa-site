import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { categoryTones } from "../src/lib/community/lists";

// The calendar applies `category-${tone}` by name (each board category gets
// a colour by its place in the list, `categoryTone`), so a search for the
// full class finds nothing and a clean-up can delete it by mistake.
test("every category colour has its top-level colour class in globals.css", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  for (const category of categoryTones)
    assert.match(
      css,
      new RegExp(
        `^\\.category-${category} \\{\\n\\s*color: var\\(--category-${category}\\);`,
        "m",
      ),
      `missing .category-${category}`,
    );
});
