"use client";
import { useRef, useState } from "react";

import {
  boxesOf,
  clockHours,
  clockMinutes,
  clockParts,
  clockPeriods,
  clockValue,
  disabledClockParts,
  timeFloor,
  type ClockParts,
  type TimeRule,
} from "@/lib/time/field-rules";
import { systemText } from "@/lib/system-text";
import { useFormBoxes } from "./form-boxes";
import styles from "./TimeField.module.css";

const words = systemText.fields;

export type TimeFieldProps = {
  /** The posted box's name; the value is 24-hour `HH:MM`, or "" when empty. */
  name: string;
  /** The group's id (a `CheckedForm` box key may name it). */
  id?: string;
  /** The box's name, read before Hour, Minutes and AM or PM. */
  label: string;
  /**
   * The id of a heading already shown above the box (a `<span>`, never a
   * `<label>`: a label cannot point at a group). It then names the group
   * instead of `label`.
   */
  labelledBy?: string;
  /** The stored `HH:MM` (anything else starts empty). */
  defaultValue?: string;
  /**
   * Which times can be chosen (`anyTime`, `laterThan`): the others are
   * greyed out. Required, so every time box says its rule.
   */
  rule: TimeRule;
  /** Told the new value after each choice (`HH:MM`, "" or "incomplete"). */
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

/**
 * Every time box of the dashboard (review fixes P1, item 1): Hour, Minutes
 * and AM or PM drop-downs, so the board always reads and picks a 12-hour
 * time whatever the browser's language; the form posts 24-hour `HH:MM` from
 * a hidden input. Choosing an hour first fills ":00" (when allowed);
 * emptying the hour empties the box. Times outside the `rule` are greyed out. Each drop-down
 * carries `data-control` with the box's name and id, so a `CheckedForm`
 * marks all three when the box needs fixing.
 */
export function TimeField({
  name,
  id,
  label,
  labelledBy,
  defaultValue = "",
  rule,
  onChange,
  required,
  disabled,
  "aria-describedby": describedBy,
  className,
}: TimeFieldProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [parts, setParts] = useState<ClockParts>(() =>
    clockParts(defaultValue),
  );
  const boxes = useFormBoxes(ref, boxesOf(rule));
  const floor = timeFloor(rule, (box) => boxes[box] ?? "");
  const greyed = disabledClockParts(floor, parts);
  const choose = (change: Partial<ClockParts>) => {
    let next: ClockParts =
      change.hour === ""
        ? { hour: "", minute: "", period: "" }
        : { ...parts, ...change };
    // A new hour starts on the hour, unless that is greyed out.
    if (
      change.hour &&
      !parts.minute &&
      !disabledClockParts(floor, next).minutes.has("00")
    )
      next = { ...next, minute: "00" };
    setParts(next);
    onChange?.(clockValue(next));
  };
  const common = {
    "data-control": [name, id].filter(Boolean).join(" "),
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
    disabled,
    className: styles.part,
  };
  return (
    <span
      ref={ref}
      id={id}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={[styles.time, className].filter(Boolean).join(" ")}
    >
      <select
        {...common}
        aria-label={words.hour}
        value={parts.hour}
        onChange={(event) => choose({ hour: event.target.value })}
      >
        <option value="">{words.notChosen}</option>
        {clockHours.map((hour) => (
          <option key={hour} value={hour} disabled={greyed.hours.has(hour)}>
            {hour}
          </option>
        ))}
      </select>
      <span className={styles.colon} aria-hidden="true">
        :
      </span>
      <select
        {...common}
        aria-label={words.minutes}
        value={parts.minute}
        onChange={(event) => choose({ minute: event.target.value })}
      >
        <option value="">{words.notChosen}</option>
        {clockMinutes.map((minute) => (
          <option
            key={minute}
            value={minute}
            disabled={greyed.minutes.has(minute)}
          >
            {minute}
          </option>
        ))}
      </select>
      <select
        {...common}
        aria-label={words.period}
        value={parts.period}
        onChange={(event) =>
          choose({ period: event.target.value as ClockParts["period"] })
        }
      >
        <option value="">{words.notChosen}</option>
        {clockPeriods.map((period) => (
          <option
            key={period}
            value={period}
            disabled={greyed.periods.has(period)}
          >
            {period}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={clockValue(parts)} />
    </span>
  );
}
