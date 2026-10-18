import { shownIds } from "@/lib/content/page-layouts";
import type { Lists } from "@/lib/community/lists";
import type { EventsContent, Reminder } from "@/lib/content/schemas";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";

import c from "./calendar.module.css";
import { CalendarExplorer } from "./CalendarExplorer";
import type { CalendarEntry } from "./types";

/**
 * The Calendar page's body: the heading, then the explorer with the verse in
 * its margin, unless the board hid it in Pages (review 3 B). Presentational (PR5b WP4): the page passes the stored text,
 * the Pages preview the typed text; the events come from the dashboard.
 */
export function CalendarBody({
  content,
  entries,
  lists,
  today,
  unavailable,
  verse,
}: {
  content: EventsContent;
  entries: CalendarEntry[];
  /** The board's Lists, for the filters (review fixes P3). */
  lists: Pick<Lists, "event_categories" | "terms">;
  /** Today in Grenada, ringed on the month. */
  today: string | null;
  unavailable: boolean;
  verse?: Reminder | null;
}) {
  return (
    <Container>
      <PageSection id="top">
        <header className={`${c.head} ${quiet.enter}`}>
          <div>
            {content.hero.eyebrow ? (
              <p className={quiet.eyebrow}>{content.hero.eyebrow}</p>
            ) : null}
            <h1 className={`${quiet.display} ${c.title}`}>
              {content.hero.title}
            </h1>
          </div>
          {content.hero.description ? (
            <p className={`${quiet.lede} ${c.lede}`}>
              {content.hero.description}
            </p>
          ) : null}
        </header>
      </PageSection>

      {shownIds(content.sections).map((id) => (
        <PageSection key={id} id={id}>
          <CalendarExplorer
            events={entries}
            lists={lists}
            today={today}
            emptyMessage={content.empty_message}
            unavailable={unavailable}
            note={verse ? <MarginNote reminder={verse} /> : null}
          />
        </PageSection>
      ))}
    </Container>
  );
}
