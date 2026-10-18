import type { ResourcesContent } from "@/lib/content/schemas";
import { isExternalHref, safeHref } from "@/lib/url";

export type ResourceItem = ResourcesContent["items"][number];

/** A resource category as visitors see it: its slug and its name (the board's Lists). */
export type ResourceCategory = { slug: string; name: string };

/** A category's name ("All" for every category); "" for one not in the list. */
export function categoryLabel(
  categories: readonly ResourceCategory[],
  slug: string,
) {
  if (slug === "all") return "All";
  return categories.find((category) => category.slug === slug)?.name ?? "";
}

/** A resource's safe link, or null when it has none (it is then not shown). */
export function resourceLink(resource: ResourceItem) {
  const href = safeHref(resource.resource_url);
  return href ? { href, external: isExternalHref(href) } : null;
}

/**
 * What visitors see (review fixes PR-1): only resources with a working link
 * that are not archived. The rest stay in Pages → Resources.
 */
export function shownResources(resources: ResourceItem[]) {
  return resources.filter(
    (resource) => !resource.archived && resourceLink(resource) !== null,
  );
}

/** Client-side search over title, description and category name (no index, no API). */
export function filterResources(
  resources: ResourceItem[],
  category: string,
  query: string,
  categories: readonly ResourceCategory[] = [],
) {
  const search = query.trim().toLowerCase();
  return resources.filter(
    (resource) =>
      (category === "all" || resource.category === category) &&
      (!search ||
        `${resource.title} ${resource.description} ${categoryLabel(categories, resource.category)}`
          .toLowerCase()
          .includes(search)),
  );
}

/** How many resources sit in each category, plus "all". */
export function categoryCounts(resources: ResourceItem[]) {
  const counts: Record<string, number> = { all: resources.length };
  for (const resource of resources)
    counts[resource.category] = (counts[resource.category] ?? 0) + 1;
  return counts;
}

/**
 * The button of an issue, by what it is (review fixes P3): "Open PDF" for a
 * PDF, "View image" for an image (an uploaded one is WebP), else "Visit link".
 */
export function newsletterButton(href: string) {
  const path = href.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".pdf")) return "Open PDF";
  if (/\.(webp|png|jpe?g)$/.test(path)) return "View image";
  return "Visit link";
}
