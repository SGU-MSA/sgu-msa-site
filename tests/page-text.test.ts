import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { problemsOf } from "../src/features/admin/form-check/problems";
import { describeChange } from "../src/lib/community/activity";
import {
  developerOwnedPaths,
  editorialDocuments,
  pageTextKeys,
  type PageTextKey,
} from "../src/lib/content/documents";
import {
  chosenPhotoSource,
  documentNamesPhoto,
  isPageLink,
  isPhotoPath,
  keepCurrentPhotos,
  mergePageText,
  pageFields,
  pageTextProblems,
  pageTextSaveSchema,
  photosIn,
  restoredPageText,
  withChosenPhotos,
  withEveryField,
  withPhotoSource,
  type PageField,
} from "../src/lib/content/page-fields";
import { createSupabaseEditorialSource } from "../src/lib/content/providers/supabase";
import {
  contentDirectory,
  yamlEditorialSource,
} from "../src/lib/content/providers/yaml";
import { placedVerse } from "../src/lib/content/reminders";
import { isLayoutKey } from "../src/lib/content/page-layouts";
import { formsSchema } from "../src/lib/content/schemas";
import type { EditorialSource } from "../src/lib/content/providers/contract";
import { systemText } from "../src/lib/system-text";

// PR5b WP2 (docs/contracts/pr5b-page-text-forms-reminders.md): field lists,
// save rules, the Supabase page-text adapter, verse placement, system wording.

const starter = (key: PageTextKey) =>
  load(fs.readFileSync(path.join(contentDirectory, `${key}.yaml`), "utf8"));

/** The document as the editor posts it, unchanged. */
const asPosted = (key: PageTextKey, document: unknown) =>
  JSON.parse(JSON.stringify(withEveryField(key, document)));

function* allFields(fields: readonly PageField[]): Generator<PageField> {
  for (const field of fields) {
    yield field;
    if (field.kind === "list" || field.kind === "entries")
      yield* allFields(field.item);
  }
}

test("every page-text document has a field list, and every box shows an example (D-26)", () => {
  assert.deepEqual(Object.keys(pageFields).sort(), [...pageTextKeys].sort());
  for (const key of pageTextKeys)
    for (const section of pageFields[key].sections)
      for (const field of allFields(section.fields))
        assert.ok(
          field.example.trim(),
          `${key} › ${section.title} › ${field.label} has an example`,
        );
});

test("the starter text passes the save rules and reads back the same after a save", () => {
  for (const key of pageTextKeys) {
    const raw = starter(key);
    const merged = mergePageText(key, raw, asPosted(key, raw));
    assert.ok(merged.ok, key);
    const parsed = pageTextSaveSchema(key).safeParse(merged.document);
    assert.ok(
      parsed.success,
      `${key}: ${parsed.success ? "" : parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
    const stored = JSON.parse(JSON.stringify(parsed.data));
    const { schema } = editorialDocuments[key];
    // Empty optional boxes may be left out instead of null: the page reads them the same.
    const shown = (value: unknown) =>
      JSON.stringify(schema.parse(value), (_, item) =>
        item === null ? undefined : item,
      );
    assert.equal(shown(stored), shown(raw), key);
  }
});

test("a stored photo that still has the retired historical flag loads and loses the flag on save", () => {
  const raw = starter("about") as Record<string, Record<string, unknown>>;
  const image = raw.at_sgu.image as Record<string, unknown>;
  image.historical = true;
  image.year = 2020;
  const { schema } = editorialDocuments.about;
  const loaded = JSON.parse(JSON.stringify(schema.parse(raw)));
  assert.equal(loaded.at_sgu.image.src, image.src);
  assert.ok(!("historical" in loaded.at_sgu.image));
  const merged = mergePageText("about", raw, asPosted("about", raw));
  assert.ok(merged.ok);
  const saved = JSON.stringify(merged.document);
  assert.ok(!saved.includes("historical"));
  assert.ok(!saved.includes('"year"'));
});

test("a refused save names each problem's own box, by its path (review 2)", () => {
  const raw = starter("about") as Record<string, Record<string, unknown>>;
  const posted = asPosted("about", raw);
  posted.hero.title = "  ";
  posted.board.heading = "";
  posted.mission.heading = "x".repeat(161);
  posted.what_we_do.items[1].title = "";
  posted.contact.email = "not an email";
  posted.at_sgu.image.alt = "";
  const merged = mergePageText("about", raw, posted);
  assert.ok(merged.ok);
  const parsed = pageTextSaveSchema("about").safeParse(merged.document);
  assert.ok(!parsed.success);
  assert.deepEqual(problemsOf(parsed.error), {
    "hero.title": "Top of the page · Page title: fill in this box.",
    "mission.heading": "Our mission · Heading: use 160 characters or fewer.",
    "what_we_do.items.1.title":
      "What we do · Item 2 · Title: fill in this box.",
    "board.heading": "Our team · Heading: fill in this box.",
    "at_sgu.image": "MSA at SGU · Photo: describe the photo in one sentence.",
    "contact.email":
      "Contact · Email: use an email address such as name@example.com.",
  });
});

test("links: a page of this site or https; sign-up forms: Google Forms only (D-25)", () => {
  for (const ok of [
    "/",
    "/prayer#find-the-musallah",
    "/resources?category=newsletter",
    "/documents/msa-newsletter-april-2026.pdf",
    "https://www.sgu.edu",
  ])
    assert.ok(isPageLink(ok), ok);
  for (const bad of [
    "/nowhere",
    "http://www.sgu.edu",
    "javascript:alert(1)",
    "https://user:pass@sgu.edu",
    "mailto:so-msa@sgu.edu",
  ])
    assert.ok(!isPageLink(bad), bad);
  assert.ok(isPageLink("mailto:so-msa@sgu.edu", true));

  const raw = starter("forms");
  const posted = asPosted("forms", raw);
  posted.forms.volunteer.url = "https://example.com/form";
  const merged = mergePageText("forms", raw, posted);
  assert.ok(merged.ok);
  assert.deepEqual(
    pageTextProblems("forms", merged.document).map(
      (problem) => problem.message,
    ),
    [
      "Sign-up forms · Volunteer · Link: use a Google Forms link (docs.google.com/forms/… or forms.gle/…).",
    ],
  );
});

test("forms are open unless closed (D-7)", () => {
  const parsed = formsSchema.parse({
    forms: {
      volunteer: { label: "Volunteer", url: "https://forms.gle/x" },
      mentor: { label: "Mentor", open: false },
    },
  });
  assert.equal(parsed.forms.volunteer.open, true);
  assert.equal(parsed.forms.mentor.open, false);
  // Every starter form starts closed: their link is one shared example form.
  const forms = formsSchema.parse(starter("forms")).forms;
  assert.ok(Object.values(forms).every((form) => form.open === false));
});

test("merging keeps what the board cannot edit and refuses an out-of-date screen", () => {
  const raw = starter("site") as { navigation: unknown[] };
  const posted = asPosted("site", raw);
  posted.navigation = [{ label: "Hacked", href: "/x" }];
  posted.brand.tagline = "Faith. Knowledge. Community. Together.";
  const merged = mergePageText("site", raw, posted);
  assert.ok(merged.ok);
  const document = merged.document as {
    navigation: unknown[];
    brand: { tagline: string };
  };
  assert.deepEqual(document.navigation, raw.navigation);
  assert.equal(
    document.brand.tagline,
    "Faith. Knowledge. Community. Together.",
  );

  // A screen loaded before a box existed posts no value for it.
  const old = asPosted("site", raw);
  delete old.meta;
  assert.deepEqual(mergePageText("site", raw, old), {
    ok: false,
    reason: "out_of_date",
  });
});

test("list items: kept by id with their other keys; a new item gets an id from its title; empty optional boxes are left out", () => {
  const raw = starter("faq") as { items: { id: string }[] };
  const posted = asPosted("faq", raw);
  posted.items.reverse();
  posted.items.push({
    id: "new-abc",
    question: "Is there parking?",
    answer: "Yes, beside Charter Hall.",
  });
  posted.items.push({
    id: "musallah-location",
    question: "A copy claiming an existing id",
    answer: "Gets its own id.",
  });
  posted.hero.eyebrow = "";
  const merged = mergePageText("faq", raw, posted);
  assert.ok(merged.ok);
  const document = merged.document as {
    items: { id: string; question: string }[];
    hero: { eyebrow?: string };
  };
  assert.deepEqual(
    document.items.slice(0, raw.items.length).map((item) => item.id),
    raw.items.map((item) => item.id).reverse(),
  );
  assert.equal(document.items.at(-2)?.id, "is-there-parking");
  assert.equal(document.items.at(-1)?.id, "a-copy-claiming-an-existing-id");
  assert.equal(document.hero.eyebrow, undefined);
});

test("photos: only photo boxes take a file; a chosen photo stands in until stored; replaced photos are not restored", () => {
  assert.ok(isPhotoPath("about", "at_sgu.image"));
  assert.ok(isPhotoPath("home", "features.2.image"));
  assert.ok(isPhotoPath("musallah", "gallery.0"));
  assert.ok(isPhotoPath("get-involved", "pathways.3.image"));
  for (const bad of [
    "about.hero.title",
    "hero.title",
    "features.image",
    "gallery",
  ])
    assert.ok(!isPhotoPath("home", bad), bad);

  const raw = starter("about");
  const posted = asPosted("about", raw);
  posted.at_sgu.image.alt = "The campus";
  const chosen = withChosenPhotos("about", posted, ["at_sgu.image"]);
  assert.equal(withChosenPhotos("about", posted, ["hero.title"]), null);
  const merged = mergePageText("about", raw, chosen);
  assert.ok(merged.ok);
  assert.ok(pageTextSaveSchema("about").safeParse(merged.document).success);
  const name = "0f8fad5b-d9cb-469f-a165-70867728950e.webp";
  const stored = withPhotoSource(merged.document, "at_sgu.image", name) as {
    at_sgu: { image: { src: string; alt: string } };
  };
  assert.deepEqual(stored.at_sgu.image, {
    ...stored.at_sgu.image,
    src: `/media/${name}`,
    alt: "The campus",
  });
  assert.notEqual(chosenPhotoSource, stored.at_sgu.image.src);
  assert.deepEqual(photosIn(stored), [name]);
  assert.ok(documentNamesPhoto(stored, name));
  assert.ok(!documentNamesPhoto({ note: `/media/${name}` }, name));

  // History: the earlier version named a photo replaced since; the photo there now stays.
  const later = withPhotoSource(
    stored,
    "at_sgu.image",
    "1f8fad5b-d9cb-469f-a165-70867728950e.webp",
  );
  const restored = keepCurrentPhotos(stored, later) as typeof stored;
  assert.equal(
    restored.at_sgu.image.src,
    "/media/1f8fad5b-d9cb-469f-a165-70867728950e.webp",
  );
});

test("Supabase page text: one read for every document; missing, invalid or unreadable text falls back; other documents come from YAML", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  let reads = 0;
  const rows = [
    { key: "faq", document: starter("faq") },
    { key: "about", document: { hero: 42 } },
  ];
  const reader = (result: { data: unknown; error: unknown }) => () => ({
    from: () => ({
      select: async () => {
        reads++;
        return result as {
          data: { key: string; document: unknown }[] | null;
          error: unknown;
        };
      },
    }),
  });
  const yaml: EditorialSource = {
    async get(key) {
      return {
        document: editorialDocuments[key].fallback,
        unavailable: false,
        provenance: "live",
      };
    },
  };
  const source = createSupabaseEditorialSource(
    reader({ data: rows, error: null }),
    yaml,
  );
  const faq = await source.get("faq");
  assert.equal(faq.unavailable, false);
  assert.equal(faq.document.items.length > 0, true);
  const about = await source.get("about");
  assert.equal(about.unavailable, true);
  assert.equal(about.document, editorialDocuments.about.fallback);
  const contact = await source.get("contact");
  assert.equal(contact.unavailable, true, "no row");
  const reminders = await source.get("reminders");
  assert.equal(reminders.unavailable, false, "still YAML");
  assert.equal(reads, 1);

  const down = createSupabaseEditorialSource(
    reader({ data: null, error: { message: "down" } }),
    yaml,
  );
  assert.equal((await down.get("site")).unavailable, true);
  const noClient = createSupabaseEditorialSource(() => null, yaml);
  assert.equal(
    (await noClient.get("home")).document,
    editorialDocuments.home.fallback,
  );
  assert.ok(warn.mock.callCount() >= 3);
});

test("every part of the starter YAML is either a board field or developer-owned, never both (D-22)", () => {
  const fieldPaths = (fields: readonly PageField[], prefix = ""): string[] =>
    fields.flatMap((field) => {
      const at =
        prefix && field.path ? `${prefix}.${field.path}` : prefix || field.path;
      return field.kind === "list" || field.kind === "entries"
        ? [at, ...fieldPaths(field.item, `${at}[]`)]
        : [at];
    });
  const leaves = (value: unknown, at: string): string[] =>
    Array.isArray(value)
      ? [at]
      : typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, inner]) =>
            leaves(inner, at ? `${at}.${key}` : key),
          )
        : [at];
  const under = (leaf: string, path: string) =>
    leaf === path ||
    leaf.startsWith(`${path}.`) ||
    leaf.startsWith(`${path}[]`);
  for (const key of pageTextKeys) {
    const board = pageFields[key].sections.flatMap((section) =>
      fieldPaths(section.fields),
    );
    const developer = developerOwnedPaths[key] ?? [];
    // A page's sections: their order and which are shown (review 3 B).
    if (isLayoutKey(key)) board.push("sections");
    for (const path of developer)
      assert.ok(
        !board.some((field) => under(field, path) || under(path, field)),
        `${key}.${path} is both a board field and developer-owned`,
      );
    for (const leaf of leaves(starter(key), ""))
      assert.ok(
        [...board, ...developer].some((path) => under(leaf, path)),
        `${key}.${leaf} is neither a board field nor in developerOwnedPaths`,
      );
  }
});

test("the menu, footer, logo and filter lists come from YAML, also while the database is down (D-22)", async (t) => {
  t.mock.method(console, "warn", () => {});
  const yamlSite = (await yamlEditorialSource.get("site")).document;
  const down = createSupabaseEditorialSource(() => null, yamlEditorialSource);
  const site = await down.get("site");
  assert.equal(site.unavailable, true);
  assert.deepEqual(site.document.navigation, yamlSite.navigation);
  assert.deepEqual(site.document.footer, yamlSite.footer);
  assert.deepEqual(site.document.header_cta, yamlSite.header_cta);
  assert.equal(
    site.document.brand.name,
    editorialDocuments.site.fallback.brand.name,
  );

  const stored = structuredClone(starter("site")) as Record<string, unknown> & {
    brand: Record<string, unknown>;
  };
  stored.brand.name = "Board's name";
  stored.navigation = [{ label: "Old menu", href: "/" }];
  const events = structuredClone(starter("events")) as Record<string, unknown>;
  events.terms = ["T9"];
  const live = createSupabaseEditorialSource(
    () => ({
      from: () => ({
        select: async () => ({
          data: [
            { key: "site", document: stored },
            { key: "events", document: events },
          ],
          error: null,
        }),
      }),
    }),
    yamlEditorialSource,
  );
  const read = await live.get("site");
  assert.equal(read.unavailable, false);
  assert.equal(read.document.brand.name, "Board's name");
  assert.deepEqual(read.document.navigation, yamlSite.navigation);
});

test("verse placement: the placed verse from the library, else no verse (D-24)", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const verse = {
    reference: "94:5",
    surahName: "Ash-Sharh",
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    meaning: "For indeed, with hardship [will be] ease.",
  };
  assert.equal(
    placedVerse("support", "94:5", { verse, unavailable: false }),
    verse,
  );
  assert.equal(warn.mock.callCount(), 0);
  assert.equal(
    placedVerse("home", "2:255", { verse: null, unavailable: false }),
    null,
  );
  assert.equal(warn.mock.callCount(), 1, "a missing verse is logged");
  assert.equal(
    placedVerse("support", "94:5", { verse: null, unavailable: true }),
    null,
  );
  assert.equal(warn.mock.callCount(), 1, "an unreadable library is not");
  // A place names one whole verse, never a range.
  assert.equal(
    editorialDocuments["reminder-places"].schema.safeParse({
      places: { support: "94:5-6" },
    }).success,
    false,
  );
});

test("every SGU error code the database raises has its meaning in system-text (D-22)", () => {
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const raised = new Set<string>();
  for (const name of fs.readdirSync(folder))
    for (const match of fs
      .readFileSync(new URL(name, folder), "utf8")
      .matchAll(/errcode = '(SGU\d+)'/g))
      raised.add(match[1]);
  assert.ok(raised.size > 0);
  for (const code of raised)
    assert.ok(code in systemText.sguCodes, `${code} has a meaning`);
});

test("Recent changes names a page-text change by its page and lists its sections", () => {
  const before = { key: "about", document: { board: { heading: "Our team" } } };
  const after = {
    key: "about",
    document: { board: { heading: "Meet the board" } },
  };
  const change = describeChange(
    {
      id: 1,
      occurred_at: "2026-10-05T15:00:00Z",
      actor: null,
      area: "page_texts",
      record_id: "about",
      action: "updated",
      before,
      after,
      highlight: false,
    },
    new Map(),
  );
  assert.equal(change.label, "Edited page text");
  assert.equal(change.subject, "About");
  assert.deepEqual(change.fields, [
    {
      name: "Board",
      before: "Heading: Our team",
      after: "Heading: Meet the board",
      hidden: false,
    },
  ]);
});

test("Resources shows only linked, not archived resources (review fixes PR-1)", async () => {
  const { shownResources } = await import("../src/features/resources/library");
  const { resourcesSchema } = await import("../src/lib/content/schemas");
  const { starterSections } = await import("../src/lib/content/page-layouts");
  const { items } = resourcesSchema.parse({
    hero: { title: "Resources" },
    sections: starterSections("resources"),
    items: [
      {
        id: "a",
        title: "A",
        category: "guide",
        description: "Linked.",
        resource_url: "/prayer",
      },
      {
        id: "b",
        title: "B",
        category: "guide",
        description: "No link.",
        resource_url: null,
      },
      {
        id: "c",
        title: "C",
        category: "guide",
        description: "Archived.",
        resource_url: "/faq",
        archived: true,
      },
      {
        id: "d",
        title: "D",
        category: "guide",
        description: "Unsafe.",
        resource_url: "javascript:alert(1)",
      },
    ],
  });
  assert.deepEqual(
    shownResources(items).map((item) => item.id),
    ["a"],
  );
  assert.equal(items[0].archived, false);
});

test("History restore checks the earlier text by today's save rules, for the preview and the restore alike (review 3 D)", () => {
  const current = starter("about");
  const back = restoredPageText("about", current, current);
  assert.ok(back.ok);
  assert.deepEqual(back.document, pageTextSaveSchema("about").parse(current));
  // An earlier version a save would refuse: the first problem, as a save says it.
  const blank = asPosted("about", current) as Record<string, unknown>;
  // The top of the page (always shown), not the sections list (review 3 B).
  const [first] = Object.keys(blank).filter((name) => name !== "sections");
  const broken = { ...blank, [first]: {} };
  const refused = restoredPageText("about", broken, current);
  assert.ok(!refused.ok);
  assert.equal(
    refused.problem,
    pageTextSaveSchema("about").safeParse(
      mergePageText("about", current, withEveryField("about", broken)),
    ).error?.issues[0]?.message,
  );
});

test("History restore skips the required boxes of sections hidden in that version or on the page that shows them (review 3 B)", () => {
  const current = starter("about");
  const blank = asPosted("about", current) as {
    mission: Record<string, unknown>;
    sections: { id: string; shown: boolean }[];
  };
  const emptied = { ...blank, mission: { ...blank.mission, heading: "" } };
  assert.ok(!restoredPageText("about", emptied, current).ok);
  const hidden = {
    ...emptied,
    sections: blank.sections.map((entry) =>
      entry.id === "mission" ? { ...entry, shown: false } : entry,
    ),
  };
  assert.ok(restoredPageText("about", hidden, current).ok);
  assert.ok(restoredPageText("about", emptied, current, ["mission"]).ok);
});
