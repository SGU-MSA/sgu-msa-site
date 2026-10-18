/**
 * The small three-dot ink rubric (ADR 0018): beside a margin note's verse and
 * in the middle of Donate's rule. Decoration only; the caller sizes it and
 * fills it, usually with `--ring`.
 */
export function Rubric({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
    >
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="6" cy="16" r="2.4" />
      <circle cx="18" cy="16" r="2.4" />
    </svg>
  );
}
