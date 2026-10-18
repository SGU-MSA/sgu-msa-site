import { InkRing } from "@/shared/ui/InkRing";
import { TimeOfDay } from "@/shared/ui/TimeOfDay";

import s from "./season.module.css";
import type { TonightRow } from "./tonight";

/**
 * The "Tonight" sheet beside a Ramadan-month season's headline (PR8 D-7,
 * option B "Tonight first"; PR5c D-26): today's date, the night of the
 * month, and tonight's times with the ink ring on Iftar. No Hijri date
 * (D-31). Only the paper behind the sheet is turned; everything on it stays
 * level.
 */
export function TonightPanel({
  rows,
  night,
  date,
}: {
  rows: TonightRow[];
  /** "Night 3", "Night 3 (expected)", or null on Eid eve. */
  night: string | null;
  /** Today's normal date, e.g. "Saturday, October 3" (`todayLabel`). */
  date: string;
}) {
  return (
    <section aria-labelledby="season-tonight" className={s.tonight}>
      <div className={s.sheet}>
        <p className={s.dateLabel}>{date}</p>
        <h2 id="season-tonight" className={s.tonightTitle}>
          Tonight
        </h2>
        {night ? <p className={s.dateLabel}>{night}</p> : null}
        {rows.length ? (
          <dl className={s.times}>
            {rows.map(({ label, value }) => {
              const key = label === "Iftar";
              return (
                <div key={label} className={key ? s.timeKey : undefined}>
                  <dt>{label}</dt>
                  <dd>
                    {key ? (
                      <span className={s.rowRing}>
                        <InkRing />
                      </span>
                    ) : null}
                    <TimeOfDay value={value} className={s.timeValue} />
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
