import Link from "next/link";

import type {
  HomeContent,
  JumuahContent,
  Reminder,
} from "@/lib/content/schemas";
import type { HijriDate as Hijri } from "@/lib/time/hijri";
import {
  fridayLabel,
  startsMissingNote,
  type TodayRow,
} from "@/features/prayer/today";
import type { JumuahChangeNote } from "@/lib/prayer/congregation";
import { Container } from "@/shared/ui/Container";
import { DhikrOfTheHour } from "@/shared/ui/DhikrOfTheHour";
import { HijriDate } from "@/shared/ui/HijriDate";
import { InkRing } from "@/shared/ui/InkRing";
import { TimeOfDay } from "@/shared/ui/TimeOfDay";

import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

export type HomeHeroProps = {
  hero: HomeContent["hero"];
  dhikr?: Reminder;
  hijri: Hijri;
  rows: TodayRow[];
  next: { id: string; label: string; iso: string; day: number } | null;
  /** The musallah pin could not be read, so starts are hidden for now (PR7). */
  startsUnavailable?: boolean;
  /** The calculation line (`prayerCalculation.label`). */
  method: string;
  lastUpdated?: string | null;
  jumuah: JumuahContent & { change: JumuahChangeNote | null };
  dateLabel: string;
  isFriday: boolean;
};

/**
 * The Home hero (approved D1 layout): headline from content/home.yaml
 * (design-foundation D-6) beside the prayer block with the dhikr of the
 * hour, today's date with the Hijri date under it (PR8 D-11) and the next
 * prayer ringed in ink.
 */
export function HomeHero({
  hero,
  dhikr,
  hijri,
  rows,
  next,
  startsUnavailable = false,
  method,
  lastUpdated,
  jumuah,
  dateLabel,
  isFriday,
}: HomeHeroProps) {
  const calculated = rows.some((row) => row.begins);
  const gatherings = jumuah.gatherings;
  const change = jumuah.change;
  return (
    <Container className={`${s.above} ${h.hero}`}>
      <div className={`${h.heroMain} ${s.enter}`}>
        <p className={s.eyebrow}>{hero.eyebrow}</p>
        <h1 className={s.display}>
          {hero.headline}
          {hero.emphasis ? (
            <>
              <br />
              <em>{hero.emphasis}</em>
            </>
          ) : null}
        </h1>
        {hero.body.length ? (
          <p className={s.lede}>{hero.body.join(" ")}</p>
        ) : null}
        <div className={s.actions}>
          <Link href={hero.primary_cta.href} className={s.underline}>
            <span>{hero.primary_cta.label}</span>
          </Link>
          <Link href={hero.secondary_cta.href} className={s.underlineSoft}>
            <span>{hero.secondary_cta.label}</span>
          </Link>
        </div>
      </div>

      <div className={`${h.heroAside} ${s.enterLate}`}>
        {dhikr ? <DhikrOfTheHour reminder={dhikr} /> : null}
        <section aria-label="Calculated prayer start times">
          <HijriDate hijri={hijri} date={dateLabel} />
          {next ? (
            <div className={h.next}>
              <InkRing className={h.ring} />
              <p className={h.nextLabel}>
                Next prayer · {next.label}
                {next.day ? " tomorrow" : ""}
              </p>
              <p className={h.nextTime}>
                <TimeOfDay value={new Date(next.iso)} />
              </p>
            </div>
          ) : null}
          {!calculated ? (
            <p className={s.small}>{startsMissingNote(startsUnavailable)}</p>
          ) : null}
          {rows.length ? (
            // One table, one row per prayer, so names and both times run in
            // straight columns (review fixes PR-1); the same headings as Prayer.
            <table className={h.times}>
              <thead>
                <tr>
                  <th scope="col">Prayer</th>
                  <th scope="col">Begins</th>
                  <th scope="col">Iqamah</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      next && !next.day && row.id === next.id
                        ? h.now
                        : undefined
                    }
                  >
                    <th scope="row">{row.label}</th>
                    <td>
                      {row.begins ? (
                        <TimeOfDay value={new Date(row.begins.iso)} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={h.iqamah}>
                      {row.iqamah ? <TimeOfDay value={row.iqamah} /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={s.small}>
              A current iqamah schedule will be published here.
            </p>
          )}
          <p className={s.small}>
            {change?.state === "cancelled" ? (
              <>
                <strong className={h.strong}>
                  No Jumu’ah this Friday, {fridayLabel(change.date)}.
                </strong>{" "}
                {change.reason}
              </>
            ) : gatherings.length ? (
              <>
                <strong className={h.strong}>
                  {change
                    ? `Changed this Friday, ${fridayLabel(change.date)}`
                    : isFriday
                      ? "Jumu’ah today"
                      : jumuah.heading}
                </strong>
                {/* Each prayer in order (review fixes P2). */}
                {gatherings.map((gathering, index) => (
                  <span key={gathering.id}>
                    {index ? "; " : ", "}khutbah{" "}
                    <TimeOfDay value={gathering.khutbah} />, iqamah{" "}
                    <TimeOfDay value={gathering.iqamah} />
                  </span>
                ))}
              </>
            ) : (
              "Jumu’ah details will be published here."
            )}
          </p>
          <p className={h.method}>
            {method}
            {lastUpdated ? ` · ${lastUpdated}` : ""}
          </p>
          <p className={h.prayerLink}>
            <Link href="/prayer" className={s.underlineSoft}>
              <span>View Prayer &amp; Jumu’ah</span>
            </Link>
          </p>
        </section>
      </div>
    </Container>
  );
}
