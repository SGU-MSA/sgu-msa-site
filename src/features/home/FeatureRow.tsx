import Link from "next/link";

import type { ContentImage } from "@/lib/content/schemas";
import { Container } from "@/shared/ui/Container";
import { SafeImage } from "@/shared/ui/SafeImage";

import h from "./home.module.css";
import s from "@/shared/ui/page.module.css";

export type FeatureItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  image: ContentImage;
};

/** "More than a place to pray": three stories, each a photo on a paper sheet. */
export function FeatureRow({ items }: { items: FeatureItem[] }) {
  if (!items.length) return null;
  return (
    <Container className={s.above}>
      <section
        className={`${s.rule} ${h.storiesSection}`}
        aria-labelledby="stories"
      >
        <p className={s.eyebrow}>Life in our community</p>
        <h2 id="stories" className={s.h2}>
          More than <em>a place to pray.</em>
        </h2>
        <div className={h.stories}>
          {items.slice(0, 3).map((item) => (
            <article className={h.story} key={item.id}>
              <Link
                href={item.href}
                className={h.storyPhoto}
                aria-label={item.title}
              >
                <span className={h.storyFrame}>
                  <SafeImage
                    image={item.image}
                    fill
                    sizes="(min-width: 960px) 30vw, 100vw"
                    fit="cover"
                  />
                </span>
              </Link>
              <p className={h.storyKicker}>
                {item.eyebrow}
                {item.image.historical ? " · Archive" : ""}
              </p>
              <h3 className={h.storyTitle}>
                <Link href={item.href}>{item.title}</Link>
              </h3>
              <p className={h.storyText}>{item.description}</p>
              <p className={h.storyCta}>
                <Link href={item.href} className={s.underlineSoft}>
                  <span>{item.cta}</span>
                </Link>
              </p>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
}
