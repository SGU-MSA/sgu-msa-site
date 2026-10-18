import type { ListedPhoto } from "@/lib/media/photo-list";
import { SafeImage } from "@/shared/ui/SafeImage";

import s from "./season.module.css";

/**
 * A season page's photos, staggered like prints on wide screens; every one
 * stays level. Each photo's description is its caption. No full-size viewer
 * (D-21: merch only).
 */
export function SeasonGallery({ photos }: { photos: readonly ListedPhoto[] }) {
  if (!photos.length) return null;
  return (
    <ul className={s.strip}>
      {photos.map((photo, index) => (
        <li key={`${index}-${photo.src}`}>
          <figure className={s.figure}>
            <div className={s.frame}>
              <SafeImage
                image={{ ...photo, historical: false }}
                fill
                sizes="(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 100vw"
                className={s.cover}
              />
            </div>
            <figcaption className={s.caption}>{photo.alt}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
