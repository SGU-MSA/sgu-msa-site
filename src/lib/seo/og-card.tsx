import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { cacheLife, cacheTag } from "next/cache";
import { ImageResponse } from "next/og";

import { publicCacheTags } from "@/lib/runtime/public-cache";
import { pageColours } from "@/styles/page-colours";

/** The one link-preview card (site-essentials contract): the seal beside a kicker, a heading and a line of detail. */

export const cardSize = { width: 1200, height: 630 } as const;

const headingLimit = 90;
const subheadingLimit = 160;

/**
 * The characters a bundled font file draws, read from its own character map
 * (single source: no hand-kept ranges). Text is cut down to these before
 * rendering, because `next/og` fetches a font or emoji image from the internet
 * for any character the bundled fonts lack, which is never allowed (privacy
 * and reliability). Arabic is left out on purpose: Satori neither shapes nor
 * orders it.
 */
function drawnCharacters(woff: Buffer): Set<number> {
  const count = woff.readUInt16BE(12);
  for (let i = 0; i < count; i++) {
    const at = 44 + 20 * i;
    if (woff.subarray(at, at + 4).toString() !== "cmap") continue;
    const offset = woff.readUInt32BE(at + 4);
    const packed = woff.readUInt32BE(at + 8);
    const length = woff.readUInt32BE(at + 12);
    const raw = woff.subarray(offset, offset + packed);
    const cmap = packed < length ? inflateSync(raw) : raw;
    const covered = new Set<number>();
    for (let t = 0; t < cmap.readUInt16BE(2); t++) {
      const table = cmap.readUInt32BE(8 + 8 * t);
      if (cmap.readUInt16BE(table) !== 4) continue;
      const segments = cmap.readUInt16BE(table + 6) / 2;
      const end = table + 14;
      const start = end + 2 * segments + 2;
      const delta = start + 2 * segments;
      const range = delta + 2 * segments;
      for (let g = 0; g < segments; g++) {
        const last = cmap.readUInt16BE(end + 2 * g);
        for (let c = cmap.readUInt16BE(start + 2 * g); c <= last; c++) {
          if (c === 0xffff) continue;
          const inRange = cmap.readUInt16BE(range + 2 * g);
          const glyph = inRange
            ? cmap.readUInt16BE(
                range +
                  2 * g +
                  inRange +
                  2 * (c - cmap.readUInt16BE(start + 2 * g)),
              )
            : c + cmap.readUInt16BE(delta + 2 * g);
          if (glyph & 0xffff) covered.add(c);
        }
      }
    }
    return covered;
  }
  return new Set();
}

/** Text the bundled fonts can draw, whitespace collapsed, leftover separators tidied. */
export async function drawable(text: string): Promise<string> {
  const { covered } = await loadAssets();
  return text
    .replace(/\s+/gu, " ")
    .replace(/[\s\S]/gu, (char) => {
      if (char === " " || covered.has(char.codePointAt(0)!)) return char;
      // A letter the fonts lack as one piece may exist as base letter plus mark.
      const base = [...char.normalize("NFD")]
        .filter((piece) => covered.has(piece.codePointAt(0)!))
        .join("");
      return base || " ";
    })
    .replace(/\s+/g, " ")
    .replace(/ [—–·|:,-](?= [—–·|:,-](?: |$))/g, "")
    .replace(/^[\s—–·|:,-]+|[\s—–·|:,-]+$/g, "");
}

/** Drawable text cut to `limit` characters, ending in "…" when it was longer. */
export async function cardText(text: string, limit: number): Promise<string> {
  const clean = await drawable(text);
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
  [
    "Instrument Serif Latin Extended",
    "instrument-serif",
    "latin-ext-400-normal",
  ],
] as const;

/** The card's assets, read once per server process (files shipped with the app). */
let assets: Promise<{
  fonts: { name: string; data: Buffer; weight: 400; style: "normal" }[];
  covered: Set<number>;
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
      covered: new Set(fonts.flatMap((data) => [...drawnCharacters(data)])),
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

const family = '"Instrument Serif", "Instrument Serif Latin Extended"';

async function draw(given: CardInput): Promise<Uint8Array> {
  const { fonts, seal } = await loadAssets();
  // Nothing drawable left in the heading (an Arabic-only title): the fallback card.
  const input =
    !(await drawable(given.heading)) && given.fallback ? given.fallback : given;
  const { paper, ink } = pageColours.light;
  const [kicker, heading, subheading] = await Promise.all([
    cardText(input.kicker, 60),
    cardText(input.heading, headingLimit),
    input.subheading ? cardText(input.subheading, subheadingLimit) : "",
  ]);
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
          {kicker}
        </div>
        <div
          style={{
            ...lines(3),
            fontSize: 64,
            lineHeight: 1.1,
            marginTop: 16,
          }}
        >
          {heading}
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
async function cachedCard(
  input: Omit<CardInput, "fallback"> & {
    fallback: CardInput["fallback"] | null;
  },
): Promise<Uint8Array> {
  "use cache";
  cacheTag(...Object.values(publicCacheTags));
  cacheLife("max");
  return draw({ ...input, fallback: input.fallback ?? undefined });
}

export async function ogCard(given: CardInput): Promise<Response> {
  const png = await cachedCard({
    kicker: given.kicker,
    heading: given.heading,
    subheading: given.subheading ?? null,
    fallback: given.fallback
      ? { ...given.fallback, subheading: given.fallback.subheading ?? null }
      : null,
  });
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
