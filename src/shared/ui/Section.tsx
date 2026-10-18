import type { ReactNode } from "react";

import { Container } from "./Container";

type SectionProps = {
  id?: string;
  kicker?: string | null;
  title?: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: "dark" | "elevated" | "light";
  tight?: boolean;
  bordered?: boolean;
  className?: string;
};

const tones = {
  dark: "section-default",
  elevated: "section-elevated",
  light: "section-soft",
};

/**
 * The single section primitive.
 *
 * Every route composes from this, so heading scale, kicker treatment, rules
 * and vertical rhythm cannot drift between pages. Tones are Quiet Paper
 * surfaces: `dark` = paper, `elevated` = lighter paper, `light` = deeper paper
 * (names kept from before; PR8 may rename them).
 */
export function Section({
  id,
  kicker,
  title,
  intro,
  action,
  children,
  tone = "dark",
  tight = false,
  bordered = false,
  className = "",
}: SectionProps) {
  return (
    <section
      id={id}
      className={`${tones[tone]} ${tight ? "section-y-tight" : "section-y"} ${
        bordered ? "border-t border-[var(--rule)]" : ""
      } ${className}`}
    >
      <Container>
        {kicker || title || intro || action ? (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mb-10">
            <div className="max-w-3xl">
              {kicker ? <p className="section-kicker">{kicker}</p> : null}
              {title ? <h2 className="section-title">{title}</h2> : null}
              {intro ? <div className="section-intro">{intro}</div> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
