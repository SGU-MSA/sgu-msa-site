"use client";

import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { externalLinkProps } from "@/lib/url";
import { InkRing } from "@/shared/ui/InkRing";
import { ArchiveTag } from "@/shared/ui/Meta";

import {
  categoryCounts,
  categoryLabel,
  filterResources,
  resourceLink,
  type ResourceCategory,
  type ResourceItem,
} from "./library";
import r from "./resources.module.css";

type ResourceExplorerProps = {
  resources: ResourceItem[];
  /** The board's resource categories, in their order (Lists, review fixes P3). */
  categories: readonly ResourceCategory[];
  placeholder: string;
  emptyMessage: string;
  /** Optional deep-link, e.g. /resources?category=newsletter */
  initialCategory?: string;
};

/**
 * "The Index" (PR8 D-4): a library catalogue. Search and categories down a
 * quiet left column (the chosen one circled in ink), resources as numbered
 * ruled entries, words before pictures.
 */
export function ResourceExplorer({
  resources,
  categories,
  placeholder,
  emptyMessage,
  initialCategory = "all",
}: ResourceExplorerProps) {
  const counts = useMemo(() => categoryCounts(resources), [resources]);
  // A category with nothing shown in it is no filter for visitors (review fixes PR-1).
  const offered = categories
    .map((item) => item.slug)
    .filter((key) => (counts[key] ?? 0) > 0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(
    offered.includes(initialCategory) ? initialCategory : "all",
  );
  const filtered = useMemo(
    () => filterResources(resources, category, query, categories),
    [categories, category, query, resources],
  );

  return (
    <div className={r.index}>
      <div className={r.side}>
        <label className={r.search}>
          <span className="sr-only">Search resources</span>
          <Search
            aria-hidden="true"
            className={r.searchIcon}
            strokeWidth={1.4}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className={r.searchInput}
          />
        </label>

        {offered.length ? (
          <div role="group" aria-label="Resource category" className={r.cats}>
            {["all", ...offered].map((key) => {
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(key)}
                  className={r.cat}
                >
                  <span className={r.catLabel}>
                    {active ? <InkRing className={r.catRing} /> : null}
                    {categoryLabel(categories, key)}
                  </span>
                  <span className={r.catCount} aria-hidden="true">
                    {counts[key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <p aria-live="polite" className={r.count}>
          {filtered.length} {filtered.length === 1 ? "resource" : "resources"}
        </p>
      </div>

      <div>
        {filtered.length ? (
          <ol className={r.entries}>
            {filtered.map((resource, index) => (
              <li key={resource.id} className={r.entry}>
                <span className={r.num} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={r.body}>
                  <h2 className={r.title}>{resource.title}</h2>
                  <p className={r.desc}>{resource.description}</p>
                </div>
                <div className={r.facts}>
                  {categoryLabel(categories, resource.category) ? (
                    <p className={r.meta}>
                      {categoryLabel(categories, resource.category)}
                    </p>
                  ) : null}
                  <p className={r.updated}>
                    {resource.updated_label ?? "SGU MSA resource"}
                  </p>
                  {resource.image?.historical ? (
                    <ArchiveTag year={resource.image.year} />
                  ) : null}
                </div>
                <div className={r.action}>
                  <ResourceAction resource={resource} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={r.empty}>
            <p className={r.emptyTitle}>{emptyMessage}</p>
            <p className={r.emptyHint}>Try a different search or category.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Opens a resource (visitors only see resources with a link: `shownResources`). */
function ResourceAction({ resource }: { resource: ResourceItem }) {
  const link = resourceLink(resource);
  if (!link) return null;
  return (
    <Link
      href={link.href}
      {...(link.external ? externalLinkProps(link.href) : {})}
      aria-label={`Open ${resource.title}`}
      className={r.open}
    >
      Open
      <ArrowUpRight aria-hidden="true" className={r.icon} strokeWidth={1.4} />
    </Link>
  );
}
