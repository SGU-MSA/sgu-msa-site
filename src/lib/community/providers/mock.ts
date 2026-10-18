import "server-only";
import { documentNamesPhoto } from "../../content/page-fields";
import { sandboxVerseLibrary } from "../../demo/quran";
import { sandboxStore, type SandboxStore } from "../../demo/store";
import { groupLists } from "../lists";
import { groupTeam, publicTeamRows } from "../people";
import {
  collections,
  compareByDate,
  dateAscending,
  isVisible,
  prayerSettingsSchema,
  recordFromRow,
} from "../schema";
import type { ContentProvider, Provenance } from "./contract";

const provenance: Provenance = "sample";

const teamRows = (store: SandboxStore) =>
  publicTeamRows([...store.sections.values()], [...store.people.values()]);

/**
 * Public reads of the local sandbox (D-6): the in-memory store, seeded from
 * the fixtures at `now` (the sample clock), so public pages show sandbox
 * edits. Mirrors the anonymous database rules: published, not archived rows
 * only, in the database's order; the listed team (`public_team()`);
 * media only while a visible record or a listed team photo references it.
 * Never writes a database.
 */
export function createMockContentProvider(now: Date): ContentProvider {
  const instant = new Date(now);
  const store = () => sandboxStore(instant);
  return {
    async getRecords(kind) {
      const records = [...store().records[kind].values()]
        .filter((row) => row.published && !row.archived_at)
        .map(recordFromRow)
        .sort(compareByDate(dateAscending(kind, "public")));
      return { records, unavailable: false, provenance };
    },
    async getPrayerSettings() {
      return {
        // The same tolerant read as the database adapter (PR4 D-14).
        settings: prayerSettingsSchema.parse(store().prayer.settings),
        unavailable: false,
        provenance,
      };
    },
    async getMedia(name) {
      const sandbox = store();
      const media = sandbox.media.get(name);
      const referenced =
        collections.some((kind) =>
          [...sandbox.records[kind].values()].some(
            (row) =>
              (row.image_path === name || row.file_path === name) &&
              isVisible(row, kind, instant),
          ),
        ) ||
        teamRows(sandbox).some((row) => row.photo_path === name) ||
        // A photo a page's text names (PR5b, `page_text_names_file()`).
        [...sandbox.pageTexts.values()].some((row) =>
          documentNamesPhoto(row.document, name),
        ) ||
        // PR5c: a season with a page, a current merch item in a current collection.
        [...sandbox.seasons.values()].some(
          (row) =>
            !row.archived_at &&
            row.has_page &&
            documentNamesPhoto(row.photos, name),
        ) ||
        [...sandbox.merchItems.values()].some(
          (row) =>
            !row.archived_at &&
            !sandbox.merchCollections.get(row.collection_id)?.archived_at &&
            documentNamesPhoto(row.photos, name),
        );
      return {
        file:
          media && referenced
            ? new Blob([media.bytes], { type: media.contentType })
            : null,
        unavailable: false,
        provenance,
      };
    },
    async getTeam() {
      return {
        sections: groupTeam(teamRows(store())),
        unavailable: false,
        provenance,
      };
    },
    async getVerse(reference) {
      return {
        verse:
          sandboxVerseLibrary.find((verse) => verse.reference === reference) ??
          null,
        unavailable: false,
        provenance,
      };
    },
    async getLists() {
      return {
        lists: groupLists([...store().listOptions.values()]),
        unavailable: false,
        provenance,
      };
    },
    async getVerseLibrary() {
      return {
        verses: [...sandboxVerseLibrary],
        unavailable: false,
        provenance,
      };
    },
    async getStorageUse() {
      let bytes = 0;
      for (const file of store().media.values()) bytes += file.bytes.length;
      return { bytes, provenance };
    },
  };
}
