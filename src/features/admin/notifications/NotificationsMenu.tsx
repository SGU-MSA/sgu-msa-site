"use client";
import { Bell, X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import type { BoardNotification } from "./board-notifications";
import s from "./notifications.module.css";

/** The "info" lines this browser closed (×), by key; kept in this browser only. */
const closedKey = "sgu-admin-closed-notices:v1";
/** Enough for years of prayer changes; the oldest are forgotten first. */
const keepClosed = 50;
const changed = "sgu-admin-closed-notices";

function readClosed(): string {
  try {
    return localStorage.getItem(closedKey) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changed, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changed, onChange);
  };
}
function parseClosed(raw: string): string[] {
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}
function rememberClosed(key: string) {
  const next = [...parseClosed(readClosed()).filter((k) => k !== key), key];
  try {
    localStorage.setItem(closedKey, JSON.stringify(next.slice(-keepClosed)));
  } catch {
    // Storage blocked: the line is still hidden until the page is reloaded.
  }
  window.dispatchEvent(new Event(changed));
}

/**
 * The notifications bell and its panel (review fixes P1, item 5; WAI-ARIA
 * disclosure): the button shows how many lines there are and opens the
 * panel; Escape or a click outside closes it and focus goes back to the
 * button. Problems first, under "Needs attention"; an "info" line has ×,
 * which hides it in this browser.
 */
export function NotificationsMenu({
  notifications,
}: {
  notifications: readonly BoardNotification[];
}) {
  const [open, setOpen] = useState(false);
  // Hidden in this session even when storage is blocked.
  const [closedNow, setClosedNow] = useState<readonly string[]>([]);
  const raw = useSyncExternalStore(subscribe, readClosed, () => "[]");
  const closed = new Set([...parseClosed(raw), ...closedNow]);
  const shown = notifications.filter(
    (item) => item.level === "problem" || !closed.has(item.key),
  );
  const problems = shown.filter((item) => item.level === "problem");
  const info = shown.filter((item) => item.level === "info");
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }, []);
  // A click or tap outside closes the panel (focus stays where it went).
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, close]);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    close(true);
  };
  const count = shown.length;
  const label = `Notifications${count ? ` (${count})` : ""}`;

  return (
    <div ref={wrapper} className={s.menu} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={`button-secondary ${s.bell}`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((was) => !was)}
      >
        <Bell aria-hidden="true" size={22} strokeWidth={1.75} />
        <span className="sr-only">{label}</span>
        {count ? (
          <span
            className={`${s.count} ${problems.length ? s.countProblem : ""}`}
            aria-hidden="true"
          >
            {count}
          </span>
        ) : null}
      </button>
      <div
        id={`${id}-panel`}
        className={s.panel}
        hidden={!open}
        role="region"
        aria-labelledby={`${id}-heading`}
      >
        <h2 id={`${id}-heading`} ref={heading} tabIndex={-1}>
          Notifications
        </h2>
        {count === 0 ? (
          <p className={s.empty}>Nothing needs attention.</p>
        ) : null}
        {problems.length ? (
          <section aria-labelledby={`${id}-problems`}>
            <h3 id={`${id}-problems`} className={s.group}>
              Needs attention
            </h3>
            <ul className={s.list}>
              {problems.map((item) => (
                <Line
                  key={item.key}
                  item={item}
                  onFollow={() => close(false)}
                />
              ))}
            </ul>
          </section>
        ) : null}
        {info.length ? (
          <section aria-labelledby={`${id}-info`}>
            <h3 id={`${id}-info`} className={s.group}>
              For your information
            </h3>
            <ul className={s.list}>
              {info.map((item) => (
                <Line
                  key={item.key}
                  item={item}
                  onFollow={() => close(false)}
                  onClose={() => {
                    setClosedNow((keys) => [...keys, item.key]);
                    rememberClosed(item.key);
                    // The line is gone: keep focus in the panel.
                    heading.current?.focus();
                  }}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Line({
  item,
  onFollow,
  onClose,
}: {
  item: BoardNotification;
  onFollow: () => void;
  onClose?: () => void;
}) {
  return (
    <li
      className={`${s.item} ${item.level === "problem" ? s.problem : s.info}`}
    >
      <div className={s.text}>
        <p className={s.title}>{item.title}</p>
        {item.detail ? <p className={s.detail}>{item.detail}</p> : null}
        {item.link ? (
          <Link className="text-link" href={item.link.href} onClick={onFollow}>
            {item.link.label} →
          </Link>
        ) : null}
      </div>
      {onClose ? (
        <button type="button" className={s.close} onClick={onClose}>
          <X aria-hidden="true" size={18} />
          <span className="sr-only">Close “{item.title}”</span>
        </button>
      ) : null}
    </li>
  );
}
