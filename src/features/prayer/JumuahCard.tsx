import type { JumuahContent } from "@/lib/content/schemas";
import { jumuahSessionName } from "@/lib/prayer/adjustments";
import type { JumuahChangeNote } from "@/lib/prayer/congregation";
import { TimeOfDay } from "@/shared/ui/TimeOfDay";

import s from "@/shared/ui/page.module.css";
import p from "./prayer.module.css";
import { fridayLabel } from "./today";

type JumuahCardProps = {
  heading: string;
  gatherings: JumuahContent["gatherings"];
  note?: string | null;
  /** A one-Friday change (PR4): cancelled, or that Friday's own prayers in `gatherings`. */
  change?: JumuahChangeNote | null;
  emptyMessage?: string;
};

/** Jumu'ah on /prayer: the inverted ink card beside today's times (#jumuah). */
export function JumuahCard({
  heading,
  gatherings,
  note,
  change,
  emptyMessage = "Jumu’ah details will be published here.",
}: JumuahCardProps) {
  return (
    <section
      id="jumuah"
      aria-labelledby="jumuah-heading"
      className={`${s.ink} ${p.jumuah}`}
    >
      <div className={p.jumuahInner}>
        <p lang="ar" dir="rtl" className={p.jumuahArabic} aria-hidden="true">
          الجمعة
        </p>
        <h2 id="jumuah-heading" className={`${s.h2} ${p.jumuahTitle}`}>
          {heading}
        </h2>
        {change?.state === "cancelled" ? (
          <>
            <p className={p.jumuahNote}>
              <strong>
                No Jumu’ah this Friday, {fridayLabel(change.date)}.
              </strong>
            </p>
            <p className={p.jumuahNote}>{change.reason}</p>
          </>
        ) : gatherings.length ? (
          <>
            {change?.state === "changed" ? (
              <p className={p.gatheringLabel}>
                Changed this Friday, {fridayLabel(change.date)}
              </p>
            ) : null}
            {gatherings.map((gathering, index) => (
              <div key={gathering.id} className={p.gathering}>
                {/* Several prayers: each is named by its place (review fixes P2). */}
                {gatherings.length > 1 ? (
                  <p className={p.gatheringLabel}>
                    {gathering.label ?? jumuahSessionName(index)}
                  </p>
                ) : null}
                <dl>
                  <div>
                    <dt>Khutbah</dt>
                    <dd>
                      <TimeOfDay value={gathering.khutbah} />
                    </dd>
                  </div>
                  <div>
                    <dt>Iqamah</dt>
                    <dd>
                      <TimeOfDay value={gathering.iqamah} />
                    </dd>
                  </div>
                </dl>
                {gathering.note ? (
                  <p className={p.jumuahNote}>{gathering.note}</p>
                ) : null}
              </div>
            ))}
            {change?.state === "changed" ? (
              <>
                <p className={p.jumuahNote}>{change.reason}</p>
                {change.usual.length ? (
                  <p className={p.jumuahNote}>
                    Usually:{" "}
                    {/* Several prayers: one line each (review fixes P2). */}
                    {change.usual.map((usual, index) => (
                      <span
                        key={index}
                        className={
                          change.usual.length > 1 ? p.usualLine : undefined
                        }
                      >
                        Khutbah <TimeOfDay value={usual.khutbah} /> · Iqamah{" "}
                        <TimeOfDay value={usual.iqamah} />
                      </span>
                    ))}
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className={p.jumuahNote}>{emptyMessage}</p>
        )}
        {note && gatherings.length ? (
          <p className={p.jumuahNote}>{note}</p>
        ) : null}
      </div>
    </section>
  );
}
