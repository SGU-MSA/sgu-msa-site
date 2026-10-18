import test from "node:test";
import assert from "node:assert/strict";

import { jumuahNoticeWords } from "../src/features/admin/fields";
import {
  jumuahNotices,
  postNotices,
  prayerSavedPath,
} from "../src/features/admin/jumuah-notices";
import type { WriteResult } from "../src/lib/backend/providers/contract";
import {
  emptyPrayer,
  type CommunityRecord,
  type PrayerSettings,
} from "../src/lib/community/schema";

// PR5a WP6 (D-3, D-19): what a prayer save posts for a changed Friday.
const friday = "2026-10-16";
const now = new Date("2026-10-12T14:00:00Z");
const iqamah = { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" };
const withCancelledFriday: PrayerSettings = {
  ...emptyPrayer,
  jumuah_sessions: [{ khutbah: "12:45", iqamah: "13:00" }],
  exceptions: [
    { date: friday, reason: "Exams", iqamah, jumuah: { change: "cancelled" } },
  ],
};

/** The posted form: the Friday's card (row 0) and its question's answers. */
function form(answers: Record<string, string>) {
  const data = new FormData();
  data.set("exception_0_date", friday);
  data.set("exception_0_jumuah", "cancelled");
  for (const [field, value] of Object.entries(answers))
    data.set(`exception_0_${field}`, value);
  return data;
}

const yes = {
  notice: "yes",
  notice_text: "No Jumu’ah at the Musallah this Friday (16 Oct)",
  notice_on: friday,
  notice_at: "13:30",
};

test("Jumu'ah question: Yes posts one published urgent notice ending at Hide at", () => {
  const { notices, problems } = jumuahNotices(
    form(yes),
    withCancelledFriday,
    emptyPrayer,
    now,
  );
  assert.deepEqual(problems, {});
  assert.equal(notices.length, 1);
  const [notice] = notices as Extract<
    CommunityRecord,
    { urgent_until?: unknown }
  >[];
  assert.equal(notice.title, yes.notice_text);
  assert.equal(notice.published, true);
  assert.equal(
    Date.parse(String(notice.urgent_until)),
    Date.parse("2026-10-16T13:30:00-04:00"),
  );
});

test("Jumu'ah question: No posts no notice and refuses nothing", () => {
  assert.deepEqual(
    jumuahNotices(
      form({ ...yes, notice: "no" }),
      withCancelledFriday,
      emptyPrayer,
      now,
    ),
    { notices: [], problems: {} },
  );
});

test("Jumu'ah question: unanswered refuses on its own box; an unchanged Friday asks nothing", () => {
  assert.deepEqual(
    jumuahNotices(form({}), withCancelledFriday, emptyPrayer, now),
    {
      notices: [],
      problems: { exception_0_notice: jumuahNoticeWords.unanswered },
    },
  );
  assert.deepEqual(
    jumuahNotices(form({}), withCancelledFriday, withCancelledFriday, now),
    { notices: [], problems: {} },
  );
  // A notice the announcement rules refuse names its own boxes.
  assert.deepEqual(
    jumuahNotices(
      form({ ...yes, notice_text: "" }),
      withCancelledFriday,
      emptyPrayer,
      now,
    ).problems,
    { exception_0_notice_text: "Notice text: fill in this box." },
  );
});

test("a notice that cannot be posted keeps the prayer save and shows ?notice=failed", async () => {
  const { notices } = jumuahNotices(
    form(yes),
    withCancelledFriday,
    emptyPrayer,
    now,
  );
  const saved = async (): Promise<WriteResult> => ({ ok: true });
  assert.equal(await postNotices(notices, saved), true);
  assert.equal(prayerSavedPath(true), "/admin/prayer-times");
  const unavailable = async (): Promise<WriteResult> => ({
    ok: false,
    reason: "unavailable",
  });
  assert.equal(await postNotices(notices, unavailable), false);
  // A thrown save counts as failed and the next notice is still posted.
  let calls = 0;
  const throwsFirst = async (): Promise<WriteResult> => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return { ok: true };
  };
  assert.equal(await postNotices([...notices, ...notices], throwsFirst), false);
  assert.equal(calls, 2);
  assert.equal(prayerSavedPath(false), "/admin/prayer-times?notice=failed");
});
