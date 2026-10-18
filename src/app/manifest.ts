import type { MetadataRoute } from "next";

import { getSite } from "@/lib/content";
import { pageColours } from "@/styles/page-colours";

/** The web app manifest: the board's short name and search description, the seal icons (Pages → Site-wide). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSite();
  return {
    name: site.brand.short_name,
    short_name: site.brand.short_name,
    description: site.meta?.description,
    start_url: "/",
    scope: "/",
    display: "browser",
    lang: "en",
    dir: "ltr",
    background_color: pageColours.light.paper,
    theme_color: pageColours.light.paper,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
