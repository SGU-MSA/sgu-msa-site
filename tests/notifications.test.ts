import test from "node:test";
import assert from "node:assert/strict";
import type { AttentionItem } from "../src/lib/community/attention";
import {
  boardNotifications,
  type NotificationFacts,
} from "../src/features/admin/notifications/board-notifications";

// Review fixes P1, item 5: the bell's lines come from current state on every
// load, so a fixed problem is gone by itself; only "info" lines can be closed.
const none: NotificationFacts = {
  attention: [],
  warningEmailsOff: false,
  managers: { active: 2, short: false },
  nobodyEditsPages: false,
  canManagePeople: true,
  prayerChange: null,
};
const iqamah: AttentionItem = {
  key: "iqamah:2026-10-15",
  topic: "Prayer",
  timing: { type: "deadline", deadline: "2026-10-15", firstFrom: "2026-10-08" },
  title: "Iqamah times end on Thu 15 Oct (in 7 days)",
  detail: "After that day the website stops showing iqamah times.",
  href: "/admin/prayer-times",
  linkLabel: "Open Prayer & iqamah",
};

test("boardNotifications: nothing to say, no lines", () => {
  assert.deepEqual(boardNotifications(none), []);
  // People could not be read: no manager line (People says why).
  assert.deepEqual(boardNotifications({ ...none, managers: null }), []);
});

test("boardNotifications: the daily check's list, as problems with their link", () => {
  assert.deepEqual(boardNotifications({ ...none, attention: [iqamah] }), [
    {
      key: iqamah.key,
      level: "problem",
      title: iqamah.title,
      link: { href: "/admin/prayer-times", label: "Open Prayer & iqamah" },
    },
  ]);
});

test("boardNotifications: the manager and Pages-editor warnings follow People", () => {
  const lines = boardNotifications({
    ...none,
    managers: { active: 1, short: true },
    nobodyEditsPages: true,
  });
  assert.deepEqual(
    lines.map(({ title, level, link }) => [title, level, link?.href]),
    [
      [
        "Only 1 active person can manage people. Give a second person Manage people.",
        "problem",
        "/admin/people",
      ],
      ["Nobody can edit pages: add an executive", "problem", "/admin/people"],
    ],
  );
  // A second manager added: the warning is gone on the next load.
  assert.deepEqual(
    boardNotifications({ ...none, managers: { active: 2, short: false } }),
    [],
  );
});

test("boardNotifications: without Manage people, no manager or Pages-editor line (they cannot fix it)", () => {
  assert.deepEqual(
    boardNotifications({
      ...none,
      canManagePeople: false,
      managers: { active: 1, short: true },
      nobodyEditsPages: true,
    }),
    [],
  );
  // The daily check's list is for everyone.
  assert.equal(
    boardNotifications({
      ...none,
      canManagePeople: false,
      attention: [iqamah],
    }).length,
    1,
  );
});

test("boardNotifications: a recent prayer change is information, after the problems", () => {
  const lines = boardNotifications({
    ...none,
    attention: [iqamah],
    prayerChange: {
      id: 41,
      actor: "Omar Haddad",
      when: "Tue 6 Oct at 2:15 PM",
    },
  });
  assert.deepEqual(
    lines.map(({ key, level }) => [key, level]),
    [
      [iqamah.key, "problem"],
      ["prayer-change:41", "info"],
    ],
  );
  assert.equal(
    lines[1].detail,
    "Omar Haddad changed the prayer settings on Tue 6 Oct at 2:15 PM (Grenada time). Check that the times on the Prayer page are right.",
  );
  assert.equal(lines[1].link?.href, "/admin/activity");
});

test("boardNotifications: an Executive board member with no photo is a closable nudge with its link (review fixes P4)", () => {
  const omar = { id: "p1", name: "Omar Haddad", role: "President" };
  const aisha = { id: "p2", name: "Aisha Rahman", role: "Treasurer" };
  assert.deepEqual(
    boardNotifications({ ...none, executivesWithoutPhoto: [omar] }),
    [
      {
        key: "executive-photos:p1",
        level: "info",
        title: "Add a photo of Omar Haddad, President",
        detail: "The About page shows the Executive board with their photos.",
        link: { href: "/admin/people/p1", label: "Add a photo" },
      },
    ],
  );
  const [both] = boardNotifications({
    ...none,
    executivesWithoutPhoto: [omar, aisha],
  });
  assert.equal(both.title, "Add photos of 2 Executive board members");
  assert.equal(both.key, "executive-photos:p1,p2");
  assert.equal(both.link?.href, "/admin/people");
  // Every photo added: the line is gone by itself.
  assert.deepEqual(
    boardNotifications({ ...none, executivesWithoutPhoto: [] }),
    [],
  );
});
