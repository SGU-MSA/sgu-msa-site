import Link from "next/link";

import type { ContentImage, Reminder } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";
import { SafeImage } from "@/shared/ui/SafeImage";

import { InkHeading } from "@/shared/ui/InkHeading";
import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

export type ContributionItem = {
  id: string;
  title: string;
  short_description: string;
  icon?: string | null;
  href: string;
};

/** "Our community, built by students": a layered photo beside the ways to help, with its verse. */
export function ContributionStrip({
  heading,
  items,
  image,
  verse,
}: {
  heading: string;
  items: ContributionItem[];
  image: ContentImage;
  verse?: Reminder | null;
}) {
  if (!items.length) return null;

  return (
    <Container className={s.above}>
      <section className={`${s.split} ${h.involve}`} aria-labelledby="involve">
        <div className={s.photo}>
          <div className={s.photoFrame}>
            <SafeImage
              image={image}
              fill
              sizes="(max-width: 44rem) 100vw, 40vw"
              fit="cover"
            />
          </div>
        </div>
        <div className={h.involveSide}>
          <InkHeading id="involve" text={heading} />
          <ul className={`${s.list} ${h.involveList}`}>
            {items.slice(0, 6).map((item) => (
              <li key={item.id} className={h.involveItem}>
                <Link href={item.href}>
                  <strong>{item.title}</strong>
                  <span>{item.short_description}</span>
                </Link>
              </li>
            ))}
          </ul>
          {verse ? <MarginNote reminder={verse} /> : null}
        </div>
      </section>
    </Container>
  );
}
