import Link from "next/link";
import type { ReactNode } from "react";

import type { ContentImage } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { SafeImage } from "@/shared/ui/SafeImage";

import s from "@/shared/ui/page.module.css";
import p from "./prayer.module.css";

/**
 * Home: "Your first visit", a layered photo beside the way in and the Find-us
 * box. The photo is the board's (Pages → Home → Your first visit; photo
 * library, 2026-10-06); the words are fixed. `map` is the server-drawn
 * `LocationMap`.
 */
export function VisitSection({
  image,
  map,
}: {
  image: ContentImage;
  map?: ReactNode;
}) {
  return (
    <Container className={s.above}>
      <section
        className={`${s.split} ${s.rule} ${p.visit}`}
        aria-labelledby="first-visit"
      >
        <div className={s.photo}>
          <div className={s.photoFrame}>
            <SafeImage
              image={image}
              fill
              sizes="(max-width: 44rem) 100vw, 45vw"
              fit="cover"
            />
          </div>
        </div>
        <div className={p.visitCopy}>
          <p className={s.eyebrow}>Your first visit</p>
          <h2 id="first-visit" className={s.h2}>
            A familiar place,
            <br />
            <em>even on your first day.</em>
          </h2>
          <p className={p.visitText}>
            Find the Musallah with our location map and walking directions and
            step-by-step directions. Start at the bus stop by Charter Hall.
          </p>
          <p className={s.actions}>
            <Link href="/prayer#find-the-musallah" className={s.underline}>
              <span>Plan your visit</span>
            </Link>
          </p>
          {map}
        </div>
      </section>
    </Container>
  );
}
