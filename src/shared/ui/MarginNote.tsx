import type { Reminder } from "@/lib/content/schemas";

import { ArabicLine } from "./ArabicLine";
import { MeaningTip } from "./MeaningTip";
import { Rubric } from "./Rubric";
import styles from "./reminders.module.css";

/**
 * Hāshiya (ADR 0018): a short verse set level in a section's margin, like a
 * scholar's marginal note, with a small ink rubric and a "?" for its meaning.
 * Never placed behind or under other text, never beside delete controls.
 */
export function MarginNote({
  reminder,
  className,
}: {
  reminder: Reminder;
  className?: string;
}) {
  return (
    <aside
      className={className ? `${styles.margin} ${className}` : styles.margin}
      // Named by its reference so several notes on one page stay distinct landmarks.
      aria-label={`Reminder, ${reminder.reference}`}
    >
      <span className={styles.marginInk}>
        <Rubric className={styles.rubric} />
        <ArabicLine text={reminder.arabic} className={styles.marginArabic} />
      </span>
      <MeaningTip reminder={reminder} />
    </aside>
  );
}
