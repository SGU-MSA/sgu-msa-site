import "server-only";
import { contentEditor } from "@/lib/runtime/providers";

/**
 * Deletes stored files that no item or person names any more, after a
 * permanent delete or a photo removal (ADR 0013, ADR 0014). Any admin may
 * (D-23); storage keeps a file a row still names. Returns the names that
 * could not be removed, so the screen can offer "Try Remove again".
 */
export async function removeUnusedFiles(names: readonly string[]) {
  const left: string[] = [];
  for (const name of names.filter(Boolean))
    if (!(await contentEditor().removeFile(name)).ok) left.push(name);
  return left;
}

/** `path` (which already has a query) with one `file` parameter per file left behind (`FileCleanup` reads them). */
export function withLeftFiles(path: string, left: readonly string[]) {
  return left.reduce(
    (url, name) => `${url}&file=${encodeURIComponent(name)}`,
    path,
  );
}
