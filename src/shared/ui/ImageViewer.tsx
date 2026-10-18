"use client";

import Image from "next/image";
import { Dialog } from "radix-ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { InkRing } from "./InkRing";
import styles from "./ImageViewer.module.css";
import { servedAsIs } from "./imageSource";
import {
  keyTarget,
  loadsFullImage,
  openIndex,
  photoAnnouncement,
  photoLabel,
  type ViewerImage,
} from "./imageViewerModel";

export type { ViewerImage } from "./imageViewerModel";

type ImageViewerProps = {
  images: ViewerImage[];
  /** The open photo; `null` keeps the viewer closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** The dialog's accessible name (and its visible title with several photos). */
  label?: string;
};

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The shared photo viewer (the Filmstrip look): a modal Radix dialog on the
 * page's paper, opt-in per use. Nothing gets it by default; decorative and
 * hero images never do.
 *
 * - Several photos: the photo large, a thumbnail strip with the ink ring
 *   around the current one, Previous/Next and "2 of 5". Swipe, the buttons,
 *   ←/→ or Home/End move; only the open photo and its neighbours load.
 * - One photo: just the photo and Close.
 * - A visible caption only when the photo has a `caption`; `alt` is for
 *   screen readers and is never shown.
 *
 * Esc, Close or a tap beside the photo close it, and focus goes back to
 * whatever opened it. Pass only approved sources (`/media/…` uploads or
 * `/images/approved/…`), the same rule as SafeImage.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
  label = "Photos",
}: ImageViewerProps) {
  const count = images.length;
  const opened = openIndex(index, count);
  const open = opened !== null;
  // While the closing fade plays, keep showing the photo that was open.
  const [shown, setShown] = useState(0);
  const current = opened ?? shown;
  if (current !== shown) setShown(current);
  const several = count > 1;
  const image = images[current] as ViewerImage | undefined;
  const caption = image?.caption?.trim();

  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);
  const placedAt = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const focusThumb = useRef(false);
  const stripPlaced = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => onIndexChange(null), [onIndexChange]);
  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= count || next === current) return;
      onIndexChange(next);
    },
    [count, current, onIndexChange],
  );

  // Scroll the track to the open photo: smoothly to a neighbour, instantly on
  // open, for a longer jump or with reduced motion.
  useEffect(() => {
    if (!track || !open) {
      placedAt.current = null;
      return;
    }
    const from = placedAt.current;
    placedAt.current = current;
    const width = track.clientWidth || 1;
    if (Math.round(track.scrollLeft / width) === current) return;
    const smooth =
      from !== null && Math.abs(from - current) === 1 && !reducedMotion();
    track.scrollTo({
      left: current * width,
      behavior: smooth ? "smooth" : "instant",
    });
  }, [track, open, current]);

  // A swipe settles on a slide: report its index once scrolling ends.
  useEffect(() => {
    if (!track) return;
    let timer: number | undefined;
    const settle = () => {
      window.clearTimeout(timer);
      const width = track.clientWidth || 1;
      const settled = Math.round(track.scrollLeft / width);
      if (settled !== current && settled >= 0 && settled < count)
        onIndexChange(settled);
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 150);
    };
    const hasScrollEnd = "onscrollend" in window;
    track.addEventListener("scroll", onScroll, { passive: true });
    if (hasScrollEnd) track.addEventListener("scrollend", settle);
    return () => {
      window.clearTimeout(timer);
      track.removeEventListener("scroll", onScroll);
      if (hasScrollEnd) track.removeEventListener("scrollend", settle);
    };
  }, [track, current, count, onIndexChange]);

  // Keep the ringed thumbnail in view; when the arrow keys moved from inside
  // the strip, focus follows it (one Tab stop for the whole strip).
  useEffect(() => {
    if (!open || !strip) return;
    const thumb = strip.querySelector<HTMLElement>('[aria-current="true"]');
    if (!thumb) return;
    // Instantly on open (a new strip), smoothly afterwards.
    const smooth = stripPlaced.current === strip && !reducedMotion();
    stripPlaced.current = strip;
    thumb.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: smooth ? "smooth" : "instant",
    });
    if (focusThumb.current) {
      focusThumb.current = false;
      thumb.focus({ preventScroll: true });
    }
  }, [open, strip, current]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const target = keyTarget(event.key, current, count);
    if (target === null) return;
    event.preventDefault();
    if (target === current) return;
    focusThumb.current = Boolean(strip?.contains(event.target as Node));
    onIndexChange(target);
  }

  // Taps on the empty space around the photo close the viewer.
  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).hasAttribute("data-backdrop")) close();
  }

  // The track scrolls sideways (swipe), so with several photos it is a Tab
  // stop of its own: axe's scrollable-region-focusable rule, WCAG 2.1.1.
  const trackFocus = several
    ? {
        tabIndex: 0,
        role: "group",
        "aria-label": "Current photo. The left and right arrow keys change it.",
      }
    : {};

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={
            several ? styles.content : `${styles.content} ${styles.single}`
          }
          // The caption, when there is one, describes the dialog.
          {...(caption ? {} : { "aria-describedby": undefined })}
          data-backdrop=""
          onKeyDown={onKeyDown}
          onClick={onBackdropClick}
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            opener.current =
              active instanceof HTMLElement && active !== document.body
                ? active
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (!opener.current?.isConnected) return;
            event.preventDefault();
            opener.current.focus();
          }}
        >
          <div className={styles.bar}>
            <Dialog.Title className={several ? styles.title : "sr-only"}>
              {label}
            </Dialog.Title>
            <Dialog.Close className={`${styles.textButton} ${styles.close}`}>
              Close <span aria-hidden="true">×</span>
            </Dialog.Close>
          </div>

          <div
            ref={setTrack}
            className={styles.track}
            data-backdrop=""
            {...trackFocus}
          >
            {images.map((photo, i) => (
              <Slide
                key={`${photo.src}-${i}`}
                image={photo}
                position={i}
                count={count}
                current={i === current}
                near={loadsFullImage(i, current)}
              />
            ))}
          </div>

          {caption || several ? (
            <div className={styles.meta}>
              {caption ? (
                <Dialog.Description className={styles.caption}>
                  {caption}
                </Dialog.Description>
              ) : null}
              {several ? (
                <>
                  <p className={styles.counter} aria-hidden="true">
                    {current + 1} of {count}
                  </p>
                  <div className={styles.controls}>
                    <button
                      type="button"
                      className={styles.textButton}
                      aria-disabled={current === 0}
                      onClick={() => go(current - 1)}
                    >
                      <span aria-hidden="true">←</span> Previous
                      <span className="sr-only"> photo</span>
                    </button>
                    <button
                      type="button"
                      className={styles.textButton}
                      aria-disabled={current === count - 1}
                      onClick={() => go(current + 1)}
                    >
                      Next<span className="sr-only"> photo</span>{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {several && image ? (
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {photoAnnouncement(image, current, count)}
            </p>
          ) : null}

          {several ? (
            <div
              ref={setStrip}
              className={styles.strip}
              role="group"
              aria-label="All photos"
            >
              {images.map((photo, i) => {
                const src = photo.thumbSrc ?? photo.src;
                const isCurrent = i === current;
                return (
                  <button
                    key={`${photo.src}-${i}`}
                    type="button"
                    className={styles.stripThumb}
                    aria-label={photoLabel(photo, i, count)}
                    aria-current={isCurrent ? "true" : undefined}
                    tabIndex={isCurrent ? 0 : -1}
                    onClick={() => go(i)}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="4.5rem"
                      unoptimized={servedAsIs(src)}
                      draggable={false}
                    />
                    {isCurrent ? (
                      <span className={styles.stripRing}>
                        <InkRing />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * One slide. Away from the open photo it is an empty box (with the photo's
 * shape when known), so its full-size image only loads when it comes near.
 */
function Slide({
  image,
  position,
  count,
  current,
  near,
}: {
  image: ViewerImage;
  position: number;
  count: number;
  current: boolean;
  near: boolean;
}) {
  const sized = Boolean(image.width && image.height);
  const slide =
    count > 1
      ? {
          role: "group",
          "aria-roledescription": "slide",
          "aria-label": `${position + 1} of ${count}`,
        }
      : {};

  return (
    <div
      className={styles.slide}
      data-backdrop=""
      {...slide}
      aria-hidden={current ? undefined : true}
      inert={!current}
    >
      {!near ? (
        <span
          className={styles.placeholder}
          style={
            sized
              ? ({
                  "--ratio": `${image.width} / ${image.height}`,
                } as CSSProperties)
              : undefined
          }
        />
      ) : sized ? (
        <Image
          className={styles.photo}
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="100vw"
          loading="eager"
          unoptimized={servedAsIs(image.src)}
          draggable={false}
        />
      ) : (
        // Size unknown: the browser's own image keeps its natural shape.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.photo}
          src={image.src}
          alt={image.alt}
          decoding="async"
          draggable={false}
        />
      )}
    </div>
  );
}
