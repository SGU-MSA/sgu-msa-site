import type { ImageProps } from "next/image";

import type { ContentImage } from "@/lib/content/schemas";
import { SafeImage, type ImageFit } from "@/shared/ui/SafeImage";

import c from "./community.module.css";

/** A photo (or the demo's shot brief) in a plain paper frame. */
export function Cover({
  image,
  sizes,
  className = "",
  eager = false,
  fit = "cover",
}: {
  image: ContentImage;
  sizes: string;
  className?: string;
  /** A post's own page shows its picture whole (it may be a flyer); lists crop it. */
  fit?: ImageFit;
  /** The page's first picture: load it straight away. */
  eager?: boolean;
}) {
  const load: Partial<ImageProps> = eager
    ? { loading: "eager", fetchPriority: "high" }
    : {};
  return (
    <span className={`${c.cover} ${className}`}>
      <SafeImage image={image} fill sizes={sizes} fit={fit} {...load} />
    </span>
  );
}
