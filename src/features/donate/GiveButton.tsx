import { ArrowUpRight } from "lucide-react";

const base =
  "form-cta group inline-flex min-h-11 items-center justify-center gap-3 border px-5 py-3 font-semibold transition-colors";

/**
 * A Give or Buy button (PR6 D-49, D-53): a plain link to our own Give
 * address, opened in a new tab and never prefetched, so no Go2Pay address is
 * in the page. The arrow is the "↗" of "Give on Go2Pay ↗" and "See price and buy ↗".
 */
export function GiveButton({
  href,
  label,
  className = "",
}: {
  href: `/donate/${string}/give`;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={`${base} form-cta-primary ${className}`}
    >
      <span>{label}</span>
      <ArrowUpRight
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform duration-300 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
