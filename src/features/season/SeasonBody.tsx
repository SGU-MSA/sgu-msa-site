import { WeekSummary } from "@/features/home/WeekSummary";
import { Container } from "@/shared/ui/Container";
import { FormCtaView } from "@/shared/ui/FormCtaView";
import { InkHeading } from "@/shared/ui/InkHeading";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";
import { SafeImage } from "@/shared/ui/SafeImage";

import type { SeasonPageData } from "./load";
import { ScheduleLedger } from "./ScheduleLedger";
import { SeasonFunds } from "./SeasonFunds";
import { SeasonGallery } from "./SeasonGallery";
import s from "./season.module.css";
import { TonightPanel } from "./TonightPanel";

/** The intro as paragraphs: split on blank lines. */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * A season's public page (PR5c; Ramadan's option B "Tonight first", PR8
 * D-7): the label ("Ramadan 2027") and name with the intro, outside the
 * season the line saying when the next one starts, the sign-up button, and
 * beside it tonight's sheet in the month (else the cover photo); then the
 * schedule, the season's events, its open funds and the photos. Gregorian
 * years only (D-31). Draws `SeasonPageData`; computes no dates. No
 * server-only import, so the season screen's Preview draws it too.
 */
export function SeasonBody({ data }: { data: SeasonPageData }) {
  const { season, state, tonight, events, funds, verse, signUp } = data;
  const [lede, ...more] = paragraphs(season.intro);
  const [cover] = season.photos;
  return (
    <>
      <Container className={`${quiet.above} ${s.hero}`}>
        <header className={`${s.heroMain} ${quiet.enter}`}>
          <p className={quiet.eyebrow}>{state.label}</p>
          <InkHeading
            as="h1"
            text={season.name}
            className={`${quiet.display} ${s.display}`}
          />
          {state.next ? (
            <p className={s.next} role="note">
              {state.next}
            </p>
          ) : null}
          {lede ? <p className={quiet.lede}>{lede}</p> : null}
          {more.map((paragraph, index) => (
            <p key={index} className={s.intro}>
              {paragraph}
            </p>
          ))}
          {signUp ? (
            <div className={s.actions}>
              <FormCtaView destination={signUp} />
            </div>
          ) : null}
          {verse ? <MarginNote reminder={verse} /> : null}
        </header>
        {tonight ? (
          <TonightPanel
            rows={tonight.rows}
            night={tonight.night}
            date={tonight.date}
          />
        ) : cover ? (
          <div className={`${quiet.photo} ${s.coverPhoto}`}>
            <div className={quiet.photoFrame}>
              <SafeImage
                image={{ ...cover, historical: false }}
                fill
                priority
                sizes="(min-width: 960px) 36vw, 100vw"
                className={s.cover}
              />
            </div>
          </div>
        ) : null}
      </Container>

      <ScheduleLedger schedule={season.schedule} className={quiet.above} />

      {events.length ? (
        <div className={s.events}>
          <WeekSummary heading="Events" events={events} emptyMessage="" />
        </div>
      ) : null}

      <SeasonFunds name={season.name} groups={funds} className={quiet.above} />

      {season.photos.length ? (
        <Container
          as="section"
          className={`${quiet.above} ${s.gallery}`}
          aria-labelledby="season-photos"
        >
          <h2 id="season-photos" className={s.h2}>
            Photos
          </h2>
          <SeasonGallery photos={season.photos} />
        </Container>
      ) : null}
    </>
  );
}
