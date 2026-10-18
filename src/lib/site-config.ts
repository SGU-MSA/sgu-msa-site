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
