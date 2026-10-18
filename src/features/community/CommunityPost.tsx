import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { CommunityRecord } from "@/lib/community/schema";
import type { Reminder } from "@/lib/content/schemas";
import { ButtonLink } from "@/shared/ui/ButtonLink";
import { Container } from "@/shared/ui/Container";
import { MarginNote } from "@/shared/ui/MarginNote";

import { Cover } from "./CommunityParts";
import { longDate, paragraphs } from "./feed";
import c from "./community.module.css";

/**
 * One community update as an article (PR8 D-4): kind and date, headline, the
 * summary as a standfirst, the photo on a lifted sheet, then the body in a
 * reading column with the page's verse in the margin.
 */
export function CommunityPost({
  row,
  kind,
  verse,
}: {
  row: CommunityRecord;
  kind: string;
  verse?: Reminder | null;
}) {
  return (
    <div className={c.page}>
      <Container>
        <article>
          {/* Wording reused from the Home feed's "All community updates →". */}
          <Link href="/community" className={c.back}>
            <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.5} />
            All community updates
          </Link>
          <header className={c.postHead}>
            <p className={c.label}>
              {kind} <span aria-hidden="true">·</span>{" "}
              <time dateTime={row.date}>{longDate(row.date)}</time>
            </p>
            <h1 className={c.postTitle}>{row.title}</h1>
            {row.summary ? <p className={c.standfirst}>{row.summary}</p> : null}
          </header>

          {row.image_path ? (
            <div className={`${c.lead} ${c.postPhoto}`}>
              <div className={c.sheet} aria-hidden="true" />
              <Cover
                image={{
                  src: `/media/${row.image_path}`,
                  alt: row.image_alt,
                }}
                sizes="(min-width: 1440px) 1340px, 100vw"
                className={c.postPhotoFrame}
                fit="contain"
                eager
              />
            </div>
          ) : null}

          <div className={c.columns}>
            <div className={c.body}>
              {paragraphs(row.body).map((text, i) => (
                <p key={i} className="whitespace-pre-line">
                  {text}
                </p>
              ))}
              {row.url ? (
                <ButtonLink href={row.url} className={c.more}>
                  Learn more
                </ButtonLink>
              ) : null}
            </div>
            {verse ? (
              <MarginNote reminder={verse} className={c.postNote} />
            ) : null}
          </div>
        </article>
      </Container>
    </div>
  );
}
