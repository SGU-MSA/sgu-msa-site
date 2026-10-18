/*
 * The pure rules behind the shared photo viewer (ImageViewer and
 * ImageViewerGallery): which photo is open, which keys move, which slides
 * load a full-size image and what each control is called. No React here, so
 * the rules are unit-tested on their own (tests/image-viewer.test.ts).
 */

/** One photo the viewer can show. */
export type ViewerImage = {
  src: string;
  /** Always required: what a screen reader says. Never shown as visible text. */
  alt: string;
  /** Optional visible line under the photo. Only shown when given. */
  caption?: string;
  /** The photo's pixel size, when known: the browser keeps its shape while loading. */
  width?: number;
  height?: number;
  /** A smaller copy for the thumbnails; the full photo is used otherwise. */
  thumbSrc?: string;
};

/** The open photo, kept inside the list; `null` when closed or empty. */
export function openIndex(index: number | null, count: number): number | null {
  if (index === null || count < 1 || !Number.isFinite(index)) return null;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

/**
 * Where a key press moves to: ←/→ one photo (stopping at the ends), Home the
 * first, End the last. `null` when the key is not one of these or there is
 * nothing to move between.
 */
export function keyTarget(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count < 2) return null;
  switch (key) {
    case "ArrowLeft":
      return Math.max(current - 1, 0);
    case "ArrowRight":
      return Math.min(current + 1, count - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Only the open photo and its two neighbours load a full-size image. */
export function loadsFullImage(position: number, current: number): boolean {
  return Math.abs(position - current) <= 1;
}

function withAlt(prefix: string, image: ViewerImage) {
  const alt = image.alt.trim();
  return alt ? `${prefix}: ${alt}` : prefix;
}

/** "Photo 2 of 5: <alt>": a filmstrip thumbnail's name. */
export function photoLabel(
  image: ViewerImage,
  position: number,
  count: number,
) {
  return withAlt(`Photo ${position + 1} of ${count}`, image);
}

/**
 * What a screen reader hears after moving to a photo: its position, its
 * description and, when there is one, its caption.
 */
export function photoAnnouncement(
  image: ViewerImage,
  position: number,
  count: number,
) {
  const caption = image.caption?.trim();
  const label = photoLabel(image, position, count);
  return caption ? `${label}. ${caption}` : label;
}

/** "Open photo 2 of 5: <alt>" (or "Open photo: <alt>" for one): a gallery thumbnail's name. */
export function openLabel(image: ViewerImage, position: number, count: number) {
  return withAlt(
    count > 1 ? `Open photo ${position + 1} of ${count}` : "Open photo",
    image,
  );
}
