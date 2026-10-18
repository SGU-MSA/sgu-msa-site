/**
 * Whether next/image should serve `src` as it is, skipping the optimizer:
 * board uploads (`/media/…`, already checked and normalized to WebP when they
 * were uploaded) and vectors (the optimizer does not handle SVG). Shared by
 * SafeImage and the photo viewer so the rule lives in one place.
 */
export function servedAsIs(src: string): boolean {
  return src.startsWith("/media/") || src.endsWith(".svg");
}
