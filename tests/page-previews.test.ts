import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import { pageTextKeys, type PageTextKey } from "../src/lib/content/documents";
import {
  previewPageText,
  withEveryField,
} from "../src/lib/content/page-fields";
import { contentDirectory } from "../src/lib/content/providers/yaml";
import { verseReminder } from "../src/lib/content/reminders";
import { formsSchema, siteSchema } from "../src/lib/content/schemas";
import { formDestination } from "../src/lib/integrations/form-destination";
import { scheduleNotice } from "../src/lib/prayer/congregation";
import { systemText } from "../src/lib/system-text";

// PR5b PR-B (docs/contracts/pr5b-page-text-forms-reminders.md, WP4 and WP5):
// page previews drawn in the browser, copy moved out of components, verses
// read from the library, the closed-form button, the footer year.

const root = path.resolve(import.meta.dirname, "..");
const starter = (key: PageTextKey) =>
  load(fs.readFileSync(path.join(contentDirectory, `${key}.yaml`), "utf8"));
/** The editor's document as it starts (every box present). */
const typed = (key: PageTextKey) =>
  JSON.parse(JSON.stringify(withEveryField(key, starter(key))));

/* ------------------------------------------------------------ previews -- */

/** The project modules a file imports at run time (type-only imports left out). */
function runtimeImports(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const found: string[] = [];
  const pattern =
    /^\s*(import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2];
    const base = specifier.startsWith("@/")
      ? path.join(root, "src", specifier.slice(2))
      : specifier.startsWith(".")
        ? path.resolve(path.dirname(file), specifier)
        : null;
    if (specifier === "server-only") found.push(specifier);
    if (!base || /\.(css|svg|png|webp)$/.test(base)) continue;
    const resolved = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
      .map((ending) => base + ending)
      .find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
    if (resolved) found.push(resolved);
  }
  return found;
}

test("the page previews render in the browser: nothing they import is server-only (WP4)", () => {
  const start = path.join(root, "src/features/admin/pages/previews.tsx");
  const seen = new Set<string>();
  const queue = [start];
  const serverOnly: string[] = [];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const imported of runtimeImports(file)) {
      if (imported === "server-only")
        serverOnly.push(path.relative(root, file));
      else queue.push(imported);
    }
    // An async component cannot render in the browser.
    if (
      file.endsWith(".tsx") &&
      /export\s+async\s+function\s+[A-Z]/.test(fs.readFileSync(file, "utf8"))
    )
      serverOnly.push(`${path.relative(root, file)} (async component)`);
  }
  assert.ok(seen.size > 20, "the walk followed the imports");
  assert.deepEqual(serverOnly, []);
});

test("every page's starter text previews as it would save; problems instead of a broken page", () => {
  for (const key of pageTextKeys) {
    const result = previewPageText(key, typed(key));
    assert.ok(result.ok, `${key}: ${result.ok ? "" : result.problems}`);
  }
  const about = typed("about");
  about.hero.title = "  ";
  about.board.heading = "";
  const refused = previewPageText("about", about);
  assert.equal(refused.ok, false);
  assert.deepEqual(!refused.ok && refused.problems, [
    "Top of the page · Page title: fill in this box.",
    "Our team · Heading: fill in this box.",
  ]);
  // A screen from before the field list changed: reload, as a save says.
  const old = typed("contact");
  delete old.visit;
  assert.deepEqual(previewPageText("contact", old), {
    ok: false,
    problems: [systemText.messages.outOfDate],
  });
});

test("the preview shows typed text: an emptied optional box hides its block", () => {
  const contact = typed("contact");
  contact.title = "Come and see us";
  contact.description = "";
  const result = previewPageText("contact", contact);
  assert.ok(result.ok);
  assert.equal(result.document.title, "Come and see us");
  assert.equal(result.document.description, undefined);
});

/* ---------------------------------------------------- copy out of code -- */

test("no page picks a verse by a hardcoded id; every verse comes from its place (WP5)", () => {
  const files = fs
    .readdirSync(path.join(root, "src"), { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => path.join(root, "src", file));
  const offenders = files.filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return (
      /verses\.find\(\s*\(?\w+\)?\s*=>\s*\w+\.id\s*===/.test(source) ||
      /footerVerseId/.test(source)
    );
  });
  assert.deepEqual(
    offenders.map((file) => path.relative(root, file)),
    [],
  );
});

test("a library verse reads as Qur'an <reference> (<surah>) with the translator credit", () => {
  const reminder = verseReminder({
    reference: "94:5",
    surahName: "Ash-Sharh",
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    meaning: "For indeed, with hardship [will be] ease.",
  });
  assert.equal(reminder.reference, "Qur’an 94:5 (Ash-Sharh)");
  assert.equal(reminder.credit, "Translation: Saheeh International");
  assert.equal(reminder.source, "api.alquran.cloud quran-uthmani + en.sahih");
  assert.equal(reminder.id, "q94:5");
  assert.equal(reminder.arabic, "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا");
});

test("the footer has no stored copyright year: the line follows the year by itself", () => {
  const site = siteSchema.parse(starter("site"));
  assert.equal("copyright" in site.footer, false);
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, "src/shared/layout/Footer.tsx"), "utf8"),
    /new Date\(/,
  );
});

test("the schedule line: the board's notice first, then the page text's lines", () => {
  const lines = {
    schedule_note: "Set by the MSA.",
    no_schedule_note: "Not published yet.",
    unavailable_note: "Temporarily unavailable.",
  };
  const state = {
    unavailable: false,
    changedToday: "",
    boardNotice: "",
    hasTimes: true,
  };
  assert.equal(scheduleNotice(lines, state), "Set by the MSA.");
  assert.equal(
    scheduleNotice(lines, { ...state, hasTimes: false }),
    "Not published yet.",
  );
  assert.equal(
    scheduleNotice(lines, {
      ...state,
      changedToday: "Changed today: Exams. ",
      boardNotice: "Doors open at 5.",
    }),
    "Changed today: Exams. Doors open at 5.",
  );
  assert.equal(
    scheduleNotice(lines, { ...state, unavailable: true }),
    "Temporarily unavailable.",
  );
});

/* ------------------------------------------------- the closed-form button */

test("a closed form, or one without a safe link, shows no button and no line (review fixes P3)", () => {
  const forms = formsSchema.parse({
    forms: {
      open: { label: "Volunteer", url: "https://forms.gle/abc" },
      closed: { label: "Mentor", url: "https://forms.gle/abc", open: false },
      quiet: { label: "Idea", url: "https://forms.gle/abc", open: false },
      nolink: { label: "Helper" },
      unsafe: { label: "Helper", url: "javascript:alert(1)" },
    },
  });
  assert.deepEqual(formDestination(forms, "open"), {
    state: "ready",
    label: "Volunteer",
    href: "https://forms.gle/abc",
    external: true,
    placeholder: false,
  });
  for (const key of ["closed", "quiet", "nolink", "unsafe", "not-in-the-list"])
    assert.equal(formDestination(forms, key).state, "unconfigured", key);
  // The starter forms are closed until the board pastes its real forms.
  const starterForms = formsSchema.parse(starter("forms"));
  for (const key of Object.keys(starterForms.forms))
    assert.equal(formDestination(starterForms, key).state, "unconfigured", key);
});
