import type { Metadata, Viewport } from "next";

import { siteUrl } from "@/lib/site-config";
import { deploymentProfile } from "@/lib/runtime/providers";
import { Measurements } from "@/shared/layout/Measurements";
import { MotionRoot } from "@/shared/layout/MotionRoot";
import { SiteChrome } from "@/shared/layout/SiteChrome";
import { getSite } from "@/lib/content";

import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Applies the visitor's theme before first paint (no flash): the choice
 * remembered on this device (`msa-theme`), else the device setting. The same
 * attributes are written by ThemeToggle. Allowed by the CSP's inline-script
 * allowance; with JavaScript off the page stays light (Green Ink).
 */
const themeScript = `(function(){try{var d=document.documentElement,s=null;try{s=localStorage.getItem("msa-theme")}catch(e){}var c=s==="light"||s==="dark"?s:"system";var r=c==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.setAttribute("data-theme",r);d.setAttribute("data-theme-choice",c)}catch(e){}})();`;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    robots: deploymentProfile().indexable
      ? undefined
      : { index: false, follow: false },
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.brand.short_name,
      title: site.brand.name,
      description: site.meta?.description,
    },
    twitter: {
      card: "summary",
      title: site.brand.name,
      description: site.meta?.description,
    },
    title: {
      default: site.brand.short_name,
      template: `%s | ${site.brand.short_name}`,
    },
    description:
      site.meta?.description ??
      "St. George’s University Muslim Students Association — faith, knowledge, and community.",
    keywords: site.meta?.keywords,
  };
}

/** Green Ink and Dusk page colours from src/styles/tokens.css (keep in sync). */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#24221e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = deploymentProfile();

  return (
    // The pre-paint script sets data-theme on <html> before React hydrates.
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Without JavaScript the page stays light and the switch cannot work: hide it. */}
        <noscript>
          <style>{".theme-toggle{display:none!important}"}</style>
        </noscript>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <MotionRoot>
          <SiteChrome>{children}</SiteChrome>
        </MotionRoot>
        {profile.measurements ? <Measurements /> : null}
      </body>
    </html>
  );
}
