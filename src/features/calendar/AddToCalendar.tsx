"use client";

import { CalendarPlus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState, useSyncExternalStore } from "react";

import {
  calendarTarget,
  type CalendarLinks,
  type CalendarTarget,
} from "@/lib/calendar/targets";

import c from "./calendar.module.css";

type AddToCalendarProps = {
  /** The event's file, Google Calendar and Outlook addresses (`calendarLinks`). */
  links: CalendarLinks;
  title: string;
  /**
   * "underline" sits quietly on an event card; "ink" is the event page's main
   * action; "outline" sits beside a filled ticket button (PR6 D-82).
   */
  variant?: "underline" | "ink" | "outline";
  /**
   * "event" adds one event; "feed" subscribes to every public event (the
   * links are `calendarFeedLinks`): the same menu and device choice, other words.
   */
  kind?: "event" | "feed";
};

/** The menu's choices on a computer that is not a Mac (review 2, 2026-10-05). */
export const calendarChoices = [
  ["google", "Google Calendar"],
  ["outlook", "Outlook"],
  ["file", "Apple or other (file)"],
] as const satisfies readonly (readonly [keyof CalendarLinks, string])[];

/** The same choices when subscribing to the feed. */
const feedChoices = [
  ["file", "Apple Calendar or other (subscribe)"],
  ["google", "Google Calendar"],
  ["outlook", "Outlook"],
] as const satisfies readonly (readonly [keyof CalendarLinks, string])[];

/** Nothing to subscribe to: the device does not change on a page. */
const noChanges = () => () => {};
const onThisDevice = (): CalendarTarget => calendarTarget(navigator.userAgent);
/** The server and a browser without JavaScript give the file. */
const onServer = (): CalendarTarget => "file";

/**
 * "Add to Calendar" (review 2, 2026-10-05; `CalendarTarget`): iPhone, iPad
 * and Mac open the event's calendar file, which Apple Calendar takes in;
 * Android opens Google Calendar with the event filled in; other computers
 * get a small menu: Google Calendar, Outlook, or the file for Apple
 * Calendar and every other app. Provider-neutral: no calendar API and no
 * account; Google and Outlook only receive the event's public details.
 */
export function AddToCalendar({
  links,
  title,
  variant = "underline",
  kind = "event",
}: AddToCalendarProps) {
  const feed = kind === "feed";
  const [copied, setCopied] = useState(false);
  const target = useSyncExternalStore(noChanges, onThisDevice, onServer);
  const className =
    variant === "ink"
      ? c.addInk
      : variant === "outline"
        ? c.addOutline
        : c.addUnderline;
  const label = (
    <>
      <CalendarPlus
        aria-hidden="true"
        className={c.addIcon}
        strokeWidth={1.35}
      />
      {feed ? "Subscribe to calendar" : "Add to Calendar"}
      {feed ? null : <span className="sr-only">{` — ${title}`}</span>}
    </>
  );

  if (target === "menu")
    return (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger className={className}>
          {label}
        </DropdownMenu.Trigger>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Link copied" : ""}
        </span>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={c.addMenu}
            align="start"
            sideOffset={6}
          >
            {(feed ? feedChoices : calendarChoices).map(([key, name]) => (
              <DropdownMenu.Item key={key} asChild className={c.addMenuItem}>
                <a
                  href={links[key]}
                  {...(key === "file"
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                >
                  {name}
                </a>
              </DropdownMenu.Item>
            ))}
            {feed ? (
              <DropdownMenu.Item
                className={c.addMenuItem}
                onSelect={(event) => {
                  event.preventDefault();
                  const address = links.file.replace(/^webcal:/, "https:");
                  void navigator.clipboard
                    ?.writeText(address)
                    .then(() => setCopied(true))
                    .catch(() => {});
                }}
              >
                Copy link
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );

  return target === "google" ? (
    <a
      href={links.google}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {label}
    </a>
  ) : (
    <a href={links.file} className={className}>
      {label}
    </a>
  );
}
