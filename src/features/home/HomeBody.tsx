import type { ReactNode } from "react";

import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import type { FAQContent, HomeContent, Reminder } from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";

import { ContributionStrip } from "./ContributionStrip";
import { FAQPreview } from "./FAQPreview";
import { FeatureRow } from "./FeatureRow";
import { GiveBand } from "./GiveBand";
import { HomeHero } from "./HomeHero";
import h from "./home.module.css";
import type { HomeLive } from "./load";
import { VerseBand } from "./VerseBand";
import { WeekSummary } from "./WeekSummary";
import { VisitSection } from "../prayer/VisitSection";

/** The verses placed on Home (PR5b D-24), by place. */
export type HomeVerses = {
  home?: Reminder | null;
  events?: Reminder | null;
  community?: Reminder | null;
  giving?: Reminder | null;
};

/**
 * Home (Quiet Paper): the welcome, then the sections in the order the board
 * set in Pages, without the hidden ones (review 3 B). Presentational (PR5b
 * WP4): the page passes the stored text, the Pages preview the typed text of
 * Home. The parts read on the server (the featured notice, community
 * updates, the map in the first-visit box) come in as slots, drawn by the
 * server for the page and for the preview alike.
 */
export function HomeBody({
  home,
  faq,
  live,
  givingOpen,
  verses,
  notice,
  feed,
  map,
}: {
  home: HomeContent;
  faq: FAQContent;
  live: HomeLive;
  /** The Donate page shows funds now (D-41). */
  givingOpen: boolean;
  verses: HomeVerses;
  notice?: ReactNode;
  feed?: ReactNode;
  /** The "Find us on campus" map in the first-visit box. */
  map?: ReactNode;
}) {
  const sections: Record<SectionId<"home">, ReactNode> = {
    week: (
      <WeekSummary
        heading={home.week.heading}
        events={live.week.events}
        emptyMessage={
          live.week.unavailable
            ? "Events are temporarily unavailable. Please try again shortly."
            : home.week.empty_message
        }
        verse={verses.events}
      />
    ),
    contribution: (
      <ContributionStrip
        heading={home.contribution.heading}
        items={home.contribution.items}
        image={home.hero.image}
        verse={verses.community}
      />
    ),
    updates: feed ? <div className={h.layer}>{feed}</div> : null,
    visit: <VisitSection image={home.visit.image} map={map} />,
    features: <FeatureRow items={home.features} />,
    faq: (
      <FAQPreview
        items={faq.items.slice(0, 6)}
        eyebrow={faq.eyebrow}
        heading={faq.heading}
      />
    ),
    giving: <GiveBand givingOpen={givingOpen} verse={verses.giving} />,
  };
  return (
    <>
      <PageSection id="top">
        <HomeHero hero={home.hero} {...live.today} />
        {notice}
        {verses.home ? <VerseBand verse={verses.home} /> : null}
      </PageSection>
      {shownIds(home.sections).map((id) => (
        <PageSection key={id} id={id}>
          {sections[id]}
        </PageSection>
      ))}
    </>
  );
}
