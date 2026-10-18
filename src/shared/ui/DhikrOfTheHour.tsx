import type { Reminder } from "@/lib/content/schemas";

import { ArabicLine } from "./ArabicLine";
import { MeaningTip } from "./MeaningTip";
import styles from "./reminders.module.css";

/**
 * Dhikr of the hour (ADR 0018): the remembrance for this time of day
 * (morning, after a prayer, Friday, evening or night), chosen on the server
 * by `dhikrSlot` from the same prayer times the page shows.
 */
export function DhikrOfTheHour({ reminder }: { reminder: Reminder }) {
  return (
    <figure
      className={styles.dhikr}
      aria-label="Remembrance for this time of day"
    >
      <span className={styles.dhikrHour} aria-hidden="true" />
      <ArabicLine
        as="blockquote"
        text={reminder.arabic}
        className={styles.dhikrArabic}
      />
      <figcaption className={styles.dhikrCaption}>
        <MeaningTip reminder={reminder} />
      </figcaption>
    </figure>
  );
}
