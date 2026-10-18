import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { externalLinkProps, isExternalHref, safeHref } from "@/lib/url";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "gold" | "outline" | "light" | "text";
  className?: string;
  showArrow?: boolean;
  ariaLabel?: string;
};

const variants = {
  gold: "design-button-primary",
  outline: "design-button-outline",
  light: "design-button-outline",
  text: "design-button-text",
};

export function ButtonLink({
  href,
  children,
  variant = "gold",
  className = "",
  showArrow = true,
  ariaLabel,
}: ButtonLinkProps) {
  // A rejected href is a content bug, not a reason to render a dead control.
  const safe = safeHref(href);
  if (!safe) return null;

  const external = isExternalHref(safe);
  const classes = `design-button group inline-flex min-h-11 items-center justify-center gap-3 border font-semibold ${variants[variant]} ${className}`;
  const Arrow = external ? ArrowUpRight : ArrowRight;
  const content = (
    <>
      <span className="inline-flex items-center gap-2 text-center">
        {children}
      </span>
      {showArrow ? (
        <Arrow
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-300 motion-safe:group-hover:translate-x-1"
        />
      ) : null}
    </>
  );

  if (external) {
    return (
      <a
        className={classes}
        href={safe}
        aria-label={ariaLabel}
        {...externalLinkProps(safe)}
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={classes} href={safe} aria-label={ariaLabel}>
      {content}
    </Link>
  );
}
