import type { ComponentProps } from "react";

import { timeOfDay } from "@/lib/time/time-of-day";

type TimeOfDayProps = Omit<ComponentProps<"time">, "children" | "dateTime"> & {
  /** A stored 24-hour `HH:MM` value, or an instant shown in Grenada time. */
  value: string | Date;
};

/**
 * A time of day as the public site shows it (restyle-public D-8):
 * `<time dateTime="13:30">1:30 PM</time>`. Text that is not a stored time
 * ("6:40 PM", "After Isha") renders as written in a `<span>`; empty renders
 * nothing. Other attributes (className, aria-*) pass to the element.
 */
export function TimeOfDay({ value, ...rest }: TimeOfDayProps) {
  const { label, dateTime } = timeOfDay(value);
  if (!label) return null;
  return dateTime ? (
    <time {...rest} dateTime={dateTime}>
      {label}
    </time>
  ) : (
    <span {...rest}>{label}</span>
  );
}
