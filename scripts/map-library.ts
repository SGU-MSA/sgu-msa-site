import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mapLibraryFiles, mapLibraryFolder } from "../src/lib/maps/style";

/**
 * PR7: the map library and its worker are served from this site as the
 * installed package ships them (one shared file for both; CSP `worker-src
 * 'self'`, no blob). next.config.ts runs this on every `next dev`, `build`
 * and `start`, and .storybook/main.ts before Storybook, so the copy in
 * public/maplibre (gitignored) always matches package.json. A folder that
 * cannot be written (a running deployment) already has them from the build.
 */
export function copyMapLibrary(root = process.cwd()): void {
  const folder = join(root, "public", mapLibraryFolder);
  try {
    mkdirSync(folder, { recursive: true });
    for (const file of mapLibraryFiles)
      copyFileSync(
        join(root, "node_modules/maplibre-gl/dist", file),
        join(folder, file),
      );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS") return;
    const kept = mapLibraryFiles.every((file) =>
      existsSync(join(folder, file)),
    );
    if ((code === "EACCES" || code === "EPERM") && kept) return;
    throw error;
  }
}
