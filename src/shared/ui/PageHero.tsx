import type { ReactNode } from "react";
import type { ContentImage } from "@/lib/content/schemas";
import { Container } from "./Container";
import { SafeImage } from "./SafeImage";
type PageHeroProps = {
  title: string;
  eyebrow?: string | null;
  description?: string | null;
  image?: ContentImage | null;
  compact?: boolean;
  children?: ReactNode;
  badge?: ReactNode;
};
export function PageHero({
  title,
  eyebrow,
  description,
  image,
  compact = false,
  children,
  badge,
}: PageHeroProps) {
  return (
    <header className={`design-page-header ${compact ? "is-compact" : ""}`}>
      <Container
        className={
          image ? "page-header-layout with-image" : "page-header-layout"
        }
      >
        <div className="page-header-copy">
          {badge}
          {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? (
            <p className="page-description">{description}</p>
          ) : null}
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
        {image ? (
          <div className="page-header-image">
            <SafeImage
              image={image}
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 960px) 32vw, 100vw"
              fit="cover"
            />
          </div>
        ) : null}
      </Container>
    </header>
  );
}
