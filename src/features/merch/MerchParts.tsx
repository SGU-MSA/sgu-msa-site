import { TICKET_BUTTON } from "@/lib/community/payment-policy";
import type { MerchSize } from "@/lib/community/merch";
import type { ListedPhoto } from "@/lib/media/photo-list";
import { ArabicLine } from "@/shared/ui/ArabicLine";
import { ImageViewerGallery } from "@/shared/ui/ImageViewerGallery";
import { SafeImage } from "@/shared/ui/SafeImage";

import { GiveButton } from "../donate/GiveButton";
import s from "./merch.module.css";

/** One photo frame (its description is the image's alt text). */
export function Photo({
  photo,
  className = "",
  sizes,
  priority = false,
}: {
  photo: ListedPhoto;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <figure className={`${s.frame} ${className}`}>
      <SafeImage
        image={photo}
        fill
        priority={priority}
        sizes={sizes}
        fit="cover"
      />
    </figure>
  );
}

/** Uploads and approved images open in the photo viewer; others are placeholders (SafeImage's rule). */
const viewable = (photo: ListedPhoto) =>
  photo.src.startsWith("/media/") || photo.src.startsWith("/images/approved/");

/**
 * An item's photos as small squares that open the shared photo viewer
 * (D-21: merch only). Photos the viewer may not show (starter images that
 * are not approved) stay as placeholders, without the viewer.
 */
export function Thumbs({
  photos,
  label,
  className = "",
}: {
  photos: readonly ListedPhoto[];
  /** The viewer's name: the item's name. */
  label: string;
  className?: string;
}) {
  if (!photos.length) return null;
  if (photos.every(viewable))
    return (
      <ImageViewerGallery
        images={photos.map((photo) => ({ src: photo.src, alt: photo.alt }))}
        label={label}
        className={`${s.thumbs} ${className}`}
      />
    );
  return (
    <div className={`${s.thumbs} ${className}`}>
      {photos.map((photo, index) => (
        <Photo
          key={`${index}-${photo.src}`}
          photo={photo}
          className={s.thumb}
          sizes="(min-width: 1024px) 14vw, 45vw"
        />
      ))}
    </div>
  );
}

/** The collection's Arabic name, set level and on one line when short. */
export function ArabicName({
  text,
  size,
}: {
  text?: string | null;
  size: "sm" | "lg";
}) {
  if (!text) return null;
  return (
    <ArabicLine
      as="p"
      text={text}
      className={`${s.arabic} ${size === "lg" ? s.arabicLg : s.arabicSm}`}
    />
  );
}

/** Garment, colourway and release as a dotted leader list. */
export function Details({
  garment,
  colorway,
  year,
}: {
  garment: string;
  colorway: string;
  year: string;
}) {
  const rows = [
    ["Garment", garment],
    ["Colourway", colorway],
    ["Released", year],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (!rows.length) return null;
  return (
    <dl className={s.details}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <span aria-hidden="true" className={s.leader} />
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * An item's sizes on sale now (D-27 a, P-72 B): "See price and buy ↗", then
 * one button per size, each opening that size's Give address (its own
 * Go2Pay page, with the price and Sold out) in a new tab. No price here.
 */
export function SizeButtons({
  sizes,
  itemName,
}: {
  sizes: readonly MerchSize[];
  itemName: string;
}) {
  if (!sizes.length) return null;
  return (
    <div
      className={s.sizes}
      role="group"
      aria-label={`${itemName}: ${TICKET_BUTTON}`}
    >
      <p className={s.sizesLabel}>{TICKET_BUTTON} ↗</p>
      <div className={s.sizeRow}>
        {sizes.map((size) => (
          <GiveButton
            key={size.giveHref}
            href={size.giveHref}
            label={size.label}
            className={s.size}
          />
        ))}
      </div>
    </div>
  );
}
