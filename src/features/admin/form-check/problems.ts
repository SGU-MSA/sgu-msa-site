import type { z } from "zod";

/**
 * The problems of a board form, by box (review 2, 2026-10-05): the key of the
 * box (a field name such as `title`, or a dotted path such as
 * `exception_2_date` or `sections.0.heading`) and its first problem. The
 * server actions and the browser build it from the same pure rules, so a box
 * turns red as you type for the same reason a save is refused.
 */
export type FieldProblems = Record<string, string>;

/** No problems. */
export const noProblems: FieldProblems = {};

/** Whether there is anything to fix. */
export const hasProblems = (problems: FieldProblems | undefined) =>
  Boolean(problems && Object.keys(problems).length);

/**
 * A zod refusal as problems by box: the issue's path joined with "." is the
 * key (`rename` maps a field to the box that edits it), and each box keeps
 * its first problem.
 */
export function problemsOf(
  error: z.ZodError,
  rename: Readonly<Record<string, string>> = {},
): FieldProblems {
  const problems: FieldProblems = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String);
    const key = rename[path[0] ?? ""] ?? path.join(".");
    problems[key] ??= issue.message;
  }
  return problems;
}

/** Adds `more` without replacing a box's first problem. */
export function withProblems(
  problems: FieldProblems,
  more: FieldProblems,
): FieldProblems {
  return { ...more, ...problems };
}

/**
 * The line under a box: a refusal names its box ("Event name: fill in this
 * box."), which the box already shows above it, so the name is dropped
 * ("Fill in this box."). A message without a name stays as it is.
 */
export function boxReason(message: string): string {
  const named = /^[^:.!\n]{1,80}: (\S)/.exec(message);
  if (!named) return message;
  const rest = message.slice(named[0].length - 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
