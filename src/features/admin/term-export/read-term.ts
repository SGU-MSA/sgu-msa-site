import "server-only";
import {
  listAdminListOptions,
  listAdminPeople,
  listAdminSections,
  readAdminPageText,
} from "@/lib/backend/admin-content";
import {
  allAdminPaymentItems,
  listAdminSeasons,
} from "@/lib/backend/admin-payments";
import type { DayRange } from "@/lib/backend/providers/contract";
import { groupLists } from "@/lib/community/lists";
import { contentEditor } from "@/lib/runtime/providers";
import { datedLists, type DatedList, type TermData } from "./term-contents";

/**
 * Everything one term's zip holds (review fixes P5), read through the ports
 * as the signed-in board member: the events, community news and newsletters
 * dated in `range` (current and archived), every person and group, every
 * fund, ticket and merch size with their Go2Pay links, the season names,
 * Pages → Resources and the Lists. Null when any of it cannot be read: a zip must never
 * look complete while a list is missing.
 */
export async function readTerm(range: DayRange): Promise<TermData | null> {
  const [records, seasons, people, sections, payments, resources, lists] =
    await Promise.all([
      Promise.all(
        datedLists.map((kind) => contentEditor().listRecordsDated(kind, range)),
      ),
      Promise.all([listAdminSeasons(), listAdminSeasons("archived")]),
      Promise.all([listAdminPeople(), listAdminPeople("archived")]),
      Promise.all([listAdminSections(), listAdminSections("archived")]),
      allAdminPaymentItems(),
      readAdminPageText("resources"),
      listAdminListOptions(),
    ]);
  if (
    records.some((read) => read.unavailable) ||
    seasons.some((read) => read.unavailable) ||
    people.some((read) => read.unavailable) ||
    sections.some((read) => read.unavailable) ||
    payments.unavailable ||
    !resources ||
    lists.unavailable
  )
    return null;
  return {
    records: Object.fromEntries(
      datedLists.map((kind, at) => [kind, records[at].records]),
    ) as Record<DatedList, (typeof records)[number]["records"]>,
    seasons: new Map(
      seasons.flatMap((read) =>
        read.seasons.map((season) => [season.id, season.name] as const),
      ),
    ),
    people: people.flatMap((read) => read.people),
    sections: sections.flatMap((read) => read.sections),
    paymentItems: payments.items,
    links: payments.links,
    resources: resources.document.items,
    lists: groupLists(lists.options),
  };
}
