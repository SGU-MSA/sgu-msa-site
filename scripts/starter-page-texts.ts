// The one owner of "starter page text from content/*.yaml": every page-text key, merged with its
// full field list and checked by the board's own save rules. Used by scripts/page-text-seed.mjs
// (the starter migration) and scripts/staging-review (the review-site reset).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { pageTextKeys, type PageTextKey } from "../src/lib/content/documents";
import {
  mergePageText,
  pageTextSaveSchema,
  withEveryField,
} from "../src/lib/content/page-fields";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (key: PageTextKey) =>
  load(fs.readFileSync(path.join(root, "content", `${key}.yaml`), "utf8"));

export function starterPageTexts(): {
  key: PageTextKey;
  document: Record<string, unknown>;
}[] {
  const texts: { key: PageTextKey; document: Record<string, unknown> }[] = [];
  for (const key of pageTextKeys) {
    const raw = read(key);
    const merged = mergePageText(key, raw, withEveryField(key, raw));
    if (!merged.ok)
      throw new Error(`${key}: the field list does not fit the starter text.`);
    const parsed = pageTextSaveSchema(key).safeParse(merged.document);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `  · ${issue.message}`)
        .join("\n");
      throw new Error(
        `${key}.yaml does not pass the board's save rules:\n${problems}`,
      );
    }
    texts.push({ key, document: parsed.data as Record<string, unknown> });
  }
  return texts;
}
