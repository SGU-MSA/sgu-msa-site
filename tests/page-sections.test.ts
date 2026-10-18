import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import { describeChange } from "../src/lib/community/activity";
import {
  editsPages,
  nobodyEditsPages,
  type Access,
} from "../src/lib/community/people";
import { editorialDocuments, pageTextKeys } from "../src/lib/content/documents";
import {
  mergePageText,
  pageFields,
  pageSectionTitle,
  pageTextProblems,
  pageTextSaveSchema,
  previewPageText,
  sectionOfPath,
  sectionProblems,
  withEveryField,
} from "../src/lib/content/page-fields";
import {
  drawnOn,
  hiddenSections,
  isLayoutKey,
  layoutIds,
  layoutOwner,
  pageLayouts,
  pagesShowing,
  previewPages,
  sharedTexts,
  shownIds,
  starterSections,
  type LayoutKey,
  type PageLayout,
} from "../src/lib/content/page-layouts";
import { contentDirectory } from "../src/lib/content/providers/yaml";
import {
  editedOn,
  pagesListed,
  pagesOnScreen,
} from "../src/features/admin/pages/pages-list";
import {
  chosenPhotos,
  pageTextsForm,
  photoBox,
  textOfPath,
} from "../src/features/admin/pages/page-form";

// Review 3 B (.plans/review3-plan.md; docs/contracts/pr5b-page-text-forms-reminders.md,
// amendment 2026-10-06): each page's sections can be hidden and moved by the
// Executive board; hidden sections keep their words.

const starter = (key: string) =>
  load(fs.readFileSync(path.join(contentDirectory, `${key}.yaml`), "utf8"));
const typed = (key: (typeof pageTextKeys)[number]) =>
  JSON.parse(JSON.stringify(withEveryField(key, starter(key)))) as Record<
    string,
    unknown
  > & { sections: { id: string; shown: boolean }[] };
const layoutKeys = Object.keys(pageLayouts) as LayoutKey[];

test("every page section is a Pages section of its document, or a screen or fixed words; ids are unique per page", () => {
  for (const key of layoutKeys) {
    const layout: PageLayout = pageLayouts[key];
    const ids: readonly string[] = layoutIds(key);
    assert.equal(new Set(ids).size, ids.length, `${key}: unique ids`);
    const own = pageFields[key].sections.map((section) => section.id);
    assert.ok(own.includes(layout.top), `${key}: the top is a Pages section`);
    for (const id of layout.settings ?? [])
      assert.ok(own.includes(id), `${key}: ${id} is a Pages section`);
    for (const section of layout.sections) {
      assert.ok(!ids.includes(layout.top), `${key}: the top is never moved`);
      if (section.source.from === "text")
        assert.ok(
          pageFields[section.source.key].sections.some(
            ({ id }) => id === section.id,
          ),
          `${key}.${section.id} is a section of ${section.source.key}`,
        );
      else assert.ok(section.title, `${key}.${section.id} has a name`);
      assert.notEqual(pageSectionTitle(key, section.id), section.id);
    }
  }
});

test("every Pages section of a page's document is its top, a setting or one of its sections, or shown by another page", () => {
  for (const key of pageTextKeys) {
    const ids = pageFields[key].sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, `${key}: unique section ids`);
    if (!isLayoutKey(key)) continue;
    const layout: PageLayout = pageLayouts[key];
    for (const id of ids)
      assert.ok(
        id === layout.top ||
          layout.settings?.includes(id) ||
          layout.sections.some((section) => section.id === id) ||
          layoutOwner(key, id) !== null,
        `${key}.${id} has a place`,
      );
  }
  // Sections other pages show (the Prayer page's Jumu'ah and Musallah parts).
  assert.equal(layoutOwner("musallah", "directions"), "prayer");
  assert.equal(layoutOwner("jumuah", "jumuah"), "prayer");
  assert.equal(layoutOwner("newsletters", "archive"), "resources");
  assert.equal(layoutOwner("faq", "faq"), "home");
  assert.equal(layoutOwner("faq", "questions"), null);
});

test("the starter text lists every section of its page once, all shown, in the starter order", () => {
  for (const key of layoutKeys) {
    assert.deepEqual(
      (starter(key) as { sections: unknown }).sections,
      starterSections(key),
      key,
    );
    assert.deepEqual(
      editorialDocuments[key].fallback.sections,
      starterSections(key),
      `${key} fallback`,
    );
  }
  const schema = editorialDocuments.about.schema;
  const about = starter("about") as { sections: unknown[] };
  assert.equal(
    schema.safeParse({ ...about, sections: about.sections.slice(1) }).success,
    false,
    "a section missing",
  );
  assert.equal(
    schema.safeParse({
      ...about,
      sections: [...about.sections, about.sections[0]],
    }).success,
    false,
    "a section twice",
  );
});

test("moving and hiding sections is saved with the page; a malformed list is an out-of-date screen", () => {
  const home = typed("home");
  home.sections = [
    { id: "faq", shown: true },
    ...starterSections("home")
      .filter(({ id }) => id !== "faq")
      .map((entry) => ({ ...entry, shown: entry.id !== "updates" })),
  ];
  const merged = mergePageText("home", starter("home"), home);
  assert.ok(merged.ok);
  const saved = pageTextSaveSchema("home").parse(merged.document);
  assert.deepEqual(shownIds(saved.sections), [
    "faq",
    "week",
    "contribution",
    "visit",
    "features",
    "giving",
  ]);
  for (const sections of [
    undefined,
    home.sections.slice(1),
    [...home.sections.slice(1), { id: "week", shown: true }],
    [...home.sections.slice(1), { id: "elsewhere", shown: true }],
  ])
    assert.deepEqual(
      mergePageText("home", starter("home"), { ...home, sections }),
      { ok: false, reason: "out_of_date" },
    );
});

test("a hidden section keeps its words, and its required boxes may stay empty; a photo stays required", () => {
  const about = typed("about") as ReturnType<typeof typed> & {
    mission: { heading: string };
  };
  about.mission.heading = "";
  // Shown: the heading is required.
  assert.deepEqual(
    pageTextProblems("about", about).map((problem) => problem.path),
    ["mission.heading"],
  );
  about.sections = about.sections.map((entry) =>
    entry.id === "mission" ? { ...entry, shown: false } : entry,
  );
  assert.deepEqual(pageTextProblems("about", about), []);
  const merged = mergePageText("about", starter("about"), about);
  assert.ok(merged.ok);
  const saved = pageTextSaveSchema("about").parse(merged.document);
  // Kept empty, so showing it again asks for it.
  assert.equal(saved.mission.heading, "");
  assert.deepEqual(hiddenSections("about", saved), new Set(["mission"]));

  // A photo stays required while hidden (the page needs one to read back).
  const home = typed("home") as ReturnType<typeof typed> & {
    features: { image: unknown }[];
    week: { heading: string };
  };
  home.sections = home.sections.map((entry) => ({ ...entry, shown: false }));
  home.week.heading = "";
  home.features[0].image = null;
  assert.deepEqual(
    pageTextProblems("home", home).map((problem) => problem.path),
    ["features.0.image"],
  );
});

test("a section another page hides follows that page: its required boxes may stay empty", () => {
  const musallah = typed("musallah") as ReturnType<typeof typed> & {
    helper_cta: { heading: string };
  };
  musallah.helper_cta.heading = "";
  assert.deepEqual(
    pageTextProblems("musallah", musallah).map((problem) => problem.path),
    ["helper_cta.heading"],
  );
  const prayer = typed("prayer");
  prayer.sections = prayer.sections.map((entry) =>
    entry.id === "helpers" ? { ...entry, shown: false } : entry,
  );
  const hidden = hiddenSections("musallah", musallah, { prayer });
  assert.deepEqual(hidden, new Set(["helpers"]));
  assert.deepEqual(pageTextProblems("musallah", musallah, hidden), []);
  assert.ok(previewPageText("musallah", musallah, hidden).ok);
  // Showing it again on the Prayer page waits for its words.
  assert.deepEqual(
    sectionProblems("musallah", musallah, "helpers").map(
      (problem) => problem.path,
    ),
    ["helper_cta.heading"],
  );
  assert.deepEqual(sectionProblems("musallah", musallah, "directions"), []);
});

test("the editor's problems open the section they are in", () => {
  // `sections.<id>` is the switch of a section; a box's path is in its section.
  assert.equal(sectionOfPath("home", "features.0.image"), "features");
  assert.equal(sectionOfPath("home", "hero.aside.quote"), "welcome");
  assert.equal(sectionOfPath("home", "sections.faq"), "faq");
  assert.equal(sectionOfPath("musallah", "gallery.2"), "gallery");
  assert.equal(sectionOfPath("get-involved", "intro"), "top");
  assert.equal(sectionOfPath("resources", "search_placeholder"), "library");
});

test("Recent changes lists a page's sections by name, hidden ones marked", () => {
  const before = {
    key: "contact",
    document: { sections: starterSections("contact") },
  };
  const after = {
    key: "contact",
    document: {
      sections: [
        { id: "visit", shown: true },
        { id: "card", shown: false },
      ],
    },
  };
  const change = describeChange(
    {
      id: 1,
      occurred_at: "2026-10-06T15:00:00Z",
      actor: null,
      area: "page_texts",
      record_id: "contact",
      action: "updated",
      before,
      after,
      highlight: false,
    },
    new Map(),
  );
  assert.deepEqual(change.fields, [
    {
      name: "Sections",
      before: "Get in touch, Find the Musallah",
      after: "Find the Musallah, Get in touch (hidden)",
      hidden: false,
    },
  ]);
});

test("Pages follow the Executive board: a current entry there with a login that is not turned off (mirror of can_edit_pages)", () => {
  const login = (state: Access["state"]): Access =>
    state === "none"
      ? { state }
      : {
          state,
          userId: "u",
          email: null,
          canManagePeople: false,
          canManageMoney: false,
          version: "v",
        };
  const person = (
    section_id: string,
    state: Access["state"],
    archived_at: string | null = null,
  ) => ({ section_id, archived_at, access: login(state) });
  const groups = [
    { id: "exec", kind: "executive" as const },
    { id: "general", kind: "general" as const },
  ];
  assert.equal(editsPages(person("exec", "active"), "exec"), true);
  assert.equal(editsPages(person("exec", "invited"), "exec"), true);
  assert.equal(editsPages(person("exec", "deactivated"), "exec"), false);
  assert.equal(editsPages(person("exec", "none"), "exec"), false);
  assert.equal(editsPages(person("general", "active"), "exec"), false);
  assert.equal(editsPages(person("exec", "active", "2026"), "exec"), false);
  assert.equal(nobodyEditsPages([person("general", "active")], groups), true);
  assert.equal(nobodyEditsPages([person("exec", "none")], groups), true);
  assert.equal(
    nobodyEditsPages(
      [person("exec", "none"), person("exec", "invited")],
      groups,
    ),
    false,
  );
});

test("a page edits the sections of other page texts it shows in place: each text checked by its own rules, its problems named by text (dashboard polish)", () => {
  assert.deepEqual(sharedTexts("prayer"), ["jumuah", "musallah"]);
  assert.deepEqual(sharedTexts("home"), ["jumuah", "faq"]);
  assert.deepEqual(sharedTexts("resources"), ["newsletters"]);
  assert.deepEqual(sharedTexts("about"), []);
  assert.deepEqual(sharedTexts("musallah"), []);
  // A shared section's id never clashes with the page's own sections, and is
  // a section of its text.
  for (const key of layoutKeys) {
    const own = pageFields[key].sections.map((section) => section.id);
    for (const ref of drawnOn(key)) {
      assert.ok(!own.includes(ref.section), `${key}: ${ref.section}`);
      assert.ok(
        pageFields[ref.key].sections.some(({ id }) => id === ref.section),
        `${key}: ${ref.key}.${ref.section}`,
      );
    }
  }

  const texts = () => ({
    prayer: typed("prayer"),
    jumuah: typed("jumuah"),
    musallah: typed("musallah") as ReturnType<typeof typed> & {
      facilities: { heading: string };
    },
  });
  const stored = texts();
  const posted = texts();
  const none = () => [];
  const ok = pageTextsForm("prayer", stored, posted, none);
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.documents.map((entry) => entry.key), [
    "prayer",
    "jumuah",
    "musallah",
  ]);
  // A shared box's problem is keyed by its text, and opens its section here.
  posted.musallah.facilities.heading = "";
  const refused = pageTextsForm("prayer", stored, posted, none);
  assert.ok(!refused.ok && "fields" in refused);
  assert.deepEqual(Object.keys(refused.fields), [
    "musallah:facilities.heading",
  ]);
  assert.deepEqual(textOfPath("prayer", "musallah:facilities.heading"), {
    owner: "musallah",
    path: "facilities.heading",
  });
  assert.equal(sectionOfPath("musallah", "facilities.heading"), "facilities");
  // Hidden on this page (as typed here), the required box may stay empty.
  posted.prayer.sections = posted.prayer.sections.map((entry) =>
    entry.id === "facilities" ? { ...entry, shown: false } : entry,
  );
  assert.ok(pageTextsForm("prayer", stored, posted, none).ok);
  // A document that does not fit the screen is out of date, as for one text.
  assert.ok(
    "outOfDate" in
      pageTextsForm("prayer", stored, { ...posted, jumuah: [] }, none),
  );
});

test("a photo chosen in a shared section goes to its own text (dashboard polish)", () => {
  const form = new FormData();
  const file = (name: string) =>
    new File([new Uint8Array([1])], name, { type: "image/webp" });
  form.append(photoBox("prayer", "prayer", "top.image"), file("own.webp"));
  form.append(photoBox("musallah", "prayer", "gallery.0"), file("way.webp"));
  form.append(photoBox("musallah", "prayer", "gallery.1"), new File([], "x"));
  assert.equal(
    photoBox("musallah", "prayer", "gallery.0"),
    "photo:musallah:gallery.0",
  );
  assert.deepEqual(
    chosenPhotos(form, "prayer").map((photo) => photo.path),
    ["top.image"],
  );
  assert.deepEqual(
    chosenPhotos(form, "prayer", "musallah").map((photo) => photo.path),
    ["gallery.0"],
  );
  assert.deepEqual(chosenPhotos(form, "prayer", "jumuah"), []);
});

test("shared text, option A (2026-10-06): where each shared section shows, what Preview can switch to, and which texts leave the Pages list", () => {
  // The Jumu'ah heading: in the Prayer page's list and inside Home's prayer block.
  assert.deepEqual(pagesShowing("jumuah", "jumuah"), ["home", "prayer"]);
  // The questions: the FAQ page and Common questions on Home.
  assert.deepEqual(pagesShowing("faq", "questions"), ["home", "faq"]);
  assert.deepEqual(pagesShowing("faq", "faq"), ["home"]);
  assert.deepEqual(pagesShowing("musallah", "directions"), ["prayer"]);
  assert.deepEqual(pagesShowing("newsletters", "archive"), ["resources"]);
  // Preview: the page first, then the pages that show words edited there.
  assert.deepEqual(previewPages("prayer"), ["prayer", "home"]);
  assert.deepEqual(previewPages("home"), ["home", "prayer", "faq"]);
  assert.deepEqual(previewPages("faq"), ["faq", "home"]);
  assert.deepEqual(previewPages("resources"), ["resources"]);
  assert.deepEqual(previewPages("about"), ["about"]);
  // Words with no page of their own are edited on the pages that show them.
  assert.deepEqual(editedOn("jumuah"), ["home", "prayer"]);
  assert.deepEqual(editedOn("musallah"), ["prayer"]);
  assert.deepEqual(editedOn("newsletters"), ["resources"]);
  for (const key of ["home", "prayer", "faq", "forms", "site"] as const)
    assert.equal(editedOn(key), null, key);
  assert.deepEqual(
    pagesListed.filter((key) =>
      ["jumuah", "musallah", "newsletters"].includes(key),
    ),
    [],
  );
  assert.ok(pagesOnScreen.includes("musallah"), "its History screen stays");
});

test("a shared section is hidden only where every page that shows it hides it", () => {
  const hide = (key: LayoutKey, id: string) => ({
    sections: typed(key).sections.map((entry) =>
      entry.id === id ? { ...entry, shown: false } : entry,
    ),
  });
  // Hidden on Prayer & Musallah, the Jumu'ah heading still shows on Home.
  assert.deepEqual(
    [...hiddenSections("jumuah", {}, { prayer: hide("prayer", "jumuah") })],
    [],
  );
  // Musallah directions shows only on Prayer & Musallah.
  assert.deepEqual(
    [
      ...hiddenSections(
        "musallah",
        {},
        { prayer: hide("prayer", "directions") },
      ),
    ],
    ["directions"],
  );
  // The questions: hidden on the FAQ page but shown on Home, they stay checked;
  // hidden on both, they may keep an empty box.
  const faqHidden = hide("faq", "questions");
  assert.deepEqual([...hiddenSections("faq", faqHidden)], []);
  assert.deepEqual(
    [...hiddenSections("faq", faqHidden, { home: hide("home", "faq") })].sort(),
    ["faq", "questions"],
  );
  assert.deepEqual(
    [...hiddenSections("faq", typed("faq"), { home: hide("home", "faq") })],
    ["faq"],
  );
});

test("a band (About's Contact, Home's giving band, the Musallah helpers) is always last (review fixes P3)", () => {
  for (const [key, band] of [
    ["about", "contact"],
    ["home", "giving"],
    ["prayer", "helpers"],
  ] as const) {
    const document = typed(key);
    const ids = document.sections.map(({ id }: { id: string }) => id);
    // The band first, as a forged or old screen might post it.
    document.sections = [
      { id: band, shown: true },
      ...document.sections.filter(({ id }: { id: string }) => id !== band),
    ];
    const merged = mergePageText(key, starter(key), document);
    assert.ok(merged.ok, key);
    const saved = pageTextSaveSchema(key).parse(merged.document);
    assert.equal(saved.sections.at(-1)?.id, band, key);
    assert.deepEqual(
      saved.sections.map(({ id }: { id: string }) => id),
      ids,
      key,
    );
  }
});
