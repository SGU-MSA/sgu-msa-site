import quiet from "@/shared/ui/page.module.css";
import type { GetInvolvedContent } from "@/lib/content/schemas";
import type { LinkDestination } from "@/lib/integrations/types";
import { FormCtaView } from "@/shared/ui/FormCtaView";
import { SafeImage } from "@/shared/ui/SafeImage";
import { SiteIcon } from "@/shared/ui/SiteIcon";

import s from "./involve.module.css";

export type Pathway = GetInvolvedContent["pathways"][number];

/**
 * One pathway, open on a lifted paper sheet (PR8 D-4, Get Involved option B
 * "Chooser"). Rendered on the server for the page, so no form URL is a prop
 * of the client chooser; `destination` is the pathway's sign-up form,
 * resolved from the forms list (null: the pathway has none).
 */
export function PathwaySheet({
  pathway,
  destination,
}: {
  pathway: Pathway;
  destination: LinkDestination | null;
}) {
  const titleId = `${pathway.id}-title`;

  return (
    <article className={s.sheet} aria-labelledby={titleId}>
      <div className={s.sheetHead}>
        {pathway.number ? (
          <span className={s.sheetNumber}>{pathway.number}</span>
        ) : null}
        <SiteIcon name={pathway.icon} aria-hidden="true" className={s.icon} />
      </div>

      <h2 id={titleId} className={s.title}>
        {pathway.title}
      </h2>
      <p className={s.summary}>{pathway.summary}</p>

      {/* Only where an authentic photo exists for this pathway. */}
      {pathway.image ? (
        <figure className={`${quiet.photo} ${s.photo}`}>
          <div className={quiet.photoFrame}>
            <SafeImage
              image={pathway.image}
              fill
              sizes="(min-width: 52rem) 30rem, 100vw"
              fit="cover"
            />
          </div>
        </figure>
      ) : null}

      {pathway.body ? <p className={s.body}>{pathway.body}</p> : null}

      {/* Ordered workflow, shown only where content defines steps. */}
      {pathway.steps.length ? (
        <ol className={s.steps}>
          {pathway.steps.map((step, index) => (
            <li key={step.id} className={s.step}>
              <span className={s.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <span className={s.stepLabel}>{step.label}</span>
                {step.detail ? (
                  <span className={s.stepDetail}>{step.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {/* Fields the external form covers, so students know what to prepare. */}
      {pathway.fields.length ? (
        <div className={s.fields}>
          <p className={s.label}>The form asks about</p>
          <ul className={s.fieldList}>
            {pathway.fields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {pathway.note ? <p className={s.note}>{pathway.note}</p> : null}

      {destination ? (
        <FormCtaView
          destination={destination}
          className={s.cta}
          variant="outline"
        />
      ) : null}
    </article>
  );
}
