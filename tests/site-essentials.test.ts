import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { SiteContent, SiteEvent } from "../src/lib/content/schemas";
import {
  eventJsonLd,
  jsonLdText,
  organizationJsonLd,
  searchConsoleVerification,
} from "../src/lib/seo/structured-data";
import { llmsTxt, securityTxt } from "../src/lib/seo/text-files";
import { clampText } from "../src/lib/seo/og-card";
import { pageColours } from "../src/styles/page-colours";

const origin = "https://msa.example";
const site = {
  brand: {
    name: "SGU Muslim Students Association",
    short_name: "SGU MSA",
    university: "St. George’s University Muslim Students Association",
    tagline: "Faith. Knowledge. Community.",
    email: "so-msa@sgu.edu",
    logo: { src: "/logo.webp", alt: "Crest" },
  },
  navigation: [
    { label: "Home", href: "/" },
    { label: "Events", href: "/calendar" },
    { label: "Admin", href: "/admin" },
    { label: "Elsewhere", href: "https://other.example/" },
  ],
  footer: {
    quick_links: [
      { label: "Calendar", href: "/calendar" },
      { label: "Contact\n& Visit", href: "/contact" },
    ],
  },
  social: [
    {
      id: "i",
      label: "Instagram",
      url: "https://instagram.com/x",
      kind: "instagram",
    },
    { id: "h", label: "Plain", url: "http://insecure.example", kind: "other" },
  ],
  meta: { description: "Prayer times,\nevents <and> more.", keywords: [] },
} as unknown as SiteContent;

const event = (over: Partial<SiteEvent> = {}): SiteEvent =>
  ({
    id: "iftar",
    title: "Iftar",
    date: "2026-10-16",
    start_time: "17:00",
    end_time: "19:00",
    location: "Musallah",
    organization: "MSA",
    visibility: "public",
    featured: false,
    verification_status: "verified",
    ...over,
  }) as SiteEvent;

test("the home page's Organization data is the object it always carried", () => {
  const before = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.brand.name,
    url: origin,
    email: site.brand.email,
    sameAs: ["https://instagram.com/x"],
  }).replace(/</g, "\\u003c");
  assert.equal(jsonLdText(organizationJsonLd(site, origin)), before);
});

test("jsonLdText escapes < so no text closes the script tag", () => {
  assert.equal(jsonLdText({ a: "</script>" }), '{"a":"\\u003c/script>"}');
});

test("a timed event carries Grenada offsets, status, place and organizer", () => {
  const data = eventJsonLd(event(), site, origin);
  assert.deepEqual(data, {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Iftar",
    startDate: "2026-10-16T17:00:00-04:00",
    endDate: "2026-10-16T19:00:00-04:00",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: "Musallah", address: "Musallah" },
    organizer: { "@type": "Organization", name: site.brand.name, url: origin },
    url: `${origin}/calendar/iftar`,
  });
});

test("a timed event without an end time has no endDate", () => {
  const data = eventJsonLd(event({ end_time: null }), site, origin);
  assert.equal(data?.startDate, "2026-10-16T17:00:00-04:00");
  assert.ok(!("endDate" in data!));
});

test("a multi-day all-day event ends on its inclusive last day", () => {
  const data = eventJsonLd(
    event({ start_time: null, end_time: null, end_date: "2026-10-18" }),
    site,
    origin,
  );
  assert.equal(data?.startDate, "2026-10-16");
  assert.equal(data?.endDate, "2026-10-18");
  assert.equal(
    eventJsonLd(event({ start_time: null, end_time: null }), site, origin)
      ?.endDate,
    "2026-10-16",
  );
});

test("cancelled and postponed events say so, with the plain title", () => {
  const cancelled = eventJsonLd(event({ status: "cancelled" }), site, origin);
  assert.equal(cancelled?.eventStatus, "https://schema.org/EventCancelled");
  assert.equal(cancelled?.name, "Iftar");
  assert.equal(
    eventJsonLd(event({ status: "postponed" }), site, origin)?.eventStatus,
    "https://schema.org/EventPostponed",
  );
});

test("university dates and events without a place have no Event data", () => {
  assert.equal(eventJsonLd(event({ organization: "SGU" }), site, origin), null);
  assert.equal(eventJsonLd(event({ location: "  " }), site, origin), null);
  assert.equal(eventJsonLd(event({ location: null }), site, origin), null);
});

test("an uploaded photo becomes an absolute image; a missing one adds none", () => {
  const withImage = eventJsonLd(
    event({ image: { src: "/media/iftar.webp", alt: "Iftar" } }),
    site,
    origin,
  );
  assert.deepEqual(withImage?.image, [`${origin}/media/iftar.webp`]);
  assert.ok(!("image" in eventJsonLd(event(), site, origin)!));
});

test("security.txt: email and contact page, Expires 180 days after the request day", () => {
  const now = new Date("2026-10-18T15:30:00Z");
  assert.equal(
    securityTxt({ email: "so-msa@sgu.edu", origin, now }),
    [
      "Contact: mailto:so-msa@sgu.edu",
      `Contact: ${origin}/contact`,
      "Expires: 2027-04-16T00:00:00.000Z",
      "Preferred-Languages: en",
      `Canonical: ${origin}/.well-known/security.txt`,
      "",
    ].join("\n"),
  );
  const noEmail = securityTxt({ email: " ", origin, now });
  assert.doesNotMatch(noEmail, /mailto/);
  assert.match(noEmail, /^Contact: https:\/\/msa\.example\/contact/);
});

test("llms.txt: name, description on one line, absolute deduplicated public links", () => {
  const text = llmsTxt(site, origin);
  assert.match(
    text,
    /^# SGU Muslim Students Association\n\n> Prayer times, events <and> more\.\n/,
  );
  assert.match(
    text,
    /St\. George’s University Muslim Students Association\. Contact: so-msa@sgu\.edu/,
  );
  const links = text.split("\n").filter((line) => line.startsWith("- "));
  assert.deepEqual(links, [
    `- [Home](${origin}/)`,
    `- [Events](${origin}/calendar)`,
    `- [Contact & Visit](${origin}/contact)`,
  ]);
});

test("the Search Console tag needs both a token and the live site", () => {
  assert.equal(searchConsoleVerification(null, true), undefined);
  assert.equal(searchConsoleVerification("abc", false), undefined);
  assert.deepEqual(searchConsoleVerification("abc", true), { google: "abc" });
});

test("the card's text is clamped with an ellipsis and whitespace collapsed", () => {
  assert.equal(clampText("  a\n b ", 10), "a b");
  const clamped = clampText("x".repeat(100), 90);
  assert.equal(Array.from(clamped).length, 90);
  assert.ok(clamped.endsWith("…"));
});

test("the card renders as a 1200×630 PNG", async () => {
  const { ogCard } = await import("../src/lib/seo/og-card");
  const response = await ogCard({
    kicker: "SGU MSA · Event",
    heading: "Cancelled: Iftar",
    subheading: "Friday 16 October 2026 · Musallah",
  });
  assert.equal(response.headers.get("content-type"), "image/png");
  const png = Buffer.from(await response.arrayBuffer());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("page-colours.ts mirrors the tokens", () => {
  const css = readFileSync(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  const block = (open: string) =>
    css.slice(css.indexOf(open), css.indexOf("\n}", css.indexOf(open)));
  const value = (scope: string, name: string) =>
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block(scope))?.[1];
  assert.equal(value(":root {", "paper"), pageColours.light.paper);
  assert.equal(value(":root {", "ink"), pageColours.light.ink);
  assert.equal(value(":root {", "seal-mint"), pageColours.light.sealMint);
  assert.equal(value('[data-theme="dark"] {', "paper"), pageColours.dark.paper);
});
