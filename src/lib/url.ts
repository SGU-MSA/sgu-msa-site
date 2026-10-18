/**
 * Central guard for every URL that reaches the DOM.
 *
 * Content is editable by non-developers, so a typo or a pasted `javascript:`
 * link must never become a live href. Anything this module rejects is treated
 * by the UI as "not configured yet" — the CTA degrades to a placeholder state
 * instead of rendering a dead or dangerous link.
 */

/** Internal app routes and in-page anchors. */
export function isInternalHref(value: string): boolean {
  return value.startsWith("/") || value.startsWith("#");
}

/**
 * External destinations are https-only. Plain http is rejected so a
 * configuration mistake cannot downgrade a student to an insecure page.
 */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeMailto(value: string): boolean {
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Returns the href only when it is safe to render; otherwise null. */
export function safeHref(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isInternalHref(trimmed)) return trimmed;
  if (isSafeMailto(trimmed)) return trimmed;
  if (isSafeExternalUrl(trimmed)) return trimmed;
  return null;
}

export function isExternalHref(value: string): boolean {
  return !isInternalHref(value);
}

/** Standard, non-coercive external link behaviour. */
export function externalLinkProps(href: string) {
  return isSafeExternalUrl(href)
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
}
