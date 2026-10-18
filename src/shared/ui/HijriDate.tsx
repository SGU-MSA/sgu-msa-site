import type { HijriDate as Hijri } from "@/lib/time/hijri";

import styles from "./reminders.module.css";

/** An ink moon for the Hijri day: waxing to full around the 14th, then waning. */
function Moon({ day }: { day: number }) {
  const r = 9;
  const phase = ((((day - 1) % 29.53) + 29.53) % 29.53) / 29.53;
  const k = Math.cos(2 * Math.PI * phase); // 1 = new, -1 = full
  const waxing = phase < 0.5;
  const rx = Math.max(Math.abs(k) * r, 0.01);
  const outer = waxing ? 1 : 0;
  const terminator = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  return (
    <svg viewBox="-11 -11 22 22" className={styles.moon} aria-hidden="true">
      <circle r={r} fill="none" stroke="currentColor" strokeWidth="1" />
      <path
        d={`M0,${-r} A${r},${r} 0 0 ${outer} 0,${r} A${rx},${r} 0 0 ${terminator} 0,${-r} Z`}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Today's Hijri date (ADR 0018), English first with the Arabic small beneath,
 * beside its moon. `hijri` comes from `hijriDate()` on the server clock and
 * advances at Maghrib, without saying so (PR8 D-11).
 *
 * A Hijri date is only ever shown next to the normal (Gregorian) date
 * (PR8 D-11): pass `date` (e.g. `todayLabel(now)`) and it shows first, larger,
 * with the Hijri date as the smaller line under it. Leave it out only where
 * the normal date already heads the block, as in Prayer's "Today · …".
 */
export function HijriDate({ hijri, date }: { hijri: Hijri; date?: string }) {
  const line = (
    <p className={styles.hijri}>
      <Moon day={hijri.day} />
      <span className={styles.hijriText}>
        <span className={styles.hijriEnglish}>{hijri.english}</span>
        <span lang="ar" dir="rtl" className={styles.hijriArabic}>
          {hijri.arabic}
        </span>
      </span>
    </p>
  );
  if (!date) return line;
  return (
    <div className={styles.dated}>
      <p className={styles.today}>{date}</p>
      {line}
    </div>
  );
}
