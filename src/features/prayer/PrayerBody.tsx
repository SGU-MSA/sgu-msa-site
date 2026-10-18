import type { ReactNode } from "react";

import type {
  FormsContent,
  JumuahContent,
  MusallahContent,
  PrayerContent,
  Reminder,
} from "@/lib/content/schemas";
import { formDestination } from "@/lib/integrations/form-destination";
import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import type { JumuahChangeNote } from "@/lib/prayer/congregation";
import type { HijriDate } from "@/lib/time/hijri";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { FormCtaView } from "@/shared/ui/FormCtaView";
import { InkHeading } from "@/shared/ui/InkHeading";
import quiet from "@/shared/ui/page.module.css";
import { SafeImage } from "@/shared/ui/SafeImage";

import { Directions } from "./Directions";
import { JumuahCard } from "./JumuahCard";
import { MusallahFacilities } from "./MusallahFacilities";
import p from "./prayer.module.css";
import { PrayerToday } from "./PrayerToday";
import type { TodayRow } from "./today";

/** Today's prayer block as the server worked it out (calculated starts, the board's times). */
export type PrayerTodayView = {
  dateLabel: string;
  hijri: HijriDate;
  rows: TodayRow[];
  startsUnavailable: boolean;
  nextId: string | null;
  method: string;
};

type PrayerSection = SectionId<"prayer">;

/**
 * The Prayer & Musallah page's body: the heading, then the sections in the
 * order the board set in Pages without the hidden ones (review 3 B): today's
 * times and Jumu'ah (side by side when next to each other), the way to the
 * Musallah with its photos, its facilities and the helpers' sign-up.
 * Presentational (PR5b WP4): the page passes the stored text, the Pages
 * preview the typed text of Prayer & Musallah, Jumu'ah or Musallah
 * directions; times and the map come from Prayer & iqamah.
 */
export function PrayerBody({
  prayer,
  jumuah,
  musallah,
  forms,
  today,
  map,
  verse,
}: {
  prayer: PrayerContent;
  jumuah: JumuahContent & { change: JumuahChangeNote | null };
  musallah: MusallahContent;
  forms: FormsContent;
  today: PrayerTodayView;
  /** The "Find us on campus" box (LocationMap), placed as is. */
  map: ReactNode;
  verse?: Reminder | null;
}) {
  const { route, facilities, helper_cta: helper, gallery } = musallah;
  const shown = shownIds(prayer.sections);

  const times = (
    <PrayerToday
      {...today}
      notice={prayer.notice}
      lastUpdated={prayer.last_updated_label}
      verse={verse}
    />
  );
  const jumuahCard = (
    <JumuahCard
      heading={jumuah.heading}
      gatherings={jumuah.gatherings}
      note={jumuah.note}
      change={jumuah.change}
    />
  );
  // Stills from the same walk, so the written steps have a picture.
  const photos = gallery.length ? (
    <div className={p.gallery}>
      {gallery.map((image) => (
        <figure key={image.src}>
          <div className={p.galleryFrame}>
            <SafeImage
              image={image}
              fill
              sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw"
              fit="cover"
            />
          </div>
          <figcaption>{image.alt}</figcaption>
        </figure>
      ))}
    </div>
  ) : null;

  const draw: Record<
    PrayerSection,
    (next: PrayerSection | undefined) => ReactNode
  > = {
    // Today's times beside Jumu'ah when they follow each other.
    times: (next) => (
      <Container className={quiet.above}>
        <section
          className={`${quiet.split} ${p.today}`}
          aria-labelledby="today"
        >
          {times}
          {next === "jumuah" ? jumuahCard : null}
        </section>
      </Container>
    ),
    jumuah: (next) => (
      <Container className={quiet.above}>
        {next === "times" ? (
          <section
            className={`${quiet.split} ${p.today}`}
            aria-labelledby="today"
          >
            {jumuahCard}
            {times}
          </section>
        ) : (
          <div className={`${quiet.split} ${p.today} ${p.jumuahAlone}`}>
            {jumuahCard}
          </div>
        )}
      </Container>
    ),
    // The photos of the way stay in the directions band when they follow it.
    directions: (next) => (
      <section
        id="find-the-musallah"
        className={`${quiet.band} scroll-mt-24`}
        aria-labelledby="find"
      >
        <Container>
          <div className={p.findInner}>
            <div className={p.findCopy}>
              <InkHeading id="find" text={route.heading} />
              {route.subheading ? (
                <p className={quiet.small}>{route.subheading}</p>
              ) : null}
              <Directions
                heading={route.directions_heading}
                directions={route.directions}
                landmarkNote={route.landmark_note}
              />
            </div>
            <div className={p.findAside}>
              <div className={quiet.photo}>
                <div className={quiet.photoFrame}>
                  <SafeImage
                    image={prayer.hero.image}
                    fill
                    sizes="(max-width: 44rem) 100vw, 40vw"
                    fit="cover"
                  />
                </div>
              </div>
              {map}
            </div>
          </div>
          {next === "gallery" ? photos : null}
        </Container>
      </section>
    ),
    gallery: () =>
      photos ? (
        <section className={`${quiet.band} ${p.galleryBand}`}>
          <Container>{photos}</Container>
        </section>
      ) : null,
    facilities: () =>
      facilities.items.length ? (
        <Container className={quiet.above}>
          <section className={p.info} aria-labelledby="info">
            <InkHeading
              id="info"
              text={facilities.heading}
              className={quiet.h2Small}
              inline
            />
            {facilities.note ? (
              <p className={p.infoNote}>{facilities.note}</p>
            ) : null}
            <MusallahFacilities facilities={facilities} />
          </section>
        </Container>
      ) : null,
    helpers: () => (
      <Container className={quiet.above}>
        <section
          className={`${quiet.rule} ${p.helper}`}
          aria-labelledby="helpers"
        >
          <div className={p.helperCopy}>
            {helper.eyebrow ? (
              <p className={quiet.eyebrow}>{helper.eyebrow}</p>
            ) : null}
            <h2 id="helpers" className={quiet.h2Small}>
              {helper.heading}
            </h2>
            <p className={p.helperBody}>{helper.body}</p>
          </div>
          <FormCtaView
            destination={formDestination(forms, helper.form)}
            className="shrink-0"
          />
        </section>
      </Container>
    ),
  };
  // Pairs drawn together: the second one is not drawn again.
  const joined = (id: PrayerSection, next: PrayerSection | undefined) =>
    (id === "times" && next === "jumuah") ||
    (id === "jumuah" && next === "times") ||
    (id === "directions" && next === "gallery");

  return (
    <>
      <Container className={quiet.above}>
        <PageSection id="top">
          <header className={`${p.hero} ${quiet.enter}`}>
            {prayer.hero.eyebrow ? (
              <p className={quiet.eyebrow}>{prayer.hero.eyebrow}</p>
            ) : null}
            <InkHeading
              as="h1"
              text={prayer.hero.title}
              className={`${quiet.display} ${p.heroTitle}`}
              inline
            />
            {prayer.hero.description ? (
              <p className={`${quiet.lede} ${p.heroLede}`}>
                {prayer.hero.description}
              </p>
            ) : null}
          </header>
        </PageSection>
      </Container>
      {shown.map((id, index) => {
        const previous = shown[index - 1];
        if (previous && joined(previous, id)) return null;
        const next = shown[index + 1];
        return (
          <PageSection
            key={id}
            id={id}
            joined={next && joined(id, next) ? next : undefined}
          >
            {draw[id](next)}
          </PageSection>
        );
      })}
    </>
  );
}
