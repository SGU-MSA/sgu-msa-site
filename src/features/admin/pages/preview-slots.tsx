import "server-only";
import { CommunityFeed } from "@/features/community/CommunityFeed";
import { HomeNotice } from "@/features/community/HomeNotice";
import { LocationMap } from "@/features/prayer/LocationMap";
import type { PageTextKey } from "@/lib/content/documents";
import type { PreviewSlots } from "./previews";

/**
 * The parts of a public page only the server draws (review 3 B), drawn for
 * the Pages preview as the page itself draws them, so the preview shows the
 * whole page: the featured notice and community updates on Home, the "Find
 * us on campus" map on Home, Prayer & Musallah and Contact.
 */
export function previewSlots(key: PageTextKey): PreviewSlots {
  switch (key) {
    case "home":
      return {
        notice: <HomeNotice />,
        feed: <CommunityFeed compact />,
        map: <LocationMap />,
      };
    case "prayer":
    case "jumuah":
    case "musallah":
    case "contact":
      return { map: <LocationMap /> };
    default:
      return {};
  }
}
