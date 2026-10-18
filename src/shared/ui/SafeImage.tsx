import { servedAsIs } from "./imageSource";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { photoBrief } from "@/lib/media/shot-list";
import Image, { type ImageProps } from "next/image";

import type { ContentImage } from "@/lib/content/schemas";

const FALLBACK = "/images/placeholder/editorial.svg";

/**
 * How a picture fills its frame (review fixes P3; the review's "images must
 * respect content type"):
 * - `contain`: flyers and logos, shown whole and never cropped (the frame's
 *   paper shows around them);
 * - `portrait`: people's photos, a fixed crop that keeps the face (upper middle);
 * - `cover`: banners and scenery, filling the frame (cropping is fine).
 */
export type ImageFit = "contain" | "portrait" | "cover";

const fitClass: Record<ImageFit, string> = {
  contain: "object-contain",
  portrait: "object-cover",
  cover: "object-cover",
};

type SafeImageProps = Omit<ImageProps, "src" | "alt"> & {
  image?: ContentImage | null;
  fallbackSrc?: string;
  /** How the picture fills its frame; banners and scenery (`cover`) when left out. */
  fit?: ImageFit;
};

/**
 * Renders content imagery with a branded fallback.
 *
 * A missing or empty `image` never produces a broken tag — the editorial
 * placeholder takes its place. Uploads and SVGs bypass the optimizer
 * (`servedAsIs`).
 */
export function SafeImage({
  image,
  fallbackSrc = FALLBACK,
  fit = "cover",
  style,
  className,
  ...props
}: SafeImageProps) {
  const classes = [fitClass[fit], className].filter(Boolean).join(" ");
  // A portrait keeps the face: the upper middle, unless the photo says where.
  const position =
    image?.focal_point ?? (fit === "portrait" ? "50% 25%" : undefined);
  const src = image?.src?.trim() || fallbackSrc;
  const alt = image?.alt?.trim() || "";

  if (!src.startsWith("/media/") && !src.startsWith("/images/approved/"))
    return (
      <PhotoPlaceholder
        brief={photoBrief(src)}
        fill={props.fill}
        className={classes}
        style={style}
      />
    );

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={servedAsIs(src)}
      className={classes}
      style={{ objectPosition: position, ...style }}
    />
  );
}
