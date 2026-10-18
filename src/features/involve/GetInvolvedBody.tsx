import type {
  FormsContent,
  GetInvolvedContent,
  Reminder,
} from "@/lib/content/schemas";
import { formDestination } from "@/lib/integrations/form-destination";
import { shownIds } from "@/lib/content/page-layouts";
import { PageSection } from "@/shared/layout/PageSection";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import quiet from "@/shared/ui/page.module.css";

import { Chooser } from "./Chooser";
import s from "./involve.module.css";
import { PathwaySheet } from "./PathwaySheet";

/**
 * The Get Involved page's body (PR8 D-4, option B "Chooser"): the heading
 * with its verse and introduction, then the pathways, each with its sign-up
 * form from the forms list, unless the board hid them in Pages (review 3 B). Presentational (PR5b WP4): the page passes the stored text,
 * the Pages preview the typed text.
 */
export function GetInvolvedBody({
  content,
  forms,
  verse,
}: {
  content: GetInvolvedContent;
  forms: FormsContent;
  verse?: Reminder | null;
}) {
  const { hero, intro, pathways } = content;
  return (
    <Container className={quiet.above}>
      <PageSection id="top">
        <header className={`${s.hero} ${quiet.enter}`}>
          {hero.eyebrow ? (
            <p className={quiet.eyebrow}>{hero.eyebrow}</p>
          ) : null}
          <h1 className={`${quiet.display} ${s.display}`}>{hero.title}</h1>
          <div className={s.heroRow}>
            {hero.description ? (
              <p className={s.heroSub}>{hero.description}</p>
            ) : (
              <span />
            )}
            {verse ? <MarginNote reminder={verse} /> : null}
          </div>
          {intro ? <p className={s.intro}>{intro}</p> : null}
        </header>
      </PageSection>

      {shownIds(content.sections).map((id) => (
        <PageSection key={id} id={id}>
          <div className={s.main}>
            {pathways.length ? (
              <Chooser
                items={pathways.map((pathway) => ({
                  id: pathway.id,
                  number: pathway.number ?? null,
                  title: pathway.title,
                  summary: pathway.summary,
                  panel: (
                    <PathwaySheet
                      pathway={pathway}
                      destination={
                        pathway.form
                          ? formDestination(forms, pathway.form)
                          : null
                      }
                    />
                  ),
                }))}
              />
            ) : (
              <p className={s.empty}>Pathways will be published here.</p>
            )}
          </div>
        </PageSection>
      ))}
    </Container>
  );
}
