import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  itemFromForm,
  moneyFilters,
  moneyQuery,
  seasonFromForm,
  seasonPreview,
  confirmedDayHint,
  confirmedDayProblems,
  confirmedDayReach,
  startingConfirmedDay,
  seasonRanges,
  seasonYearFor,
} from "../src/features/admin/payment-forms";
import {
  categoryCardLines,
  itemFlagText,
  donateStatusText,
  gatewayWords,
  money,
  seasonRule,
  windowWords,
} from "../src/features/admin/payment-words";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canSeeMoney, readMoneyIn } from "../src/lib/backend/admin-payments";
import { MoneyKeyNotices } from "../src/features/admin/PaymentsReport";
import type { PaymentGateway } from "../src/lib/integrations/payments/providers/contract";
import { collectOrders } from "../src/lib/integrations/payments/orders";
import {
  CATEGORIES,
  GO2PAY_LINK_ERROR,
} from "../src/lib/community/payment-policy";
import {
  go2payOrderSchema,
  type Go2PayOrder,
} from "../src/lib/community/payments";
import type { SeasonDates } from "../src/lib/community/season-policy";
import { seasonSchema } from "../src/lib/community/seasons";
import {
  activityEntrySchema,
  activityKinds,
  describeChange,
} from "../src/lib/community/activity";
import { hijriMonthName } from "../src/lib/time/hijri";
import { outOfDate } from "../src/lib/system-text";

// PR6 PR-B (WP-5, WP-6, WP-7): how the Funds, Tickets, Seasons and Payments
// forms are read, the Payments filters, the order paging with its time
// budget, the money-holder guard, and the Recent changes words for giving.

const today = "2026-10-08";
const id = randomUUID();
const fund = (values: Record<string, string> = {}) => ({
  id,
  name: "Iftar",
  category: "sadaqah",
  about: "Helps pay for iftar.",
  heading: "",
  position: "2",
  ...values,
});
const read = (
  values: Record<string, string>,
  extra: Partial<Parameters<typeof itemFromForm>[0]> = {},
) =>
  itemFromForm({
    values,
    kind: "fund",
    slug: "iftar",
    before: null,
    currentLink: null,
    season: null,
    ...extra,
  });

test("fund form: a link that is not a Go2Pay page is refused with the example (D-58)", () => {
  for (const link of ["go2pay.gd/1234x", "https://evil.com/557", "go2pay.gd/0"])
    assert.deepEqual(read(fund({ link })), {
      ok: false,
      fields: { link: GO2PAY_LINK_ERROR },
    });
  const ok = read(fund({ link: "https://www.go2pay.gd/1650/" }));
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.link, 1650);
  // The current link pasted again is no change.
  const same = read(fund({ link: "go2pay.gd/1650" }), {
    currentLink: {
      go2pay_product_id: 1650,
      payment_item_id: id,
      added_at: "2026-10-01T00:00:00Z",
    },
  });
  assert.ok(same.ok && same.link === null);
});

test("fund form: no default category; heading over 40 refused; a new fund needs the order number its screen gave", () => {
  const result = read(
    fund({ category: "", heading: "x".repeat(41), position: "" }),
  );
  assert.equal(result.ok, false);
  // Each problem on its own box (review 2).
  assert.deepEqual(!result.ok && result.fields, {
    category: "Category: choose one.",
    position: outOfDate,
    heading: "Heading: use 40 characters or fewer.",
  });
});

test("fund form: a saved fund keeps its place; only dragging changes it (review fixes PR-2)", () => {
  const saved = read(fund({ position: "99" }), {
    before: {
      category: "sadaqah",
      position: 3,
      season_id: "",
      season_year: null,
      first_shown_at: null,
    },
  });
  assert.ok(saved.ok);
  assert.equal(saved.ok && saved.row.position, 3);
  const added = read(fund({ position: "7" }));
  assert.equal(added.ok && added.row.position, 7);
});

test("fund form: Show needs a link, and a zakat fund needs its sentence (readyToList)", () => {
  const noLink = read(fund({ listed: "on" }));
  assert.deepEqual(noLink, {
    ok: false,
    fields: { link: "Go2Pay page link: paste it before ticking Show." },
  });
  const zakat = read(
    fund({
      category: "zakat_al_mal",
      about: "",
      listed: "on",
      link: "go2pay.gd/77",
    }),
  );
  assert.equal(zakat.ok, false);
  assert.match(!zakat.ok ? zakat.fields.about : "", /^About this fund: zakat/);
  const listed = read(fund({ listed: "on", link: "go2pay.gd/77" }));
  assert.ok(listed.ok && listed.row.listed && listed.link === 77);
});

test("fund form: a locked category comes from the saved row, never from the form (D-61)", () => {
  const saved = {
    id,
    slug: "iftar",
    name: "Iftar",
    kind: "fund" as const,
    category: "sadaqah" as const,
    about: "",
    heading: "",
    listed: true,
    position: 2,
    season_id: "",
    season_year: null,
    shows_from: "",
    shows_until: "",
    first_shown_at: "2026-09-01T00:00:00Z",
  };
  const result = read(fund({ category: "zakat_al_mal" }), { before: saved });
  assert.ok(result.ok);
  assert.equal(result.ok && result.row.category, "sadaqah");
  assert.equal(result.ok && result.row.first_shown_at, saved.first_shown_at);
});

test("ticket form: always General, no heading, no season", () => {
  const result = itemFromForm({
    values: fund({
      category: "zakat_al_mal",
      heading: "Ramadan",
      season_id: randomUUID(),
    }),
    kind: "priced",
    slug: "dinner",
    before: null,
    currentLink: null,
    season: null,
  });
  assert.ok(result.ok);
  assert.equal(result.ok && result.row.category, "general");
  assert.equal(result.ok && result.row.heading, "");
  assert.equal(result.ok && result.row.season_id, "");
});

const ramadan = (hijriYear: number): SeasonDates => ({
  state: "dates",
  first: "2027-02-08",
  last: "2027-03-08",
  firstStatus: "expected",
  lastStatus: "expected",
  hijriYear,
  boardDayIgnored: false,
});

test("Running again (D-14): a waiting fund keeps last year's occurrence until ticked", () => {
  const seasonId = randomUUID();
  const before = { season_id: seasonId, season_year: 1447 };
  const season = ramadan(1448);
  assert.equal(
    seasonYearFor({ before: null, seasonId, rerun: false, season }),
    1448,
  );
  assert.equal(seasonYearFor({ before, seasonId, rerun: false, season }), 1447);
  assert.equal(seasonYearFor({ before, seasonId, rerun: true, season }), 1448);
  assert.equal(
    seasonYearFor({ before, seasonId: "", rerun: false, season }),
    null,
  );
  // Ticking it asks which Go2Pay page to use.
  const unanswered = read(fund({ rerun: "on" }));
  assert.equal(unanswered.ok, false);
  const newPage = read(fund({ rerun: "on", rerun_link: "new" }));
  assert.deepEqual(!newPage.ok && newPage.fields, {
    link: "Go2Pay page link: paste the new page's link.",
  });
  assert.ok(read(fund({ rerun: "on", rerun_link: "same" })).ok);
});

test("season form: Islamic anchor or typed days, with the database's checks", () => {
  const islamic = seasonFromForm({
    id,
    name: "Ramadan",
    calendar: "islamic",
    hijri_month: "9",
    hijri_first_day: "1",
    hijri_last_day: "",
  });
  assert.ok(islamic.ok);
  assert.equal(islamic.ok && islamic.row.hijri_last_day, null);
  const typed = seasonFromForm({
    id,
    name: "Awareness week",
    calendar: "typed",
    hijri_month: "9",
    board_starts_on: "2027-04-12",
  });
  assert.deepEqual(typed, {
    ok: false,
    fields: { board_starts_on: "First day: type the first and the last day." },
  });
  const backwards = seasonFromForm({
    id,
    name: "Eid",
    calendar: "islamic",
    hijri_month: "10",
    hijri_first_day: "3",
    hijri_last_day: "1",
  });
  assert.deepEqual(!backwards.ok && backwards.fields, {
    hijri_last_day: "Until day: choose a day on or after the from day.",
  });
});

test("season screen words: the anchor reads as a rule, days are Gregorian only (D-78)", () => {
  const names = Array.from({ length: 12 }, (_, i) => hijriMonthName(i + 1));
  assert.equal(names[8], "Ramadan");
  assert.equal(names[9], "Shawwal");
  const rule = (month: number, first: number, last: number | null) =>
    seasonRule(
      { hijri_month: month, hijri_first_day: first, hijri_last_day: last },
      names,
    );
  assert.equal(
    rule(9, 1, null),
    "Starts on 1 Ramadan, until the end of Ramadan",
  );
  assert.equal(rule(10, 1, 1), "On 1 Shawwal");
  assert.equal(
    seasonRule(
      { hijri_month: null, hijri_first_day: null, hijri_last_day: null },
      names,
    ),
    "Days typed by the board",
  );
  const preview = seasonPreview(
    {
      id,
      name: "Ramadan",
      calendar: "islamic",
      hijri_month: "9",
      hijri_first_day: "1",
      hijri_last_day: "",
      board_starts_on: "",
      board_ends_on: "",
    },
    today,
    0,
  );
  assert.ok(preview.expected);
  assert.doesNotMatch(preview.expected ?? "", /1448|AH|Ramadan/);
  assert.match(preview.expected ?? "", /2027/);
  assert.equal(
    windowWords({ from: "2027-02-08", until: "2027-03-08", blocked: null }),
    "Shows Mon 8 Feb – Mon 8 Mar 2027",
  );
});

test("category cards: rule lines from CATEGORIES, other words keyed on the rule flags", () => {
  assert.equal(
    categoryCardLines("zakat_al_mal")[0],
    CATEGORIES.zakat_al_mal.ruleLine,
  );
  assert.ok(
    categoryCardLines("zakat_al_fitr").some((line) => /Eid al-Fitr/.test(line)),
  );
  assert.deepEqual(categoryCardLines("sadaqah"), categoryCardLines("general"));
  assert.equal(
    itemFlagText({ code: "ended", on: "2026-10-05" }),
    "Ended on 5 Oct 2026 · close it in Go2Pay",
  );
  assert.equal(
    itemFlagText({ code: "ended", on: "2026-10-05" }, { endDateShown: true }),
    "Close it in Go2Pay",
  );
  // A fund's Donate line says the weekday, like the rest of its row.
  assert.equal(
    donateStatusText([
      { code: "starts", on: "2027-03-09" },
      { code: "ended", on: "2026-10-04" },
    ]),
    "Not on the Donate page: starts on Tue 9 Mar 2027, ended on Sun 4 Oct 2026",
  );
  assert.equal(money(124000), "US$1,240.00");
});

test("Payments filters: last 30 days by default, a season replaces the days, unknown values ignored", () => {
  const ranges = [
    {
      id: randomUUID(),
      label: "Ramadan 2026",
      first: "2026-02-18",
      last: "2026-03-19",
    },
  ];
  const plain = moneyFilters({}, today, ranges);
  assert.deepEqual(plain, {
    from: "2026-09-09",
    until: today,
    season: "",
    category: "",
    item: "",
    status: "all",
  });
  const season = moneyFilters(
    { season: ranges[0].id, from: "2026-01-01", status: "REFUNDED" },
    today,
    ranges,
  );
  assert.equal(season.from, "2026-02-18");
  assert.equal(season.until, "2026-03-19");
  assert.equal(season.status, "REFUNDED");
  assert.match(moneyQuery(season), /^season=/);
  const swapped = moneyFilters(
    { from: "2026-10-01", until: "2026-09-01", category: "bogus", item: "x" },
    today,
    ranges,
  );
  assert.deepEqual(
    [swapped.from, swapped.until, swapped.category, swapped.item],
    ["2026-09-01", "2026-10-01", "", ""],
  );
});

test("Payments season filter: the latest started occurrence (last Ramadan after it ended)", () => {
  const season = seasonSchema.parse({
    id,
    name: "Ramadan",
    hijri_month: 9,
    hijri_first_day: 1,
    hijri_last_day: null,
  });
  const [range] = seasonRanges([season], today, 0);
  assert.ok(range);
  assert.ok(range.first < today && range.first.startsWith("2026-02"));
  assert.match(range.label, /^Ramadan 2026 \(/);
  assert.deepEqual(seasonRanges([season], today, null), []);
});

const order = (n: number, product: number, created: string): Go2PayOrder =>
  go2payOrderSchema.parse({
    id: n,
    product_id: product,
    first_name: "Sample",
    last_name: "Donor",
    subtotal: "10.00",
    customer_total: "10.69",
    refunded: "0",
    status: "PAID",
    note: "",
    created,
  });

test("collectOrders: pages newest first until before the range, keeps only the range", async () => {
  const pages: Record<number, Go2PayOrder[][]> = {
    1: [
      [order(5, 1, "2026-10-07 10:00:00"), order(4, 1, "2026-10-01 10:00:00")],
      [order(3, 1, "2026-09-20 10:00:00"), order(2, 1, "2026-08-30 10:00:00")],
      [order(1, 1, "2026-08-01 10:00:00")],
    ],
    2: [[order(9, 2, "2026-10-08 09:00:00")]],
  };
  const calls: string[] = [];
  const result = await collectOrders({
    gateway: {
      async listOrders(productId, page) {
        calls.push(`${productId}:${page}`);
        const all = pages[productId];
        return {
          ok: true,
          orders: all[page - 1] ?? [],
          more: page < all.length,
        };
      },
    },
    productIds: [1, 2, 1],
    from: "2026-09-09",
    until: "2026-10-07",
    elapsed: () => 0,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.ok && result.orders.map((o) => o.id), [5, 4, 3]);
  assert.equal(result.ok && result.partial, false);
  // Page 3 of product 1 is never read: page 2 already reaches before the range.
  assert.deepEqual(calls.sort(), ["1:1", "1:2", "2:1"]);
});

test("collectOrders: out of time is partial; a refused page fails the whole read", async () => {
  let clock = 0;
  const slow = await collectOrders({
    gateway: {
      async listOrders() {
        clock += 5_000;
        return {
          ok: true,
          orders: [order(1, 1, "2026-10-07 10:00:00")],
          more: true,
        };
      },
    },
    productIds: [1],
    from: "2026-09-09",
    until: today,
    elapsed: () => clock,
  });
  assert.ok(slow.ok && slow.partial);
  const refused = await collectOrders({
    gateway: {
      async listOrders(productId) {
        return productId === 2
          ? { ok: false, reason: "unauthorized" }
          : { ok: true, orders: [], more: false };
      },
    },
    productIds: [1, 2],
    from: "2026-09-09",
    until: today,
    elapsed: () => 0,
  });
  assert.deepEqual(refused, { ok: false, reason: "unauthorized" });
});

test("only 'manage money' holders read orders; saving a fund never calls Go2Pay (D-64, D-65)", () => {
  const admin = {
    userId: "u",
    email: "a@example.invalid",
    canManagePeople: true,
    canManageMoney: false,
    canEditPages: true,
  };
  assert.equal(canSeeMoney(null), false);
  assert.equal(canSeeMoney(admin), false);
  assert.equal(canSeeMoney({ ...admin, canManageMoney: true }), true);
  for (const file of [
    "src/features/admin/payment-actions.ts",
    "src/features/admin/season-actions.ts",
  ])
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /paymentGateway|go2pay\.gd\/api|fetch\(/,
      `${file} must not call Go2Pay`,
    );
});

test("Money in: warning, access checks, and gateway outcomes", async (t) => {
  const holder = {
    userId: "u",
    email: "a@example.invalid",
    canManagePeople: false,
    canManageMoney: true,
    canEditPages: false,
  };
  const gateway = (
    mode: PaymentGateway["mode"],
    scope: "payments_only" | "too_broad",
  ): PaymentGateway => ({
    mode,
    checkKey: async () => ({ ok: true, scope }),
    listOrders: async () => ({ ok: true, orders: [], more: false }),
    checkoutUrl: (product) => `https://go2pay.gd/${product}`,
  });
  const emptyRows = { items: [], links: [], unavailable: false };
  const orderRows: NonNullable<Parameters<typeof readMoneyIn>[2]> = {
    items: [
      {
        id: randomUUID(),
        slug: "iftar",
        name: "Iftar",
        kind: "fund",
        category: "sadaqah",
        about: "Helps pay for iftar.",
        heading: "",
        listed: true,
        position: 1,
        season_id: "",
        season_year: null,
        shows_from: "",
        shows_until: "",
        first_shown_at: null,
        merch_item_id: "",
        size_label: "",
        updated_at: "2026-10-01T00:00:00Z",
        archived_at: null,
      },
    ],
    links: [
      {
        go2pay_product_id: 41,
        payment_item_id: "",
        added_at: "2026-10-01T00:00:00Z",
      },
    ],
    unavailable: false,
  };
  orderRows.links[0].payment_item_id = orderRows.items[0].id;
  const read = (
    g: PaymentGateway,
    rows: NonNullable<Parameters<typeof readMoneyIn>[2]> = emptyRows,
  ) =>
    readMoneyIn(
      holder,
      {
        from: "2026-10-01",
        until: today,
        category: "",
        item: "",
        status: "all",
      },
      rows,
      g,
    );
  const html = async (g: PaymentGateway) => {
    const money = await read(g);
    assert.equal(money.state, "ready");
    return renderToStaticMarkup(
      createElement(MoneyKeyNotices, {
        mode: money.state === "ready" ? money.mode : null,
        broadKey: money.state === "ready" && money.broadKey,
      }),
    );
  };
  const broad = await read(gateway("test", "too_broad"));
  assert.equal(broad.state === "ready" && broad.broadKey, true);
  const warned = await html(gateway("test", "too_broad"));
  assert.ok(warned.includes('role="alert"'));
  assert.ok(warned.includes(gatewayWords.too_broad));
  assert.match(warned, /Orders shown are real\./);
  const narrow = await html(gateway("live", "payments_only"));
  assert.equal(narrow, "");
  await t.test("unavailable board rows stop before Go2Pay calls", async () => {
    let keyCalls = 0;
    let orderCalls = 0;
    assert.deepEqual(
      await read(
        {
          ...gateway("live", "payments_only"),
          checkKey: async () => {
            keyCalls += 1;
            return { ok: true, scope: "payments_only" };
          },
          listOrders: async () => {
            orderCalls += 1;
            return { ok: true, orders: [], more: false };
          },
        },
        { items: [], links: [], unavailable: true },
      ),
      { state: "unavailable" },
    );
    assert.equal(keyCalls, 0);
    assert.equal(orderCalls, 0);
  });

  await t.test(
    "a refused key stops before fetching linked orders",
    async () => {
      let keyCalls = 0;
      let orderCalls = 0;
      assert.deepEqual(
        await read(
          {
            ...gateway("live", "payments_only"),
            checkKey: async () => {
              keyCalls += 1;
              return { ok: false, reason: "unauthorized" };
            },
            listOrders: async () => {
              orderCalls += 1;
              return { ok: true, orders: [], more: false };
            },
          },
          orderRows,
        ),
        { state: "gateway", problem: "unauthorized", mode: "live" },
      );
      assert.equal(keyCalls, 1);
      assert.equal(orderCalls, 0);
    },
  );

  await t.test(
    "an order-fetch failure returns only the safe gateway state",
    async () => {
      assert.deepEqual(
        await read(
          {
            ...gateway("live", "payments_only"),
            listOrders: async () => ({ ok: false, reason: "unreachable" }),
          },
          orderRows,
        ),
        { state: "gateway", problem: "unreachable", mode: "live" },
      );
    },
  );

  // Someone without "manage money" never reaches the gateway.
  assert.deepEqual(
    await readMoneyIn(
      { ...holder, canManageMoney: false },
      {
        from: "2026-10-01",
        until: today,
        category: "",
        item: "",
        status: "all",
      },
      { items: [], links: [], unavailable: false },
      {
        ...gateway("live", "payments_only"),
        checkKey: () => assert.fail("no Go2Pay call without manage money"),
      },
    ),
    { state: "forbidden" },
  );
});

test("Recent changes: giving rows read by name, with the category tag and the Go2Pay page", () => {
  const itemId = randomUUID();
  const names = new Map([[itemId, "Iftar"]]);
  const link = describeChange(
    activityEntrySchema.parse({
      id: 1,
      occurred_at: "2026-10-08T12:00:00Z",
      actor: null,
      area: "payment_item_links",
      record_id: "1650",
      action: "created",
      before: null,
      after: {
        go2pay_product_id: 1650,
        payment_item_id: itemId,
        added_at: "2026-10-08T12:00:00Z",
      },
      highlight: true,
    }),
    names,
  );
  assert.equal(link.label, "Added Go2Pay link");
  assert.equal(link.subject, "Iftar");
  assert.deepEqual(
    link.fields.map((f) => [f.name, f.after]),
    [
      ["Go2Pay page", "go2pay.gd/1650"],
      ["Fund or ticket", "Iftar"],
    ],
  );
  const row = {
    id: itemId,
    name: "Iftar",
    category: "sadaqah",
    kind: "fund",
    updated_at: "a",
  };
  const edit = describeChange(
    activityEntrySchema.parse({
      id: 2,
      occurred_at: "2026-10-08T12:00:00Z",
      actor: null,
      area: "payment_items",
      record_id: itemId,
      action: "updated",
      before: row,
      after: { ...row, category: "general", updated_at: "b" },
      highlight: false,
    }),
    names,
  );
  assert.equal(edit.label, "Edited fund or ticket");
  assert.deepEqual(edit.fields, [
    { name: "Category", before: "Sadaqah", after: "General", hidden: false },
  ]);
  assert.deepEqual(activityKinds.giving.areas, [
    "payment_items",
    "payment_item_links",
    "seasons",
  ]);
});

test("a confirmed season day: within 5 days of the expected day, typed ones checked, last year's starts empty (review fixes P4)", () => {
  assert.deepEqual(confirmedDayReach("2027-02-08"), {
    from: "2027-02-03",
    until: "2027-02-13",
  });
  assert.equal(confirmedDayReach(null), null);
  assert.equal(
    confirmedDayHint(confirmedDayReach("2027-02-08")!),
    "Choose a day from Wed 3 Feb to Sat 13 Feb 2027.",
  );
  const preview = { expectedFirst: "2027-02-08", expectedLast: "2027-03-09" };
  assert.deepEqual(
    confirmedDayProblems(
      {
        calendar: "islamic",
        board_starts_on: "2027-02-13",
        board_ends_on: "",
      },
      preview,
    ),
    {},
  );
  assert.deepEqual(
    confirmedDayProblems(
      {
        calendar: "islamic",
        board_starts_on: "2027-02-14",
        board_ends_on: "2027-02-20",
      },
      preview,
    ),
    {
      board_starts_on: "Choose a day within 5 days of the expected day.",
      board_ends_on: "Choose a day within 5 days of the expected day.",
    },
  );
  // Days I type: no reach.
  assert.deepEqual(
    confirmedDayProblems(
      { calendar: "typed", board_starts_on: "2020-01-01" },
      preview,
    ),
    {},
  );
  assert.equal(startingConfirmedDay("2026-02-18", "2027-02-08"), "");
  assert.equal(startingConfirmedDay("2027-02-09", "2027-02-08"), "2027-02-09");
  assert.equal(startingConfirmedDay("2027-02-09", null), "2027-02-09");
  assert.equal(startingConfirmedDay(undefined, "2027-02-08"), "");
});
