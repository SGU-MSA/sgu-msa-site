"use client";
import { useRef } from "react";
import { scheduleEndStatus } from "@/lib/prayer/congregation";
import { weekdayDateLabel } from "@/lib/time/date-label";
import { useFormBoxes } from "@/shared/ui/form-boxes";

/**
 * The warning that the iqamah times are about to stop showing on the website.
 * It asks `scheduleEndStatus`, the same rule as the bell's "ending soon" item,
 * and follows the "Times end on" box live when it sits inside the form
 * (otherwise it uses the saved date).
 */
export function PrayerEndWarning({
  saved,
  today,
}: {
  /** The saved "Times end on" (YYYY-MM-DD) or "". */
  saved: string;
  /** Today in Grenada (server clock). */
  today: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const boxes = useFormBoxes(ref, ["valid_until"]);
  const end = boxes.valid_until ?? saved;
  const status = scheduleEndStatus({ valid_until: end }, today);
  return (
    <div ref={ref}>
      {status.state === "none" ? null : (
        <p role="status" className="end-warning" data-state={status.state}>
          <strong>
            {status.state === "ended"
              ? `Iqamah times ended on ${weekdayDateLabel(status.end)} and are hidden on the website.`
              : status.end === today
                ? "Iqamah times stop showing on the website after today."
                : `Iqamah times stop showing on the website after ${weekdayDateLabel(status.end)}.`}
          </strong>{" "}
          Set new dates to keep them.
        </p>
      )}
    </div>
  );
}
