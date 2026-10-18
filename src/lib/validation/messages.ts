import type { z } from "zod";
import { outOfDate } from "../system-text";

/**
 * The one wording of a rule that a schema did not word itself (review fixes
 * P1, item 3): the board never reads a validation library's own text, a
 * pattern, a field's key or a format name. A box shows these under itself
 * (`FieldError`), so they do not name it; schemas that know the box's name
 * word their own refusals ("Date: choose a valid date."). Installed for
 * every schema by `./zod` (`z.config`). Words not used elsewhere yet are
 * listed in the release checklist ("You or the founder must decide").
 */
export const ruleWords = {
  fillIn: "Fill in this box.",
  check: "Check this box.",
  chooseFromList: "Choose one from the list.",
  number: "Enter a number.",
  wholeNumber: "Use a whole number.",
  date: "Choose a valid date.",
  time: "Choose a valid time.",
  dateTime: "Choose a valid date and time.",
  email: "Enter a valid email address.",
  link: "Use a secure web address (starting with https://).",
  atMost: (count: number) =>
    `Use ${count.toLocaleString("en-US")} characters or fewer.`,
  atLeast: (count: number) =>
    `Use at least ${count.toLocaleString("en-US")} characters.`,
  numberAtMost: (count: number) => `Use ${count} or less.`,
  numberAtLeast: (count: number) => `Use ${count} or more.`,
  itemsAtMost: (count: number) => `Use ${count} or fewer.`,
  itemsAtLeast: (count: number) => `Add at least ${count}.`,
  outOfDate,
} as const;

type Issue = Parameters<z.core.$ZodErrorMap>[0];

const isEmpty = (input: unknown) =>
  input === undefined || input === null || input === "";

const formatWords: Readonly<Record<string, string>> = {
  email: ruleWords.email,
  url: ruleWords.link,
  date: ruleWords.date,
  time: ruleWords.time,
  datetime: ruleWords.dateTime,
  // Ids are chosen from lists, never typed.
  uuid: ruleWords.chooseFromList,
  guid: ruleWords.chooseFromList,
};

/** The board's words for a refusal that a schema did not word itself. */
export function ruleMessage(issue: Issue): string {
  switch (issue.code) {
    case "invalid_type":
      if (isEmpty(issue.input)) return ruleWords.fillIn;
      if (issue.expected === "number" || issue.expected === "int")
        return ruleWords.number;
      if (issue.expected === "date") return ruleWords.date;
      return ruleWords.check;
    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "string")
        return minimum <= 1 ? ruleWords.fillIn : ruleWords.atLeast(minimum);
      if (issue.origin === "array" || issue.origin === "set")
        return ruleWords.itemsAtLeast(minimum);
      if (issue.origin === "number" || issue.origin === "int")
        return ruleWords.numberAtLeast(minimum);
      return ruleWords.check;
    }
    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "string") return ruleWords.atMost(maximum);
      if (issue.origin === "array" || issue.origin === "set")
        return ruleWords.itemsAtMost(maximum);
      if (issue.origin === "number" || issue.origin === "int")
        return ruleWords.numberAtMost(maximum);
      return ruleWords.check;
    }
    case "invalid_format":
      if (isEmpty(issue.input)) return ruleWords.fillIn;
      return formatWords[String(issue.format)] ?? ruleWords.check;
    case "not_multiple_of":
      return ruleWords.wholeNumber;
    case "invalid_value":
      return ruleWords.chooseFromList;
    // A form posting boxes this screen does not have: loaded before an update.
    case "unrecognized_keys":
      return ruleWords.outOfDate;
    default:
      return ruleWords.check;
  }
}
