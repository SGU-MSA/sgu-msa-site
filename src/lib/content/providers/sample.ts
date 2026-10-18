import "server-only";
import { sandboxStore } from "../../demo/store";
import {
  isPageTextKey,
  parseEditorialDocument,
  withDeveloperParts,
  type EditorialKey,
} from "../documents";
import type { EditorialSource } from "./contract";

/**
 * The sandbox's page text (PR5b, D-6): the starter text from `content/*.yaml`
 * (the YAML adapter, `starter`) with the sandbox's own edits over it, kept
 * in the in-memory store until the server restarts; the developer-owned
 * parts (`developerOwnedPaths`) always come from the starter YAML. `seed` is
 * the sample clock, as for the other sample adapters.
 */
export function createSampleEditorialSource(
  seed: Date,
  starter: EditorialSource,
): EditorialSource {
  const instant = new Date(seed);
  return {
    async get<K extends EditorialKey>(key: K) {
      const edited = isPageTextKey(key)
        ? sandboxStore(instant).pageTexts.get(key)
        : undefined;
      const yaml = await starter.get(key);
      if (!edited) return yaml;
      const read = parseEditorialDocument(
        key,
        edited.document,
        `sandbox page text "${key}"`,
      );
      return {
        ...read,
        document: yaml.unavailable
          ? read.document
          : withDeveloperParts(key, read.document, yaml.document),
        provenance: "live" as const,
      };
    },
  };
}
