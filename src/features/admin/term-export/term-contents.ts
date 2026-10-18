import { csvFile } from "@/lib/csv";
import type { ResourcesContent } from "@/lib/content/schemas";
import { formatTimeOfDay } from "@/lib/time/time-of-day";
import { CATEGORIES, go2payPageUrl } from "@/lib/community/payment-policy";
import {
  currentLinks,
  type PaymentItem,
  type PaymentItemLink,
} from "@/lib/community/payments";
import type { Person, Section } from "@/lib/community/people";
import {
  eventStatusNames,
  localDate,
  type CommunityRecord,
} from "@/lib/community/schema";
import { eventEntry } from "@/lib/community/event-entry";
import type { Lists } from "@/lib/community/lists";
import { categoryLabel } from "@/features/resources/library";
import { collectionLabels } from "../fields";
import type { TermExport } from "./term-form";

/**
 * The term export (review fixes P5, the approved plan of 2026-10-07): a
 * term's records and files as one zip the board keeps outside the website.
 * Pure and browser-safe: what is in the zip, under which names, and the
 * spreadsheets' rows. The route reads the data and the files; the zip is
 * built while it downloads and never stored.
 */

/**
 * A name that is safe as a file or folder name on Windows, macOS and phones:
 * no slashes or other reserved characters, no leading or trailing dots or
 * spaces, at most 80 characters.
 */
export function safeName(text: string, fallback = "Untitled"): string {
  const cleaned = text
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/^[\s.]+|[\s.]+$/g, "");
  return cleaned || fallback;
}

/**
 * The zip's folders, `Year/Term` (the plan's "2026 → Fall"): the year of the
 * From day, then the term's name without that year ("2026 Fall" and "Fall
 * 2026" both give `2026/Fall`). A name that is only the year keeps it.
 */
export function termFolder(term: Pick<TermExport, "name" | "from">): string {
  const year = term.from.slice(0, 4);
  const withoutYear = term.name
    .replace(new RegExp(`(^|\\s)${year}(?=\\s|$)`), " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
  return `${year}/${safeName(withoutYear || term.name)}`;
}

/** The zip's own name: the term's name ("2026 Fall.zip"). */
export const zipFileName = (term: Pick<TermExport, "name">) =>
  `${safeName(term.name, "Term")}.zip`;

/** The three dated lists in the zip ("events, news, newsletters"). */
export const datedLists = ["events", "news_posts", "newsletters"] as const;
export type DatedList = (typeof datedLists)[number];

/** Everything one term's zip holds, read by the route as the board member. */
export type TermData = {
  records: Record<
    DatedList,
    readonly (CommunityRecord & { id: string; archived_at: string | null })[]
  >;
  /** Season names by id (an event's or a fund's season). */
  seasons: ReadonlyMap<string, string>;
  /** Every person, current and archived, and every group. */
  people: readonly (Person & { archived_at: string | null })[];
  sections: readonly (Section & { archived_at: string | null })[];
  /** Every fund, ticket and merch size, current and archived, with every link. */
  paymentItems: readonly (PaymentItem & { archived_at: string | null })[];
  links: readonly PaymentItemLink[];
  /** Pages → Resources' items, archived ones included. */
  resources: ResourcesContent["items"];
  /** The Lists, for each event's category and term and each resource's category. */
  lists: Lists;
};

/** A stored photo or PDF the zip carries, and where it goes in the zip. */
export type TermFile = { name: string; path: string };

/** A spreadsheet of the zip: its path in the term folder and its text. */
export type TermSheet = { path: string; text: string };

const yesNo = (value: boolean) => (value ? "Yes" : "No");
/** An archive stamp as the day it happened in Grenada, or "". */
const archivedOn = (stamp: string | null) =>
  stamp ? localDate(new Date(stamp)) : "";
const timeText = (time: string | null | undefined) =>
  time ? formatTimeOfDay(time) : "";
const storedFile = (src: string | null | undefined) =>
  src?.startsWith("/media/") ? src.slice("/media/".length) : "";

/**
 * Gives every file one path in the zip: `<folder>/<base>.<ext>`, with
 * " (2)", " (3)" … when a name is taken (Windows ignores letter case). A
 * file used twice keeps its first path.
 */
function fileNamer() {
  const files: TermFile[] = [];
  const byName = new Map<string, string>();
  const taken = new Set<string>();
  const place = (name: string, folder: string, base: string) => {
    if (!name) return "";
    const known = byName.get(name);
    if (known) return known;
    const extension = name.slice(name.lastIndexOf("."));
    const stem = safeName(base);
    let path = `${folder}/${stem}${extension}`;
    for (let n = 2; taken.has(path.toLowerCase()); n++)
      path = `${folder}/${stem} (${n})${extension}`;
    taken.add(path.toLowerCase());
    byName.set(name, path);
    files.push({ name, path });
    return path;
  };
  return { files, place };
}

/**
 * The zip's spreadsheets and the files to put beside them: Events, News
 * and Newsletters dated in the term (current and archived), and the whole
 * People, Funds and Resources lists as they are on the day of the export
 * (they have no date). Each row names its photo and PDF by their path in
 * the zip, so the spreadsheet and the files go together.
 */
export function termContents(data: TermData): {
  sheets: TermSheet[];
  files: TermFile[];
} {
  const { files, place } = fileNamer();
  const sheets: TermSheet[] = [];
  const sheet = (
    name: string,
    header: readonly string[],
    rows: readonly (readonly string[])[],
  ) =>
    sheets.push({
      path: `${name}.csv`,
      text: csvFile(header, rows, { bom: true }),
    });

  for (const list of datedLists) {
    // Each list's spreadsheet and folder are named as on the dashboard.
    const folder = collectionLabels[list];
    const event = list === "events";
    const rows = data.records[list].map((record) => {
      const base = `${record.date} ${record.title}`;
      const photo = place(record.image_path, folder, base);
      const pdf = place(record.file_path, folder, base);
      const shown = event ? eventEntry(record, data.lists) : null;
      return [
        record.title,
        record.date,
        ...(event
          ? [
              record.end_date ?? "",
              timeText(record.start_time),
              timeText(record.end_time),
              record.location,
              eventStatusNames[record.status],
              record.status_note,
              data.seasons.get(record.season_id) ?? "",
              shown?.category_name ?? "",
              shown?.term_name ?? "",
            ]
          : []),
        record.summary,
        record.body,
        record.url,
        yesNo(record.published),
        record.expires_on ?? "",
        archivedOn(record.archived_at),
        photo,
        photo ? record.image_alt : "",
        pdf,
      ];
    });
    sheet(
      folder,
      [
        "Title",
        "Date",
        ...(event
          ? [
              "End date",
              "Start time",
              "End time",
              "Place",
              "Status",
              "Reason",
              "Season",
              "Category",
              "Term",
            ]
          : []),
        "Summary",
        "Details",
        "Link",
        "Published",
        "Hide after",
        "Archived on",
        "Photo",
        "Photo description",
        "PDF",
      ],
      rows,
    );
  }

  const groups = [...data.sections].sort(
    (a, b) =>
      Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)) ||
      a.position - b.position,
  );
  const groupOrder = new Map(groups.map((group, at) => [group.id, at]));
  const people = [...data.people].sort(
    (a, b) =>
      Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)) ||
      (groupOrder.get(a.section_id) ?? 0) -
        (groupOrder.get(b.section_id) ?? 0) ||
      a.position - b.position,
  );
  sheet(
    "People",
    [
      "Name",
      "Group",
      "Role",
      "Shown on the About page",
      "Archived on",
      "Photo",
    ],
    people.map((person) => [
      person.full_name,
      data.sections.find((group) => group.id === person.section_id)?.name ?? "",
      person.role_title,
      yesNo(person.show_on_public),
      archivedOn(person.archived_at),
      place(person.photo_path, "People", person.full_name),
    ]),
  );

  const links = currentLinks(data.links);
  const items = [...data.paymentItems].sort(
    (a, b) =>
      Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)) ||
      a.kind.localeCompare(b.kind) ||
      a.position - b.position,
  );
  sheet(
    "Funds",
    [
      "Name",
      "Type",
      "Category",
      "About",
      "Shown",
      "Show from",
      "Show until",
      "Season",
      "Go2Pay page",
      "Archived on",
    ],
    items.map((item) => {
      const link = links.get(item.id);
      return [
        item.size_label ? `${item.name} (${item.size_label})` : item.name,
        item.kind === "fund"
          ? "Fund"
          : item.merch_item_id
            ? "Merch size"
            : "Ticket",
        CATEGORIES[item.category].tag,
        item.about,
        yesNo(item.listed),
        item.shows_from ?? "",
        item.shows_until ?? "",
        data.seasons.get(item.season_id) ?? "",
        link ? go2payPageUrl(link.go2pay_product_id) : "",
        archivedOn(item.archived_at),
      ];
    }),
  );

  sheet(
    "Resources",
    [
      "Title",
      "Category",
      "Description",
      "Link",
      "Updated",
      "Archived",
      "Photo",
    ],
    data.resources.map((resource) => [
      resource.title,
      categoryLabel(data.lists.resource_categories, resource.category) ||
        resource.category,
      resource.description,
      resource.resource_url ?? "",
      resource.updated_label ?? "",
      yesNo(resource.archived),
      place(storedFile(resource.image?.src), "Resources", resource.title),
    ]),
  );
  return { sheets, files };
}

/** The list of files that could not be found while the zip was made. */
export function missingFilesSheet(paths: readonly string[]): TermSheet {
  return {
    path: "Files not found.csv",
    text: csvFile(
      ["File"],
      paths.map((path) => [path]),
      { bom: true },
    ),
  };
}
