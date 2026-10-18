import { siteUrl } from "@/lib/site-config";
import { HomeBody } from "@/features/home/HomeBody";
import { loadHomeLive } from "@/features/home/load";
import quiet from "@/shared/ui/page.module.css";
import { LocationMap } from "@/features/prayer/LocationMap";
import { getFAQ, getHome, getSite, placedReminder } from "@/lib/content";
import { CommunityFeed } from "@/features/community/CommunityFeed";
import { HomeNotice } from "@/features/community/HomeNotice";
import { getRecords } from "@/lib/community/queries";
import { donatePageShowsFunds } from "@/lib/integrations/payments";
import { deploymentProfile } from "@/lib/runtime/providers";
import { requestNow } from "@/lib/runtime/public-cache";
import { PaperLayers } from "@/shared/ui/PaperLayers";
import { TasbihThread, tasbihThreadHost } from "@/shared/ui/TasbihThread";

/** Home (Quiet Paper): operational content from the shared backend; verses from the verse library. */
export default async function HomePage() {
  const [
    home,
    site,
    faq,
    live,
    givingOpen,
    verseHome,
    verseEvents,
    verseCommunity,
    verseGiving,
  ] = await Promise.all([
    getHome(),
    getSite(),
    getFAQ(),
    loadHomeLive(),
    requestNow().then(donatePageShowsFunds),
    placedReminder("home"),
    placedReminder("home_events"),
    placedReminder("home_community"),
    placedReminder("home_giving"),
    getRecords("announcements"),
    getRecords("news_posts"),
  ]);

  return (
    <div className={`${tasbihThreadHost} ${quiet.page}`}>
      <PaperLayers />
      <TasbihThread />
      {deploymentProfile().indexable && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: site.brand.name,
              url: siteUrl,
              email: site.brand.email,
              sameAs: site.social
                .filter((item) => item.url.startsWith("https://"))
                .map((item) => item.url),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <HomeBody
        home={home}
        faq={faq}
        live={live}
        givingOpen={givingOpen}
        verses={{
          home: verseHome,
          events: verseEvents,
          community: verseCommunity,
          giving: verseGiving,
        }}
        notice={<HomeNotice />}
        feed={<CommunityFeed compact />}
        map={<LocationMap />}
      />
    </div>
  );
}
