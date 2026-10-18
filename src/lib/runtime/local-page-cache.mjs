/**
 * The page cache on a developer's computer (`npm run demo:review`,
 * `npm start`; never on Vercel, where Vercel keeps the pages): Next's
 * `cacheHandler` (review fixes PR-C, `next.config.ts`).
 *
 * Why not Next's own file cache: it compares a page's save time (the wall
 * clock) with a board save's time (a clock that, under WSL, falls seconds to
 * minutes behind the wall clock the longer the server runs), so a page built
 * just before a save could keep showing the old text after it. Here a save
 * simply removes every page that used one of its tags, and nothing is written
 * to disk, so restarting the server always starts from the sample data again.
 */

/** @type {Map<string, { value: unknown, lastModified: number, tags: string[] }>} */
const entries = new Map();

/** The tags a cached page or reply depends on, including its path tags. */
function tagsOf(data, ctx) {
  const header = data?.headers?.["x-next-cache-tags"];
  return [
    ...(typeof header === "string" ? header.split(",") : []),
    ...(ctx?.tags ?? []),
    ...(ctx?.softTags ?? []),
  ];
}

export default class LocalPageCache {
  async get(key) {
    return entries.get(key) ?? null;
  }

  async set(key, data, ctx) {
    if (data === null) entries.delete(key);
    else
      entries.set(key, {
        value: data,
        lastModified: Date.now(),
        tags: tagsOf(data, ctx),
      });
  }

  async revalidateTag(tags) {
    const gone = new Set([tags].flat());
    for (const [key, entry] of entries)
      if (entry.tags.some((tag) => gone.has(tag))) entries.delete(key);
  }

  resetRequestCache() {}
}
