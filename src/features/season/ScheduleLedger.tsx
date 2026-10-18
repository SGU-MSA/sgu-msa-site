import type { ScheduleRow } from "@/lib/community/seasons";
import { Container } from "@/shared/ui/Container";

import s from "./season.module.css";

/**
 * A season page's schedule as a numbered ledger (D-26): What, then When and
 * Where on one line. Nothing is drawn without rows.
 */
export function ScheduleLedger({
  schedule,
  className,
}: {
  schedule: readonly ScheduleRow[];
  className?: string;
}) {
  if (!schedule.length) return null;
  return (
    <Container
      as="section"
      className={className ? `${s.month} ${className}` : s.month}
      aria-labelledby="season-schedule"
    >
      <h2 id="season-schedule" className={s.h2}>
        Schedule
      </h2>
      <ol className={s.ledger}>
        {schedule.map((row, index) => (
          <li key={`${index}-${row.what}`}>
            <span className={s.ledgerLabel}>{row.what}</span>
            <span className={s.ledgerDetail}>
              {[row.when, row.where].filter(Boolean).join(" · ")}
            </span>
          </li>
        ))}
      </ol>
    </Container>
  );
}
