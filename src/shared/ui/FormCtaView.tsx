import { ArrowUpRight } from "lucide-react";

import type { LinkDestination } from "@/lib/integrations/types";
import { externalLinkProps } from "@/lib/url";

export type FormCtaViewProps = {
  destination: LinkDestination;
  label?: string;
  variant?: "gold" | "outline";
  className?: string;
};

const variants = {
  gold: "form-cta-primary",
  outline: "form-cta-outline",
};

const base =
  "form-cta group inline-flex min-h-11 items-center justify-center gap-3 border px-5 py-3 font-semibold transition-colors";

/**
 * How a contribution CTA looks for a resolved destination. Pages use
 * `FormCta` (which resolves the form key); the Pages preview and Storybook
 * render this directly. A closed form, or one without a safe link, shows
 * nothing: never a dead link or a "coming soon" line (review fixes P3).
 */
export function FormCtaView({
  destination,
  label,
  variant = "gold",
  className = "",
}: FormCtaViewProps) {
  if (destination.state === "unconfigured") return null;

  return (
    <a
      href={destination.href}
      className={`${base} ${variants[variant]} ${className}`}
      {...externalLinkProps(destination.href)}
    >
      <span>{label ?? destination.label}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
      />
      {destination.external ? (
        <span className="sr-only">(opens in a new tab)</span>
      ) : null}
    </a>
  );
}
