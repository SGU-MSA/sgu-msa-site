/**
 * Content validation.
 *
 * Reads every editorial document through the YAML adapter and reports what
 * the site would silently fall back on. Exits non-zero if anything failed to
 * parse, so a bad edit is caught in CI rather than discovered as an empty
 * section in a meeting.
 *
 * Run: npm run validate:content
 */
import { editorialKeys } from "../src/lib/content/documents";
import { contentDirectory, readYamlDocument } from "../src/lib/content/providers/yaml";

const warnings: string[] = [];
const original = console.warn;
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};

for (const key of editorialKeys) readYamlDocument(key, contentDirectory);

/* Sanity checks that no schema can express. */
const formKeys = Object.keys(readYamlDocument("forms", contentDirectory).document.forms);
if (formKeys.length === 0) warnings.push("forms.yaml → no forms defined; every contribution CTA will show a placeholder");

console.warn = original;

if (warnings.length) {
  console.error(`\n✗ Content validation found ${warnings.length} problem(s):\n`);
  for (const warning of warnings) console.error(`  ${warning}`);
  console.error(
    "\nThe site will still build — each affected item falls back safely — but the content above is not being used.\n",
  );
  process.exit(1);
}

console.log(`✓ Content validation passed — ${editorialKeys.length} files, ${formKeys.length} forms.`);
