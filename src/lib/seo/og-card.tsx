import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { pageColours } from "@/styles/page-colours";

/** The one link-preview card (site-essentials contract): the seal beside a kicker, a heading and a line of detail. */

export const cardSize = { width: 1200, height: 630 } as const;

const headingLimit = 90;
const subheadingLimit = 160;

/** Text cut to `limit` characters, ending in "…" when it was longer; whitespace collapsed. */
export function clampText(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
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
  "instrument-serif-latin-400-normal.woff",
  "instrument-serif-latin-ext-400-normal.woff",
];

/** The card's assets, read once per server process (files shipped with the app). */
let assets: Promise<{
  fonts: { name: string; data: Buffer; weight: 400; style: "normal" }[];
  seal: string;
}> | null = null;
function loadAssets() {
  assets ??= (async () => {
    const [fonts, seal] = await Promise.all([
      Promise.all(
        fontFiles.map((file) =>
          readFile(
            join(
              process.cwd(),
              "node_modules/@fontsource/instrument-serif/files",
              file,
            ),
          ),
        ),
      ),
      readFile(join(process.cwd(), "public/icons/icon-512.png")),
    ]);
    return {
      fonts: fonts.map((data) => ({
        name: "Instrument Serif",
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

export async function ogCard(input: {
  kicker: string;
  heading: string;
  subheading?: string | null;
}): Promise<ImageResponse> {
  const { fonts, seal } = await loadAssets();
  const { paper, ink } = pageColours.light;
  const subheading = input.subheading
    ? clampText(input.subheading, subheadingLimit)
    : "";
  const lines = (count: number) =>
    ({
      display: "block",
      lineClamp: count,
    }) as Record<string, unknown>;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: paper,
        color: ink,
        fontFamily: "Instrument Serif",
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
}
