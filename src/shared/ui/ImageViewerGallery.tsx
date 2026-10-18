"use client";

import Image from "next/image";
import { useState } from "react";

import { ImageViewer, type ViewerImage } from "./ImageViewer";
import styles from "./ImageViewer.module.css";
import { servedAsIs } from "./imageSource";
import { openLabel } from "./imageViewerModel";

type ImageViewerGalleryProps = {
  images: ViewerImage[];
  /** The viewer's accessible name (and its visible title with several photos). */
  label?: string;
  /**
   * Added to the list; its rules beat the default grid of square thumbnails
   * (shared rules sit in `:where()`), so a page can lay the thumbnails out.
   */
  className?: string;
};

/**
 * Thumbnails that each open the shared photo viewer on their photo. Each one
 * is a button named "Open photo 2 of 5: <alt>". Only for photos a visitor may
 * want to look at closely (merch, an event's photos); never for decoration.
 */
export function ImageViewerGallery({
  images,
  label,
  className,
}: ImageViewerGalleryProps) {
  const [index, setIndex] = useState<number | null>(null);
  if (!images.length) return null;

  return (
    <>
      <ul
        className={
          className ? `${styles.gallery} ${className}` : styles.gallery
        }
      >
        {images.map((image, i) => {
          const src = image.thumbSrc ?? image.src;
          return (
            <li key={`${image.src}-${i}`}>
              <button
                type="button"
                className={styles.thumb}
                aria-label={openLabel(image, i, images.length)}
                onClick={(event) => {
                  // Safari does not focus a clicked button; focus returns here on close.
                  event.currentTarget.focus();
                  setIndex(i);
                }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(min-width: 44rem) 14rem, 45vw"
                  unoptimized={servedAsIs(src)}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <ImageViewer
        images={images}
        index={index}
        onIndexChange={setIndex}
        label={label}
      />
    </>
  );
}
