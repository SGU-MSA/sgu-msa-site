"use client";
import { useEffect, useRef, useState } from "react";
import type { TimeFieldProps } from "./TimeField";
import styles from "./StepTimeField.module.css";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const label12 = (value: string) => {
  const hours = Number(value.slice(0, 2));
  return `${hours % 12 || 12}:${value.slice(3)} ${hours < 12 ? "AM" : "PM"}`;
};

/** `value` moved by `delta` minutes, around midnight. */
const shift = (value: string, delta: number) => {
  const total =
    (Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) + delta + 1440) %
    1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Prototype time box: the time large in 12-hour form, "−5 min" and "+5 min"
 * buttons, and a way to type it (a native time box). Posts 24-hour `HH:MM`
 * from one hidden input. Same props as `TimeField`, plus `start`, where an
 * empty box begins.
 */
export function StepTimeField({
  name,
  id,
  label,
  defaultValue = "",
  onChange,
  disabled,
  "aria-describedby": describedBy,
  className,
  start = "12:00",
}: TimeFieldProps & { start?: string }) {
  const [value, setValue] = useState(
    timePattern.test(defaultValue) ? defaultValue : "",
  );
  const [typing, setTyping] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  // The form hears a change (unsaved bar, checks), as it does from a drop-down.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);
  const set = (next: string) => {
    setValue(next);
    onChange?.(next);
  };
  const bump = (delta: number) => set(value ? shift(value, delta) : start);
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      data-control={[name, id].filter(Boolean).join(" ")}
      className={[styles.step, className].filter(Boolean).join(" ")}
    >
      <output className={styles.big} data-empty={value ? undefined : "true"}>
        {value ? label12(value) : "Not set"}
      </output>
      <div className={styles.buttons}>
        <button
          type="button"
          className="button-secondary"
          disabled={disabled}
          aria-label={`${label}: 5 minutes earlier`}
          onClick={() => bump(-5)}
        >
          −5 min
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={disabled}
          aria-label={`${label}: 5 minutes later`}
          onClick={() => bump(5)}
        >
          +5 min
        </button>
        <button
          type="button"
          className={styles.link}
          disabled={disabled}
          aria-expanded={typing}
          onClick={() => setTyping((open) => !open)}
        >
          {typing ? "Done typing" : "Type a time"}
        </button>
      </div>
      {typing ? (
        <input
          type="time"
          lang="en-US"
          aria-label={`${label}, type a time`}
          value={value}
          disabled={disabled}
          className={styles.typed}
          onChange={(event) => set(event.target.value)}
        />
      ) : null}
      <input ref={hidden} type="hidden" name={name} value={value} />
    </div>
  );
}
