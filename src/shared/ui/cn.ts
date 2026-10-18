/** Joins class names, skipping empty ones. The registry `cn()` without clsx or tailwind-merge. */
export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
