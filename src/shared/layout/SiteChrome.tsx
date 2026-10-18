import { Suspense, type ReactNode } from "react";
import { LiveRefresh } from "./LiveRefresh";

import { managedUrgentNotices } from "@/lib/community/managed";
import { getSite, placedReminder, siteYear } from "@/lib/content";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { UrgentBand } from "./UrgentBand";

/**
 * Shared navigation, the urgent band (PR5a), operational refresh and footer.
 * No page owns its own shell. The menu and footer come from cached page
 * text, so they are sent at once; the urgent band streams in its own
 * Suspense (review fixes PR-C), read on every visit, so an urgent notice
 * leaves the band at its exact end; when announcements are unavailable the
 * band is simply absent. On /admin pages the notices are still read (one
 * small cached query) and `UrgentBand` hides them in the browser: the shared
 * layout cannot see the path, and the cost is accepted.
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const [site, footerVerse, year] = await Promise.all([
    getSite(),
    placedReminder("footer"),
    siteYear(),
  ]);

  return (
    <>
      <LiveRefresh />
      <Navbar
        items={site.navigation}
        cta={site.header_cta ?? null}
        logoLabel={site.brand.logo.alt}
        shortName={site.brand.short_name}
        tagline={site.brand.tagline}
      />
      <Suspense fallback={null}>
        <UrgentNotices />
      </Suspense>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <Footer
        name={site.brand.name}
        shortName={site.brand.short_name}
        university={site.brand.university}
        tagline={site.brand.tagline}
        quickLinks={site.footer.quick_links}
        socialLinks={site.social}
        email={site.brand.email}
        verse={footerVerse}
        year={year}
        adminLink={site.footer.admin_link ?? null}
      />
    </>
  );
}

/** The urgent band's notices, per visit (behind SiteChrome's Suspense). */
async function UrgentNotices() {
  return <UrgentBand notices={await managedUrgentNotices()} />;
}
