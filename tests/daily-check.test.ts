import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cronAuthorized, runDailyCheck } from "../src/lib/backend/daily-check";
import { createSampleWarningLedger } from "../src/lib/backend/providers/sample-ledger";
import { createSampleWarningMailer } from "../src/lib/backend/providers/sample-mailer";
import type {
  WarningLedger,
  WarningMailer,
} from "../src/lib/backend/providers/contract";
import { sandboxStore } from "../src/lib/demo/store";
import type { AttentionReads } from "../src/lib/community/attention";

// Daily check WP-5 (docs/contracts/daily-check-notifications.md): the nightly
// run with the sample mailer and ledger and a fixed date per night, then the
// route itself on a sandbox configuration.
const END = "2026-10-15";
const SITE = "https://sgu-msa-site.vercel.app";
const night = (offset: number) =>
  new Date(Date.parse(`${END}T12:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

function sandbox(seedIso: string) {
  const seed = new Date(seedIso);
  const store = sandboxStore(seed);
  let prayer: { valid_until: string } | null = { valid_until: END };
  let giving: AttentionReads["giving"] = { seasons: [], items: [], links: [] };
  let storageBytes: number | null = 0;
  let mailer: WarningMailer = createSampleWarningMailer(seed);
  let ledger: WarningLedger = createSampleWarningLedger(seed);
  const run = (today: string) =>
    runDailyCheck({
      read: async () => ({
        prayer: prayer && { ...prayer, hijri_adjustment: 0 },
        giving,
        storageBytes,
      }),
      ledger,
      mailer,
      today,
      siteUrl: SITE,
    });
  return {
    store,
    run,
    setPrayer: (value: typeof prayer) => (prayer = value),
    setGiving: (value: typeof giving) => (giving = value),
    setStorage: (value: number | null) => (storageBytes = value),
    setMailer: (value: WarningMailer) => (mailer = value),
    setLedger: (value: WarningLedger) => (ledger = value),
    sampleLedger: () => createSampleWarningLedger(seed),
  };
}

test("cron secret: only the exact Bearer header passes", () => {
  const secret = "s".repeat(40);
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  for (const header of [
    null,
    "",
    secret,
    `Bearer ${secret}x`,
    `bearer ${secret}`,
    `Bearer ${"t".repeat(40)}`,
    `Basic ${secret}`,
  ])
    assert.equal(cronAuthorized(header, secret), false, String(header));
});

test("iqamah 7 days away: one email; then none until the last call; none after the end", async () => {
  const { store, run } = sandbox("2032-01-01T12:00:00Z");
  assert.deepEqual(await run(night(-8)), {
    status: 200,
    body: { warnings: 0, emailed: 0 },
  });
  assert.deepEqual(await run(night(-7)), {
    status: 200,
    body: { warnings: 1, emailed: 1 },
  });
  assert.equal(store.sentWarnings.length, 1);
  assert.equal(
    store.sentWarnings[0].subject,
    "SGU MSA website: 1 thing needs attention",
  );
  assert.match(store.sentWarnings[0].text, /\(in 7 days\)/);
  // A second run the same night, and the following nights: nothing new.
  for (const offset of [-7, -6, -5, -4, -3, -2])
    assert.deepEqual(
      await run(night(offset)),
      { status: 200, body: { warnings: 1, emailed: 0 } },
      `night ${offset}`,
    );
  assert.equal(store.sentWarnings.length, 1);
  assert.deepEqual((await run(night(-1))).body, { warnings: 1, emailed: 1 });
  assert.match(store.sentWarnings[1].text, /\(tomorrow\)/);
  for (const offset of [-1, 0, 1, 5])
    assert.deepEqual(
      (await run(night(offset))).body,
      { warnings: 1, emailed: 0 },
      `night ${offset}`,
    );
  // At most 2 emails for the problem (D-13); the dashboard still lists it.
  assert.equal(store.sentWarnings.length, 2);
});

test("a failed send records nothing, so the next night sends", async () => {
  const box = sandbox("2032-02-01T12:00:00Z");
  const working = createSampleWarningMailer(new Date("2032-02-01T12:00:00Z"));
  for (const reason of ["rejected", "unavailable"] as const) {
    box.setMailer({ send: async () => ({ ok: false, reason }) });
    assert.deepEqual(await box.run(night(-7)), {
      status: 500,
      body: { warnings: 1, emailed: 0, failed: "mail" },
    });
    const read = await box.sampleLedger().alreadySent([`iqamah:${END}`]);
    assert.ok("sent" in read && read.sent.size === 0);
  }
  box.setMailer(working);
  assert.deepEqual((await box.run(night(-6))).body, {
    warnings: 1,
    emailed: 1,
  });
  assert.equal(box.store.sentWarnings.length, 1);
});

test("mail off (not Vercel Production): nothing sent, nothing recorded, no error", async () => {
  const box = sandbox("2032-03-01T12:00:00Z");
  box.setMailer({ send: async () => ({ ok: false, reason: "off" }) });
  assert.deepEqual(await box.run(night(-7)), {
    status: 200,
    body: { warnings: 1, emailed: 0 },
  });
  const read = await box.sampleLedger().alreadySent([`iqamah:${END}`]);
  assert.ok("sent" in read && read.sent.size === 0);
});

test("prayer settings unreadable: 500 facts, no email (P-8 A)", async () => {
  const box = sandbox("2032-04-01T12:00:00Z");
  box.setPrayer(null);
  assert.deepEqual(await box.run(night(-7)), {
    status: 500,
    body: { warnings: 0, emailed: 0, failed: "facts" },
  });
  assert.equal(box.store.sentWarnings.length, 0);
});

test("any read unavailable (seasons and funds, or the photo space): 500 facts, no email", async () => {
  const box = sandbox("2032-04-15T12:00:00Z");
  box.setGiving(null);
  assert.deepEqual(await box.run(night(-7)), {
    status: 500,
    body: { warnings: 0, emailed: 0, failed: "facts" },
  });
  box.setGiving({ seasons: [], items: [], links: [] });
  box.setStorage(null);
  assert.deepEqual((await box.run(night(-7))).body, {
    warnings: 0,
    emailed: 0,
    failed: "facts",
  });
  assert.equal(box.store.sentWarnings.length, 0);
});

test("photo space 80% full: one email listing it with the iqamah warning, then a last call 3 nights later", async () => {
  const box = sandbox("2032-04-20T12:00:00Z");
  box.setStorage(800_000_000);
  assert.deepEqual((await box.run(night(-7))).body, {
    warnings: 2,
    emailed: 2,
  });
  assert.equal(box.store.sentWarnings.length, 1, "one combined email");
  assert.match(
    box.store.sentWarnings[0].text,
    /2\. \[Photos\] Photo space is 80% full \(800 MB of 1 GB\)\./,
  );
  assert.deepEqual((await box.run(night(-6))).body, {
    warnings: 2,
    emailed: 0,
  });
  // Night 4 of the space warning (and the iqamah last call is not due yet).
  assert.deepEqual((await box.run(night(-4))).body, {
    warnings: 2,
    emailed: 1,
  });
  assert.match(box.store.sentWarnings[1].subject, /1 thing needs attention/);
  // 95% is a new problem with its own two emails.
  box.setStorage(950_000_000);
  assert.deepEqual((await box.run(night(-3))).body, {
    warnings: 2,
    emailed: 1,
  });
  assert.match(box.store.sentWarnings[2].text, /95% full/);
});

test("ledger unreadable: no email; ledger write fails after a send: 500, sent again next night", async () => {
  const box = sandbox("2032-05-01T12:00:00Z");
  const real = box.sampleLedger();
  box.setLedger({
    alreadySent: async () => ({ unavailable: true }),
    record: real.record,
  });
  assert.deepEqual(await box.run(night(-7)), {
    status: 500,
    body: { warnings: 1, emailed: 0, failed: "ledger" },
  });
  assert.equal(box.store.sentWarnings.length, 0);
  box.setLedger({
    alreadySent: real.alreadySent,
    record: async () => ({ ok: false }),
  });
  assert.deepEqual(await box.run(night(-7)), {
    status: 500,
    body: { warnings: 1, emailed: 1, failed: "ledger" },
  });
  box.setLedger(real);
  assert.deepEqual((await box.run(night(-6))).body, {
    warnings: 1,
    emailed: 1,
  });
  assert.equal(box.store.sentWarnings.length, 2);
});

test("the route: 401 without the right header, counts only with it (sandbox wiring)", async () => {
  const secret = "c".repeat(48);
  // The sandbox seeds iqamah times that end on the seed day and a fund that
  // ended 3 days before it (fixtures).
  Object.assign(process.env, {
    NODE_ENV: "test",
    SITE_DEMO_MODE: "true",
    SITE_DEMO_DATE: "2033-06-01T12:00:00Z",
    SITE_URL: "http://localhost:3000",
    CRON_SECRET: secret,
  });
  const { GET } = await import("../src/app/api/daily-check/route");
  const call = (init?: RequestInit, query = "") =>
    GET(new Request(`http://localhost:3000/api/daily-check${query}`, init));
  const store = sandboxStore(new Date("2033-06-01T12:00:00Z"));
  for (const response of [
    await call(),
    await call({ headers: { authorization: "Bearer wrong" } }),
    await call(undefined, `?secret=${secret}`),
    await call({ headers: { authorization: secret } }),
  ]) {
    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Unauthorized");
  }
  assert.equal(store.sentWarnings.length, 0);
  const ok = await call({ headers: { authorization: `Bearer ${secret}` } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");
  const body = await ok.text();
  assert.deepEqual(JSON.parse(body), { warnings: 2, emailed: 2 });
  assert.ok(!body.includes(secret) && !/iqamah|Prayer/.test(body));
  assert.equal(store.sentWarnings.length, 1);
  assert.match(store.sentWarnings[0].text, /Fix it: http:\/\/localhost:3000\//);
  assert.match(store.sentWarnings[0].text, /\[Go2Pay\] “Flood relief” ended/);
  const again = await call({ headers: { authorization: `Bearer ${secret}` } });
  assert.deepEqual(await again.json(), { warnings: 2, emailed: 0 });
});

test("the route never reads the secret from the URL and sends at most one email", () => {
  const route = readFileSync("src/app/api/daily-check/route.ts", "utf8");
  assert.doesNotMatch(route, /searchParams|nextUrl|\.url\b/);
  assert.match(route, /headers\.get\("authorization"\)/);
  const run = readFileSync("src/lib/backend/daily-check.ts", "utf8");
  assert.equal(run.match(/mailer\.send\(/g)?.length, 1);
  // Cron entry: once a day at 05:00 UTC (01:00 Grenada), git block unchanged.
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(vercel.crons, [
    { path: "/api/daily-check", schedule: "0 5 * * *" },
  ]);
  assert.deepEqual(vercel.git, {
    deploymentEnabled: { "**": false, main: true },
  });
});
