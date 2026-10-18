/**
 * The first element matching `selector` that is drawn on the screen. Pages
 * visited just before stay in the document, hidden (Cache Components keep
 * them for going back), so a tour must never count or point at their copies.
 */
export function shownElement(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) => element.getClientRects().length > 0,
  );
}
