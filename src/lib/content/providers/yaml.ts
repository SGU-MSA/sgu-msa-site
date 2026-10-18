import fs from "node:fs";
import path from "node:path";

import { load } from "js-yaml";

import {
  parseEditorialDocument,
  unreadableEditorialDocument,
  type EditorialKey,
  type EditorialRead,
} from "../documents";
import type { EditorialSource } from "./contract";

/** The repository's `content/` folder, where the developer-edited YAML lives. */
export const contentDirectory = path.join(process.cwd(), "content");

/** Parsed documents are stable for the life of the process (build or server). */
const cache = new Map<string, EditorialRead<EditorialKey>>();

/**
 * Reads and validates `<directory>/<key>.yaml` synchronously, once per
 * process. Used by the adapter below and by `npm run validate:content`.
 */
export function readYamlDocument<K extends EditorialKey>(
  key: K,
  directory: string,
): EditorialRead<K> {
  const file = path.join(directory, `${key}.yaml`);
  const cached = cache.get(file);
  if (cached) return cached as EditorialRead<K>;

  const source = `${key}.yaml`;
  let read: EditorialRead<K>;
  try {
    const raw = fs.readFileSync(file, "utf8");
    read = parseEditorialDocument(key, load(raw), source);
  } catch (error) {
    read = unreadableEditorialDocument(key, source, error);
  }
  cache.set(file, read);
  return read;
}

/** The YAML adapter: real editorial copy, so its provenance is always "live". */
export function createYamlEditorialSource(directory: string): EditorialSource {
  return {
    async get(key) {
      return { ...readYamlDocument(key, directory), provenance: "live" };
    },
  };
}

export const yamlEditorialSource = createYamlEditorialSource(contentDirectory);
