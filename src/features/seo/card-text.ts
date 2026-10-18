import { createHash } from "node:crypto";

import { calendarDetails } from "@/lib/calendar/ics";
import type { SiteContent, SiteEvent } from "@/lib/content/schemas";
import { whenLine } from "@/features/calendar/format";

/**
 * The words on an event's or update's link-preview card, in one place for the
 * card itself and for its address's version (site-essentials contract, D-12).
 */
type Words = {
  kicker: string;
  heading: string;
  subheading?: string | null;
};
type Brand = Pick<SiteContent, "brand">;

/** The site's own card text: its name and search description (Pages → Site-wide). */
export function siteCard(site: {
  brand: { name: string; short_name: string };
  meta?: { description: string } | null;
}): Words {
  return {
    kicker: site.brand.short_name,
    heading: site.brand.name,
    subheading: site.meta?.description,
  };
}

/** An event's card: its title ("Cancelled: …" when cancelled), date and place. */
export function eventCard(event: SiteEvent, site: Brand): Words {
  const details = calendarDetails(event);
  return {
    // A category named "MSA" would only repeat the site's own name.
    kicker:
      event.category_name && event.category_name !== "MSA"
        ? `${site.brand.short_name} · ${event.category_name}`
        : site.brand.short_name,
    heading: details.title,
    subheading: [whenLine(event), details.location].filter(Boolean).join(" · "),
  };
}

/** An update's card: its kind, title and summary. */
export function postCard(
  post: { kind: string; row: { title: string; summary?: string | null } },
  site: Brand,
): Words {
  return {
    kicker: `${site.brand.short_name} · ${post.kind}`,
    heading: post.row.title,
    subheading: post.row.summary,
  };
}

/**
 * The card's design version: bump it whenever the card's layout, fonts or
 * colours change (src/lib/seo/og-card.tsx), so every card address changes and
 * CDNs and chat apps fetch the new design (contract D-12).
 */
export const CARD_DESIGN_VERSION = 1;

/**
 * A short version of the card's words and site name: it is part of the card's
 * address, so an edit changes the address at once (CDNs and chat apps keep a
 * given address for a long time) while an unchanged card keeps its address.
 */
export function cardVersion(words: Words, site: Brand): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        CARD_DESIGN_VERSION,
        words.kicker,
        words.heading,
        words.subheading ?? "",
        site.brand.name,
      ]),
    )
    .digest("hex")
    .slice(0, 10);
}

/**
 * The page's preview-image metadata for a card served at `<path>/card`: the
 * address carries the version of the card's words (D-12). Spread into the
 * page's own `openGraph` and `twitter`.
 */
export function cardImages(path: string, words: Words, site: Brand) {
  const url = `${path}/card?v=${cardVersion(words, site)}`;
  return {
    openGraph: {
      images: [
        {
          url,
          width: 1200,
          height: 630,
          alt: "The SGU MSA seal beside this page's title",
        },
      ],
    },
    twitter: { card: "summary_large_image" as const, images: [url] },
  };
}
