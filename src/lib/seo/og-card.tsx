import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { ImageResponse } from "next/og";

import { publicCacheTags } from "@/lib/runtime/public-cache";
import { pageColours } from "@/styles/page-colours";

/** The one link-preview card (site-essentials contract): the seal beside a kicker, a heading and a line of detail. */

export const cardSize = { width: 1200, height: 630 } as const;

const headingLimit = 90;
const subheadingLimit = 160;

/**
 * What the card draws: Latin (Instrument Serif) and common punctuation.
 * Anything else is removed before rendering: emoji and other scripts, and
 * Arabic, because `next/og` (Satori) neither shapes nor orders Arabic (it
 * would draw detached letters in reverse) and would fetch a font or emoji
 * image from the internet for a glyph the bundled font lacks, which is never
 * allowed (privacy and reliability).
 */
const undrawable =
  /[^\u0020-\u007E\u00A0-\u024F\u2010-\u2015\u2018-\u201F\u2022\u2026\u2030\u2039\u203A\u20AC]/gu;

/** Text the card can draw, whitespace collapsed. */
export function drawable(text: string): string {
  return (
    text
      .replace(undrawable, " ")
      .replace(/\s+/g, " ")
      // A separator left beside another one, or at either end, goes too.
      .replace(/ [—–·|:,-](?= [—–·|:,-](?: |$))/g, "")
      .replace(/^[\s—–·|:,-]+|[\s—–·|:,-]+$/g, "")
  );
}

/** Text cut to `limit` characters, ending in "…" when it was longer; undrawable characters removed. */
export function clampText(text: string, limit: number): string {
  const clean = drawable(text);
  const chars = Array.from(clean);
  if (chars.length <= limit) return clean;
  return `${chars
    .slice(0, limit - 1)
    .join("")
    .trimEnd()}…`;
}

const rgba = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const fontFiles = [
  ["Instrument Serif", "instrument-serif", "latin-400-normal"],
  ["Instrument Serif", "instrument-serif", "latin-ext-400-normal"],
] as const;

/** The card's assets, read once per server process (files shipped with the app). */
let assets: Promise<{
  fonts: { name: string; data: Buffer; weight: 400; style: "normal" }[];
  seal: string;
}> | null = null;
function loadAssets() {
  assets ??= (async () => {
    const [fonts, seal] = await Promise.all([
      Promise.all(
        fontFiles.map(([, pkg, file]) =>
          readFile(
            join(
              process.cwd(),
              `node_modules/@fontsource/${pkg}/files/${pkg}-${file}.woff`,
            ),
          ),
        ),
      ),
      readFile(join(process.cwd(), "public/icons/icon-512.png")),
    ]);
    return {
      fonts: fonts.map((data, i) => ({
        name: fontFiles[i][0],
        data,
        weight: 400 as const,
        style: "normal" as const,
      })),
      seal: `data:image/png;base64,${seal.toString("base64")}`,
    };
  })();
  assets.catch(() => (assets = null));
  return assets;
}

type CardInput = {
  kicker: string;
  heading: string;
  subheading?: string | null;
  /** Drawn instead when the heading has nothing drawable left (an Arabic-only title). */
  fallback?: { kicker: string; heading: string; subheading?: string | null };
};

const family = '"Instrument Serif"';

/** The site's own card text: its name and search description (Pages → Site-wide). */
export function siteCard(site: {
  brand: { name: string; short_name: string };
  meta?: { description: string } | null;
}) {
  return {
    kicker: site.brand.short_name,
    heading: site.brand.name,
    subheading: site.meta?.description,
  };
}

async function draw(input: CardInput): Promise<Uint8Array> {
  const { fonts, seal } = await loadAssets();
  const { paper, ink } = pageColours.light;
  const subheading = input.subheading
    ? clampText(input.subheading, subheadingLimit)
    : "";
  const lines = (count: number) =>
    ({ display: "block", lineClamp: count }) as Record<string, unknown>;
  const response = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: paper,
        color: ink,
        fontFamily: family,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>, not next/image */}
      <img src={seal} width={300} height={300} alt="" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: 80,
          width: 660,
        }}
      >
        <div
          style={{
            ...lines(1),
            fontSize: 24,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: rgba(ink, 0.7),
          }}
        >
          {clampText(input.kicker, 60)}
        </div>
        <div
          style={{
            ...lines(3),
            fontSize: 64,
            lineHeight: 1.1,
            marginTop: 16,
          }}
        >
          {clampText(input.heading, headingLimit)}
        </div>
        {subheading ? (
          <div
            style={{
              ...lines(3),
              fontSize: 30,
              lineHeight: 1.3,
              marginTop: 24,
              color: rgba(ink, 0.8),
            }}
          >
            {subheading}
          </div>
        ) : null}
      </div>
    </div>,
    { ...cardSize, fonts },
  );
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * The card's PNG, drawn once per distinct text and kept until a board save
 * expires the public cache tags (ADR 0024): a card renders once per edit,
 * not once per request. The reads that feed the text stay per visit.
 */
async function cachedCard(input: CardInput): Promise<Uint8Array> {
  "use cache";
  cacheTag(...Object.values(publicCacheTags));
  cacheLife("max");
  return draw(input);
}

export async function ogCard(given: CardInput): Promise<Response> {
  const input =
    !drawable(given.heading) && given.fallback ? given.fallback : given;
  const png = await cachedCard({
    kicker: input.kicker,
    heading: input.heading,
    subheading: input.subheading ?? null,
  });
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
