import type { Reminder } from "@/lib/content/schemas";
import type { HijriDate as Hijri } from "@/lib/time/hijri";
import { HijriDate } from "@/shared/ui/HijriDate";
import { InkRing } from "@/shared/ui/InkRing";
import { MarginNote } from "@/shared/ui/MarginNote";
import { TimeOfDay } from "@/shared/ui/TimeOfDay";

import s from "@/shared/ui/page.module.css";
import p from "./prayer.module.css";
import { startsMissingNote, type TodayRow } from "./today";

type PrayerTodayProps = {
  dateLabel: string;
  hijri: Hijri;
  rows: TodayRow[];
  /** Id of today's next prayer, ringed in ink; null after Isha or without times. */
  nextId: string | null;
  /** The musallah pin could not be read, so starts are hidden for now (PR7). */
  startsUnavailable?: boolean;
  method: string;
  notice?: string | null;
  lastUpdated?: string | null;
  verse?: Reminder | null;
};

/**
 * Today on /prayer: begins (calculated) and iqamah (set by the MSA) in one
 * table, the next prayer ringed in ink, the Hijri date beside "Today" and the
 * page's margin note verse.
 */
export function PrayerToday({
  dateLabel,
  hijri,
  rows,
  nextId,
  startsUnavailable = false,
  method,
  notice,
  lastUpdated,
  verse,
}: PrayerTodayProps) {
  const calculated = rows.some((row) => row.begins);
  return (
    <div className={s.splitMain}>
      <h2 id="today" className={s.h2Small}>
        Today <em>· {dateLabel}</em>
      </h2>
      <div className={p.hijri}>
        <HijriDate hijri={hijri} />
      </div>
      {!calculated ? (
        <p className={p.footnote}>{startsMissingNote(startsUnavailable)}</p>
      ) : null}
      {rows.length ? (
        <table className={p.table} aria-labelledby="today">
          <thead>
            <tr>
              <th scope="col">Prayer</th>
              <th scope="col">Begins</th>
              <th scope="col">Iqamah</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const now = row.id === nextId;
              return (
                <tr
                  key={row.id}
                  className={
                    now ? p.now : row.id === "sunrise" ? p.dim : undefined
                  }
                >
                  <th scope="row">
                    {now ? <InkRing className={p.rowRing} /> : null}
                    <span className={p.rowName}>{row.label}</span>
                    {now ? <span className={p.nowTag}>Next</span> : null}
                  </th>
                  <td>
                    {row.begins ? (
                      <TimeOfDay value={new Date(row.begins.iso)} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{row.iqamah ? <TimeOfDay value={row.iqamah} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className={p.footnote}>
          A current congregation schedule will be published here.
        </p>
      )}
      <p className={p.footnote}>
        {calculated ? (
          <>
            Begins: calculated for the Musallah ({method} ·
            America/Grenada).{" "}
          </>
        ) : null}
        Iqamah: {notice}
        {lastUpdated ? <> · {lastUpdated}</> : null}
      </p>
      {verse ? <MarginNote reminder={verse} /> : null}
    </div>
  );
}
