import { Mail } from "lucide-react";
import type { ReactNode } from "react";

import type { TeamSection } from "@/lib/community/people";
import { shownIds, type SectionId } from "@/lib/content/page-layouts";
import type { AboutContent, Reminder } from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";
import { safeHref } from "@/lib/url";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";
import { SafeImage } from "@/shared/ui/SafeImage";
import { SiteIcon } from "@/shared/ui/SiteIcon";

import {
  Chapter,
  ChapterHead,
  ChapterIndex,
  chapterNumber,
  type ChapterEntry,
} from "./Chapter";
import s from "./about.module.css";
import { TeamSeats } from "./TeamSeats";

/** The anchor id of each About section (the index links to it). */
const anchors: Record<SectionId<"about">, string> = {
  mission: "mission",
  what_we_do: "what-we-do",
  team: "team",
  at_sgu: "at-sgu",
  contact: "contact",
};

/**
 * The About page's body, option C "Chapters" (PR8 D-7): the numbered index,
 * the chapters with the team as seats and the verse under the team, and the
 * contact band, in the order the board set in Pages without the hidden ones
 * (review 3 B). The chapters between two bands sit beside the index (the
 * first group) or under it. Presentational (PR5b WP4): the page passes the
 * stored text, the Pages preview passes the typed text; the team comes from
 * People.
 */
export function AboutChapters({
  about,
  team,
  verse,
}: {
  about: AboutContent;
  team: TeamSection[];
  verse?: Reminder | null;
}) {
  const email = about.contact.email
    ? safeHref(`mailto:${about.contact.email}`)
    : null;

  const headings: Record<SectionId<"about">, string> = {
    mission: about.mission.heading,
    what_we_do: about.what_we_do.heading,
    team: about.board.heading,
    at_sgu: about.at_sgu.heading,
    contact: about.contact.heading,
  };
  // "What we do" shows only with items (PR8).
  const shown = shownIds(about.sections).filter(
    (id) => id !== "what_we_do" || about.what_we_do.items.length > 0,
  );
  const chapters: ChapterEntry[] = shown.map((id) => ({
    id: anchors[id],
    label: headings[id],
  }));
  const number = (id: SectionId<"about">) => chapterNumber(shown.indexOf(id));

  const chapter: Record<
    Exclude<SectionId<"about">, "contact">,
    () => ReactNode
  > = {
    mission: () => (
      <Chapter
        id="mission"
        number={number("mission")}
        heading={about.mission.heading}
      >
        <div className={s.prose}>
          {about.mission.body.map((paragraph, index) => (
            <p key={paragraph} className={index === 0 ? s.opening : undefined}>
              {paragraph}
            </p>
          ))}
        </div>
      </Chapter>
    ),
    what_we_do: () => (
      <Chapter
        id="what-we-do"
        number={number("what_we_do")}
        heading={about.what_we_do.heading}
      >
        <ul className={s.pairs}>
          {about.what_we_do.items.map((item) => (
            <li key={item.id}>
              <SiteIcon
                name={item.icon}
                aria-hidden="true"
                className={s.icon}
              />
              <div>
                <h3 className={s.itemTitle}>{item.title}</h3>
                <p className={s.itemText}>{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Chapter>
    ),
    // The team list comes from People (PR3 WP-G, D-10).
    team: () => (
      <Chapter
        id="team"
        number={number("team")}
        heading={about.board.heading}
        kicker="Leadership"
      >
        {about.board.note ? <p className={s.note}>{about.board.note}</p> : null}
        <TeamSeats sections={team} />
        {verse ? <MarginNote reminder={verse} /> : null}
      </Chapter>
    ),
    at_sgu: () => (
      <Chapter
        id="at-sgu"
        number={number("at_sgu")}
        heading={about.at_sgu.heading}
      >
        <div className={s.prose}>
          {about.at_sgu.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {about.at_sgu.image ? (
          <figure className={`${quiet.photo} ${s.sguPhoto}`}>
            <span className={`${quiet.photoFrame} ${s.photoWide}`}>
              <SafeImage
                image={about.at_sgu.image}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                fit="cover"
              />
            </span>
          </figure>
        ) : null}
      </Chapter>
    ),
  };

  const contact = (
    <section
      id="contact"
      className={`${quiet.ink} ${s.contact}`}
      aria-labelledby="contact-title"
    >
      <Container className={s.contactInner}>
        <div className={s.contactCopy}>
          <ChapterHead
            id="contact"
            number={number("contact")}
            heading={about.contact.heading}
          />
          {about.contact.body ? (
            <p className={s.contactText}>{about.contact.body}</p>
          ) : null}
          {about.contact.note ? (
            <p className={s.contactNote}>{about.contact.note}</p>
          ) : null}
        </div>
        {email ? (
          <a href={email} className={s.button}>
            <Mail aria-hidden="true" size={18} strokeWidth={1.5} />
            {about.contact.email}
          </a>
        ) : null}
      </Container>
    </section>
  );

  // The chapters in runs between the contact band; the first run holds the index.
  const runs: (SectionId<"about">[] | "contact")[] = [];
  for (const id of shown) {
    const last = runs.at(-1);
    if (id === "contact") runs.push("contact");
    else if (Array.isArray(last)) last.push(id);
    else runs.push([id]);
  }
  const firstRun = runs.findIndex((run) => run !== "contact");

  return (
    <>
      <Container className={quiet.above}>
        <PageSection id="top">
          <header className={`${s.hero} ${quiet.enter}`}>
            {about.hero.eyebrow ? (
              <p className={quiet.eyebrow}>{about.hero.eyebrow}</p>
            ) : null}
            <h1 className={`${quiet.display} ${s.display}`}>
              {about.hero.title}
            </h1>
            {about.hero.description ? (
              <p className={s.heroSub}>{about.hero.description}</p>
            ) : null}
          </header>
        </PageSection>
      </Container>

      {runs.map((run, index) =>
        run === "contact" ? (
          <PageSection key="contact" id="contact">
            {contact}
          </PageSection>
        ) : (
          <Container
            key={run[0]}
            className={`${quiet.above} ${index > 0 ? s.afterBand : ""}`}
          >
            <div className={s.body}>
              {index === firstRun ? (
                <ChapterIndex chapters={chapters} />
              ) : (
                <div aria-hidden="true" />
              )}
              <div>
                {run.map((id) => (
                  <PageSection key={id} id={id}>
                    {chapter[id as Exclude<SectionId<"about">, "contact">]()}
                  </PageSection>
                ))}
              </div>
            </div>
          </Container>
        ),
      )}
    </>
  );
}
