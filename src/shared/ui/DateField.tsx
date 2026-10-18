"use client";
import { useRef, type ComponentProps } from "react";

import { boxesOf, dayLimits, type DateRule } from "@/lib/time/field-rules";
import { useFormBoxes } from "./form-boxes";

export type DateFieldProps = Omit<
  ComponentProps<"input">,
  "type" | "min" | "max" | "ref"
> & {
  /**
   * Which days can be chosen (`anyDate`, `todayOrLater`, `dayRange`): the
   * others are greyed out in the picker. Required, so every date box says
   * its rule.
   */
  rule: DateRule;
};

/**
 * Every date box of the dashboard (review fixes P1, item 1): the browser's
 * own date picker, keyboard and screen-reader friendly, posting
 * `YYYY-MM-DD`. Its `rule` sets `min` and `max`, following other boxes of the
 * same form live, so a day outside the rule cannot be picked. All other
 * input attributes (id, name, defaultValue, aria-*) pass through.
 */
export function DateField({ rule, ...input }: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const boxes = useFormBoxes(ref, boxesOf(rule));
  const { min, max } = dayLimits(rule, (box) => boxes[box] ?? "");
  return <input {...input} ref={ref} type="date" min={min} max={max} />;
}
