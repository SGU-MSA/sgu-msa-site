import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createGo2PayGateway } from "../src/lib/integrations/payments/providers/go2pay";
import {
  createFakeCheckout,
  createFakeGateway,
} from "../src/lib/integrations/payments/providers/fake";
import { offPaymentGateway } from "../src/lib/integrations/payments/providers/off-gateway";
import { createSamplePaymentsProvider } from "../src/lib/integrations/payments/providers/sample";
import { createSamplePaymentItemEditor } from "../src/lib/backend/providers/sample-payments";
import { createSampleSeasonEditor } from "../src/lib/backend/providers/sample-seasons";
import { createSampleMerchEditor } from "../src/lib/backend/providers/sample-merch";
import { sandboxStore } from "../src/lib/demo/store";
import { paymentsReport } from "../src/lib/community/payment-policy";

// PR6 WP-4: the Go2Pay gateway over a stub fetch, the fake and off gateways,
// the sandbox adapters' mirrors of the database rules, and the sandbox
// composition (Donate page data and the Give target).

const KEY = "g2p_test_do-not-print-0000";
type Reply = { status: number; body?: unknown } | "network";

/** A stand-in for fetch: answers per path, records every call. */
function stubFetch(replies: Record<string, Reply>) {
  const calls: { path: string; auth: string | null }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "") + url.search;
    calls.push({
      path,
      auth: new Headers(init?.headers).get("Authorization"),
    });
    const reply = replies[path] ?? replies[url.pathname.replace("/api/v1", "")];
    if (!reply || reply === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status,
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const order = (id: number, product = 557) => ({
  id,
  product_id: product,
  first_name: "Sample",
  last_name: "Giver",
  email: "giver@example.invalid",
  phone: "+1 473 000 0000",
  address: "Example street",
  customer_ip: "203.0.113.1",
  payment_intent_secret: "pi_example_secret",
  price: "1.00",
  qty: 1,
  donation: "24.00",
  subtotal: "25.00",
  processing_fee: "1.27",
  customer_total: "26.27",
  service_fee: "1.25",
  refunded: "0.00",
  status: "PAID",
  note: "For the carpets",
  created: "2026-10-04 10:00:00",
  test_mode: 0,
  pay_product: { id: product, title: "Fund", price: "1.00" },
});

test("Go2Pay checkKey: a payments-only key is refused on products; a broader key is not", async () => {
  const cases: [Record<string, Reply>, unknown][] = [
    [
      { "/auth/me": { status: 200 }, "/products": { status: 403 } },
      { ok: true, scope: "payments_only" },
    ],
    [
      { "/auth/me": { status: 200 }, "/products": { status: 200 } },
      { ok: true, scope: "too_broad" },
    ],
    [{ "/auth/me": { status: 401 } }, { ok: false, reason: "unauthorized" }],
    [{ "/auth/me": "network" }, { ok: false, reason: "unreachable" }],
    [{ "/auth/me": { status: 500 } }, { ok: false, reason: "unreachable" }],
  ];
  for (const [replies, expected] of cases) {
    const { fetch, calls } = stubFetch(replies);
    const gateway = createGo2PayGateway({
      key: KEY,
      mode: "test",
      refuseBroadKey: false,
      fetch,
    });
    assert.deepEqual(await gateway.checkKey(), expected);
    // Asked once per gateway (one request).
    await gateway.checkKey();
    assert.ok(calls.length <= 2);
    for (const call of calls) {
      assert.equal(call.auth, `Bearer ${KEY}`);
      assert.match(call.path, /^\/(auth\/me|products\?page=1)$/);
    }
    assert.ok(!JSON.stringify(expected).includes(KEY));
  }
});

test("Go2Pay listOrders: reads one product's page, keeps only what Payments needs, pages on", async () => {
  const { fetch, calls } = stubFetch({
    "/orders?product_id=557&page=2": {
      status: 200,
      body: {
        success: true,
        data: [order(12), order(11)],
        pagination: { page: 2, limit: 20, total: 45, total_pages: 3 },
      },
    },
  });
  const gateway = createGo2PayGateway({
    key: KEY,
    mode: "test",
    refuseBroadKey: false,
    fetch,
  });
  const read = await gateway.listOrders(557, 2);
  assert.ok(read.ok);
  assert.equal(read.more, true);
  assert.deepEqual(read.orders[0], {
    id: 12,
    product_id: 557,
    first_name: "Sample",
    last_name: "Giver",
    qty: 1,
    subtotal: 2500,
    customer_total: 2627,
    refunded: 0,
    status: "PAID",
    note: "For the carpets",
    created: "2026-10-04 10:00:00",
    test_mode: false,
  });
  // Only GET /orders; never products, bank accounts or any write.
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/orders?product_id=557&page=2"],
  );
  assert.equal(gateway.checkoutUrl(557), "https://go2pay.gd/557");
  assert.equal(gateway.mode, "test");
});

test("Go2Pay listOrders: wrong shapes and other products are unreadable; errors carry no key", async () => {
  const replies = (body: unknown, status = 200): Record<string, Reply> => ({
    "/orders?product_id=557&page=1": { status, body },
  });
  for (const [label, reply, reason] of [
    ["not a list", replies({ data: "nope" }), "unreadable"],
    ["another product", replies({ data: [order(1, 999)] }), "unreadable"],
    [
      "a missing amount",
      replies({ data: [{ ...order(1), subtotal: "x" }] }),
      "unreadable",
    ],
    ["revoked", replies({}, 401), "unauthorized"],
    ["down", replies({}, 503), "unreachable"],
  ] as const) {
    const gateway = createGo2PayGateway({
      key: KEY,
      mode: "test",
      refuseBroadKey: false,
      fetch: stubFetch(reply).fetch,
    });
    const result = await gateway.listOrders(557, 1);
    assert.deepEqual(result, { ok: false, reason }, label);
    assert.ok(!JSON.stringify(result).includes(KEY));
  }
});

test("Go2Pay: the live site refuses a too-broad key before reading orders; elsewhere it only warns", async () => {
  const replies: Record<string, Reply> = {
    "/auth/me": { status: 200 },
    "/products": { status: 200 },
    "/orders?product_id=557&page=1": {
      status: 200,
      body: { data: [order(1)], pagination: { page: 1, total_pages: 1 } },
    },
  };
  const live = stubFetch(replies);
  const refused = createGo2PayGateway({
    key: KEY,
    mode: "live",
    refuseBroadKey: true,
    fetch: live.fetch,
  });
  assert.deepEqual(await refused.listOrders(557, 1), {
    ok: false,
    reason: "too_broad",
  });
  assert.ok(!live.calls.some((c) => c.path.startsWith("/orders")));
  const dev = createGo2PayGateway({
    key: KEY,
    mode: "test",
    refuseBroadKey: false,
    fetch: stubFetch(replies).fetch,
  });
  const read = await dev.listOrders(557, 1);
  assert.ok(read.ok && read.orders.length === 1 && !read.more);
  // A payments-only key reads on the live site.
  const ok = createGo2PayGateway({
    key: KEY,
    mode: "live",
    refuseBroadKey: true,
    fetch: stubFetch({ ...replies, "/products": { status: 403 } }).fetch,
  });
  assert.ok((await ok.listOrders(557, 1)).ok);
});

test("off gateway: no key, no reads; Give still goes to the Go2Pay page", async () => {
  assert.deepEqual(await offPaymentGateway.checkKey(), {
    ok: false,
    reason: "off",
  });
  assert.deepEqual(await offPaymentGateway.listOrders(1, 1), {
    ok: false,
    reason: "off",
  });
  assert.equal(offPaymentGateway.checkoutUrl(9), "https://go2pay.gd/9");
});

test("fake gateway and checkout: sample orders, the sandbox checkout, a paid order shows in the report", async () => {
  const seed = new Date("2026-10-05T16:00:00Z");
  const gateway = createFakeGateway(seed);
  assert.equal(gateway.mode, "sample");
  assert.equal(gateway.checkoutUrl(9001), "/checkout/9001");
  const first = await gateway.listOrders(9001, 1);
  assert.ok(first.ok);
  // One gift and one unfinished attempt (which the report hides).
  assert.deepEqual(first.orders.map((o) => o.status).sort(), [
    "PAID",
    "REQUIRES_PAYMENT_METHOD",
  ]);
  const checkout = createFakeCheckout(seed);
  assert.deepEqual(await checkout.product(9001), {
    title: "MSA & Musallah",
    kind: "fund",
  });
  assert.equal(await checkout.product(1), null);
  assert.equal(
    await checkout.pay({ productId: 1, amount: 100, note: "" }),
    false,
  );
  assert.equal(
    await checkout.pay({ productId: 9001, amount: 0, note: "" }),
    false,
  );
  assert.ok(
    await checkout.pay({ productId: 9001, amount: 1000, note: "test note" }),
  );
  const after = await gateway.listOrders(9001, 1);
  assert.ok(after.ok);
  const store = sandboxStore(seed);
  const report = paymentsReport(
    after.orders,
    [...store.paymentItems.values()],
    store.paymentLinks,
  );
  const line = report.unrestricted.lines.find(
    (l) => l.name === "MSA & Musallah",
  );
  assert.equal(line?.gift, 2500 + 1000);
  assert.ok(report.rows.some((row) => row.note === "test note"));
});

test("sample payments provider: current rows only, the current link, unknown slugs", async () => {
  const provider = createSamplePaymentsProvider(
    new Date("2026-10-06T16:00:00Z"),
  );
  const { items, links, unavailable, provenance } = await provider.items();
  assert.equal(unavailable, false);
  assert.equal(provenance, "sample");
  assert.ok(
    !items.some((item) => item.slug === "old-general-fund"),
    "archived",
  );
  assert.ok(links.every((l) => items.some((i) => i.id === l.payment_item_id)));
  const found = await provider.itemBySlug("iftar");
  assert.equal(found.found?.link?.go2pay_product_id, 9002);
  for (const slug of ["old-general-fund", "nope", "../x", "UPPER"])
    assert.deepEqual(await provider.itemBySlug(slug), {
      found: null,
      unavailable: false,
    });
  const { seasons } = await provider.seasons();
  assert.deepEqual(seasons.map((s) => s.name).sort(), [
    "Eid al-Adha",
    "Eid al-Fitr",
    "Islamic Awareness Week",
    "Ramadan",
  ]);
});

test("sample payments provider: an unlisted draft and its Go2Pay link stay hidden, as the read policy does", async () => {
  const seed = new Date("2026-10-06T17:00:00Z");
  const store = sandboxStore(seed);
  const sadaqah = [...store.paymentItems.values()].find(
    (item) => item.slug === "sadaqah",
  )!;
  store.paymentItems.set(sadaqah.id, { ...sadaqah, listed: false });
  const provider = createSamplePaymentsProvider(seed);
  const { items, links } = await provider.items();
  assert.ok(!items.some((item) => item.id === sadaqah.id));
  assert.ok(!links.some((link) => link.payment_item_id === sadaqah.id));
  assert.deepEqual(await provider.itemBySlug("sadaqah"), {
    found: null,
    unavailable: false,
  });
});

test("sample item editor mirrors the database: lock, slugs, one item per product, archived read-only, highlights", async () => {
  const seed = new Date("2026-10-07T16:00:00Z");
  const editor = createSamplePaymentItemEditor(seed);
  const store = sandboxStore(seed);
  const { items } = await editor.listItems();
  const zakat = items.find((i) => i.slug === "zakat-al-mal")!;
  // A shown fund's category is locked; its name is not.
  assert.deepEqual(
    await editor.saveItem(
      { ...zakat, category: "sadaqah" },
      zakat.updated_at,
      null,
    ),
    { ok: false, reason: "fund_locked" },
  );
  assert.deepEqual(
    await editor.saveItem(
      { ...zakat, slug: "renamed" },
      zakat.updated_at,
      null,
    ),
    { ok: false, reason: "fund_locked" },
  );
  assert.deepEqual(
    await editor.saveItem({ ...zakat, name: "Zakat" }, zakat.updated_at, null),
    { ok: true },
  );
  // A new unlisted fund is not locked; listing locks it and is highlighted.
  const id = "00000000-0000-4000-8000-0000000007aa";
  const fresh = {
    ...zakat,
    id,
    slug: "test-sadaqah",
    name: "Test sadaqah",
    category: "sadaqah" as const,
    listed: false,
    first_shown_at: "2020-01-01T00:00:00Z",
  };
  assert.deepEqual(await editor.saveItem(fresh, null, 1234), { ok: true });
  let saved = (await editor.readItem(id)).item!;
  assert.equal(saved.first_shown_at, null, "a sent stamp is ignored");
  assert.deepEqual(
    await editor.saveItem(
      { ...saved, category: "general" },
      saved.updated_at,
      null,
    ),
    { ok: true },
  );
  saved = (await editor.readItem(id)).item!;
  const mark = store.activity.length;
  assert.deepEqual(
    await editor.saveItem({ ...saved, listed: true }, saved.updated_at, 5678),
    { ok: true },
  );
  const logged = store.activity.slice(mark);
  assert.deepEqual(
    logged.map((e) => [e.area, e.highlight]),
    [
      ["payment_items", true],
      ["payment_item_links", true],
    ],
  );
  assert.equal(logged[1].record_id, "5678");
  const read = await editor.readItem(id);
  assert.deepEqual(
    read.links.map((l) => l.go2pay_product_id),
    [5678, 1234],
    "newest first",
  );
  // D-17: a product linked to another item is refused, and nothing is saved.
  saved = read.item!;
  assert.deepEqual(
    await editor.saveItem(
      { ...saved, name: "Changed" },
      saved.updated_at,
      9001,
    ),
    { ok: false, reason: "link_taken" },
  );
  assert.equal((await editor.readItem(id)).item!.name, "Test sadaqah");
  // Re-pasting the current link is no change.
  assert.deepEqual(await editor.saveItem(saved, saved.updated_at, 5678), {
    ok: true,
  });
  // Re-pasting this item's own earlier link is refused with its own reason.
  const latest = (await editor.readItem(id)).item!;
  assert.deepEqual(
    await editor.saveItem(
      { ...latest, name: "Changed" },
      latest.updated_at,
      1234,
    ),
    { ok: false, reason: "link_used_before" },
  );
  assert.equal((await editor.readItem(id)).item!.name, "Test sadaqah");
  // Slugs are never reused, archived items included.
  assert.deepEqual(
    await editor.saveItem(
      {
        ...fresh,
        id: "00000000-0000-4000-8000-0000000007ab",
        slug: "old-general-fund",
      },
      null,
      null,
    ),
    { ok: false, reason: "slug_taken" },
  );
  // Archived rows are read-only until restored.
  saved = (await editor.readItem(id)).item!;
  assert.deepEqual(await editor.archiveItem(id, saved.updated_at), {
    ok: true,
  });
  saved = (await editor.readItem(id)).item!;
  assert.deepEqual(await editor.saveItem(saved, saved.updated_at, null), {
    ok: false,
    reason: "conflict",
  });
  assert.deepEqual(await editor.restoreItem(id, saved.updated_at), {
    ok: true,
  });
  assert.deepEqual(await editor.restoreItem(id, saved.updated_at), {
    ok: false,
    reason: "conflict",
  });
});

test("sample season editor: one current name, in-use seasons stay, day changes highlighted", async () => {
  const seed = new Date("2026-10-08T16:00:00Z");
  const seasons = createSampleSeasonEditor(seed);
  const store = sandboxStore(seed);
  const all = (await seasons.listSeasons()).seasons;
  const eid = all.find((s) => s.name === "Eid al-Fitr")!;
  const ramadan = all.find((s) => s.name === "Ramadan")!;
  assert.deepEqual(await seasons.archiveSeason(eid.id, eid.updated_at), {
    ok: false,
    reason: "in_use",
  });
  assert.deepEqual(
    await seasons.saveSeason(
      { ...ramadan, name: "EID AL-FITR" },
      ramadan.updated_at,
    ),
    { ok: false, reason: "name_taken" },
  );
  const mark = store.activity.length;
  assert.deepEqual(
    await seasons.saveSeason(
      { ...ramadan, board_starts_on: "2027-02-08" },
      ramadan.updated_at,
    ),
    { ok: true },
  );
  assert.equal(store.activity.at(-1)?.highlight, true);
  assert.equal(store.activity.length, mark + 1);
  const updated = (await seasons.listSeasons()).seasons.find(
    (s) => s.id === ramadan.id,
  )!;
  assert.deepEqual(
    await seasons.archiveSeason(ramadan.id, updated.updated_at),
    {
      ok: true,
    },
  );
  assert.equal((await seasons.listSeasons("archived")).seasons.length, 1);
});

test("sample merch editor: an item with current sizes stays until they are archived (SGU16)", async () => {
  const seed = new Date("2026-10-08T16:00:00Z");
  const merch = createSampleMerchEditor(seed);
  const items = createSamplePaymentItemEditor(seed);
  const shirt = (await merch.listItems()).items.find(
    (item) => item.name === "Shukr long-sleeve",
  )!;
  assert.deepEqual(await merch.archiveItem(shirt.id, shirt.updated_at), {
    ok: false,
    reason: "in_use",
  });
  const sizes = (await items.listItems()).items.filter(
    (item) => item.merch_item_id === shirt.id,
  );
  assert.ok(sizes.length > 0, "the sandbox shirt has sizes");
  for (const size of sizes)
    assert.deepEqual(await items.archiveItem(size.id, size.updated_at), {
      ok: true,
    });
  assert.deepEqual(await merch.archiveItem(shirt.id, shirt.updated_at), {
    ok: true,
  });
});

/** The sandbox composition (wiring, fixtures, policies), in a child process with sample settings. */
function sandbox(script: string) {
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      script,
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "development",
        SITE_DEMO_MODE: "true",
        SITE_DEMO_DATE: "2026-10-05T16:00:00Z",
        SITE_URL: "http://localhost:3000",
        CRON_SECRET: "off",
      },
      encoding: "utf8",
    },
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test("sandbox: the Donate page data and the Give targets", () => {
  const result = sandbox(`
    const { loadDonatePage, loadGiveTarget } = require("./src/lib/integrations/payments/index.ts");
    (async () => {
      const now = new Date(process.env.SITE_DEMO_DATE);
      const page = await loadDonatePage(now);
      const give = {};
      for (const slug of ["iftar", "flood-relief", "old-general-fund", "welcome-dinner-ticket", "nope"])
        give[slug] = await loadGiveTarget(slug, now);
      process.stdout.write(JSON.stringify({ page, give }));
    })();
  `);
  const { page, give } = result;
  assert.equal(page.state, "ready");
  assert.equal(page.intentionLine, "The fund you choose is your intention.");
  // Review fixes P4: the Go2Pay notice sits near the top, not in the fine print.
  assert.equal(
    page.notice,
    "Payments are made on Go2Pay, an outside service. About 5% goes to fees.",
  );
  assert.deepEqual(page.finePrint, [
    "Payments are handled by Go2Pay, an independent payment service not affiliated with the SGU MSA. This website doesn't store your payment details.",
  ]);
  const groups = page.groups.map(
    (g: { heading: string | null; slips: { title: string }[] }) => [
      g.heading,
      g.slips.map((s) => s.title),
    ],
  );
  // Zakat first, then Sadaqah (Iftar is order 2, under the board's heading), then General.
  assert.deepEqual(groups, [
    [null, ["Zakat al-Fitr", "Zakat al-Mal"]],
    ["Ramadan", ["Iftar"]],
    [null, ["Sadaqah", "MSA & Musallah", "Study circle books"]],
  ]);
  const slips = page.groups.flatMap((g: { slips: unknown[] }) => g.slips);
  const books = slips.find(
    (s: { title: string }) => s.title === "Study circle books",
  );
  assert.equal(books.closingSoon, "Closes tomorrow");
  // Ended, archived, out-of-season funds and tickets are not on the page.
  for (const title of [
    "Flood relief",
    "Old general fund",
    "Eid gifts",
    "Welcome dinner ticket",
  ])
    assert.ok(!slips.some((s: { title: string }) => s.title === title), title);
  assert.ok(!JSON.stringify(page).includes("go2pay.gd"));
  assert.deepEqual(give.iftar, {
    state: "redirect",
    url: "/checkout/9002",
  });
  assert.deepEqual(give["welcome-dinner-ticket"], {
    state: "redirect",
    url: "/checkout/9101",
  });
  for (const slug of ["flood-relief", "old-general-fund", "nope"])
    assert.deepEqual(give[slug], { state: "closed" }, slug);
});

test("sandbox: a postponed event's ticket button pauses until its new date is set and it is Scheduled (D-81, review 2)", () => {
  const result = sandbox(`
    const { loadEventTicket } = require("./src/lib/integrations/payments/index.ts");
    const { DEMO_TICKET_ID } = require("./src/lib/demo/fixtures.ts");
    (async () => {
      const now = new Date(process.env.SITE_DEMO_DATE);
      const event = (changes) => ({
        ticket_payment_item_id: DEMO_TICKET_ID,
        date: "2026-10-16",
        start_time: "18:00",
        end_time: "20:00",
        status: "scheduled",
        ...changes,
      });
      process.stdout.write(JSON.stringify({
        scheduled: await loadEventTicket(event({}), now),
        noDate: await loadEventTicket(event({ status: "postponed" }), now),
        // Review 2: the new date set and Scheduled again.
        newDate: await loadEventTicket(event({ date: "2026-10-17" }), now),
        cancelled: await loadEventTicket(event({ status: "cancelled" }), now),
      }));
    })();
  `);
  const button = {
    slug: "welcome-dinner-ticket",
    title: "Welcome dinner ticket",
    giveHref: "/donate/welcome-dinner-ticket/give",
  };
  assert.deepEqual(result.scheduled, button);
  assert.equal(result.noDate, null);
  assert.deepEqual(result.newDate, button);
  assert.equal(result.cancelled, null);
});
