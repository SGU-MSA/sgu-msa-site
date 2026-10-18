import { z } from "../validation/zod";

/**
 * The board password rule (PR3 contract D-16). Supabase Auth enforces the same
 * rule (minimum length 12; lower-case, upper-case, digit and symbol) and is the
 * authority; this mirror gives the set-password form an immediate answer. The
 * app passes a password only to Supabase Auth and never stores, logs or shows it.
 */
export const passwordHint =
  "At least 12 characters, including a lower-case letter, a capital letter, a number and a symbol.";

// The symbols Supabase Auth counts for "lower_upper_letters_digits_symbols".
const symbols = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const passwordSchema = z
  .string()
  .refine(
    (value) =>
      value.length >= 12 &&
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /[0-9]/.test(value) &&
      [...value].some((character) => symbols.includes(character)),
    passwordHint,
  );
