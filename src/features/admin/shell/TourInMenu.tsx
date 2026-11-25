"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const none = () => () => {};

/**
 * Draws a page's "Show me how" button inside the account menu (the frame's
 * `#account-tour-slot`), while the button stays owned by the page that has
 * the tour. Without the slot (a sign-in page) the page keeps its own.
 */
export function TourInMenu({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(
    none,
    () => document.getElementById("account-tour-slot"),
    () => null,
  );
  return slot ? createPortal(children, slot) : null;
}
