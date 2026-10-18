"use client";

import { useEffect, useSyncExternalStore } from "react";

import { AnimatedThemeToggler } from "./animated-theme-toggler";

/**
 * The header theme switch (ADR 0018, Magic UI round button). One tap flips
 * light and dark and remembers the choice on this device; until then the site
 * follows the device setting. The root layout's pre-paint script applies the
 * same attributes before first paint, so there is no flash.
 *
 * The single mechanism is the `data-theme` / `data-theme-choice` attributes
 * on <html> plus CSS variables: no context, provider or client store.
 */
type Choice = "light" | "dark" | "system";

/** Private: the device key the pre-paint script in src/app/layout.tsx also reads. */
const STORAGE_KEY = "msa-theme";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function apply(choice: Choice) {
  const root = document.documentElement;
  const resolved =
    choice === "system" ? (darkQuery().matches ? "dark" : "light") : choice;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-choice", choice);
  if (choice === "system") return;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit.
  }
}

/** Every toggle on the page follows the <html> attributes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-choice"],
  });
  return () => observer.disconnect();
}
type Theme = "light" | "dark";
const readTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
const readChoice = (): Choice => {
  const value = document.documentElement.getAttribute("data-theme-choice");
  return value === "light" || value === "dark" ? value : "system";
};

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    (): Theme => "light",
  );
  const choice = useSyncExternalStore(
    subscribe,
    readChoice,
    (): Choice => "system",
  );

  // Following the device: re-resolve when its setting changes.
  useEffect(() => {
    if (choice !== "system") return;
    const query = darkQuery();
    const follow = () => apply("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={apply}
      variant="circle"
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={`theme-toggle ${className ?? "nav-icon-button inline-grid"}`}
    />
  );
}
