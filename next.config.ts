import { join } from "node:path";
import type { NextConfig } from "next";
import { copyMapLibrary } from "./scripts/map-library";
import { ACTION_BODY_LIMIT_BYTES } from "./src/lib/media/photo-limits";
import { openFreeMapHost } from "./src/lib/maps/style";
import {
  configurationWarnings,
  parseRuntimeConfig,
} from "./src/lib/runtime/config";

// Fail fast (ADR 0012): `next dev`, `build` and `start` stop here with one
// readable message when a required variable is missing or invalid. On Vercel a
// failed build leaves the previous deployment live.
const runtime = parseRuntimeConfig(process.env);
// Accepted settings that leave something off on the live site: a warning in
// the build log, never an error (daily-check contract D-17).
for (const warning of configurationWarnings(runtime))
  console.warn(`Warning: ${warning}`);

// PR7: the map library and its worker, copied into public/maplibre.
copyMapLibrary();

/**
 * Baseline security headers.
 *
 * Public editorial pages and dynamic content share this baseline.
 * `'unsafe-inline'` is required for style-src by Next's inlined critical CSS,
 * and for script-src by the App Router's inline bootstrap payload.
 * React development debugging additionally needs eval; never enable it in
 * production. See the installed Next.js content-security-policy guide.
 */
// NODE_ENV is build tooling (Next), not deployment config.
const isDevelopment = process.env.NODE_ENV === "development";
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "font-src 'self'",
      // The musallah map's style, tiles, fonts and icons (PR7); the campus
      // names come from our own route.
      `connect-src 'self' ${openFreeMapHost}`,
      // MapLibre's worker is served from this site (PR7), never a blob.
      "worker-src 'self'",
      // No frames: the map is drawn by the page itself (PR7).
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // `upgrade-insecure-requests` is deliberately omitted. On an https
      // deployment it is redundant (every URL here is same-origin already),
      // and WebKit applies it to http origins too — which breaks any local
      // preview of a production build in Safari. HSTS below covers production.
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Only meaningful over HTTPS; harmless on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // No "N" button on `npm run dev` / `npm run demo`: the sandbox looks exactly
  // like the live site (review fixes PR-1). Build and runtime errors still show.
  devIndicators: false,
  // Dev only: lets an ngrok tunnel (`ngrok http <port>`) reach the dev
  // server's live-reload socket, without which the page never hydrates.
  allowedDevOrigins: ["*.ngrok-free.dev"],
  turbopack: { root: process.cwd() },
  // Cache Components (review fixes PR-C): pages are sent from a shell built
  // ahead of time; page text, verses, prayer settings and the musallah pin
  // are cached (`use cache`) until a board save expires them, and what must
  // be fresh streams in per visit. See docs/architecture.md (Caching).
  cacheComponents: true,
  // Off Vercel Production (a developer's computer: the sandbox, `npm start`)
  // pages are kept in memory by our own small handler, so a board save shows
  // at once and a restart starts clean (src/lib/runtime/local-page-cache.mjs).
  // On Vercel, Vercel keeps the pages.
  ...(runtime.production
    ? {}
    : {
        cacheHandler: join(
          process.cwd(),
          "src/lib/runtime/local-page-cache.mjs",
        ),
      }),
  // One save carries at most the photo budget plus its typed text
  // (`src/lib/media/photo-limits.ts`).
  experimental: {
    serverActions: { bodySizeLimit: ACTION_BODY_LIMIT_BYTES },
    // Pages stream what must be fresh behind the root loading.tsx on purpose
    // (review fixes PR-C), so Next's development "instant navigation" check
    // runs only where a page asks for it (`export const instant`); without
    // this the sandbox would show an "Insight" badge the live site never has.
    instantInsights: { validationLevel: "manual-warning" },
  },
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The seal's one drawing (review fixes PR-C). Its address carries a
      // hash of the drawing (src/shared/ui/seal-art.ts), so browsers may keep
      // it for a year; a new drawing gets a new address.
      {
        source: "/images/brand/seal-sprite.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
