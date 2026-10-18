"use client";

import type { Reminder } from "@/lib/content/schemas";

import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "./popover";
import styles from "./reminders.module.css";

/**
 * The small "?" toggletip beside a reminder (ADR 0018): tap, click, Enter or
 * Space opens its English meaning and reference (surah and verse; PR8 D-6:
 * the source stays in content/reminders.yaml for review, not on the page),
 * and a library verse's translator credit (PR5b D-24).
 * Escape or a tap outside closes it. Screen readers always get the meaning
 * directly.
 */
export function MeaningTip({ reminder }: { reminder: Reminder }) {
  return (
    <>
      <span className="sr-only">Meaning: {reminder.meaning}</span>
      <Popover>
        <PopoverTrigger
          className={styles.tipTrigger}
          aria-label="Show the meaning"
        >
          ?
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            className={styles.tip}
            side="bottom"
            align="center"
            sideOffset={8}
            collisionPadding={12}
          >
            <p lang="en">{reminder.meaning}</p>
            <p className={styles.tipReference}>{reminder.reference}</p>
            {reminder.credit ? (
              <p className={styles.tipReference}>{reminder.credit}</p>
            ) : null}
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </>
  );
}
