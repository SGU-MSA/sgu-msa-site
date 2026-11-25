"use client";
import { useRef } from "react";
import { boxesOf, timeFloor } from "@/lib/time/field-rules";
import type { TimeFieldProps } from "./TimeField";
import { useFormBoxes } from "./form-boxes";
import styles from "./SelectTimeField.module.css";

const label12 = (hours: number, minutes: number) =>
  `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;

/** "12:00 AM" … "11:55 PM", every 5 minutes, valued as 24-hour `HH:MM`. */
const steps = Array.from({ length: 288 }, (_, index) => {
  const hours = Math.floor(index / 12);
  const minutes = (index % 12) * 5;
  return {
    value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    label: label12(hours, minutes),
  };
});

/**
 * Prototype time box: one 12-hour drop-down in 5-minute steps. Posts 24-hour
 * `HH:MM`. A stored time between steps is kept as an extra choice. Same props
 * as `TimeField`.
 */
export function SelectTimeField({
  name,
  id,
  label,
  defaultValue = "",
  rule,
  onChange,
  required,
  disabled,
  "aria-describedby": describedBy,
  className,
}: TimeFieldProps) {
  const ref = useRef<HTMLSelectElement>(null);
  const boxes = useFormBoxes(ref, boxesOf(rule));
  const floor = timeFloor(rule, (box) => boxes[box] ?? "");
  const stored = /^\d\d:\d\d$/.test(defaultValue) ? defaultValue : "";
  const odd =
    stored && !steps.some((step) => step.value === stored)
      ? {
          value: stored,
          label: label12(Number(stored.slice(0, 2)), Number(stored.slice(3))),
        }
      : null;
  const all = odd
    ? [...steps, odd].sort((a, b) => a.value.localeCompare(b.value))
    : steps;
  return (
    <select
      ref={ref}
      id={id}
      name={name}
      data-control={[name, id].filter(Boolean).join(" ")}
      aria-label={label}
      defaultValue={stored}
      required={required}
      disabled={disabled}
      aria-describedby={describedBy}
      className={[styles.select, className].filter(Boolean).join(" ")}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="">Not set</option>
      {all.map((step) => (
        <option
          key={step.value}
          value={step.value}
          disabled={floor !== null && step.value <= floor}
        >
          {step.label}
        </option>
      ))}
    </select>
  );
}
