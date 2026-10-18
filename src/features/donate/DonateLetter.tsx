import type { Reminder } from "@/lib/content/schemas";
import type { DonatePageData } from "@/lib/community/payments";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import { Rubric } from "@/shared/ui/Rubric";
import { Seal } from "@/shared/ui/Seal";

import { DonateSlips } from "./DonateSlips";
import s from "./donate.module.css";

/**
 * The Donate page as a letter from the MSA (PR8 D-2, option C "Letter"): one
 * centred paper sheet headed by the seal, the thanks and a rubric rule, then
 * the giving state (PR6 `DonatePageData`): the Go2Pay notice (review fixes
 * P4), then the open funds as paper slips under the intention line (D-49,
 * D-62, D-77), or the "no open appeals"
 * line, or the could-not-load line; the fine print (D-31, D-76) and the verse
 * close it. Only the paper sheet behind the letter is turned slightly; the
 * seal, the text and the verse on it stay level (ADR 0018).
 */
export function DonateLetter({
  data,
  verse,
}: {
  data: DonatePageData;
  verse?: Reminder | null;
}) {
  return (
    <Container className={s.page}>
      <article
        className={data.state === "ready" ? `${s.letter} ${s.wide}` : s.letter}
        aria-labelledby="donate-title"
      >
        <div aria-hidden="true" className={s.sheet} />
        <div className={s.seal}>
          <Seal size={72} />
        </div>
        <p className={s.eyebrow}>Giving at SGU MSA</p>
        <h1 id="donate-title" className={s.display}>
          Support <em>our community</em>
        </h1>
        <p className={s.lede}>
          Thank you for wanting to support Muslim student life at SGU.
        </p>
        <div className={s.divider} aria-hidden="true">
          <Rubric />
        </div>
        <section aria-labelledby="donate-state">
          {data.state === "ready" ? (
            <>
              <p className={s.notice} role="note">
                {data.notice}
              </p>
              <h2 id="donate-state" className={s.h2}>
                Choose where your gift goes
              </h2>
              <p className={s.intent}>{data.intentionLine}</p>
              <DonateSlips groups={data.groups} />
            </>
          ) : data.state === "empty" ? (
            <>
              <h2 id="donate-state" className={s.h2}>
                There are no open appeals right now.
              </h2>
              <div className={s.action}>
                <ButtonLink href="/contact" variant="outline">
                  Contact the MSA
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <h2 id="donate-state" className={s.h2}>
                Giving details could not be loaded right now.
              </h2>
              <div className={s.action}>
                <ButtonLink href="/contact" variant="outline">
                  Contact the MSA
                </ButtonLink>
              </div>
            </>
          )}
        </section>
        {data.state === "ready" ? (
          <div className={s.fine}>
            {data.finePrint.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {verse ? <MarginNote reminder={verse} className={s.note} /> : null}
      </article>
    </Container>
  );
}
