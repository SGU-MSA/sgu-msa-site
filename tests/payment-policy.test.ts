import test from "node:test";
import assert from "node:assert/strict";
import {
  canPayNow,
  CATEGORIES,
  closedReasons,
  closingSoon,
  donateGroups,
  donateOrder,
  donateSlip,
  FEE_LINE,
  go2payCopyText,
  go2payPageUrl,
  GO2PAY_LINK_ERROR,
  INTENTION_LINE,
  orderDay,
  parseGo2PayLink,
  paymentItemFlags,
  paymentItemVisible,
  paymentItemWindow,
  paymentsCsv,
  paymentsReport,
  readyToList,
  slugFor,
  windowOpen,
  zakatAlFitrLastDay,
  type ItemWindow,
} from "../src/lib/community/payment-policy";
import {
  currentLinks,
  donatePageDataSchema,
  go2payOrderSchema,
  paymentItemFromRow,
  paymentItemSchema,
  paymentItemToRow,
  type Category,
  type PaymentItem,
  type PaymentItemLink,
} from "../src/lib/community/payments";
import { resolveSeason } from "../src/lib/community/season-policy";
import { seasonSchema } from "../src/lib/community/seasons";

// PR6 WP-4: the fixed giving rules (ADR 0020), pure.

let n = 0;
const item = (fields: Partial<PaymentItem> = {}): PaymentItem =>
  paymentItemSchema.parse({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    slug: `item-${n}`,
    name: `Item ${n}`,
    kind: "fund",
    category: "general",
    about: "",
    listed: true,
    position: 1,
    ...fields,
  });
const link = (
  owner: PaymentItem,
  product: number,
  at = "2026-10-01T00:00:00Z",
): PaymentItemLink => ({
  go2pay_product_id: product,
  payment_item_id: owner.id,
  added_at: at,
});
const always: ItemWindow = {
  from: null,
  until: null,
  blocked: null,
  ownDateIgnored: false,
  seasonYear: null,
  season: null,
};
const today = "2026-10-05";

test("parseGo2PayLink: go2pay.gd links only, the id kept, everything else refused with the example", () => {
  for (const [text, id] of [
    ["go2pay.gd/1650", 1650],
    ["https://go2pay.gd/1650", 1650],
    ["https://www.go2pay.gd/1650/", 1650],
    ["  go2pay.gd/557?ref=flyer  ", 557],
    ["HTTPS://GO2PAY.GD/557#top", 557],
  ] as const)
    assert.deepEqual(parseGo2PayLink(text), { ok: true, id }, text);
  for (const text of [
    "",
    "go2pay.gd/0",
    "go2pay.gd/",
    "go2pay.gd/1234x",
    "go2pay.gd/abc",
    "http://go2pay.gd/557",
    "https://go2pay.gd.evil.com/1",
    "https://evil.com/go2pay.gd/1",
    "https://go2pay.gd/557/edit",
    "go2pay.gd/1234567890123",
    "javascript:go2pay.gd/1",
  ])
    assert.deepEqual(
      parseGo2PayLink(text),
      { ok: false, error: GO2PAY_LINK_ERROR },
      text,
    );
  assert.equal(
    GO2PAY_LINK_ERROR,
    "Paste the Go2Pay page link, for example go2pay.gd/557.",
  );
  assert.equal(go2payPageUrl(557), "https://go2pay.gd/557");
});

test("CATEGORIES: four fixed categories; only zakat is restricted and has a rule line (round 2 wording)", () => {
  assert.deepEqual(Object.keys(CATEGORIES), [
    "zakat_al_fitr",
    "zakat_al_mal",
    "sadaqah",
    "general",
  ]);
  assert.equal(
    CATEGORIES.zakat_al_fitr.ruleLine,
    "Goes to people in need before Eid prayer.",
  );
  assert.equal(
    CATEGORIES.zakat_al_mal.ruleLine,
    "Goes only to people who can receive zakat.",
  );
  for (const category of ["sadaqah", "general"] as const) {
    assert.equal(CATEGORIES[category].ruleLine, null);
    assert.equal(CATEGORIES[category].restricted, false);
    assert.equal(CATEGORIES[category].aboutRequired, false);
  }
  assert.equal(CATEGORIES.zakat_al_fitr.closesBeforeEidPrayer, true);
  assert.equal(CATEGORIES.zakat_al_mal.closesBeforeEidPrayer, false);
  assert.equal(INTENTION_LINE, "The fund you choose is your intention.");
  // Review fixes P4: the Go2Pay notice near the top of Donate.
  assert.equal(
    FEE_LINE,
    "Payments are made on Go2Pay, an outside service. About 5% goes to fees.",
  );
});

test("donateSlip: each category's slip, no heading by default, no Hijri date, Give through our route", () => {
  const slips = (
    [
      ["zakat_al_fitr", "Zakat al-Fitr", "US$10 per person in your household."],
      ["zakat_al_mal", "Zakat al-Mal", "Passed on to people in need."],
      ["sadaqah", "Sadaqah", "Used where it helps most."],
      ["general", "General", "Keeps the Musallah and the MSA running."],
    ] as const
  ).map(([category, tag, about]) => {
    const slip = donateSlip(
      item({ category, about, slug: category.replaceAll("_", "-") }),
      always,
      today,
    );
    assert.equal(slip.tag, tag);
    assert.equal(slip.about, about);
    assert.equal(slip.heading, null);
    assert.equal(slip.closingSoon, null);
    assert.equal(
      slip.giveHref,
      `/donate/${category.replaceAll("_", "-")}/give`,
    );
    return slip;
  });
  assert.equal(slips[0].ruleLine, CATEGORIES.zakat_al_fitr.ruleLine);
  assert.equal(slips[2].ruleLine, null);
  // Nothing on a slip is a Hijri date or a Go2Pay address.
  const text = JSON.stringify(slips);
  assert.doesNotMatch(text, /AH\b|Ramadan \d|Shawwal|go2pay\.gd/);
  // Empty board text is null, not "".
  assert.equal(donateSlip(item({ about: "  " }), always, today).about, null);
  // The page shape validates.
  assert.ok(
    donatePageDataSchema.safeParse({
      state: "ready",
      notice: FEE_LINE,
      intentionLine: INTENTION_LINE,
      groups: donateGroups(slips),
      finePrint: [],
    }).success,
  );
});

test("donateOrder and donateGroups: zakat first, then season funds, Sadaqah, General; headings group neighbours only", () => {
  const ramadanId = "00000000-0000-4000-8000-0000000005a1";
  const general = item({
    name: "MSA & Musallah",
    category: "general",
    position: 1,
  });
  const sadaqah = item({ name: "Sadaqah", category: "sadaqah", position: 1 });
  const iftar = item({
    name: "Iftar",
    category: "sadaqah",
    season_id: ramadanId,
    heading: "Ramadan",
    position: 2,
  });
  const suhoor = item({
    name: "Suhoor",
    category: "general",
    season_id: ramadanId,
    heading: "Ramadan",
    position: 1,
  });
  const mal = item({
    name: "Zakat al-Mal",
    category: "zakat_al_mal",
    position: 9,
  });
  const fitr = item({
    name: "Zakat al-Fitr",
    category: "zakat_al_fitr",
    position: 9,
  });
  const ordered = donateOrder([general, sadaqah, iftar, suhoor, mal, fitr]);
  assert.deepEqual(
    ordered.map((i) => i.name),
    [
      "Zakat al-Fitr",
      "Zakat al-Mal",
      "Suhoor",
      "Iftar",
      "Sadaqah",
      "MSA & Musallah",
    ],
  );
  const groups = donateGroups(ordered.map((i) => donateSlip(i, always, today)));
  assert.deepEqual(
    groups.map((g) => [g.heading, g.slips.map((s) => s.title)]),
    [
      [null, ["Zakat al-Fitr", "Zakat al-Mal"]],
      ["Ramadan", ["Suhoor", "Iftar"]],
      [null, ["Sadaqah", "MSA & Musallah"]],
    ],
  );
  // A heading split by another slip prints twice (the preview shows it, D-77).
  const split = donateGroups(
    [iftar, sadaqah, suhoor].map((i) => donateSlip(i, always, today)),
  );
  assert.deepEqual(
    split.map((g) => g.heading),
    ["Ramadan", null, "Ramadan"],
  );
  assert.deepEqual(donateGroups([]), []);
});

test("readyToList: zakat needs About this fund; every fund and item needs a link", () => {
  const zakat = item({ category: "zakat_al_mal" });
  assert.deepEqual(readyToList(zakat, null), {
    ok: false,
    missing: ["about", "link"],
  });
  assert.deepEqual(
    readyToList({ ...zakat, about: "Passed on." }, link(zakat, 1)),
    { ok: true },
  );
  assert.deepEqual(readyToList(item({ category: "sadaqah" }), null), {
    ok: false,
    missing: ["link"],
  });
  assert.deepEqual(readyToList(item({ category: "general" }), link(zakat, 2)), {
    ok: true,
  });
});

test("windows: own dates, season dates with one day's grace while expected, zakat al-Fitr capped without grace", () => {
  const ramadan = seasonSchema.parse({
    id: "00000000-0000-4000-8000-0000000005a1",
    name: "Ramadan",
    hijri_month: 9,
    hijri_first_day: 1,
    hijri_last_day: null,
  });
  const dates = resolveSeason(ramadan, today, 0);
  const iftar = item({ category: "sadaqah", season_id: ramadan.id });
  const window = paymentItemWindow(iftar, dates, "2027-03-08");
  assert.equal(window.from, "2027-02-08");
  assert.equal(window.until, "2027-03-09", "expected last day + 1 (D-22)");
  assert.equal(window.seasonYear, 1448);
  // Confirmed last day: no grace.
  const confirmed = resolveSeason(
    { ...ramadan, board_ends_on: "2027-03-08" },
    today,
    0,
  );
  assert.equal(paymentItemWindow(iftar, confirmed, null).until, "2027-03-08");
  // Zakat al-Fitr: capped at the day before 1 Shawwal, no grace.
  const zakatLast = zakatAlFitrLastDay([ramadan], today, 0);
  assert.equal(zakatLast, "2027-03-08");
  const fitr = item({
    category: "zakat_al_fitr",
    about: "x",
    season_id: ramadan.id,
  });
  assert.equal(paymentItemWindow(fitr, dates, zakatLast).until, "2027-03-08");
  // Without a season it is still capped; with no Hijri data it stays closed (closing early is safe).
  assert.equal(
    paymentItemWindow(item({ category: "zakat_al_fitr" }), null, zakatLast)
      .until,
    "2027-03-08",
  );
  assert.equal(
    paymentItemWindow(item({ category: "zakat_al_fitr" }), null, null).blocked,
    "season_unavailable",
  );
  // An own date replaces only its side; one far from the season is last year's.
  const own = paymentItemWindow(
    { ...iftar, shows_until: "2027-03-01" },
    dates,
    null,
  );
  assert.deepEqual([own.from, own.until], ["2027-02-08", "2027-03-01"]);
  const stale = paymentItemWindow(
    { ...iftar, shows_from: "2026-02-18" },
    dates,
    null,
  );
  assert.equal(stale.from, "2027-02-08");
  assert.equal(stale.ownDateIgnored, true);
  // Waiting for "running again" (D-14) and an unavailable or archived season.
  assert.equal(
    paymentItemWindow({ ...iftar, season_year: 1447 }, dates, null).blocked,
    "waiting_rerun",
  );
  assert.equal(
    paymentItemWindow({ ...iftar, season_year: 1448 }, dates, null).blocked,
    null,
  );
  assert.equal(
    paymentItemWindow(iftar, { state: "unavailable" }, null).blocked,
    "season_unavailable",
  );
  assert.equal(
    paymentItemWindow(iftar, null, null).blocked,
    "season_unavailable",
  );
  assert.equal(
    paymentItemWindow(iftar, { state: "over" }, null).blocked,
    "season_over",
  );
  // No season and no dates: always.
  assert.deepEqual(paymentItemWindow(item(), null, null), always);
});

test("canPayNow and visibility: our own rows and dates only", () => {
  const fund = item();
  const l = link(fund, 5);
  const window = { ...always, from: "2026-10-01", until: "2026-10-05" };
  assert.equal(canPayNow(fund, l, window, "2026-10-05"), "ok");
  assert.equal(canPayNow(fund, l, window, "2026-10-06"), "closed");
  assert.equal(canPayNow(fund, l, window, "2026-09-30"), "closed");
  assert.equal(canPayNow(fund, null, window, "2026-10-05"), "closed");
  assert.equal(
    canPayNow({ ...fund, listed: false }, l, window, "2026-10-05"),
    "closed",
  );
  assert.equal(
    canPayNow(
      { ...fund, archived_at: "2026-10-01T00:00:00Z" },
      l,
      window,
      "2026-10-05",
    ),
    "closed",
  );
  assert.equal(
    canPayNow(fund, l, { ...always, blocked: "waiting_rerun" }, today),
    "closed",
  );
  const ticket = item({ kind: "priced" });
  assert.equal(
    paymentItemVisible(ticket, l, always, { onSale: false }, today),
    false,
  );
  assert.equal(
    paymentItemVisible(ticket, l, always, { onSale: true }, today),
    true,
  );
  assert.equal(paymentItemVisible(fund, l, always, null, today), true);
  assert.equal(windowOpen(always, today), true);
});

test("closingSoon: the last 3 Grenada days only, with the slip's words", () => {
  const until = (day: string) => ({ ...always, until: day });
  assert.equal(closingSoon(until("2026-10-08"), today), null);
  assert.deepEqual(closingSoon(until("2026-10-07"), today), { daysLeft: 2 });
  assert.deepEqual(closingSoon(until("2026-10-06"), today), { daysLeft: 1 });
  assert.deepEqual(closingSoon(until("2026-10-05"), today), { daysLeft: 0 });
  assert.equal(closingSoon(until("2026-10-04"), today), null, "already closed");
  assert.equal(closingSoon(always, today), null, "no end date");
  const words = ["2026-10-05", "2026-10-06", "2026-10-07"].map(
    (day) => donateSlip(item(), until(day), today).closingSoon,
  );
  assert.deepEqual(words, [
    "Closes today",
    "Closes tomorrow",
    "Closes in 2 days",
  ]);
});

test("board flags: no end, never shows, ended (7 days), no link, locked", () => {
  const fund = item({ first_shown_at: "2026-09-01T16:00:00Z" });
  const codes = (
    window: ItemWindow,
    l: PaymentItemLink | null = link(fund, 1),
  ) => paymentItemFlags(fund, l, window, today).map((f) => f.code);
  assert.deepEqual(codes(always), ["no_end", "locked"]);
  assert.deepEqual(
    codes({ ...always, from: "2026-10-09", until: "2026-10-01" }),
    ["never_shows", "ended", "locked"],
  );
  assert.deepEqual(codes({ ...always, until: "2026-09-28" }), [
    "ended",
    "locked",
  ]);
  assert.deepEqual(
    codes({ ...always, until: "2026-09-27" }),
    ["locked"],
    "after 7 days the reminder goes",
  );
  assert.deepEqual(codes({ ...always, until: "2026-12-01" }, null), [
    "no_link",
    "locked",
  ]);
  assert.deepEqual(
    paymentItemFlags(fund, link(fund, 1), always, today).at(-1),
    { code: "locked", since: "2026-09-01" },
  );
});

test("go2payCopyText: the words to copy into Go2Pay, zakat rule written once", () => {
  assert.deepEqual(
    go2payCopyText(
      item({
        name: "Zakat al-Mal",
        category: "zakat_al_mal",
        about: "Passed on to people in need.",
      }),
      "Thank you for supporting the SGU MSA.",
    ),
    {
      title: "Zakat al-Mal",
      description:
        "Zakat al-Mal. Goes only to people who can receive zakat. Passed on to people in need.",
      caption:
        "Zakat al-Mal. Goes only to people who can receive zakat. Passed on to people in need.",
      receiptNote:
        "Zakat al-Mal (Zakat al-Mal). Thank you for supporting the SGU MSA.",
    },
  );
  assert.equal(
    go2payCopyText(item({ name: "Iftar", category: "sadaqah" }), "x")
      .description,
    "Sadaqah.",
  );
});

test("slugFor: ASCII, lowercase, hyphens; -2 when taken; never empty", () => {
  assert.equal(slugFor("MSA & Musallah", new Set()), "msa-musallah");
  assert.equal(slugFor("Zakât al-Fiṭr", new Set()), "zakat-al-fitr");
  assert.equal(slugFor("Iftar", new Set(["iftar"])), "iftar-2");
  assert.equal(slugFor("Iftar", new Set(["iftar", "iftar-2"])), "iftar-3");
  assert.equal(slugFor("زكاة", new Set()), "give");
  const long = slugFor("x".repeat(100), new Set());
  assert.ok(long.length <= 56);
  assert.match(
    slugFor("  --Hello,  World!--  ", new Set()),
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
  );
});

test("paymentsReport: zakat in its own boxes never summed, no grand total, old links count, attempts hidden", () => {
  const fitr = item({
    name: "Zakat al-Fitr",
    category: "zakat_al_fitr",
    position: 1,
  });
  const mal = item({
    name: "Zakat al-Mal",
    category: "zakat_al_mal",
    position: 2,
  });
  const iftar = item({ name: "Iftar", category: "sadaqah", position: 3 });
  const general = item({
    name: "MSA & Musallah",
    category: "general",
    position: 4,
  });
  const links = [
    link(fitr, 10),
    link(mal, 20),
    link(iftar, 30, "2026-01-01T00:00:00Z"),
    link(iftar, 31, "2026-09-01T00:00:00Z"),
    link(general, 40),
  ];
  const order = (
    id: number,
    product: number,
    gift: string,
    status = "PAID",
    refunded = "0",
    note = "",
  ) =>
    go2payOrderSchema.parse({
      id,
      product_id: product,
      first_name: "Aisha",
      last_name: "Example",
      qty: 1,
      subtotal: gift,
      customer_total: (Number(gift) * 1.039 + 0.3).toFixed(2),
      refunded,
      status,
      note,
      created: `2026-10-0${(id % 5) + 1} 10:00:00`,
      customer_ip: "203.0.113.9",
      payment_intent_secret: "pi_secret",
      address: "Somewhere",
    });
  const report = paymentsReport(
    [
      order(1, 10, "40.00"),
      order(2, 20, "50.00", "PARTIAL REFUND", "10.00"),
      order(3, 30, "30.00", "PAID", "0", "For iftar"),
      order(4, 31, "20.00"),
      order(5, 40, "20.00"),
      order(6, 40, "99.00", "REQUIRES_PAYMENT_METHOD"),
      order(7, 40, "15.00", "REFUNDED", "15.00"),
      order(5, 40, "20.00"), // the same order read twice counts once
    ],
    [fitr, mal, iftar, general],
    links,
  );
  assert.deepEqual(
    report.restricted.map((box) => [
      box.tag,
      box.lines.map((l) => [l.name, l.gift]),
    ]),
    [
      ["Zakat al-Fitr", [["Zakat al-Fitr", 4000]]],
      ["Zakat al-Mal", [["Zakat al-Mal", 5000]]],
    ],
  );
  assert.ok(!("total" in report.restricted[0]), "no zakat total");
  assert.ok(!("total" in report), "no grand total");
  assert.deepEqual(
    report.unrestricted.lines.map((l) => [
      l.name,
      l.orders,
      l.gift,
      l.refunded,
      l.productIds,
    ]),
    [
      ["Iftar", 2, 5000, 0, [30, 31]],
      ["MSA & Musallah", 2, 3500, 1500, [40]],
    ],
  );
  assert.equal(report.unrestricted.subtotal.gift, 8500, "zakat never added");
  assert.equal(report.rows.length, 6);
  assert.ok(
    report.rows.every((row) => row.status !== "REQUIRES_PAYMENT_METHOD"),
  );
  assert.equal(report.rows.find((row) => row.orderId === 3)?.note, "For iftar");
  assert.equal(
    report.rows.find((row) => row.orderId === 3)?.giver,
    "Aisha Example",
  );
  // The parse keeps only what Payments needs.
  const parsed = order(9, 10, "1.00") as Record<string, unknown>;
  for (const field of ["customer_ip", "payment_intent_secret", "address"])
    assert.ok(!(field in parsed), field);
});

test("paymentsCsv: notes but never names; formula-like cells made text", () => {
  const fund = item({ name: "=SUM(A1)", category: "sadaqah" });
  const csv = paymentsCsv(
    paymentsReport(
      [
        go2payOrderSchema.parse({
          id: 77,
          product_id: 5,
          first_name: "Bilal",
          last_name: "Secretname",
          subtotal: "30.00",
          customer_total: "31.47",
          refunded: null,
          status: "PAID",
          note: '@cmd, "quoted"\nline',
          created: "2026-10-04T22:30:00-04:00",
        }),
      ],
      [fund],
      [link(fund, 5)],
    ).rows,
  );
  const [header, row] = csv.trimEnd().split("\r\n");
  assert.equal(
    header,
    "Date,Fund or item,Category,Go2Pay product,Order no.,Gift,Buyer paid,Refunded,Status,Note",
  );
  assert.ok(
    row.startsWith("2026-10-04,'=SUM(A1),Sadaqah,5,77,30.00,31.47,0.00,PAID,"),
  );
  assert.ok(row.endsWith(`"'@cmd, ""quoted""\nline"`));
  assert.ok(!csv.includes("Bilal") && !csv.includes("Secretname"));
});

test("orderDay: Go2Pay times are Grenada days", () => {
  assert.equal(orderDay("2026-10-04 23:30:00"), "2026-10-04");
  assert.equal(orderDay("2026-10-04T23:30:00-04:00"), "2026-10-04");
  assert.equal(orderDay("2026-10-05T02:30:00Z"), "2026-10-04");
});

test("item rows: null season and days read as empty; first_shown_at is never written; checks mirror the database", () => {
  const row = paymentItemFromRow({
    id: "00000000-0000-4000-8000-000000000999",
    slug: "iftar",
    name: "Iftar",
    kind: "fund",
    category: "sadaqah" satisfies Category,
    about: "",
    heading: "",
    listed: false,
    position: 1,
    season_id: null,
    season_year: null,
    shows_from: null,
    shows_until: null,
    first_shown_at: "2026-09-01T00:00:00Z",
    archived_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  });
  assert.equal(row.season_id, "");
  assert.ok(!("first_shown_at" in paymentItemToRow(row)));
  assert.equal(paymentItemToRow(row).shows_from, null);
  for (const bad of [
    { kind: "priced", category: "sadaqah" },
    { kind: "priced", heading: "Tickets" },
    { heading: "x".repeat(41) },
    { about: "x".repeat(301) },
    { slug: "Not A Slug" },
    { shows_from: "2026-10-10", shows_until: "2026-10-09" },
  ])
    assert.equal(
      paymentItemSchema.safeParse({ ...row, ...bad }).success,
      false,
      JSON.stringify(bad),
    );
  // The current link is the newest row.
  const fund = item();
  assert.equal(
    currentLinks([
      link(fund, 1, "2026-01-01T00:00:00Z"),
      link(fund, 2, "2026-02-01T00:00:00Z"),
    ]).get(fund.id)?.go2pay_product_id,
    2,
  );
});

test("closedReasons: why a fund is not on the Donate page, from the rule canPayNow uses (review fixes P4)", () => {
  const fund = item();
  const linked = link(fund, 1650);
  assert.deepEqual(closedReasons(fund, linked, always, today), []);
  assert.equal(canPayNow(fund, linked, always, today), "ok");
  assert.deepEqual(
    closedReasons({ ...fund, listed: false }, null, always, today),
    [{ code: "not_listed" }, { code: "no_link" }],
  );
  assert.deepEqual(
    closedReasons(fund, linked, { ...always, from: "2026-10-12" }, today),
    [{ code: "starts", on: "2026-10-12" }],
  );
  assert.deepEqual(
    closedReasons(
      fund,
      linked,
      {
        ...always,
        from: "2027-02-08",
        until: "2027-03-09",
        season: { first: "2027-02-08", last: "2027-03-09" },
      },
      today,
    ),
    [{ code: "season_not_started", on: "2027-02-08" }],
  );
  assert.deepEqual(
    closedReasons(fund, linked, { ...always, until: "2026-10-01" }, today),
    [{ code: "ended", on: "2026-10-01" }],
  );
  assert.deepEqual(
    closedReasons(fund, linked, { ...always, blocked: "waiting_rerun" }, today),
    [{ code: "waiting_rerun" }],
  );
  // One rule: closed exactly when there is a reason.
  for (const window of [
    always,
    { ...always, from: "2026-10-06" },
    { ...always, until: "2026-10-04" },
    { ...always, blocked: "season_over" as const },
  ])
    for (const listed of [true, false])
      for (const linkNow of [linked, null])
        assert.equal(
          canPayNow({ ...fund, listed }, linkNow, window, today) === "ok",
          closedReasons({ ...fund, listed }, linkNow, window, today).length ===
            0,
        );
});
