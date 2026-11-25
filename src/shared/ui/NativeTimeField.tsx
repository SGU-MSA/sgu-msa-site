"use client";
import type { TimeFieldProps } from "./TimeField";
import styles from "./NativeTimeField.module.css";

/**
 * Prototype time box: one native time input (one wheel on a phone). Posts
 * 24-hour `HH:MM` as it holds it. Same props as `TimeField`.
 */
export function NativeTimeField({
  name,
  id,
  label,
  defaultValue = "",
  onChange,
  required,
  disabled,
  "aria-describedby": describedBy,
  className,
}: TimeFieldProps) {
  return (
    <input
      type="time"
      lang="en-US"
      id={id}
      name={name}
      step={60}
      aria-label={label}
      defaultValue={/^\d\d:\d\d$/.test(defaultValue) ? defaultValue : ""}
      required={required}
      disabled={disabled}
      aria-describedby={describedBy}
      className={[styles.time, className].filter(Boolean).join(" ")}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
