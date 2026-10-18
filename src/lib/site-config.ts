import { runtimeConfig } from "@/lib/runtime/config";

/** The site's origin (SITE_URL, required; no fallback). */
export const siteUrl = runtimeConfig().siteUrl;
export const publicRoutes = [
  "/",
  "/prayer",
  "/calendar",
  "/community",
  "/resources",
  "/get-involved",
  "/about",
  "/contact",
  "/donate",
  "/faq",
  "/ramadan",
  "/merch",
  "/privacy",
];

/**
 * Google Search Console's "HTML tag" verification token (a public value the
 * owner reads from Search Console). Null until the owner verifies the site;
 * the live site then emits it (`searchConsoleVerification`).
 */
export const searchConsoleToken: string | null = null;
